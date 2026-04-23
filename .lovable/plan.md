

# Revisão Mobile — Comercial

Análise focada **exclusivamente em mobile (<768px)**, com base nos arquivos reais: `Orcamentos.tsx`, `Pedidos.tsx`, `OrcamentoForm.tsx` (1.353 linhas), `PedidoForm.tsx`, `OrcamentoItemsGrid.tsx`, `OrcamentoView.tsx`, `OrdemVendaView.tsx`, `OrcamentoTotaisCard`, `OrcamentoCondicoesCard`, `FreteSimuladorCard`, `OrcamentoSidebarSummary`.

---

## 1. Visão geral da experiência mobile do módulo

Comercial é o coração do ERP em mobile (vendedor cota em campo, gerente aprova no celular, comprador converte pedido). Hoje as **listas** já se beneficiam do `MobileCardList` recém-redesenhado, mas o **fluxo de criação/edição** é o mais hostil de todo o sistema:

- **`OrcamentoForm` (1.353 linhas)** monta TODA a página comercial em uma única coluna scrollável com 8 blocos verticais (Identificação → Cliente → Itens → Análise interna → Totais → Frete simulador → Condições → Observações). Em mobile, somente a "página real" (sem o sidebar resumo, que é `hidden lg:block`) chega facilmente a **6.000–7.500 px de scroll**.
- **`OrcamentoItemsGrid`** força tabela horizontal com `min-w-[980px]` mesmo em mobile, exigindo overflow-x. Adicionar item, alterar qtd/preço, aplicar desconto, remover — tudo em inputs `h-7 text-xs` (campo de 28px). Botão "Tela cheia" abre Dialog ainda mais largo (`max-w-6xl w-[95vw]`) — em iPhone vira modal pixel-shift.
- **`Orcamentos.tsx` (lista)**: 4 ações de fluxo (Visualizar/Enviar/Aprovar/Gerar Pedido) em botões `h-7` no canto direito do card mobile. A ação principal "Gerar Pedido" abre Dialog com 2 campos (PO + data) sem otimização touch.
- **Conversão Orçamento → Pedido** exige: abrir lista → tap card → drawer view → footer "Gerar Pedido" → dialog com PO → confirmar. Em mobile são **5 toques + 2 modais empilhados**.
- **`PedidoForm`** é mais leve (313 linhas, 3 cards) mas usa `grid-cols-2` mobile (Status + Data Despacho na mesma linha = inputs de 150px).
- **`OrcamentoView` / `OrdemVendaView`** abrem em `ViewDrawerV2` (bottom-sheet em mobile, ok) mas internamente usam `Tabs` horizontais (Resumo/Itens/Frete/Vínculos/Faturamento) com mesmo problema do módulo Cadastros: trilho de tabs scrollável invisível.

Resultado: **consultar funciona razoavelmente, criar/editar é praticamente desktop-only**. O fluxo crítico de venda em campo (vendedor montando orçamento no cliente) é **inviável** hoje.

---

## 2. Problemas críticos (bloqueiam uso real)

