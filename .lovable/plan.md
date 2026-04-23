

# Revisão Mobile — Estoque & Logística

Análise focada em **<768px**, baseada em `src/pages/Estoque.tsx`, `src/pages/Logistica.tsx`, `EstoquePosicaoDrawer`, `EstoqueMovimentacaoDrawer`, `EntregaDrawer`, `RecebimentoDrawer`, `LogisticaRastreioSection`, `TrackingModal`. Os `DataTable` já caem para `MobileCardList`, mas **sem nenhum dos props mobile** (`mobileStatusKey`, `mobileIdentifierKey`, `mobilePrimaryAction`, `mobileInlineActions`) — todo o trabalho que existe em Comercial/Compras está ausente aqui.

---

## 1. Visão geral

Os dois módulos são funcionais no desktop e **degradam para listas cinzas no mobile**: status, atrasos, deltas (+/−) e códigos de rastreio são informações decisivas, mas viram texto small sem hierarquia. **Estoque/Saldos** tem 8 colunas (atual, reservado, disponível, mínimo, valor) que viram bullets indiferenciados num card. **Estoque/Ajuste Manual** é uma página inteira com `Popover` de produto largo `w-[480px]` + `grid-cols-2` para Tipo/Quantidade — em 390px o popover sai da tela e a operação mais sensível do módulo (ajuste auditável) fica frágil. **Logística/Entregas e Recebimentos** têm coluna "Ações" com 3-5 botões + `Select` de status `w-[180px]` que no card mobile só aparece truncado. **Drawer de Remessa** usa `grid-cols-4` no summary e form de evento `grid-cols-2` — quebra ou comprime em portrait.

## 2. Problemas críticos (bloqueiam uso real)

- **C1 — Status invisível nas listas (Estoque & Logística)**: nenhum dos 5 `DataTable` (`estoque-saldos`, `estoque-movimentacoes`, `logistica-entregas`, `logistica-recebimentos`, `logistica-remessas`) passa `mobileStatusKey`. Em mobile o status (Em Trânsito / Atrasado / Crítico / Sem Estoque) fica enterrado como texto cinza no meio de detail-fields. Para um operador escaneando "o que está atrasado", é impossível.
- **C2 — Coluna "Ações" das Entregas/Recebimentos vira lixo no card**: `acoes` tem 3-5 elementos (`Ver`, `Pedido/Compra`, `Rastrear`, `Select` de status w-180px, `Registrar recebimento`). O `MobileCardList` empilha tudo isso à direita do header — o `Select` de 180px estoura, e Rastrear/Registrar não viram CTA primário (são `ghost`).
- **C3 — Ajuste Manual (Estoque/aba ajuste)**: `Popover` do seletor de produto com `PopoverContent w-[480px]` em viewport 390px **sai pela borda direita**. O grid `grid-cols-2` para Tipo + Quantidade comprime o `<Select>` de "Saída — reduzir do saldo" (cortado). É a operação mais sensível do módulo (RPC com auditoria) e está em formato 100% desktop.
- **C4 — Saldos (`estoque-saldos`)**: 8 métricas (atual, reservado, disponível, mínimo, situação, valor) sem prioridade mobile. O DataTable cai em card sem `mobilePrimaryAction` ("Ajustar" rápido) e sem `mobileInlineActions` (`📊 Ver histórico`). Usuário em campo precisa abrir o drawer para descobrir saldo crítico.
- **C5 — TrackingModal**: usa `Dialog` padrão, não bottom-sheet. Lista de eventos `max-h-80 overflow-y-auto` dentro de modal quadrado em 390px deixa pouca área útil; o modal inteiro tem altura ~75vh com scroll interno aninhado (modal scrolla + lista scrolla).
- **C6 — `LogisticaRastreioSection`**: `grid-cols-2 md:grid-cols-4` para KPIs OK, mas a seção de remessas usa `flex` horizontal com Truck icon + dados + 2 botões `h-8` lado a lado — em 390px o nome da transportadora trunca em ~8 caracteres e os botões disputam espaço com o status pill.

