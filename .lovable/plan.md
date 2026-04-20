

## Revisão estrutural — Módulo Fiscal

Banco hoje: 0 NFs, CHECK em `notas_fiscais.status` aceita só **3 valores** (`rascunho`, `confirmada`, `cancelada`), enquanto o front (`fiscalStatus.ts`) trabalha com **9** (`pendente, rascunho, confirmada, autorizada, importada, rejeitada, cancelada, cancelada_sefaz, inutilizada`). A RPC `gerar_nf_de_pedido` insere `status='pendente'` — viola o CHECK atual. RPC `confirmar_nota_fiscal` aceita "qualquer status ≠ confirmada/cancelada" sem máquina de estados. `estornar_nota_fiscal` faz `DELETE` em `financeiro_lancamentos` (perde rastreabilidade — deveria usar `cancelar_lancamento`). Não há trigger anti-DELETE em `notas_fiscais`. Não há gate impedindo edição de NF confirmada/autorizada. Sem `unique` em `(modelo,serie,numero)` ou `chave_acesso`.

Plano executa apenas o necessário para alinhar banco+RPCs+front, preservando arquitetura.

---

### Máquina de estados oficial

**Status interno do ERP** (`notas_fiscais.status`) — ciclo operacional:

```text
rascunho → pendente → confirmada → cancelada
                  └→ cancelada (cancelamento antes de confirmar)
importada (terminal alternativo, para NFs externas via XML)
```

- `rascunho`: edição livre, nenhum efeito.
- `pendente`: criada por automação (ex.: `gerar_nf_de_pedido`); dados estruturais prontos, ainda não impacta estoque/financeiro. Editável.
- `confirmada`: efeitos operacionais aplicados (estoque + financeiro + faturamento OV). Estruturalmente travada.
- `importada`: NF de fornecedor importada via XML; somente leitura, pode movimentar estoque/financeiro de entrada conforme flags.
- `cancelada`: terminal local. Sem efeitos vigentes.

**Status fiscal SEFAZ** (`notas_fiscais.status_sefaz`) — ciclo eletrônico, ortogonal:

```text
nao_enviada → em_processamento → autorizada
                              └→ rejeitada (volta a nao_enviada após correção)
                              └→ denegada (terminal)
autorizada → cancelada_sefaz (terminal)
nao_enviada → inutilizada (terminal, faixa numérica não usada)
importada_externa (terminal, NF de terceiro)
```

**Relação oficial**:
- Confirmação interna **sempre** antecede envio à SEFAZ. CHECK estrutural: `status_sefaz IN ('autorizada','em_processamento','cancelada_sefaz') ⇒ status='confirmada'`.
- `inutilizada` só permitida quando `status='rascunho'` ou `status='cancelada'`.
- NF `importada` (XML externo) entra com `status='importada'` + `status_sefaz='importada_externa'` (novo valor).

---

### Migrations (ordem, idempotentes, `SET search_path=public`)

**1. `fiscal_status_canonico`**
- DROP `chk_notas_fiscais_status` antigo; CREATE com `('rascunho','pendente','confirmada','importada','cancelada')`.
- DROP `chk_notas_fiscais_status_sefaz` antigo; CREATE com `('nao_enviada','em_processamento','autorizada','rejeitada','denegada','cancelada_sefaz','inutilizada','importada_externa')`.
- CHECK composto `chk_nf_coerencia_sefaz`: `(status_sefaz IN ('autorizada','em_processamento','cancelada_sefaz') AND status='confirmada') OR status_sefaz NOT IN ('autorizada','em_processamento','cancelada_sefaz')`.
- CHECK `chk_nf_inutilizacao`: `status_sefaz='inutilizada' ⇒ status IN ('rascunho','cancelada')`.
- CHECK `chk_nf_importada`: `status='importada' ⇒ status_sefaz='importada_externa'`.
- Trigger `trg_nf_status_transicao BEFORE UPDATE OF status`: bloqueia transições inválidas (sai de `confirmada` só via `estornar_nota_fiscal`; sai de `cancelada`/`importada` proibido).

**2. `fiscal_origem_canonica`**
- CHECK `chk_nf_origem` em `notas_fiscais.origem`: `('manual','xml_importado','pedido','devolucao','importacao_historica','sefaz_externa')`.
- Reforço de FK `nf_referenciada_id` (já existe) + CHECK `chk_nf_devolucao_referencia`: `tipo_operacao='devolucao' ⇒ nf_referenciada_id IS NOT NULL`.
- Backfill: notas com `origem IS NULL` → `'manual'`.

