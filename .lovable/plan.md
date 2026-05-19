## Objetivo

Liberar para **Admin** e **Financeiro** a edição completa de itens, valores e formas de pagamento — tanto em **lançamentos financeiros** quanto em **entradas de NF** —, independentemente do status (confirmada, importada, paga, parcial, autorizada SEFAZ). O sistema deve propagar a edição para tudo que está conectado (parcelas, baixas, estoque, fatura de cartão) ou orientar o caminho seguro quando não for possível.

## Estado atual (diagnóstico)

**Travas que precisamos relaxar para Admin/Financeiro:**

1. `NotaFiscalForm.tsx` — `readOnly` quando `status_sefaz ∈ {autorizada, cancelada_sefaz, denegada}`. Só admin escapa, e apenas para `tipo = 'entrada'`. Saída autorizada fica travada para todos.
2. `FinanceiroLancamentoForm.tsx` — `STATUS_READONLY = {parcial, pago}` bloqueia todos os campos no submit (`disabled={isStatusReadonly}`), incluindo valor, vencimento, forma de pagamento, conta contábil.
3. `BaixaParcialDialog.tsx` — `isStatusBlocked` quando `pago | cancelado` impede registrar baixas adicionais ou corrigir uma baixa existente.
4. Trigger `trg_lancamento_status_requer_baixa` (memória de segurança) — bloqueia `UPDATE` direto de `status` para `pago/parcial` sem baixa. Correto para usuários normais, mas precisa de caminho admin para reabrir um lançamento sem precisar estornar manualmente.
5. NF de saída autorizada não tem fluxo "editar com cuidado": só Cancelar/Inutilizar.
6. Drawer do financeiro (`FinanceiroDrawer.tsx`) calcula `canBaixa` sem considerar override de admin/financeiro.

**O que já funciona e vamos reutilizar:**

- RPC `atualizar_financeiro_nota` já regenera parcelas/lançamentos da NF a partir de nova forma + condição + parcelas (idempotente).
- RPC `salvar_nota_fiscal` faz upsert atômico de cabeçalho + itens.
- RPC `processarEstorno` (`financeiro.service`) reverte baixas.
- Role `financeiro` já tem `financeiro:editar` em `permissions.ts`.

## Mudanças propostas

### 1. Política de edição privilegiada (frontend)

Criar `useCanEditFinanceiroAvancado()` em `src/hooks/` que retorne `true` para `isAdmin || hasRole('financeiro')`. Usar em:

- **`NotaFiscalForm.tsx`**
  - Substituir `isAdminEntradaOverride` por `canEditAvancado`.
  - Liberar override também para **NF de saída** quando `canEditAvancado === true`, mantendo o banner vermelho "Modo administrador" e listando os efeitos colaterais (estoque, financeiro, SEFAZ).
  - Quando a NF está autorizada na SEFAZ, exigir **confirmação dupla** (`useConfirmDestructive`) antes de salvar.
- **`FinanceiroLancamentoForm.tsx`**
  - `isStatusReadonly` continua para usuários comuns, mas com `canEditAvancado` o fieldset libera e exibe banner "Edição privilegiada — pode afetar baixas e fatura de cartão".
  - Permitir alterar `status` de `pago → aberto` (reabertura). Ao salvar, exibir confirmação destacando que as baixas associadas serão **estornadas automaticamente**.
- **`FinanceiroDrawer.tsx`**
  - `canBaixa`, `canEditar`, `canExcluir` calculados via `getFinanceiroPermissions` recebem também `canEditAvancado` e ignoram travas de status para esses dois papéis.
- **`BaixaParcialDialog.tsx`**
  - `isStatusBlocked` deixa de bloquear quando `canEditAvancado`. Permitir corrigir/ajustar uma baixa existente (ou registrar adicional em lançamento `pago` para encargos retroativos).

### 2. Persistência segura no backend (idempotente)

Migration nova com **uma RPC central** `editar_lancamento_financeiro_admin(p_id, p_payload jsonb, p_motivo text)`:

1. Verifica papel via `has_role(auth.uid(),'admin') OR has_role(auth.uid(),'financeiro')`. Caso contrário → `EXCEPTION` 42501.
2. Se houver baixas ativas e o payload mudar `valor` / `forma_pagamento` / `cartao_id` / `data_vencimento`, **estorna** baixas via `processar_estorno_lancamento` automaticamente e registra no `auditoria_log` com `p_motivo`.
3. Atualiza o lançamento (libera trigger via `SET LOCAL avizee.admin_override = on` lido pelo `trg_lancamento_status_requer_baixa` para pular a validação dentro desta RPC).
4. Re-resolve fatura de cartão (chamando `cartao_fatura_para_data`) se mudou cartão ou vencimento.

