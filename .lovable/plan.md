

# Revisão Mobile — Financeiro

Análise focada em **<768px**, baseada em `src/pages/Financeiro.tsx`, `src/pages/Conciliacao.tsx`, `src/pages/FluxoCaixa.tsx`, `BaixaParcialDialog`, `BaixaLoteModal`, `FinanceiroCalendar`, `FinanceiroDrawer`, `financeiroColumns.tsx`. Os 3 `DataTable` (financeiro-lancamentos, conciliacao, fluxo-caixa-movimentos) caem para `MobileCardList` mas **sem nenhum dos props mobile** (`mobileStatusKey`, `mobileIdentifierKey`, `mobilePrimaryAction`, `mobileInlineActions`) — padrão já consolidado em Comercial/Compras/Estoque está ausente aqui.

---

## 1. Visão geral

Os três pilares do Financeiro têm comportamentos muito diferentes em mobile:

- **`/financeiro` (Lançamentos)** funciona razoavelmente: tem `PullToRefresh`, 5 KPIs em grid 2-col, tabela cai em cards. Mas o card mobile mostra Tipo+Pessoa+Descrição+Vencimento+Valor sem hierarquia (5 detail-fields cinzas), o status só aparece como detail-field ao final, e a ação mais importante ("Baixar") fica enterrada como `acoes_rapidas` à direita do header sem virar CTA.
- **`/conciliacao`** é **inviável em portrait**: usa `flex flex-wrap items-end` para 3 controles top (Select w-64, 2 inputs date w-36) + 4 botões de ação alinhados `ml-auto`, e o coração da tela é um split `grid-cols-1 lg:grid-cols-2` com duas colunas de ~480px de scroll interno — em mobile vira uma única coluna empilhada com 1000+px de scroll vertical aninhado.
- **`/fluxo-caixa`** tem painel principal = **tabela horizontal de 7 colunas** sem fallback mobile (`<table>` HTML cru, não `DataTable`). Em 390px o usuário só vê "Período + Entradas Prev." e precisa swipe horizontal para ver o resto. KPIs ok, gráfico Recharts `h-64` é legível.
- **Modais críticos** (`BaixaParcialDialog`, `BaixaLoteModal`) usam `Dialog` desktop com `max-w-2xl max-h-[85vh] overflow-y-auto` e grids `grid-cols-2 md:grid-cols-3` — em mobile todos os campos comprimem em 2 colunas de ~150px cada (Valor/Desconto/Juros/Multa/Abatimento) com inputs numéricos sem `inputMode="decimal"`, ou seja, abre teclado QWERTY em vez de numérico.

## 2. Problemas críticos (bloqueiam uso real)

- **C1 — `BaixaParcialDialog` é o pior offender**: 6 inputs numéricos em `grid-cols-2` (Valor, Desconto, Juros, Multa, Abatimento, Data) + 2 selects + textarea, tudo num `Dialog max-w-2xl` que vira coluna estreita em mobile com scroll interno. Inputs sem `inputMode="decimal"`/`step` ajustado — toque abre teclado errado. Botões Saldo total/50%/Limpar têm `text-[10px] px-2 py-0.5` (~22px de altura, **muito abaixo dos 44px**). Footer com 2 botões padrão `Dialog` sem ser sticky.
- **C2 — `BaixaLoteModal`**: começa com tabela HTML de 5 colunas (Descrição/Parceiro/Valor/Vencimento/Ações) dentro do `Dialog` — em 390px estoura horizontalmente. Edição inline de override usa `grid-cols-2` com inputs `h-8 text-xs` — campos de 140px de largura + teclado de 270px restantes praticamente impossível de manipular.
- **C3 — `/conciliacao` impraticável em mobile**: split OFX↔ERP em `grid-cols-1 lg:grid-cols-2` com `max-h-[480px] overflow-y-auto` em cada coluna gera 2 listas de scroll aninhadas dentro do scroll da página — clássico anti-pattern de touch (scroll roubo). O `Select` de "Vincular lançamento" abre sheet com texto truncado em ~30 chars. Top-bar de filtros tem 4 botões (Importar OFX, Match Auto, Conciliação Auto, Exportar) que viram coluna empilhada de 4 botões `h-9` antes de qualquer dado.
- **C4 — `/fluxo-caixa` painel principal**: tabela de 7 colunas com `<table className="w-full text-sm">` sem `overflow-x-auto` controlado — força scroll horizontal cego. **Não há versão mobile**. Esta é a tela onde o gestor mais espera ver "saldo do dia" no celular e ele precisa apertar pinch-zoom para ler.
- **C5 — `MobileCardList` em Lançamentos sem props mobile**: as 3 tabelas (`financeiro-lancamentos`, `conciliacao`, `fluxo-caixa-movimentos`) não passam `mobileStatusKey`/`mobileIdentifierKey`/`mobilePrimaryAction`. Resultado: todos os cards têm header só com "Pessoa" + 4 detail-fields cinzas. Status (Vencido / Pago / Parcial) — a info que o gestor escaneia primeiro — fica ilegível.
- **C6 — Touch target < 44px em pontos críticos**: chips "Saldo total / 50% / Limpar" no BaixaParcialDialog (22px), botão "Baixar" inline em coluna `acoes_rapidas` (h-7 = 28px), header de Financeiro com toggle Lista/Calendário (`h-7`) + Exportar (`h-7`).
- **C7 — `FinanceiroCalendar` em mobile**: `grid lg:grid-cols-[auto_1fr]` cai para coluna única em mobile (ok), mas o `Calendar` shadcn padrão tem células de ~36px (touch target marginal) e a lista de "Vencimentos do dia" embaixo usa `flex items-center justify-between` com nome truncado + 2 elementos à direita (Badge tipo + Valor) — em 360px o nome trunca em ~15 chars e não há ação ("Baixar" / "Ver detalhes") direta, só visualização passiva.