**3. `fiscal_protege_delete_edicao`**
- Trigger `trg_nf_protege_delete BEFORE DELETE`: permite DELETE apenas em `status='rascunho' AND status_sefaz='nao_enviada'`. Para demais casos, exige `cancelar_nota_fiscal` ou `inutilizar_nota_fiscal`.
- Trigger `trg_nf_itens_protege_edicao BEFORE INSERT/UPDATE/DELETE` em `notas_fiscais_itens`: bloqueia mutações quando NF.status ∈ (`confirmada`,`importada`,`cancelada`) E não está em fluxo de devolução/estorno (verifica via flag `current_setting('app.nf_internal_op',true)='1'` setado pelas RPCs).
- Trigger análogo em `notas_fiscais` para colunas estruturais (`valor_total`, `chave_acesso`, partner ids) — bloqueia UPDATE quando confirmada/importada/cancelada.

**4. `fiscal_unicidade`**
- UNIQUE INDEX `ux_nf_chave_acesso (chave_acesso) WHERE chave_acesso IS NOT NULL` (idempotência fiscal).
- UNIQUE INDEX `ux_nf_modelo_serie_numero_tipo (modelo_documento, serie, numero, tipo) WHERE numero IS NOT NULL AND ativo` (impede duplicidade de numeração).

**5. `fiscal_rpcs_v2`** — `CREATE OR REPLACE`:
- `confirmar_nota_fiscal`:
  - Gate explícito: aceita só `status IN ('rascunho','pendente')`.
  - `pg_advisory_xact_lock(hashtext('nf:'||p_nf_id::text))` para idempotência sob concorrência.
  - Mantém idempotência por `NOT EXISTS` em `estoque_movimentos` e `financeiro_lancamentos`.
  - Seta `app.nf_internal_op='1'` para liberar inserts de itens nos triggers (não aplicável aqui, mas padroniza).
  - Insere em `auditoria_logs` (já existe a tabela) com `acao='confirmar_nf'`.
- `estornar_nota_fiscal`:
  - Substitui `DELETE FROM financeiro_lancamentos` por `PERFORM financeiro_cancelar_lancamento(id, 'Estorno NF '||numero)` para cada lançamento em aberto da NF (preserva trilha financeira).
  - Mantém movimentos opostos em estoque com `documento_tipo='fiscal_estorno'` (já faz).
  - Reverte `quantidade_faturada` na OV vinculada e recalcula `status_faturamento` (hoje não faz — bug).
  - Insere `nota_fiscal_eventos` + `auditoria_logs`.
- `gerar_devolucao_nota_fiscal`:
  - Adiciona validação: somatório de quantidade já devolvida + nova ≤ quantidade da NF origem (consulta NFs filhas com `nf_referenciada_id=p_nf_origem_id` e `tipo_operacao='devolucao'` não canceladas).
  - Insere em `auditoria_logs`.
- Nova RPC `cancelar_nota_fiscal(p_nf_id, p_motivo)`: cancela NF não confirmada (status `rascunho`/`pendente`) ou NF confirmada **sem** SEFAZ autorizada; bloqueia cancelamento se `status_sefaz='autorizada'` (deve ir por `cancelar_nota_fiscal_sefaz`). Estorna efeitos via `estornar_nota_fiscal` quando `status='confirmada'`.
- Nova RPC `cancelar_nota_fiscal_sefaz(p_nf_id, p_protocolo, p_motivo)`: aceita só `status_sefaz='autorizada'`; seta `status_sefaz='cancelada_sefaz'`, mantém `status='confirmada'` (por integridade contábil; estorno separado se desejado), grava evento + auditoria.
- Nova RPC `inutilizar_nota_fiscal(p_nf_id, p_protocolo, p_motivo)`: aceita só `status IN ('rascunho','cancelada') AND status_sefaz='nao_enviada'`; seta `status_sefaz='inutilizada'`, evento, auditoria.

**6. `fiscal_evento_canonico`**
- CHECK `chk_nf_eventos_tipo` em `nota_fiscal_eventos.tipo_evento`: `('criacao','edicao','confirmacao','estorno','autorizacao_sefaz','rejeicao_sefaz','cancelamento','cancelamento_sefaz','inutilizacao','criacao_devolucao','importacao_xml','anexo_adicionado')`.
- Triggers `AFTER UPDATE OF status,status_sefaz ON notas_fiscais` gravando `nota_fiscal_eventos` automaticamente quando muda — substitui inserts ad-hoc dispersos em RPCs (mantidos como complemento descritivo).

**7. `fiscal_integridade_relacional`**
- Confirmar/adicionar FK `notas_fiscais.transportadora_id → transportadoras(id) ON DELETE SET NULL`.
- Confirmar/adicionar FK `notas_fiscais.conta_contabil_id → contas_contabeis(id) ON DELETE SET NULL`.
- Confirmar `notas_fiscais.ordem_venda_id → ordens_venda(id) ON DELETE SET NULL`.
- View `v_trilha_fiscal` (security_invoker): `nf_id, numero, status, status_sefaz, ordem_venda_id, financeiro_lancamento_ids, estoque_movimento_ids, devolucoes_ids, eventos_count`.