Equivalente para NF: estender `atualizar_financeiro_nota` ou criar wrapper `editar_nota_fiscal_admin(p_nf_id, p_payload, p_itens, p_parcelas, p_motivo)` que:

1. Checa o mesmo gate de papel.
2. Reverte efeitos da confirmação atual (estorno de estoque + financeiro) via `estornar_nota_fiscal`.
3. Chama `salvar_nota_fiscal` para cabeçalho + itens.
4. Re-confirma via `confirmar_nota_fiscal` (refazendo estoque e financeiro) ou apenas regrava forma/parcelas via `atualizar_financeiro_nota` se itens não mudaram.
5. Tudo na mesma transação. Falha → rollback completo.
6. Registra `auditoria_log` com `acao = 'nf_edicao_privilegiada'`, snapshot before/after e `motivo`.

### 3. Auditoria e UX de segurança

- Toda edição privilegiada exige **motivo (≥ 10 caracteres)** num `ConfirmDestructiveDialog` antes do submit.
- `useToast` ao final com resumo: "X parcelas regeneradas, Y baixas estornadas, estoque ajustado em Z itens".
- Nova aba "Histórico" no `FinanceiroDrawer` e na `NotaFiscalForm` lendo `auditoria_log` filtrado por `entidade_id`, para rastrear quem editou o quê.

### 4. Outras melhorias relacionadas (no mesmo espírito de destravar correções)

- **Reabrir NF cancelada/inutilizada (apenas interno, sem SEFAZ):** botão "Reabrir como rascunho" para Admin/Financeiro em NF com `status = cancelada` e `status_sefaz IS NULL OR rejeitada`.
- **Editar baixa existente:** hoje só dá para estornar e refazer. Adicionar "Editar baixa" no histórico do drawer (ajusta `valor_pago`, `data_pagamento`, `conta_bancaria_id`, encargos) via RPC `editar_baixa_admin`, mantendo idempotência do saldo.
- **Editar parcela isolada da NF sem regenerar tudo:** atualmente `atualizar_financeiro_nota` regrava todas as parcelas. Acrescentar `editar_parcela_nf(p_lancamento_id, p_payload)` para correção pontual de vencimento/valor de UMA parcela, atualizando o agrupador.
- **Vincular/desvincular lançamento avulso a uma NF:** útil quando o usuário criou manualmente e a NF chegou depois.
- **Lock visual claro:** banner amarelo sempre que o usuário está em "modo privilegiado", para evitar edição acidental.

## Detalhes técnicos

### Arquivos a editar

- `src/hooks/useCanEditFinanceiroAvancado.ts` (novo)
- `src/pages/fiscal/NotaFiscalForm.tsx` — substitui guard `isAdminEntradaOverride`
- `src/pages/financeiro/components/FinanceiroLancamentoForm.tsx` — libera `STATUS_READONLY` para papel
- `src/components/financeiro/FinanceiroDrawer.tsx` — propaga override em `canBaixa/canEditar`
- `src/components/financeiro/BaixaParcialDialog.tsx` — relaxa `isStatusBlocked`
- `src/lib/drawerPermissions.ts` — `getFinanceiroPermissions` aceita `canEditAvancado`
- `src/services/financeiro/lancamentos.ts` e `src/services/fiscal/lifecycle.service.ts` — wrappers para novas RPCs
- `src/pages/financeiro/hooks/useFinanceiroActions.ts` — rota submit por `editar_lancamento_financeiro_admin` quando privilegiado

### Migration

```sql
-- 1. Settings flag por transação para bypass controlado da trigger
CREATE OR REPLACE FUNCTION public.trg_lancamento_status_requer_baixa() ...
  IF current_setting('avizee.admin_override', true) = 'on' THEN RETURN NEW; END IF;
  ...

-- 2. RPCs editar_lancamento_financeiro_admin / editar_nota_fiscal_admin
--    editar_baixa_admin / editar_parcela_nf
-- Todas SECURITY DEFINER, SET search_path = public, gate por has_role.
-- Todas escrevem em auditoria_log com snapshot jsonb e motivo.
```

### Fora de escopo

- Reemissão SEFAZ automática após edição de NF autorizada (continua sendo cancelar + emitir nova).
- Conciliação bancária retroativa de baixas alteradas (só sinaliza no banner).
- Mudança nas regras de role para usuários não-admin/financeiro (ficam como hoje).