## 3. Problemas médios (atrapalham uso)

- **M1 — KPIs em Lançamentos**: `grid-cols-2 md:grid-cols-3 xl:grid-cols-5` com 5 cards = **3 linhas em mobile** (~360px de altura) antes da lista. "Vence Hoje" sem subtitle (não tem total — assimétrico).
- **M2 — Filtros avançados** (`AdvancedFilterBar`): 4 `MultiSelect` (Tipo/Status/Bancos/Origem) com `w-[150px]`–`w-[200px]` lado a lado já colapsa em popover, mas o popover em si herda larguras fixas dos selects internos.
- **M3 — Toggle Lista/Calendário + Exportar** no header: 3 botões `h-7` lado a lado com `flex-wrap` em mobile viram uma 2ª linha desordenada com `ml-auto` quebrado.
- **M4 — Atalho `/financeiro?baixa=lote`**: abre `BaixaLoteModal` via deep-link do Dashboard, mas não pré-seleciona títulos — em mobile o usuário cai numa modal vazia sem entender o porquê.
- **M5 — Ações de seleção em lote**: para entrar em modo de seleção é necessário tocar checkboxes de 14px à esquerda de cada card (touch target ruim). Botão "Baixar N selecionado(s)" aparece no `extra` do `AdvancedFilterBar` que pode ficar fora da viewport ao rolar.
- **M6 — `FluxoCaixa`/Movimentos**: usa `DataTable` com `moduleKey="fluxo-caixa-movimentos"` mas mesmas faltas de props mobile (sem `mobileStatusKey`, sem `mobilePrimaryAction`).
- **M7 — Cards de Contas Bancárias** (FluxoCaixa rodapé): `grid-cols-1 md:grid-cols-3` em mobile vira 1 col com saldo grande — ok, mas tap toggle o filterBanco sem feedback visual além do `ring-2` (sutil em mobile).
- **M8 — Período de FluxoCaixa**: usa **2 inputs `<Input type="date" w-[160px]>` + 3 botões de agrupamento + Select de banco w-[200px]** num `flex flex-wrap`. Em 390px vira ~5 linhas de controles antes dos dados; falta o `PeriodFilter` canônico (já usado em Lançamentos) com presets de 7/15/30/90d.
- **M9 — `BaixaParcialDialog` "Calculated summary" + "Cash flow impact indicator"** no fim do form competem com o teclado quando o usuário foca um input — feedback essencial fica escondido.
- **M10 — Dialog de Cancelamento/Estorno** (Financeiro): `ConfirmDialog` com Textarea de 3 linhas + texto explicativo longo — em mobile o teclado cobre o botão "Cancelar Lançamento".

## 4. Problemas leves (polimento)

- **L1 — Subtitle do `ModulePage`** ("Gestão unificada de contas a pagar e receber") em 360px quebra em 2 linhas e empurra os KPIs.
- **L2 — Badge "Eixo: baixa + vencimento"** (Conciliação) com Tooltip de hover-only — em mobile só aparece com long-press não óbvio.
- **L3 — Banner "Atenção: a confirmação ainda não persiste..."** (Conciliação) com 3 colunas Pareados/Sem par/Total + botão "Confirmar Revisão" — em 360px vira 5 linhas verticais.
- **L4 — Calendar `pointer-events-auto`** forçado mas células ainda ~36px em mobile.
- **L5 — `getTime()` no calendário gera tooltip nativo** que não dispara em touch.
- **L6 — Ícones `h-3.5 w-3.5`** em vários botões pequenos (14px) quase ilegíveis em alta densidade.

