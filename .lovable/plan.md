

# Revisão técnica e funcional — Módulo Financeiro

## 1) Visão geral do módulo

O módulo Financeiro está organizado em três páginas independentes:

- **`/financeiro` (Lançamentos)** — `src/pages/Financeiro.tsx` orquestra grid, filtros, KPIs, drawer de visualização, formulário de criação/edição, baixa parcial, baixa em lote e estorno, apoiado em hooks (`useFinanceiroFiltros`, `useFinanceiroKpis`, `useFinanceiroActions`, `useFinanceiroAuxiliares`) e em `useSupabaseCrud<Lancamento>`.
- **`/conciliacao`** — `src/pages/Conciliacao.tsx` carrega lançamentos por conta+período, importa OFX via `parseOFX`, sugere/aceita pares (auto e manual), persiste via `conciliacao.service.ts` (RPC `financeiro_conciliar_baixa` + tabelas `conciliacao_bancaria` / `conciliacao_pares`).
- **`/fluxo-caixa`** — `src/pages/FluxoCaixa.tsx` consolida previsto vs. realizado por dia/semana/mês a partir de `financeiro_lancamentos`, com painel de gráfico, grid de movimentos, lançamento manual e import CSV.

A camada de serviços está dividida entre:
- `src/services/financeiro.service.ts` (baixa em lote + estorno + cancelamento, com fallback estrutural quando RPC não existe);
- `src/services/financeiro/titulos.service.ts` (baixa unitária, negociação, antecipação — sem RPC, INSERT+UPDATE direto);
- `src/services/financeiro/conciliacao.service.ts` (matching, persistência);
- `src/pages/financeiro/hooks/useBaixaFinanceira.ts` (mutations React Query envolvendo RPCs `registrar_baixa_financeira` / `estornar_baixa_financeira` — **existem mas estão órfãs de uso**).

Cálculos puros centralizados em `src/lib/financeiro.ts` com testes em `src/lib/financeiro.test.ts`.

## 2) Pontos fortes

- **Modelo canônico documentado** (`docs/financeiro-modelo-estrutural.md`): status persistido (aberto/parcial/pago/cancelado), `vencido` derivado por `financeiro_status_efetivo`, baixas em tabela própria com estorno lógico (`estornada_em`), conciliação por baixa, auditoria, cancelamento via RPC.
- **Funções puras isoladas e testadas** (`calcularValorLiquido`, `calcularNovoSaldo`, `statusPosBaixa`, `getEffectiveStatus`).
- **Drawer (`FinanceiroDrawer`)** já usa `ViewDrawerV2`, `useDrawerData` (cancellation-aware) e `useActionLock`, com tabs Resumo / Baixas / Origem / Histórico.
- **Baixa em lote** com overrides por título, RPC consolidado e fallback transacional cliente-side; estorno com motivo obrigatório; cancelamento via `financeiro_cancelar_lancamento` (motivo ≥ 5 chars).
- **Conciliação OFX** com score de matching dedicado (Sørensen-Dice), threshold configurável, persistência em `financeiro_baixas` + RPC `financeiro_conciliar_baixa`.
- **URL-state** consistente nas três páginas (filtros, período, view mode salvos em `useSearchParams`).
- **KPIs interativos** com clique que aplica filtro de status correspondente.

## 3) Problemas encontrados (problemas reais já presentes)

### 3.1 Modelo de status **incoerente entre código e modelo canônico**
O documento define o status persistido como `aberto/parcial/pago/cancelado` e `vencido` apenas derivado. A UI viola isso em vários pontos:

- `useFinanceiroFiltros.ts` (linha 86): trata `vencido` como valor de filtro válido e compara contra `effectiveStatus`. **Correto**, mas convive com…
- `Financeiro.tsx` (linha 230): KPI "Vencidos" chama `setStatusFilters(["vencido"])` — funciona porque o filter usa `effectiveStatus`, mas o seletor mostrado é `statusFinanceiroSchema` que pode não conter `vencido` como opção.
- `FluxoCaixa.tsx` (linha 64): `statusOpts` lista `vencido` E `cancelado` como opções de filtro. O filtro usa `getEffectiveStatus` local — duplicado da função em `lib/financeiro.ts`, com lógica diferente (não trata `parcial`).
- `FinanceiroLancamentoForm.tsx` (linha 26): `STATUS_READONLY` inclui `"estornado"`, e `STATUS_LABELS` mapeia `estornado` — **status que o doc canônico declarou inexistente** (foi backfilled para `cancelado`). Resíduo morto/confuso.
- `BaixaParcialDialog.tsx` (linha 70): bloqueia status `"estornado"` — mesma situação.