| # | Problema | Onde | Impacto |
|---|---|---|---|
| C1 | `OrcamentoItemsGrid` é **tabela horizontal `min-w-[980px]`** em mobile com inputs `h-7 text-xs` | `OrcamentoItemsGrid.tsx:273-369` | Adicionar/editar item exige pinch-zoom + pan lateral. Cada linha tem 6 colunas (código/descrição/qtd/unitário/%/subtotal/ações) impossíveis de operar com polegar. |
| C2 | `OrcamentoForm` empilha 8 blocos full-page com totais ~6.000 px de scroll em mobile (sidebar resumo `hidden lg:block`) | `OrcamentoForm.tsx:916-1104` | Vendedor perde contexto do total enquanto rola para ajustar item/frete/desconto. Sem resumo flutuante mobile. |
| C3 | Header sticky de ações no `OrcamentoForm` empilha 5+ botões (Salvar/Visualizar/PDF/Templates/⋯) que em mobile quebram em 3 linhas e ocupam ~140px antes do conteúdo | `OrcamentoForm.tsx:797-843` | Quase 1/4 da viewport tomada por barra de ações; "Salvar" pode ficar na 3ª linha. |
| C4 | Diálogo "Gerar Pedido" abre por cima do drawer aberto, criando **modal-sobre-drawer** em mobile com 2 inputs `date` + texto longo + botão | `Orcamentos.tsx:391-400` + componente `CrossModuleActionDialog` | Empilhamento de overlays causa perda de scroll-lock e fechamento acidental por tap-outside. |
| C5 | Lista de ações por linha em `Orcamentos`/`Pedidos` usa botões `h-7` (28px) lado a lado: Visualizar (icon), Enviar, Aprovar, Gerar Pedido | `Orcamentos.tsx:367-403`, `Pedidos.tsx:338-362` | Touch targets abaixo de 44px; em card mobile aparecem como `actions`/dropdown ⋮ que requer 2 taps para qualquer ação principal. |
| C6 | `OrcamentoView`/`OrdemVendaView` em drawer mobile usam `Tabs` horizontais com 4-6 abas | `OrcamentoView.tsx`, `OrdemVendaView.tsx` | Mesmo problema crítico do Cadastros: trilho de tabs scrollável que esconde a maioria das abas em <375px. |
| C7 | Templates dropdown + "Compartilhar com equipe" + "Salvar como meu" são acessíveis apenas via header (que já está espremido) — sem atalho mobile | `OrcamentoForm.tsx:803-828` | Funcionalidade-chave (reaproveitar combo de itens/condições) escondida atrás de 2 toques + modal de nome. |
| C8 | `FreteSimuladorCard` renderiza tabela de cotações de transportadoras com colunas (transportadora/serviço/prazo/valor/selecionar) — em mobile vira scroll horizontal indecifrável | `FreteSimuladorCard.tsx` (não auditado a fundo) | Comparação de fretes — passo crítico antes de fechar — fica ilegível. |
| C9 | `OrcamentoInternalAnalysisPanel` (margem/rentabilidade) renderiza painel denso com cenários, custos e gráficos no mesmo trilho de scroll do form | `OrcamentoForm.tsx:1038-1046` | Painel só interessa a admin/gestor; aparece para todos no meio do form, alongando scroll para vendedor que só quer fechar pedido. |
| C10 | `OrcamentoItemsGrid` botão "Adicionar Item" fica no topo do bloco mas a edição acontece linha por linha → vendedor com 8 itens precisa scrollar até o final, tap "+", scrollar de volta para preencher | `OrcamentoItemsGrid.tsx:381` | UX de adicionar produto não funciona com keyboard aberto (50% da viewport). Sem FAB sticky de "+ Item". |
| C11 | "Gerar PDF" e "Visualizar" em mobile abrem PDF inline (`OrcamentoPdfTemplate`) que é dimensionado para A4 — vira preview gigante com texto microscópico | `OrcamentoForm.tsx:801` + `OrcamentoPdfTemplate.tsx` | Confirmar antes de enviar ao cliente é impraticável. |
| C12 | `PedidoForm` força `grid-cols-2` em "Status Operacional" (Status + Data Prometida + Prazo Despacho) e "PO Cliente" (PO + Data) em mobile | `PedidoForm.tsx:230, 266` | Inputs de 150px para `<Select>` de status com opções longas ("Em Separação", "Em Transporte") e `type="date"` ficam clipped. |

---

## 3. Problemas médios (atrapalham uso)

