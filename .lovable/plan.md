

# Revisão Mobile — Compras

Análise focada em **<768px**, baseada em `CotacoesCompra.tsx`, `PedidosCompra.tsx`, `CotacaoCompraDrawer`, `PedidoCompraDrawer`, `CotacaoCompraPropostasPanel` (comparativo + propostas/item), `CotacaoCompraItensTable`, `PedidoCompraTable`, `PedidoCompraFormModal`, `CotacaoCompraTable`.

---

## 1. Visão geral

O módulo está **operacional no desktop** mas **quebra na prática em mobile** em três pontos: (a) **comparativo de fornecedores** é uma tabela horizontal com 1 coluna por fornecedor — em 390px qualquer cotação com 3+ fornecedores estoura o viewport e exige scroll horizontal duplo (página + tabela interna); (b) **modal de criar/editar cotação** usa linhas com `flex` (produto + qtd + un + delete) que comprimem o autocomplete a ~40% da largura; (c) **PedidoFormModal** usa `ItemsGrid` baseado em `<table min-w-[700px]>` — inutilizável em celular. Drawers já têm footer sticky (V2) e os patches recentes do Comercial não foram replicados aqui.

## 2. Problemas críticos (bloqueiam uso real)

- **C1 — Comparativo de fornecedores**: `ComparativoFornecedores` renderiza `<table>` com colunas fixas (`min-w-[100px]`) por fornecedor. Com 3 fornecedores + coluna produto = ~430px. Scroll horizontal aninhado torna a comparação ilegível.
- **C2 — Cotação: linha de item no modal de criar/editar**: `flex items-center gap-3` com Autocomplete + Input qtd (`w-24`) + Input un (`w-16`) + delete = 4 elementos lado a lado em ≤390px. Autocomplete fica cortado, qtd/un viram colunas de 1 dígito.
- **C3 — Pedido: `ItemsGrid` no `PedidoCompraFormModal`**: tabela com `min-w-[700px]` e inputs `h-8 text-xs` — não há fallback de cards. Adicionar item exige scroll horizontal + tap em campos de 32px de altura (abaixo do mínimo 44px).
- **C4 — Tabelas de listagem (Cotações/Pedidos)** caem em `MobileCardList` automático mas **sem `mobileStatusKey`** — o status (informação mais crítica para decisão) vira texto cinza pequeno, não pill.
- **C5 — `CotacaoCompraItensTable`** dentro do drawer: tabela de 5 colunas (#, Produto, Cód, Qtd, Un) sem alternativa mobile — coluna Produto trava em `max-w-[180px]`.

## 3. Problemas médios (atrapalham uso)

- **M1 — Painel "Propostas por item"**: cada proposta é uma linha `flex justify-between` com fornecedor à esquerda e {preço/un + total + prazo + 2 botões} à direita. Em 390px, o nome do fornecedor é truncado em ~10 caracteres e os botões de selecionar/excluir (`h-7 w-7` = 28px) ficam abaixo do mínimo touch.
- **M2 — Form de adicionar proposta**: campos com `h-8` (32px) e Labels `text-xs` (12px). Difícil acertar com o dedo.
- **M3 — Footer do drawer da cotação**: até 4 ações (Cancelar / Rejeitar / Aprovar / Gerar Pedido) em `flex-wrap`. Em portrait quebra em 2 linhas com botões de tamanhos diferentes — hierarquia perdida.
- **M4 — Aba Decisão** (cotação): tabela 3 colunas "Produto / Fornecedor / Total" com `max-w-[120px]` e `[130px]` — fornecedor truncado, total apertado contra a borda.
- **M5 — Aba Recebimento** (pedido): `LogisticaRastreioSection` + tabela de movimentos + grid de financeiro empilhados — scroll vertical >2.000px sem âncora de retorno.
- **M6 — Modal de criar Cotação**: grid `grid-cols-2 md:grid-cols-4` para Número/Data/Validade/Status — em 390px funciona, mas o campo "Status" exibe texto longo ("Aguardando Aprovação") cortado num input disabled.
- **M7 — Filtros de Cotações/Pedidos**: o componente compartilhado já colapsa, mas os chips de `activeFilters` em `flex-wrap` competem com o contador — em portrait empilham 3 linhas.

## 4. Problemas leves (polimento)

- **L1 — KPIs**: 2x2 (`grid-cols-2 lg:grid-cols-4`) com `SummaryCard` de altura razoável; números de 4-5 dígitos cabem mas o `variation` ("aguardando decisão") quebra em 3 linhas.
- **L2 — Trophy/Award icons** (3px de margem) ao lado de preços ficam visualmente colados no mobile.
- **L3 — `DrawerSummaryGrid cols={4}`** do pedido (Itens / Recebimento / Total / Cotação) — em mobile o grid V2 já cai para 2x2, mas valor "Recebido — aguardando envio" não cabe em 1 linha.
- **L4 — `RegistrarRecebimentoDialog` / `EstornarRecebimentoDialog`**: não revisados como bottom-sheet (herdam `AlertDialog` padrão, mas o patch da Fase 8 do Comercial só atingiu `CrossModuleActionDialog`).

## 5. Melhorias de layout

- **Comparativo de fornecedores em mobile** (C1): substituir a matriz por **cards verticais por fornecedor** (1 card por fornecedor, contendo lista de itens com preço unitário, prazo e total da coluna). Adicionar pill "Menor total" no card vencedor. Manter a tabela apenas em `md:` para cima.
- **`CotacaoCompraItensTable`** (C5): replicar padrão dos itens de Orçamento — `md:hidden` com cards verticais (Produto + código + qtd + unidade), `hidden md:block` mantém a tabela.
- **Form de cotação** (C2): em mobile, cada item vira **bloco vertical**: Autocomplete em largura total, Qtd + Un em grid de 2 colunas, botão remover como ícone à direita do header do bloco com 44px.
- **`ItemsGrid` (Pedido)** (C3): adicionar layout `md:hidden` em cards (já existe esse padrão em `OrcamentoItemsGrid` — replicar para `ItemsGrid` genérico ou criar variante `ItemsGrid` com `mobileLayout="cards"`).
- **Footer do PedidoFormModal**: total + ações empilhados; o resumo "Produtos / Frete / Total" em `flex justify-end gap-6` quebra mal — virar grid 3 colunas com Total destacado em linha própria.

## 6. Melhorias de navegação

- **Tabs do drawer**: já são `FormTabsList`-compatíveis no V2; reforçar contador nas labels críticas (Propostas, Itens) já está parcialmente feito — adicionar contador em "Decisão" (`X/Y itens decididos`) e "Recebimento" (`X%`).
- **Voltar a partir do PropostasPanel**: quando o usuário entra em "Adicionar proposta" (`addingProposal`), o form aparece dentro do card mas o usuário precisa rolar muito; converter em **bottom-sheet** quando mobile.
- **Status sempre visível na lista**: aplicar `mobileStatusKey="status"` em `PedidoCompraTable` e `CotacaoCompraTable` (mesmo patch já feito no Comercial).

## 7. Melhorias de componentes

- **`ComparativoFornecedoresMobile`** (novo, dentro do mesmo arquivo, `md:hidden`): renderização em cards por fornecedor.
- **`CotacaoCompraItensTable`**: bloco mobile com cards (`md:hidden`).
- **`PropostasPanel`**: form de "Adicionar proposta" extraído — em mobile, abrir como bottom-sheet via `Sheet` (shadcn) em vez de inline.
- **`ItemsGrid`** (genérico, `src/components/ui/ItemsGrid.tsx`): adicionar `renderMobileCards()` com `md:hidden` e botões de 44px. Beneficia Pedidos de Compra hoje e qualquer outro consumidor amanhã.
- **`PedidoCompraTable` / `CotacaoCompraTable`**: passar `mobileStatusKey="status"`.
- **Recebimento/Estorno dialogs**: aplicar mesmo tratamento bottom-sheet do `CrossModuleActionDialog`.

## 8. Melhorias de fluxo

- **Decisão em 1 toque**: na aba Propostas mobile, cada proposta de item ganha um botão "Selecionar" (44px, cor primária) ocupando largura total quando não selecionada — elimina o ícone `CheckCircle2` de 28px.
- **Aprovar/Rejeitar/Cancelar** (cotação e pedido): em mobile, footer empilha vertical com **ação primária do status atual em destaque** (ex: "Aprovar" se aguardando_aprovacao) e secundárias num menu `⋯` para reduzir competição visual.
- **Recebimento rápido** (pedido): botão "Registrar Recebimento" como FAB-like sticky no rodapé quando o pedido está em `aguardando_recebimento`.
- **Reduzir cliques na cotação → pedido**: quando `aprovada` e `allItemsHaveSelected`, mostrar CTA único "Gerar Pedido de Compra" no topo do drawer (banner sticky) além do footer.

## 9. Sugestões de redesign mobile (sem inventar sistema novo)

- Reaproveitar **`MobileCardList` + `mobileStatusKey`**, **`DrawerStickyFooter`**, **`Sheet`** (bottom-sheet) e **`renderMobileCards`** já presentes no projeto.
- Padrão de **comparativo de fornecedores em mobile**: cards verticais com header "Fornecedor X — Total R$" + lista de itens.
- Padrão de **inputs em form mobile**: altura mínima `h-11` (44px), labels `text-sm`.
- Documentar em **`mem://produto/compras-mobile.md`** as decisões.

## 10. Roadmap de execução

| # | Etapa | Resolve | Esforço |
|---|---|---|---|
| **1** | `mobileStatusKey="status"` em `PedidoCompraTable` + `CotacaoCompraTable` | C4 | XS |
| **2** | `CotacaoCompraItensTable`: bloco `md:hidden` com cards verticais | C5 | S |
| **3** | `ComparativoFornecedoresMobile` em `CotacaoCompraPropostasPanel` (cards por fornecedor, `md:hidden`); manter tabela em `md:` | C1, L2 | M |
| **4** | `CotacaoCompraPropostasPanel`: cards por proposta verticais em mobile com botão "Selecionar" full-width 44px; form de adicionar como `Sheet` bottom-sheet | M1, M2 | M |
| **5** | `ItemsGrid` (`src/components/ui/ItemsGrid.tsx`): adicionar `renderMobileCards()` `md:hidden` (espelhando `OrcamentoItemsGrid`); aplicar a `PedidoCompraFormModal` automaticamente | C3 | M |
| **6** | `CotacoesCompra.tsx` form de criação: linha de item vira bloco vertical em mobile (Autocomplete full-width, Qtd/Un em grid 2 cols, remover com 44px) | C2 | S |
| **7** | `PedidoCompraDrawer` + `CotacaoCompraDrawer` footers: empilhar vertical em mobile com ação primária destacada + secundárias em menu `⋯` | M3 | S |
| **8** | Aba Decisão da cotação: cards verticais (Produto / Fornecedor / Total) em mobile no lugar da tabela 3 colunas | M4 | S |
| **9** | `RegistrarRecebimentoDialog` + `EstornarRecebimentoDialog`: estilo bottom-sheet em `max-sm` (espelhando patch do `CrossModuleActionDialog`) | L4 | XS |
| **10** | `PedidoCompraFormModal`: footer com totais em grid 3 colunas e Total em linha destacada | layout | XS |
| **11** | Banner CTA sticky "Gerar Pedido" no topo do drawer da cotação quando `aprovada` + todos selecionados | fluxo | XS |
| **12** | Documentar padrão em `mem://produto/compras-mobile.md` | governança | XS |

**Quick wins (PRs independentes)**: 1, 9, 10.
**Estruturais (alto impacto)**: 3, 4, 5.
**Polimento**: 2, 6, 7, 8, 11, 12.