## 3. Problemas médios (atrapalham uso)

- **M1 — KPIs duplicados em Logística/Entregas**: 4 cards na primeira linha + 3 cards na segunda (% no prazo, tempo médio, pendentes) = **7 cards consecutivos** antes da lista. Em mobile vira `grid-cols-2` e ocupa **~480px de altura** antes do primeiro item — usuário precisa rolar muito para chegar à lista.
- **M2 — Filtros avançados de Logística**: 3 `MultiSelect` de 160-220px + 2 `Input type="date"` de 140px lado a lado no `AdvancedFilterBar`. Já colapsa em popover, mas dentro do popover ainda usa larguras fixas — input de data fica cortado em 360px.
- **M3 — Drawer de Remessa**: `summary` é `grid grid-cols-4` (Status / Volumes / Peso / Frete) — V2 normalmente cai para 2x2 em mobile, mas o valor "Frete: R$ X,XX" com 6+ dígitos vaza a célula. Form de novo evento (`grid-cols-2`) comprime "Descrição" + "Local" em ~150px cada.
- **M4 — Drawer de Posição (`EstoquePosicaoDrawer`)**: 4 tabs (Resumo, Movimentações, Vínculos, Reposição). Tab "Resumo" tem 2 `ViewSection` com `grid-cols-2`, mas labels "Necessidade de Reposição" e "Ponto de Reposição" quebram em 3 linhas em ≤390px.
- **M5 — Aviso multi-remessa**: cada linha de Entregas com `exibicao_remessas==='multipla'` mostra texto "status reflete última remessa" e badge "X remessas" + `Select` desabilitado. No card mobile vira poluição visual sem hierarquia.
- **M6 — Movimentações (`estoque-movimentacoes`)**: coluna "Motivo / Observação" pode ter 200+ chars; no card mobile vira detail-field truncado sem expansão. Faltam `mobileInlineActions` para "ver origem" (já existe RelationalLink no drawer, mas só aparece após tap).
- **M7 — Aviso "Operação administrativa controlada"** (Ajuste): `flex` com ícone + 2 parágrafos = ocupa ~140px de altura antes do form. Em mobile competem com o teclado quando o usuário foca um campo.
- **M8 — Header "Ajuste Manual" no `headerActions`** do `ModulePage`: em mobile o botão "Ajuste Manual" no header + a tab "Ajuste Manual" são redundantes e ocupam linha dupla.

## 4. Problemas leves (polimento)

- **L1 — Trigger de tabs** com ícone + label (`<Package /> Saldos`) — em 360px as 3 tabs de Estoque cabem, mas as 3 de Logística (Entregas/Recebimentos/Remessas) ficam grudadas sem ícone; padrão inconsistente.
- **L2 — Banner azul "A lista exibe por padrão..."** (Saldos) com botão inline "Mostrar todos" — em mobile o botão quebra para 2ª linha sem alinhamento.
- **L3 — Select de status na linha de Entrega** desabilita quando terminal — em mobile a UI não comunica claramente *por que* está desabilitado.
- **L4 — Drawer de Movimentação**: alerta "ajuste manual" usa Tooltip — em touch só aparece após long-press não óbvio.
- **L5 — Bulk "Atualizar Rastreios"**: botão no header — em mobile uma operação que itera N remessas com `toast.info` + `toast.success` polui a tela.

## 5. Melhorias de layout