- **M1** — Banner contextual mobile do `OrcamentoForm` (linhas 887-912) é grid 2x2 com Orçamento/Total/Cliente/Itens — informação útil mas **não sticky**, então some assim que rola. Total deveria viver em footer flutuante permanente.
- **M2** — `JustCreatedBanner` (mensagem "Adicione itens para concluir") aparece em mobile + scroll-into-view manual via DOM id — gesto não-natural em touch.
- **M3** — Autocomplete de cliente (`AutocompleteSearch` + `ClientSelector` + botão "+") são 3 controles enfileirados num `flex gap-2` que em mobile viram 3 botões `h-10` lado a lado, deixando o input com ~60% da largura.
- **M4** — `OrcamentoTotaisCard` mostra grid editável de Subtotal/Desconto/ST/IPI/Frete/Outras/Total. Em mobile cada campo tem `text-xs`; alterar desconto sem ver total atualizando em tempo real (sem feedback visual) confunde.
- **M5** — `OrcamentoCondicoesCard` (Pagamento/Prazo Pagamento/Prazo Entrega/Modalidade/Frete tipo) tem 5+ selects que em mobile empilham em `grid-cols-2` apertados.
- **M6** — Ações secundárias em `Orcamentos.tsx` (Duplicar, Reenviar e-mail, Aprovar manualmente) ficam no menu ⋮ desktop; em mobile, no card list, só aparecem 1-2 ações por vez.
- **M7** — Rejeitar/Cancelar orçamento exige `ConfirmDialog` com motivo livre (Textarea); em mobile vira modal de altura 80vh com keyboard ocupando 50%.
- **M8** — `subscribeComercial` (realtime) atualiza grid de pedidos/orçamentos sem feedback visual — usuário em campo não percebe que aprovação chegou.
- **M9** — `Pedidos` tem `PullToRefresh`, mas `Orcamentos` não — inconsistência.
- **M10** — Status badges com cor + texto + variação aparecem repetidos: card mostra 2 badges (status + faturamento) numa só linha estreita; nomes longos ("Aguardando Aprovação") truncam.
- **M11** — `OrcamentoView` traz seções "Vínculos" / "Análise" / "Histórico" — em drawer mobile elas viram tabs, mas o conteúdo de cada uma é layout desktop (grids 3-col, tabelas).
- **M12** — `useConverterOrcamento` mostra toast com "Abrir pedido" como ação — em mobile o toast bottom + bottom-nav + FAB criam fila de elementos sobrepostos.

---

## 4. Problemas leves (polimento)

- **L1** — Numero do orçamento em mono `text-xs` no card primary perde proeminência (deveria ser secundário, cliente principal).
- **L2** — Validade vencida em mobile mostra duas linhas (data + badge "Vencida") — poderia ser apenas borda esquerda destacada do card.
- **L3** — `formatCurrency` em mono na coluna Total desktop fica perfeito; em mobile sem alinhamento de colunas, mono fica desnecessário.
- **L4** — "Autosave às HH:MM" só aparece desktop (banner `hidden md:flex`); mobile não tem indicador de save.
- **L5** — `OrcamentoSidebarSummary` é `hidden lg:block` — mobile perde Save/Preview/PDF de acesso rápido (ficam só no header espremido).
- **L6** — Skeletons em loading do form: nenhum (só um `animate-pulse` text). Alto layout shift na hidratação do form complexo.
- **L7** — `MultiSelect` de filtros (status, validade, prazo, clientes) com `w-[180px]`–`w-[250px]` no `AdvancedFilterBar` — em mobile já cai em drawer, mas widths fixos brigam (mesma issue de Cadastros).
- **L8** — Botão "Tela cheia" do `OrcamentoItemsGrid` em mobile não faz sentido (já é a tela inteira) mas continua visível.

---

## 5. Melhorias de layout

1. **Dividir `OrcamentoForm` em fluxo por etapas mobile** (sem inventar componente: usar `Accordion` vertical já adotado em `FormTabsList`):
   - **1. Cliente** (autocomplete + snapshot resumido)
   - **2. Itens** (lista mobile-friendly, expandido por padrão)
   - **3. Frete & Condições** (collapsible)
   - **4. Totais & Observações** (collapsible)
   - **5. Análise interna** (collapsible, oculto se sem permissão)
   Reduz scroll percebido para ~1/4 do atual; vendedor preenche linearmente.