## 5. Melhorias de layout

- **Lançamentos como card com hierarquia**: primary = Pessoa, identifier = Descrição (truncate), status pill = `StatusBadge(efectivo)`, primary metric = Valor, sub-metric = Vencimento com cor de overdue/today, primaryAction = "Baixar" full-width 44px (oculto se pago/cancelado), inline actions = "Editar" + ícone "Ver".
- **Conciliação**: trocar split horizontal por **stack vertical em modo "wizard"** mobile: (1) chips "Pareados / Pendentes / Sem par" no topo, (2) lista única de itens OFX em ordem, com "Vincular" como primaryAction full-width que abre **bottom-sheet de busca** filtrada por valor/data ±2 dias (não scroll de 480px com 100 títulos).
- **Fluxo de Caixa painel**: substituir tabela 7-col por **lista de cards "card-por-período"** em mobile: header = nome do período + saldo acumulado em destaque, body = entradas/saídas previstas vs realizadas em pares (2 colunas internas), expand-on-tap para ver itens. Manter tabela full em desktop.
- **KPIs**: em mobile usar 4 cards principais (A Vencer / Vencidos / Pagos / Parciais) e mover "Vence Hoje" para banner clicável acima da lista (chip "3 títulos vencem hoje").
- **Calendário**: dia tappable abre **bottom-sheet com lista** dos vencimentos daquele dia + ações por item (Baixar/Ver). Hoje a lista fica num `Card` lateral que em mobile vai pra baixo.

## 6. Melhorias de navegação

- **PeriodFilter canônico em FluxoCaixa**: substituir os 2 inputs date manuais pelo `PeriodFilter` com `financialPeriods` (igual em Lançamentos) — alinhamento com `mem://produto/contrato-de-periodos.md`.
- **Conciliação** com `Sheet` bottom-sheet para "Importar OFX" e "Vincular lançamento", removendo o split duplo.
- **Voltar consistente**: drawers V2 já têm fechar — ok. `BaixaParcialDialog` e `BaixaLoteModal` precisam virar bottom-sheet em mobile (mesmo patch dos outros módulos).
- **Atalho Dashboard `?baixa=lote`**: se sem seleção, abrir bottom-sheet "Selecione títulos" com lista filtrável em vez de modal vazio.
- **Toggle Lista/Calendário em mobile**: virar `Tabs` no topo (mais touch-friendly que ButtonGroup `h-7`).

## 7. Melhorias de componentes

- **`DataTable` props mobile** (3 tabelas):
  - `financeiro-lancamentos`: `mobileStatusKey="status_efetivo"`, `mobileIdentifierKey="descricao"`, `mobilePrimaryAction` = botão "Baixar" full-width (oculto se pago/cancelado), `mobileInlineActions` = "Editar" + "Ver".
  - `conciliacao`: `mobileStatusKey="statusConciliacao"`, primaryAction = "Vincular OFX" (abre bottom-sheet).
  - `fluxo-caixa-movimentos`: `mobileStatusKey="status"`, primaryAction = "Baixar".
- **`BaixaParcialDialog` em mobile**: virar `Sheet` bottom-sheet com layout vertical. Inputs com `inputMode="decimal" pattern="[0-9]*"` para teclado numérico nativo. Chips "Saldo total / 50% / Limpar" com `min-h-11`. Reordenar: (1) Resumo (Saldo restante grande), (2) Valor + chips, (3) Data + Forma + Conta (essenciais), (4) Collapsible "Ajustes finos" com Desconto/Juros/Multa/Abatimento, (5) Observações, (6) DrawerStickyFooter com "Confirmar baixa".
- **`BaixaLoteModal` em mobile**: trocar tabela por lista de cards verticais (descricao + parceiro + valor + chip "Personalizado"). Edição inline vira bottom-sheet aninhado por título. Footer sticky com "Confirmar baixa de N títulos · Total R$ X".
- **`Conciliacao` split**: virar lista única vertical com cards de transação OFX. Cada card tem ação "Vincular" que abre bottom-sheet de busca de lançamentos com filtro por valor (±0.05) e data (±3d) já aplicado.
- **`FluxoCaixaPainel`**: introduzir componente `FluxoCaixaPeriodCard` (mobile) — header com período, saldo acumulado destacado, expand-on-tap mostra detalhes.
- **`FinanceiroCalendar`**: dia tap → bottom-sheet com lista de vencimentos + ação "Baixar" por linha.
- **`ConfirmDialog`** (Cancelar/Estorno): usar `Sheet` mobile para o teclado caber sem cobrir o botão.