- **Saldos como card com hierarquia clara**: em mobile, primary = nome do produto, identifier = SKU/Cód, status pill = `SituacaoEstoqueBadge`, primary metric grande = Saldo Atual (`Disponível: X · Mín: Y` em linha pequena abaixo), valor estoque oculto no card (visível só no drawer).
- **Movimentações com delta destacado**: primary = produto, status pill = tipo (Entrada/Saída/Ajuste com cor), primary metric = `+/-quantidade` em mono large, identifier = data curta + origem.
- **Entregas/Recebimentos**: primary = número do pedido/compra, identifier = cliente/fornecedor, status pill = status_logistico + sub-pill "Atrasada" quando aplicável, footer = primaryAction "Rastrear" (entrega com código) ou "Registrar Recebimento" (recebimento pendente), inline actions = `Ver` + `Pedido`.
- **Remessas**: primary = código de rastreio mono, identifier = cliente · transportadora, status pill, primaryAction = "Rastrear Correios" quando aplicável.
- **Logística KPIs**: em mobile, mostrar apenas 4 cards principais (Total / Em Trânsito / Atrasadas / Entregues). Os 3 secundários (%, tempo médio, pendentes) viram `Carousel` ou `Collapsible` "Ver mais métricas".
- **Drawers**: trocar `grid-cols-4` do `DrawerSummaryGrid` para usar a quebra automática V2 (já é 2x2 em mobile); valores muito longos com `truncate` + tooltip no tap.

## 6. Melhorias de navegação

- **Tabs de Estoque na ordem mobile**: `Saldos` → `Movimentações` → `Ajuste`. Ao abrir um item crítico no banner "Abaixo do Mínimo", oferecer ação "Ajustar" que pré-preenche `produto_id` e abre **bottom-sheet de ajuste rápido** (não muda de tab).
- **Voltar consistente**: todos os drawers V2 já têm fechar — ok. O `RegistrarRecebimentoDialog` herda Dialog padrão; em mobile precisa virar bottom-sheet (mesmo patch já feito no Comercial/Compras).
- **TrackingModal como bottom-sheet** (`max-sm:inset-x-0 max-sm:bottom-0 max-sm:rounded-t-xl`).
- **Header `ModulePage` em mobile**: esconder o botão "Ajuste Manual" do header (redundante com a tab).

## 7. Melhorias de componentes

- **`DataTable` props mobile** (5 tabelas): aplicar `mobileStatusKey`, `mobileIdentifierKey`, `mobilePrimaryAction`, `mobileInlineActions` — padrão já estabelecido em `mem://produto/comercial-mobile.md` e Compras.
- **Ajuste Manual em mobile**: extrair o form da tab para um **`Sheet` bottom-sheet** com layout vertical (Produto autocomplete full-width, Tipo radio cards de 44px, Quantidade input 44px, preview do saldo em destaque, Categoria + Motivo). Tab continua existindo no desktop.
- **Popover de produto**: trocar `w-[480px]` por `w-[var(--radix-popover-trigger-width)] sm:w-[480px]` para herdar largura do trigger no mobile.
- **`EntregaDrawer` / `RecebimentoDrawer`**: footer sticky com **ação primária do estado atual** ("Rastrear", "Registrar Recebimento", "Marcar como Entregue") em destaque + secundárias num menu `⋯`.
- **`TrackingModal`**: aplicar bottom-sheet pattern + remover scroll interno aninhado (deixar a página rolar).
- **`LogisticaRastreioSection`**: cards verticais por remessa em mobile (status pill no topo, código rastreio mono, transportadora, ação primária "Rastrear" full-width).
- **Form de evento no Drawer de Remessa**: `grid-cols-2` → `grid-cols-1 md:grid-cols-2`, inputs `h-11` em mobile.

## 8. Melhorias de fluxo