### 3.2 **Dois caminhos de baixa unitária coexistindo**, e a UI usa o errado
- `useBaixaFinanceira.useRegistrarBaixa()` chama a RPC oficial `registrar_baixa_financeira` (atômica, atualiza saldo da conta bancária, gera movimento de caixa, com auditoria).
- `BaixaParcialDialog` (a UI de baixa real chamada pelo Drawer e pelo botão "Baixa parcial" do grid) chama `baixarTitulo()` em `titulos.service.ts`, que faz **INSERT em `financeiro_baixas` + UPDATE em `financeiro_lancamentos` em duas requisições separadas**, com "compensating delete" no catch. Não é transacional, não atualiza `contas_bancarias.saldo`, não passa por trigger de auditoria, não respeita o trigger `trg_sync_financeiro_saldo` (que ainda assim recalcula, mas isso conflita com o UPDATE manual de `valor_pago`/`saldo_restante` enviado pelo cliente).
- Resultado: **divergência possível entre saldo da conta bancária e baixas registradas**. O hook RPC está órfão.

### 3.3 Conciliação ignora `data_baixa` (eixo correto) e usa `data_vencimento`
O doc 5) define explicitamente: *"Eixo estrutural: baixa/movimento liquidado (não vencimento)"*.

- `Conciliacao.tsx` (linha 144-145): `gte("data_vencimento", from).lte("data_vencimento", to)` — carrega lançamentos por **vencimento**, não por baixa. Um título pago em abril mas vencido em março não aparece quando a conciliação for feita em abril.
- A `vw_conciliacao_eventos_financeiros` documentada existe (mencionada em `useConciliacaoBancaria`), mas a página `Conciliacao.tsx` **não a usa**, lê direto da tabela.
- O score em `calcularScoreConciliacao` também compara `transacao.data` com `titulo.data_vencimento` (linha 117-122), reforçando o eixo errado.

### 3.4 `negociarTitulo` (`titulos.service.ts`) sem transação real
- Linhas 175-197: cria N parcelas com `Promise.all` de inserts independentes; depois cancela o original. Se uma parcela falhar, as outras já criadas ficam órfãs e o original não é cancelado, mas também não há rollback. Mesma classe de problema da baixa unitária.
- Esse fluxo não está plugado em UI no momento, mas o serviço existe e é exportado.

### 3.5 `useFinanceiroActions.handleSubmit` cria parcelas sem RPC
- Linhas 71-110: faz `create(parentPayload)` + `supabase.from("financeiro_lancamentos").insert(parcelas)` em duas chamadas, com try/catch que tenta `delete` do agrupador no fallback. Existe RPC `gerar_parcelas_financeiras` em `useGerarParcelas` (mesmo arquivo `useBaixaFinanceira.ts`) que faz isso atomicamente — **não está sendo usada**.

### 3.6 Filtros e KPIs **não excluem `cancelado` do total a vencer/vencidos**
- `useFinanceiroKpis.ts` agrupa por `effectiveStatus`. Como `getEffectiveStatus` preserva `cancelado` quando vier do banco, o KPI funciona, mas:
- `useFinanceiroFiltros` filtra por `period` usando `data_vencimento` **mesmo para títulos cancelados**, e o KPI "A Vencer" considera apenas `effectiveStatus === "aberto"`. OK funcionalmente — porém `totalParcial` usa `saldo_restante ?? valor` enquanto `totalAVencer/Vencido/Pago` usam `valor` cheio. **Inconsistência de medida**: um título de R$1000 com R$300 pago contribui R$700 no card "Parcial" e contribui R$1000 no totalVencido se vencer.

### 3.7 Estado de "vencido" no formulário é uma gambiarra
- `useFinanceiroActions.ts` linha 59: `status: form.status === "vencido" ? "aberto" : form.status`.
- `FinanceiroLancamentoForm` mostra Badge "Status efetivo: Vencido (salvo como Aberto)".
- A tradução acontece silenciosamente; não há indicação visual no Select de que `vencido` foi convertido. UX confuso para usuário que escolheu "Aberto" e vê chip "Vencido" depois.

### 3.8 `FinanceiroDrawer.onDelete` chama `remove(id)` direto
- `Financeiro.tsx` linha 325: `onDelete={(id) => { setDrawerOpen(false); remove(id); }}` — `remove` vem de `useSupabaseCrud`, faz DELETE direto. O documento canônico (seção 3) impõe que exclusão é bloqueada por trigger `trg_financeiro_protege_delete` quando há baixa ativa ou origem ≠ manual. O cliente não chama o RPC `financeiro_cancelar_lancamento`, então o usuário recebe erro genérico do Postgres em vez do fluxo guiado de cancelamento.
- Existe `cancelarLancamento()` em `financeiro.service.ts` mas não está plugado no Drawer.