2. **Itens como cards verticais** em mobile (não tabela): cada item vira card com:
   - Linha 1: nome do produto (text-base, font-semibold)
   - Linha 2: código + estoque (text-xs muted)
   - Linha 3: [Qtd grande input] × [unitário grande input] = subtotal (mono à direita)
   - Linha 4: [- desconto] [Duplicar] [Remover] (botões 36px+)
   Drag-handle vira "Reordenar" via long-press. Sem overflow horizontal.
3. **Footer sticky mobile com Total + Salvar** sempre visível no `OrcamentoForm` (mesmo padrão `OrcamentoSidebarSummary` mas inferior, full-width).
4. **`PedidoForm` mobile single-column**: forçar `grid-cols-1 md:grid-cols-2` em todos os blocos.
5. **`FreteSimuladorCard` mobile**: cotações como lista de cards verticais (transportadora + serviço linha 1, prazo + valor linha 2, "Selecionar" full-width).
6. **`OrcamentoInternalAnalysisPanel` colapsado por padrão em mobile** + permissão: vendedor sem acesso nem vê.
7. **`OrcamentoView`/`OrdemVendaView` drawer mobile**: tabs viram `Accordion` (mesmo padrão Cadastros), com seção Resumo expandida default.

---

## 6. Melhorias de navegação

- **N1** — **Footer sticky de ações mobile** no `OrcamentoForm` substitui a barra de header empilhada: [💾 Salvar] [👁] [⋯] em 3 botões 44px.
- **N2** — **Conversão Orçamento → Pedido em 1 tap** quando PO é opcional: botão "Gerar Pedido" no card mobile dispara direto se status=aprovado e PO não obrigatório; só pede PO via bottom-sheet quando admin marcar campo como exigido.
- **N3** — **Drawer com back-arrow físico** (`<` à esquerda) além do X — mesma melhoria proposta para Cadastros.
- **N4** — **Realtime feedback visual**: quando `subscribeComercial` invalidar, mostrar chip "↻ Atualizado agora" no topo da lista por 3s.
- **N5** — **Templates como bottom-sheet em mobile** acessível via FAB secundário no `OrcamentoForm` (não enterrado em dropdown header).
- **N6** — **Deep link `?step=itens`** no `OrcamentoForm` mobile abre direto na seção (similar ao `?tab=` proposto para Cadastros).

---

## 7. Melhorias de componentes

- **`OrcamentoItemsGrid`**:
  - Detectar `useIsMobile()` e renderizar **`MobileItemsList`** (cards) em vez de tabela.
  - Adicionar `Plus` como FAB sticky bottom-right dentro do bloco quando >2 itens (não só botão no topo).
  - Tela-cheia hidden em mobile.
  - Long-press no card de item abre bottom-sheet "Editar item" com inputs grandes (qtd/preço/desconto/justificativa).
- **`OrcamentoForm`**:
  - Wrapper `<MobileFormSteps>` que recebe seções e renderiza accordion mobile / cards desktop sem mudar markup interno.
  - Footer sticky `<MobileFormFooter>` com Total + Salvar.
- **`OrcamentoView` / `OrdemVendaView`**:
  - Reaproveitar `FormTabsList` accordion pattern (já feito em Cadastros).
  - Ações principais (Gerar Pedido / Aprovar / Faturar / Cancelar) em footer sticky do drawer com botão primário full-width.
- **`FreteSimuladorCard`**:
  - Variante `mobile-list` com cards de cotação (transportadora, serviço, prazo, R$, [Selecionar full-width 44px]).
- **`OrcamentoTotaisCard`**:
  - Em mobile, cada linha (Subtotal/Desconto/ST/IPI/Frete/Outras/Total) full-width com label esquerda + input/valor direita; Total destacado em chip grande.
- **`Orcamentos`/`Pedidos`** (cards mobile):
  - Ação primária do status atual vira **botão grande full-width** no rodapé do card (Enviar / Aprovar / Gerar Pedido / Faturar) — não mais 3 botões `h-7` apertados.
  - Ações secundárias (Visualizar / Duplicar / Editar) ficam em `actionsInline` de `MobileCardList` (já implementado).