## 8. Melhorias de fluxo

- **Baixar em 2 toques** (caso comum): card de Lançamento → tap "Baixar" full-width → bottom-sheet com Saldo restante já preenchido + 3 chips (Total/50%/Custom) + Forma+Conta padrão → "Confirmar". Hoje são 4-5 toques (abrir drawer → "Registrar Baixa" → preencher 7 campos → confirmar).
- **Conciliar manualmente**: tap no card OFX → bottom-sheet "Lançamentos compatíveis" (já filtrado por valor±data) → tap único para vincular.
- **FluxoCaixa "saldo do dia"**: tap no card de período → ver entradas/saídas detalhadas + atalho "Antecipar recebíveis" se saldo negativo.
- **Banner "Vence hoje"** acima da lista: tap → filtra lista para só hoje.
- **Lançamento manual** (FluxoCaixa): hoje exige `Plus` no header → modal grande. Em mobile, `FAB` flutuante 56px com ação primária por contexto.

## 9. Sugestões de redesign mobile (sem inventar sistema novo)

Reaproveitar padrão consolidado em **`mem://produto/comercial-mobile.md`**, **`mem://produto/compras-mobile.md`** e **`mem://produto/estoque-logistica-mobile.md`**:

- **`MobileCardList` + props mobile** (`mobileStatusKey/mobileIdentifierKey/mobilePrimaryAction/mobileInlineActions`) já existentes em `DataTable`.
- **`Sheet` bottom-sheet** para BaixaParcial, BaixaLote, ConciliarVincular, ConfirmDialogs.
- **`DrawerStickyFooter`** (V2) para CTA primário das baixas.
- **`PeriodFilter` canônico** com `financialPeriods` em FluxoCaixa (alinha com contrato de períodos).
- **`STATUS_VARIANT_MAP`** já consolidado para coerência cromática.
- Documentar em **`mem://produto/financeiro-mobile.md`** as decisões.

## 10. Roadmap de execução

| # | Etapa | Resolve | Esforço |
|---|---|---|---|
| **1** | Aplicar `mobileStatusKey/mobileIdentifierKey/mobilePrimaryAction/mobileInlineActions` em `financeiro-lancamentos` (primaryAction "Baixar" full-width 44px) | C5, C6 (parte) | S |
| **2** | `BaixaParcialDialog` → `Sheet` bottom-sheet em mobile com layout vertical reorganizado, inputs `inputMode="decimal"`, chips `min-h-11`, Collapsible para Desconto/Juros/Multa/Abatimento, footer sticky | C1, C6, M9 | M |
| **3** | `BaixaLoteModal` → bottom-sheet com lista de cards em vez de tabela; edição override em sheet aninhado | C2 | M |
| **4** | `Conciliacao`: substituir split OFX↔ERP por lista única vertical com cards OFX + bottom-sheet de "Vincular lançamento" filtrado por valor±data; aplicar props mobile no DataTable de lançamentos | C3, M2 | M |
| **5** | `FluxoCaixa` painel: criar `FluxoCaixaPeriodCard` para mobile (md:hidden) substituindo tabela 7-col; manter tabela em desktop; aplicar props mobile no DataTable de movimentos | C4, M6 | M |
| **6** | `FluxoCaixa` filtros: substituir 2 inputs date manuais por `PeriodFilter` com `financialPeriods` (alinha com contrato de períodos) | M8 | XS |
| **7** | `FinanceiroCalendar` mobile: tap no dia abre bottom-sheet com vencimentos + ação "Baixar" por linha | C7 | S |
| **8** | Header de Lançamentos em mobile: tabs Lista/Calendário + botão "Mais" (Exportar) com touch targets `min-h-11`; subtitle truncate | M3, L1, C6 | XS |
| **9** | Atalho Dashboard `?baixa=lote`: se sem seleção, abrir bottom-sheet "Selecionar títulos" filtrável em vez de modal vazio | M4 | XS |
| **10** | Banner "Vence hoje" tappable acima da lista (filtra para hoje); reorganizar 5 KPIs → 4 cards + banner | M1 | S |
| **11** | `ConfirmDialog` Cancelar/Estorno → `Sheet` em mobile (textarea + botões fora do alcance do teclado) | M10 | XS |
| **12** | Documentar em `mem://produto/financeiro-mobile.md` + atualizar `mem://index.md` | governança | XS |

**Quick wins (alto valor, baixo risco)**: 1, 6, 8, 9, 11.
**Estruturais (mudam fluxo)**: 2, 3, 4, 5, 7.
**Polimento**: 10, 12.