### 3.9 Origem do lançamento — convivência de dois esquemas
- A nova coluna `origem_tipo/origem_tabela/origem_id` (doc 4) já existe e é usada no filtro (`useFinanceiroFiltros.origemFilters`).
- Mas o **drawer** (`origemLabel`, linha 91-97) ainda decide a origem por `nota_fiscal_id` / `documento_pai_id`, ignorando `origem_tipo` para "Manual" e "Parcelamento".
- A página `Conciliacao.tsx` (linha 404-410) também detecta origem por `nota_fiscal_id`/`documento_pai_id` em vez de `origem_tipo`. Duas convenções vivendo juntas.

### 3.10 `FluxoCaixa.tsx` reimplementa `getEffectiveStatus`
- Linhas 68-73: versão local divergente da `lib/financeiro.ts` (não trata `parcial`, parsing de data diferente). Quebra a "fonte única" prometida pelo módulo.

### 3.11 Conciliação grava sem checagem do estado real
- `conciliacao.service.ts` `conciliarTransacao` decide chamar `registrar_baixa_financeira` baseado em `saldoAtual > 0.009 && status !== "cancelado"`. Se a UI marcar como par algo já pago (porque o filtro carregou por vencimento e não por status), gera baixa indevida — e ainda assim tenta marcar a "última baixa ativa" como conciliada, podendo conciliar outra baixa antiga não relacionada.

### 3.12 Tipos e duplicação de interfaces
- `BaixaParcialDialog` define `ContaBancaria`/`Baixa` locais; `BaixaLoteModal` faz o mesmo. `Conciliacao.tsx` define `ContaBancariaDropdown` ad-hoc. `Lancamento` está em `@/types/domain` mas há `interface Lancamento` redefinida em vários componentes. Aumenta atrito quando o domínio muda.

### 3.13 Riscos estruturais
- **R1**: convivência baixa via `titulos.service` (não-transacional) com baixa via RPC quebra o invariante "saldo_restante coincide com soma de baixas ativas". Trigger compensa parcialmente, mas o saldo da conta bancária diverge.
- **R2**: conciliação por vencimento amplifica a janela de divergência entre extrato e ERP — um pagamento real no dia 5 não casa com título vencido no dia 3 fora da janela carregada.
- **R3**: status `vencido`/`estornado` ainda aparece em selects, payloads e validações — risco de receber esse valor de uma migração antiga e o trigger de check (`chk_financeiro_lancamentos_status`) rejeitar.
- **R4**: `removerLancamento` ignorando `cancelar_lancamento` cria atrito UX com o trigger de proteção (mensagens de erro Postgres expostas ao usuário).

## 4) Problemas prioritários (ordem de execução)

1. **Unificar a baixa unitária na RPC oficial** — substituir `baixarTitulo` (titulos.service) pelo hook `useRegistrarBaixa` no `BaixaParcialDialog`. Eliminar UPDATE manual de `valor_pago`/`saldo_restante` no cliente.
2. **Unificar status efetivo em uma única função** — remover `getEffectiveStatus` local em `FluxoCaixa.tsx`; usar `lib/financeiro.ts`. Remover `estornado` do form, dialog e labels.
3. **Conciliação por baixa** — trocar a query de `Conciliacao.tsx` para `vw_conciliacao_eventos_financeiros`; remover comparação com `data_vencimento` em `calcularScoreConciliacao` (passar a usar `data_baixa` quando disponível, com fallback ao vencimento apenas para títulos ainda em aberto).
4. **Excluir → Cancelar** no Drawer — substituir `onDelete → remove(id)` por fluxo de cancelamento (`cancelarLancamento` com motivo) quando o título não for puramente manual+aberto.
5. **Parcelamento via RPC** — trocar o create+insert manual em `useFinanceiroActions.handleSubmit` pelo `useGerarParcelas` (RPC `gerar_parcelas_financeiras`).
6. **Origem unificada** — drawer e Conciliacao passam a derivar a origem exclusivamente de `origem_tipo` (com fallback retrocompatível por `nota_fiscal_id` apenas se `origem_tipo` for nulo).

## 5) Melhorias de UI/UX