- **`CrossModuleActionDialog`**:
  - Em mobile virar `Drawer` bottom-sheet com 1 campo por vez, evitando empilhamento de overlays.

---

## 8. Melhorias de fluxo

- **F1** — **Vendedor cria orçamento em 4 toques**: FAB lista → bottom-sheet "Quick Cotação" (cliente + 1 item) → "Salvar e adicionar mais itens" → form completo já com cliente preenchido.
- **F2** — **Aprovação em 1 toque** a partir do card (mobile only para admin): chip "Aprovar" full-width quando status=`pendente`. Sem abrir drawer.
- **F3** — **Gerar Pedido em 1 toque** quando status=`aprovado` e PO não obrigatório (config). Toast com "Abrir pedido" navega ao OV em drawer.
- **F4** — **Faturamento mobile**: do card de pedido, "Gerar NF" abre bottom-sheet com check estoque inline + confirmação. Hoje já existe `ConfirmDialog`, só falta adaptar para drawer.
- **F5** — **Cancelar com motivo** em bottom-sheet com Textarea full-screen em vez de dialog modal.
- **F6** — **Duplicar orçamento** como ação rápida no card (long-press abre menu com Duplicar + Excluir + Reenviar e-mail).
- **F7** — **Edição de item via tap** (não inline): tap no card de item abre bottom-sheet com 4-5 campos grandes + Salvar — evita inputs `h-7` lado a lado.

---

## 9. Sugestões de redesign mobile (sem inventar sistema novo)

Reaproveitando 100% do que já existe (`Drawer`, `Accordion`, `MobileCardList`, `FormTabsList`, `MobileQuickAddFAB`, `ViewDrawerV2`, `useIsMobile`):

```text
┌─ Lista (Orçamentos)──────────┐
│ Orçamentos            [⋯]   │
│ [🔍 Buscar...]    [⚙ 2]    │
│ [Status: aprovado ✕]        │
├──────────────────────────────┤
│ Acme Indústria S.A.          │ ← primary
│ ORC-002342 · R$ 12.450       │ ← identifier+total
│ Validade 15/05 · Aprovado    │
│ ┌─────────────────────────┐ │
│ │  Gerar Pedido  →        │ │ ← ação primária full-width
│ └─────────────────────────┘ │
│ [👁] [📋 Duplicar] [✉]      │ ← actionsInline
├──────────────────────────────┤
│ Beta Comércio                │
│ ORC-002341 · R$ 8.200        │
│ Pendente aprovação           │
│ ┌─────────────────────────┐ │
│ │  Aprovar  ✓             │ │
│ └─────────────────────────┘ │
│ [👁] [✏] [✉]                │
└──────────────────────────────┘
                    [+] FAB
[bottom-nav ──────────────────]

┌─ Form Orçamento (mobile) ────┐
│ ← Novo Orçamento        [⋯] │ ← back arrow + menu
├──────────────────────────────┤
│ ▼ 1. Cliente            ✓   │ ← Accordion section
│   [Buscar cliente...]        │
│   Acme Indústria · CNPJ...   │
├──────────────────────────────┤
│ ▼ 2. Itens (3)              │
│   ┌─────────────────────┐   │
│   │ Produto X       OK  │   │ ← card item
│   │ COD-123 · est. 50   │   │
│   │ 10 UN × R$ 50,00    │   │
│   │       = R$ 500,00   │   │
│   │ [✏] [📋] [🗑]       │   │
│   └─────────────────────┘   │
│   ┌─────────────────────┐   │
│   │ Produto Y       ⚠   │   │
│   │ ...                 │   │
│   └─────────────────────┘   │
│   [+ Adicionar item ]        │ ← full-width
├──────────────────────────────┤
│ ▶ 3. Frete & Condições       │ ← collapsed
├──────────────────────────────┤
│ ▶ 4. Totais & Observações    │
├──────────────────────────────┤
│ ▶ 5. Análise interna  (admin)│
├──────────────────────────────┤
│ Total                        │
│ R$ 1.450,00                  │ ← sticky footer mobile
│ [Cancelar] [💾 Salvar]      │
└──────────────────────────────┘

┌─ View Orçamento (Drawer)─────┐
│ ← ORC-002342           [⋯] │
│ Acme · Aprovado · R$ 12.450  │
├──────────────────────────────┤
│ ▼ Resumo                    │
│   ...                       │
├──────────────────────────────┤
│ ▶ Itens (5)                 │
├──────────────────────────────┤
│ ▶ Frete                     │
├──────────────────────────────┤
│ ▶ Vínculos (1 OV · 0 NF)    │
├──────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ Gerar Pedido  →         │ │ ← footer sticky drawer
│ └─────────────────────────┘ │
│ [Editar] [PDF] [Cancelar]   │
└──────────────────────────────┘
```