- **Entrada/Saída rápida** (Estoque): no banner "Abaixo do Mínimo" e nos cards de Saldos, oferecer FAB "+ Entrada" / "− Saída" que abre bottom-sheet pré-preenchido (apenas Quantidade + Motivo) — elimina ir até a tab Ajuste.
- **Registrar Recebimento em 2 toques**: mobile primaryAction "Registrar" no card de Recebimento → bottom-sheet (mesma `RegistrarRecebimentoDialog` adaptada).
- **Rastrear como CTA primário**: para Entregas com `codigo_rastreio` e para Remessas com código, `primaryAction` full-width 44px abre TrackingModal direto — elimina o tap em "Ver" → tab → botão.
- **Atualizar status da entrega**: em mobile, em vez do `Select w-180px` na linha, oferecer "Próximo status" como botão único primário (avança 1 passo no fluxo). Status alternativos via long-press/menu `⋯`.
- **Banner de itens críticos**: tornar tappable cada chip → abre bottom-sheet de ajuste rápido daquele item.

## 9. Sugestões de redesign mobile (sem inventar sistema novo)

Reaproveitar o padrão consolidado em **`mem://produto/comercial-mobile.md`** e **`mem://produto/compras-mobile.md`**:

- **`MobileCardList` + `mobileStatusKey/mobileIdentifierKey/mobilePrimaryAction/mobileInlineActions`** já existentes em `DataTable`.
- **`Sheet` bottom-sheet** para Ajuste rápido, RegistrarRecebimento, TrackingModal.
- **`DrawerStickyFooter`** (V2) para CTA primário do estado.
- **Tipo de movimento** (Entrada/Saída/Ajuste) usando `STATUS_VARIANT_MAP` para coerência cromática com o resto do ERP.
- Documentar em **`mem://produto/estoque-logistica-mobile.md`** as decisões.

## 10. Roadmap de execução

| # | Etapa | Resolve | Esforço |
|---|---|---|---|
| **1** | Aplicar `mobileStatusKey/mobileIdentifierKey/mobilePrimaryAction/mobileInlineActions` nos 5 DataTables (`estoque-saldos`, `estoque-movimentacoes`, `logistica-entregas`, `logistica-recebimentos`, `logistica-remessas`) | C1, C2, C4, M5 | M |
| **2** | Popover de produto (Ajuste): largura responsiva (`w-trigger sm:w-[480px]`); inputs/selects do form com `h-11` em mobile | C3 (mitiga) | XS |
| **3** | Extrair Ajuste Manual para `EstoqueAjusteSheet` (bottom-sheet em mobile, mantém tab no desktop); pré-preenchível por `produto_id` via banner crítico e por chip da lista | C3, fluxo | M |
| **4** | `TrackingModal` em estilo bottom-sheet `max-sm` + remover scroll interno aninhado | C5 | S |
| **5** | `LogisticaRastreioSection`: cards verticais em mobile com primaryAction "Rastrear" full-width 44px | C6 | S |
| **6** | KPIs de Logística/Entregas: 4 cards principais sempre visíveis, 3 secundários em `Collapsible` "Mais métricas" no mobile | M1 | S |
| **7** | Drawers `EntregaDrawer` + `RecebimentoDrawer`: footer com ação primária por estado + secundárias em menu `⋯` (mobile) | C2 (parte), fluxo | S |
| **8** | Drawer Remessa: `grid-cols-4` summary com truncate seguro; form de evento `grid-cols-1 md:grid-cols-2` com `h-11` mobile | M3 | XS |
| **9** | `RegistrarRecebimentoDialog` quando aberto a partir de Logística: confirmar bottom-sheet (já feito no patch Comercial — replicar se necessário) | fluxo | XS |
| **10** | Esconder header `Ajuste Manual` em mobile (redundante com tab) | M8, L | XS |
| **11** | Banner "Abaixo do Mínimo": cada chip com 44px de altura e ação direta "Ajustar" via bottom-sheet | fluxo | XS |
| **12** | Documentar em `mem://produto/estoque-logistica-mobile.md` + atualizar `mem://index.md` | governança | XS |

**Quick wins (alto valor, baixo risco)**: 1, 2, 6, 8, 10.
**Estruturais (mudam fluxo)**: 3, 4, 5, 7, 11.
**Polimento**: 9, 12.