Sem migration de dados (banco vazio); apenas defaults futuros.

---

### Política oficial — exclusão / cancelamento / inutilização / estorno

| Operação | Quando aplicar | Como |
|---|---|---|
| **DELETE físico** | Só `status='rascunho' AND status_sefaz='nao_enviada'` | DELETE direto (trigger libera) |
| **Cancelamento interno** | NF não enviada à SEFAZ ou rejeitada/denegada | `cancelar_nota_fiscal()` — estorna efeitos se confirmada |
| **Cancelamento SEFAZ** | NF `status_sefaz='autorizada'` dentro do prazo legal | `cancelar_nota_fiscal_sefaz()` — comunica SEFAZ via edge function, atualiza `status_sefaz='cancelada_sefaz'` |
| **Inutilização** | Faixa numérica nunca usada/cancelada | `inutilizar_nota_fiscal()` — só com `status_sefaz='nao_enviada'` |
| **Estorno operacional** | Reverter efeitos sem cancelar (correção interna) | `estornar_nota_fiscal()` — só para `status='confirmada' AND status_sefaz NOT IN ('autorizada','em_processamento')` |
| **Devolução** | Documento derivado da NF origem | `gerar_devolucao_nota_fiscal()` — origem deve estar `confirmada`, soma de devoluções ≤ qtd origem |

---

### Código afetado (front)

- `src/lib/fiscalStatus.ts` — adicionar `importada_externa` ao `fiscalSefazStatusOptions`. Já está alinhado no resto.
- `src/services/fiscal.service.ts` — `processarEstorno` continua válido. Adicionar `cancelarNotaFiscal(id, motivo)`, `cancelarNFSefaz(id, protocolo, motivo)`, `inutilizarNF(id, protocolo, motivo)`.
- `src/components/fiscal/NotaFiscalDrawer.tsx` — botão "Cancelar" condicional pelo `status` real (não só `selected.status`); adicionar ações "Cancelar SEFAZ" e "Inutilizar" quando aplicável (gates já documentados em `fiscalStatus.ts`).
- `src/components/fiscal/NotaFiscalEditModal.tsx` — passar a respeitar `isFiscalStructurallyLocked` (já existe) bloqueando edição de cabeçalho/itens em `confirmada`/`importada`.
- `src/services/fiscal/sefaz/autorizacao.service.ts` e `cancelamento.service.ts` — após retorno da SEFAZ, gravar via novas RPCs (`cancelar_nota_fiscal_sefaz`) em vez de UPDATE direto.
- `src/pages/fiscal/hooks/useNotaFiscalLifecycle.ts` — adicionar `useCancelarNF`, `useCancelarNFSefaz`, `useInutilizarNF`.

### Documentação

- `docs/fiscal-modelo-estrutural.md` (novo): máquina de estados (interna + SEFAZ), tabela de transições válidas, política de exclusão/cancelamento/inutilização, política de devolução, política de estorno, regras de coerência (CHECKs documentados).
- `docs/MIGRACAO.md` — apêndice com as 7 migrations.

### Backfills

- Nenhum dado de NF a migrar (banco vazio).
- `origem IS NULL` → `'manual'` (precaução para inserts antigos não verificados).

### Pontos para revisão manual

- Quando começarem a entrar NFs reais, conferir se há fluxos legados criando `status='pendente'` em direção à SEFAZ sem passar por `confirmar_nota_fiscal` (CHECK de coerência irá rejeitar).
- Edge function `sefaz-proxy` deve ser atualizada para chamar `cancelar_nota_fiscal_sefaz` em vez de UPDATE direto (próxima rodada se ainda houver UPDATE direto).

### Impacto no front

- Botão "Excluir" só aparece em rascunho não enviado; demais casos viram "Cancelar"/"Cancelar SEFAZ"/"Inutilizar" conforme contexto.
- Modal de edição respeita lock estrutural — campos de cabeçalho/itens ficam read-only após confirmar/importar.
- Drawer ganha duas ações novas (Cancelar SEFAZ, Inutilizar) quando o estado permite.
- Estorno passa a preservar lançamentos financeiros (cancelados em vez de deletados); drawer financeiro vinculado mostrará histórico completo.
- Devolução rejeita quantidade que excede saldo devolvível.

### Fora de escopo

- DROP de colunas legadas em `notas_fiscais` (nenhuma identificada como morta).
- Reescrita do XML builder ou assinatura digital (já server-side em `sefaz-proxy`).
- Mudança em RLS (já adequada).
- Reenvio retroativo à SEFAZ (não há NFs).