---

## 10. Roadmap de execução

| Fase | Escopo | Resolve | Esforço |
|---|---|---|---|
| **1** | `OrcamentoView`/`OrdemVendaView` em mobile: `Tabs` → `Accordion` (reaproveita padrão Cadastros); footer sticky com ação primária full-width | C6, M11, F2-F4 | M |
| **2** | Cards mobile de `Orcamentos`/`Pedidos` ganham **ação primária full-width** baseada no status (Enviar/Aprovar/Gerar Pedido/Faturar); secundárias em `actionsInline` | C5, F2, F3, F4 | M |
| **3** | `OrcamentoItemsGrid`: detectar `useIsMobile()` e renderizar `MobileItemsList` (cards verticais com inputs grandes); FAB "+ Item" sticky no bloco | C1, C10, F7 | L |
| **4** | `OrcamentoForm` mobile vira fluxo accordion (Cliente / Itens / Frete & Cond / Totais & Obs / Análise) reusando `FormTabsList` accordion mode | C2, C9, M1, M2 | L |
| **5** | Footer sticky mobile no `OrcamentoForm` com Total + Salvar (reusar `OrcamentoSidebarSummary` em variante bottom) | C2, C3, L4, L5 | S |
| **6** | Header mobile compacto no `OrcamentoForm`: [← Voltar] [Título compacto] [⋯ menu com Visualizar/PDF/Templates/Duplicar/Reenviar] | C3, C7, C11 | S |
| **7** | `PedidoForm` mobile single-column (`grid-cols-1 md:grid-cols-2`) em todos os blocos | C12 | XS |
| **8** | `CrossModuleActionDialog` em mobile vira `Drawer` bottom-sheet (evita modal-sobre-drawer); cancelar/rejeitar com Textarea fullscreen | C4, M7 | S |
| **9** | `FreteSimuladorCard` mobile: cotações como lista de cards verticais com "Selecionar" full-width | C8 | M |
| **10** | `OrcamentoTotaisCard` e `OrcamentoCondicoesCard` mobile single-column com Total destacado em chip grande | M4, M5 | S |
| **11** | `MobileQuickCotacaoFAB` na lista de Orçamentos: bottom-sheet com Cliente + 1 item + Salvar (e abre form completo se vendedor quiser refinar) | F1 | M |
| **12** | Realtime feedback: chip "↻ Atualizado agora" 3s no topo da lista quando `subscribeComercial` invalidar; `PullToRefresh` em `Orcamentos` (paridade com Pedidos) | M8, M9 | XS |
| **13** | Long-press em card de orçamento/pedido abre bottom-sheet com ações destrutivas/secundárias separadas (Duplicar / Cancelar / Reenviar e-mail) | F6, M6 | S |
| **14** | Templates como bottom-sheet em mobile (FAB secundário no form ou ação no menu ⋯) | C7, N5 | XS |
| **15** | Documentar padrão em `mem://produto/comercial-mobile.md`: form em accordion + footer sticky de total + cards de itens + ações primárias por status | governança | XS |

**Quick wins (1 PR cada)**: 5, 7, 12, 14.
**Estruturais**: 1, 2, 3, 4, 6, 8, 9, 11, 13.
**Cosméticos**: 10, 15.