- **KPI "Parcialmente Baixados"** mostra `totalParcial = saldo_restante`; os outros KPIs mostram `valor`. Padronizar: ou todos por valor original, ou todos por saldo em aberto. Hoje confunde a leitura.
- **Form de lançamento**: remover a opção "Vencido" do Select de Status (status efetivo, nunca de entrada). Manter o aviso amarelo só ao editar um título já vencido.
- **Drawer**: mostrar quem fez o cancelamento/estorno e o motivo (a tabela `financeiro_auditoria` existe). Hoje o histórico mostra só datas técnicas.
- **Baixa parcial**: mostrar valor sugerido = saldo (já faz), mas adicionar atalhos "Saldo total", "50%", "Valor de uma parcela" para acelerar.
- **Conciliação**: indicar visualmente quando o eixo é vencimento vs. baixa (badge no header da tabela). Hoje o usuário não sabe sob qual critério a lista foi montada.
- **Fluxo de Caixa**: consolidar com a `vw_fluxo_caixa_financeiro` documentada (UNION previsto+realizado) em vez de calcular client-side a partir de `financeiro_lancamentos`. Reduz código e elimina a divergência entre `getEffectiveStatus` local e o do lib.
- **Filtros por origem**: usar ícones/cores diferentes por `origem_tipo` no grid (NF, Sócio, Folha, Compra, Manual) para identificação rápida.
- **Estado vazio na Conciliação**: quando uma conta foi selecionada mas o período não tem lançamentos, exibir CTA explícito ("Ampliar período" / "Importar OFX") em vez de tabela vazia.
- **Ações em massa**: o botão "Baixar N selecionados" só fica visível quando há seleção — adicionar contador permanente no rodapé do grid quando seleção persiste após scroll.

## 6) Melhorias estruturais

- **Dead code**:
  - `negociarTitulo`/`anteciparTitulo` em `titulos.service.ts` — não estão plugados em nenhuma UI. Decidir entre remover ou expor como ação no drawer.
  - `useEstornarBaixa` (estorno por baixa única) coexiste com `processarEstorno` (estorna todas as baixas ativas do título). A UI hoje só usa o segundo; padronizar.
- **Centralização de tipos**: extrair `Baixa`, `ContaBancariaDropdown`, `LancamentoComStatus` para `src/types/domain.ts` (ou `src/types/financeiro.ts`).
- **Service contracts**: `financeiro.service.ts` (raiz) mistura baixa em lote, estorno e cancelamento; `financeiro/titulos.service.ts` faz baixa unitária. Reorganizar para um único namespace `services/financeiro/` com submódulos: `baixas.ts`, `estornos.ts`, `cancelamentos.ts`, `parcelas.ts`, `conciliacao.ts`. Remover `services/financeiro.service.ts` raiz após migração.
- **Single source of truth para status**: `lib/statusSchema.ts` já existe — garantir que `Conciliacao` e `FluxoCaixa` consumam dele em vez de literais hardcoded.
- **Auditoria**: expor a tabela `financeiro_auditoria` no tab Histórico do Drawer; hoje o componente não consulta nada da auditoria.
- **Conciliação real-time**: `conciliacao_pares` poderia disparar invalidate de `["financeiro"]` via Supabase Realtime, evitando inconsistências entre abas abertas.

## 7) Roadmap de execução

```text
Fase 1 — Integridade (alto risco, bloqueia divergência de saldo)
  1. Plugar useRegistrarBaixa em BaixaParcialDialog (substituir baixarTitulo).
  2. Drawer: substituir onDelete por fluxo cancelarLancamento(id, motivo).
  3. Migrar parcelamento em useFinanceiroActions para useGerarParcelas (RPC).
  4. Marcar baixarTitulo/negociarTitulo/anteciparTitulo como @deprecated.

Fase 2 — Status canônico (limpa dívida do modelo)
  5. Remover "vencido" e "estornado" dos selects de Status (form e FluxoCaixa).
  6. Apagar lógica local getEffectiveStatus em FluxoCaixa.tsx.
  7. Centralizar STATUS_LABELS em lib/statusSchema.ts.
  8. Padronizar KPIs (decidir: valor original vs saldo em aberto).

Fase 3 — Conciliação alinhada ao modelo (eixo baixa)
  9. Migrar Conciliacao.tsx para vw_conciliacao_eventos_financeiros.
 10. Ajustar calcularScoreConciliacao para usar data_baixa quando existir.
 11. Adicionar guard em conciliarTransacao: rejeitar pares para títulos pagos.

Fase 4 — Origem unificada e auditoria
 12. Drawer e Conciliacao consomem origem_tipo (fallback nf/parcela).
 13. Tab Histórico do Drawer puxa de financeiro_auditoria.

Fase 5 — Limpeza estrutural
 14. Reorganizar services/financeiro/* (baixas, estornos, cancelamentos…).
 15. Centralizar tipos auxiliares (Baixa, LancamentoComStatus) em domain.
 16. Remover negociarTitulo/anteciparTitulo se não houver UI consumidora.

Fase 6 — UX
 17. Migrar FluxoCaixa para vw_fluxo_caixa_financeiro.
 18. Atalhos de valor na BaixaParcialDialog; chips de origem no grid.
 19. Empty states acionáveis na Conciliação.
```

