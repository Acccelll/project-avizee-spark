

# Revisão Mobile — Cadastros

Análise focada **exclusivamente em mobile (<768px)**, baseada nos arquivos reais: `Clientes.tsx`, `Fornecedores.tsx`, `Produtos.tsx`, `Transportadoras.tsx`, `Funcionarios.tsx`, `Socios.tsx`, `FormasPagamento.tsx`, `UnidadesMedida.tsx`, `ContasBancarias.tsx`, `ContasContabeis.tsx`, `GruposEconomicos.tsx`, `MigracaoDados.tsx`, e os wrappers `DataTable`, `MobileCardList`, `AdvancedFilterBar`, `FormModal`, `FormTabsList`, `ViewDrawerV2`.

---

## 1. Visão geral da experiência mobile do módulo

Cadastros é o módulo **mais visitado em mobile** (vendedor em campo abre cliente; comprador confere fornecedor; estoquista cria produto rápido). Hoje ele já se beneficia de 3 acertos: `DataTable` troca tabela por `MobileCardList` em `<768px`; `AdvancedFilterBar` empurra filtros para um `Drawer` bottom-sheet; `FormModal` vira fullscreen em `max-sm`. Mas **a partir do "Editar" tudo desmonta**: cada cadastro principal (Clientes/Fornecedores/Produtos/Transportadoras) abre um modal fullscreen com **6–7 abas em uma TabsList horizontal scrollável**, que em iPhone SE (375px) cabe ~2,5 abas visíveis e o usuário precisa **scrollar lateralmente um trilho de 24px de altura para descobrir as outras**. Forms internos usam `grid-cols-2` mesmo em mobile (CEP+Logradouro+Número numa só linha), apertando inputs a ~40% da largura útil.

Cadastros "leves" (Funcionários, Sócios, Formas de Pagamento, Unidades, Contas Bancárias/Contábeis, Grupos Econômicos) variam: alguns têm 1 modal de tela só (ok), outros copiaram o pattern multi-aba sem necessidade. Quick-add (já existe `QuickAddClientModal`, `QuickAddProductModal`, `QuickAddSupplierModal`) é a **única** forma realmente mobile-friendly de criar — mas só está plugado dentro de Orçamento/Pedido/Pedido de Compra, **não** na própria página do cadastro como atalho FAB.

---

## 2. Problemas críticos (bloqueiam uso real)

| # | Problema | Onde | Impacto |
|---|---|---|---|
| C1 | TabsList horizontal scrollável com 6–7 abas dentro de modal fullscreen | `Clientes.tsx:435`, `Fornecedores.tsx:441`, `Produtos.tsx:819`, `Transportadoras.tsx:489` | Usuário não vê a maioria das abas. Não há indicador "+3" nem stepper. Aba ativa pode ficar fora da viewport ao reabrir. |
| C2 | `grid-cols-2 md:grid-cols-3` em forms — em mobile mantém 2 colunas espremidas, inputs ficam ~150px com label cortado | `Clientes.tsx:457,617` (e equivalentes em Fornecedores/Produtos) | CEP, número, complemento, UF, prazo viram ilegíveis. Usuário precisa zoom + pan. |
| C3 | Botão "Consultar CNPJ" é `size="icon"` (40×40px) **ao lado** do `MaskedInput` num grid de 2-col → input tem ~110px e ícone ocupa 30% do campo | `Clientes.tsx:480`, `Fornecedores.tsx` | Touch errado garantido; usuário não percebe que é botão. |
| C4 | `MobileCardList` mostra **apenas 1 ação** atrás do `MoreVertical` dropdown — tap no card abre `onRowClick` mas a maioria dos cadastros não passa `onRowClick`, só `onView`/`onEdit`/`onDelete`. Resultado: **o card inteiro não responde a tap**, só o ⋮ no canto | `DataTable.tsx:441` (passa `onItemClick={onRowClick}`) + páginas que não definem `onRowClick` | Em Clientes.tsx (linha 374) só tem `onView/onEdit/onDelete`, sem `onRowClick`. Card vira "leitura"; usuário precisa achar o ⋮ de 36px no canto direito. |
| C5 | Modal de edição em fullscreen mobile **sem botão visível "Voltar"**: o `X` (DialogClose) padrão fica ~44px no canto superior direito; não há gesto de swipe-down para fechar (é Dialog, não Drawer) | `FormModal.tsx:87` (max-sm:rounded-none, mas continua Dialog) | Usuário "preso" no formulário. Em modais com isDirty + confirmOnDirty, o único caminho é o X. |
| C6 | Footer do modal contém 2 botões (Cancelar/Salvar) em linha, mas `FormModalFooter` padrão usa `flex justify-end gap-2` → em telas <360px botões se sobrepõem ou Salvar fica clipped | `FormModalFooter.tsx` (não revisado mas usado por todos) | Em Galaxy A04 (360×800), o "Salvar" pode rolar fora. |
| C7 | Quick-add (`QuickAddClientModal`, `QuickAddProductModal`, `QuickAddSupplierModal`) **não é exposto na página do cadastro em mobile** — só dentro de Orçamento/Pedido | grep: `QuickAddClientModal` em `OrcamentoForm`/`PedidoForm` apenas | Usuário em campo que quer cadastrar cliente novo é forçado ao modal pesado de 7 abas. |
| C8 | `MultiSelect` de filtros (Status/Tipos/Grupos) usa `className="w-[130px]"`/`w-[200px]` — em mobile cabe num `Drawer` (ok), mas dentro do drawer ficam **lado-a-lado em flex-wrap**, quebrando em 2 linhas estreitas; selects de 200px viram 320px ocupando linha inteira sem hierarquia visual | `Clientes.tsx:368-370` + `AdvancedFilterBar.tsx:155-158` (children renderizados em `flex flex-col gap-3`) | OK no drawer (children empilham), mas widths fixos `w-[200px]` lutam contra `flex-col`. |
| C9 | `MigracaoDados` tem **fluxo de 6 fases com Stepper desktop** (revisão pendente, mas inferido pela mem feature). Em mobile, stepper horizontal de 6 nós quebra; uploads de Excel via input file nativo + previews tabulares são impraticáveis | `MigracaoDados.tsx` (não revisado a fundo) | Migração só viável em desktop hoje. |
| C10 | Cards do `MobileCardList` têm `px-4 py-3` (~76px altura) — para listagens com 200+ clientes o scroll é longo demais; `MobileCardList` **não virtualiza** (DataTable só virtualiza tbody, não cards mobile) | `MobileCardList.tsx` + `DataTable.tsx:633-672` | Lista de fornecedores/produtos com 1k+ items trava em mid-range Android. |

---

## 3. Problemas médios (atrapalham uso)

- **M1** — `MobileCardList` mostra "label: valor" em pílulas pequenas (`text-[10px]` label + `text-xs` value). Para Cliente, "CONTATO: (11) 9999..." + "CPF/CNPJ: 12.345..." viram quase ilegíveis em <360px. Falta hierarquia clara: CNPJ deveria ser mono pequeno cinza abaixo do nome, contato deveria ser ação tap-to-call.
- **M2** — Telefones nos cards são texto, não clicáveis (`tel:`). Cliente em mobile **deveria poder ligar/whatsapp direto** do card.
- **M3** — `SummaryCard` repete 3-4 vezes no topo de cada cadastro (Total/Ativos/Inativos/Com grupo). Em mobile esses cards empilham consumindo ~280px antes da lista. Em Clientes especificamente, "Inativos" é métrica inútil para um vendedor.
- **M4** — Tooltip `(Info ⓘ)` ao lado de labels (CPF/CNPJ, IE, Nome Fantasia) é hover-only; em mobile o tap muitas vezes não abre tooltip (depende do Radix). Texto explicativo fica inacessível.
- **M5** — `formErrors` aparecem como `<p className="text-xs text-destructive">` abaixo do input — em mobile com keyboard aberto, o input pode subir e o erro ficar oculto atrás do teclado, sem auto-scroll-to-error.
- **M6** — Tabs internas dentro do modal de edição (Comunicações, Entregas) **abrem listas/CRUD sub-cadastros dentro de modal já fullscreen**. Por exemplo `ClienteEnderecosTab` adiciona endereços com sub-form. Em mobile vira modal-dentro-de-modal-com-scroll-duplo.
- **M7** — Botão "Novo Cliente" (`onAdd` no `ModulePage`) fica no header da página — quando usuário rola lista, precisa scroll-to-top. Não há FAB para criação rápida.
- **M8** — Skeletons em mobile usam `h-20 rounded-xl border bg-card animate-pulse` × 5 — **não corresponde** ao layout real do `MobileCardList` (que mostra primary + 2 detail rows). Layout shift visível na hidratação.
- **M9** — Página `Funcionarios` usa toggle `ativo` + botão `Excluir` (sem doutrina aplicada do `mem://produto/excluir-vs-inativar-vs-cancelar`). Em mobile, dois conceitos destrutivos viram confusão grave.
- **M10** — Filtros chips ativos (`activeFilters`) renderizam como `Badge` flex-wrap — em mobile com 4 filtros ativos viram 2 linhas tomando 60px de altura útil.

---

## 4. Problemas leves (polimento)

- **L1** — `text-[10px]` para labels nos cards é abaixo do mínimo legível (12px iOS HIG).
- **L2** — Status chip dentro do card (`Status: Ativo`) é redundante com cor da borda esquerda que o card poderia ter.
- **L3** — `MobileCardList` usa `space-y-2` (8px) entre cards — para lista longa, 4px seria suficiente e ganharia densidade.
- **L4** — `Loader2` spinner no botão CNPJ permanece por 2-3s sem skeleton no form abaixo — usuário não sabe que vai vir auto-fill.
- **L5** — `PullToRefresh` está em Clientes mas não em todos cadastros (Fornecedores sim, FormasPagamento não, ContasBancarias não).
- **L6** — Paginação mobile (`<` `>`) usa `h-9 w-9` no rodapé — botões certos, mas sem indicador "Página 1 de 4" próximo.
- **L7** — Counter "X de Y" no rodapé em `text-xs text-muted-foreground` quase invisível em mobile com pouca luz.
- **L8** — `FormModalFooter` em modal fullscreen aplica `max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]` — bom, mas o conteúdo scrollável acima não tem `pb-20` para evitar que o último input fique escondido atrás do footer sticky.

---

## 5. Melhorias de layout

1. **Forms mobile single-column**: quebrar TODA `grid grid-cols-2 md:grid-cols-3` em `grid grid-cols-1 md:grid-cols-3` (forçar 1-col em <md). Inputs voltam a ter largura útil.
2. **CEP/CNPJ com botão Consultar full-width abaixo do input** em mobile — não inline `size="icon"`. Usar `FormSection` para agrupar `[Input full]` + `[Button "Consultar CNPJ" full]`.
3. **Reduzir SummaryCards em mobile**: mostrar só 2 (Total, Ativos) em `grid-cols-2`, esconder Inativos/ComGrupo via `hidden md:block`. Ou virar carrossel horizontal scroll-snap.
4. **MobileCardList: redesenhar layout do card** — primary em `text-base font-semibold`, identifier (CNPJ) em `text-xs font-mono text-muted-foreground` linha 2, contact actions (📞 WhatsApp) como ícones tap inline. Eliminar pílula "label:".
5. **Footer sticky com gradient mask** acima — para FormModalFooter mobile, adicionar `box-shadow: 0 -4px 8px hsl(background)` + `pb-[env(safe-area-inset-bottom)]` no conteúdo scrollável (`pb-24`).

---

## 6. Melhorias de navegação

- **N1** — **FAB de criação** em todas as páginas de cadastro mobile: botão flutuante "+" `bottom-20 right-4` (acima do `MobileBottomNav`) que abre o **QuickAdd** correspondente (Cliente/Produto/Fornecedor) em vez do modal full. Para cadastros sem QuickAdd ainda (Transportadora, Funcionário), mantém `onAdd` original.
- **N2** — Substituir `Dialog` fullscreen por `Drawer` (bottom-sheet swipe-to-close) em **modal de edição mobile** — preserva gesto nativo de fechar e oferece "voltar" intuitivo.
- **N3** — **Tab navigation em mobile** vira **stepper segmentado** (atual: 1/7 · próximo) ou **menu accordion** (cada aba é uma seção colapsável vertical). Ambos funcionam melhor que TabsList horizontal em telas pequenas. Recomendação: **accordion vertical** — usuário vê todas as seções, expande a que precisa, contexto preservado.
- **N4** — Header sticky no modal mobile com **breadcrumb mini** ("Clientes › Editar › Acme Corp") + back arrow físico `ChevronLeft` no canto esquerdo (não só X à direita).

---

## 7. Melhorias de componentes

- **`MobileCardList`**:
  - Aceitar `onCardTap?: (item) => void` separado de `onItemClick` (default = abrir view); manter `actions` no canto.
  - Suportar `actionsInline?: ReactNode[]` — array de até 3 ícones (📞 WhatsApp Eye) renderizados como botões 36px no rodapé do card.
  - Suportar `virtualize?: boolean` (passa para `@tanstack/react-virtual` quando lista > 100).
  - Layout primary + secondary + identifier em vez de "label: value".
- **`AdvancedFilterBar` Drawer mobile**:
  - Aplicar `space-y-3` aos children dentro do drawer e **forçar `w-full` em todo MultiSelect filho** (override widths fixos).
  - Adicionar título de seção por filtro ("Status", "Tipos", "Grupos") acima de cada select dentro do drawer.
- **`FormModal` mobile**:
  - Prop nova `mobileVariant?: "dialog" | "drawer"` (default dialog para compat). Em "drawer" usa Sheet/Drawer com swipe-down + back arrow.
  - Auto-aplicar `mobileVariant="drawer"` em forms com >3 tabs.
- **`FormTabsList` mobile**:
  - Detectar `useIsMobile()` e renderizar como `Accordion` (uma seção visível por vez, headers tappable) em vez de `TabsList`.
  - Mostrar badge de erro/dirty por seção (ponto vermelho/amarelo).
- **`FormModalFooter`**:
  - Em mobile usar `flex-col-reverse gap-2` (Salvar full-width em cima, Cancelar abaixo).
  - Padding extra para safe-area.
- **Quick-add modals existentes**:
  - Passar a ser exposto via FAB também na própria página `Clientes`/`Produtos`/`Fornecedores` (não só em Orçamento/Pedido).

---

## 8. Melhorias de fluxo

- **F1** — **Criação rápida via FAB** (Cliente: nome + CPF/CNPJ + telefone; Produto: nome + SKU + preço + unidade; Fornecedor: razão + CNPJ). Após salvar, banner "✓ Criado · [Editar completo]" no topo da lista por 6s.
- **F2** — **Tap em telefone do card** dispara `tel:` ou `whatsapp://send?phone=`. Tap em e-mail dispara `mailto:`. Sem precisar abrir cadastro.
- **F3** — **Editar abre direto na seção certa**: se vendedor tap "Comunicações", abrir já com accordion "Comunicações" expandido (deep link `?tab=comunicacoes`).
- **F4** — **Ações destrutivas (inativar/excluir) ficam atrás de long-press** no card mobile — não no menu ⋮. Long-press → bottom-sheet com ações destrutivas separadas das construtivas.
- **F5** — **Confirmar inativação** com bottom-sheet em vez de AlertDialog modal (mais touch-friendly).
- **F6** — **Migração de dados** em mobile: bloquear acesso ou redirecionar para "Tela disponível em desktop" — não tentar fazer caber.

---

## 9. Sugestões de redesign mobile (sem inventar sistema novo)

Reaproveitando 100% dos componentes existentes (`Drawer`, `Sheet`, `Accordion`, `MobileCardList`, `QuickAddClientModal`, `useIsMobile`, `AdvancedFilterBar`, `FormSection`, `MobileBottomNav`):

```text
┌─ Lista (Clientes) ────────────┐
│ Clientes              [⋯]    │ ← header simples
│ ─────────────────────────────│
│ [🔍 Buscar...]    [⚙ 2]     │ ← search + filter chip drawer
│ [Tipo: PJ ✕] [Status: At ✕] │ ← chips ativos
├──────────────────────────────┤
│ Acme Indústria S.A.          │ ← primary text-base
│ 12.345.678/0001-90           │ ← identifier mono small
│ [📞] [💬 Wpp] [✉] [👁]      │ ← inline actions 36px
├──────────────────────────────┤
│ Beta Comércio Ltda           │
│ ...                          │
└──────────────────────────────┘
                    [+] FAB → QuickAddCliente
[bottom-nav ──────────────────]

┌─ QuickAdd (bottom-sheet 60vh)┐
│ ━━━ (drag handle)            │
│ Novo Cliente              [X]│
├──────────────────────────────┤
│ Nome / Razão Social *        │
│ [______________________]     │
│ CPF/CNPJ                     │
│ [_____________] [Consultar]  │ ← btn full-width
│ Telefone                     │
│ [______________________]     │
├──────────────────────────────┤
│ [Cancelar] [Salvar]          │ ← stack mobile
└──────────────────────────────┘

┌─ Editar (Drawer fullscreen)──┐
│ ← Acme Indústria          [⋯]│ ← back arrow + menu
│ 12.345.678/0001-90 · Ativo   │
├──────────────────────────────┤
│ ▼ Dados Gerais         (1/7) │ ← Accordion section
│   [campos preenchíveis]      │
├──────────────────────────────┤
│ ▶ Contatos             (2/7) │ ← collapsed
├──────────────────────────────┤
│ ▶ Endereço             (3/7) │
├──────────────────────────────┤
│ ▶ Entregas         (5) (4/7) │ ← badge count
├──────────────────────────────┤
│ ▶ Comercial            (5/7) │
├──────────────────────────────┤
│ ▶ Comunicações     (3) (6/7) │
├──────────────────────────────┤
│ ▶ Observações          (7/7) │
├──────────────────────────────┤
│ [Cancelar]   [Salvar ●]      │ ← sticky footer + dirty dot
└──────────────────────────────┘
```

---

## 10. Roadmap de execução

| Fase | Escopo | Resolve | Esforço |
|---|---|---|---|
| **1** | `MobileCardList` redesign: layout primary + identifier + inline actions (📞 ✉ 👁); `actionsInline` prop opcional | C4, M1, M2, L1, L2 | M |
| **2** | Forçar `grid-cols-1` em mobile em **todos** os forms de cadastros (`Clientes`, `Fornecedores`, `Produtos`, `Transportadoras`, `Funcionarios`); CEP/CNPJ com botão Consultar full-width abaixo | C2, C3 | M |
| **3** | `FormTabsList` detecta mobile e renderiza como `Accordion` vertical com badges (count + dirty/erro por seção) | C1 | M |
| **4** | `FormModal` ganha prop `mobileVariant` ("dialog"\|"drawer"); auto "drawer" em modais com >3 tabs; back arrow + breadcrumb sticky no header mobile | C5 | M |
| **5** | `FormModalFooter` mobile: stack vertical (Salvar em cima full-width), safe-area pb, content area com `pb-24` para não esconder último input | C6, L8 | S |
| **6** | FAB "+ Novo" em `/clientes`, `/produtos`, `/fornecedores` (mobile only) abrindo `QuickAdd*Modal` correspondente; banner "✓ Criado" pós-save | C7, M7, F1 | S |
| **7** | Tap-to-call/Wpp/email em cards via `tel:`/`whatsapp://`/`mailto:`; ícones inline 36px touch-target | F2, M2 | XS |
| **8** | Reduzir SummaryCards em mobile: `grid-cols-2` mostrando só Total + Ativos (esconder métricas secundárias) ou virar carrossel snap-x | M3 | XS |
| **9** | `MobileCardList` virtualizado quando lista >100 (reusar `useVirtualizer` igual DataTable desktop); skeleton fiel ao layout do card | C10, M8 | S |
| **10** | `AdvancedFilterBar` drawer: forçar `w-full` em MultiSelect children + título de seção por filtro | C8 | XS |
| **11** | `MigracaoDados` em mobile: empty state "Disponível em desktop" com link de instrução, evita degradação | C9 | XS |
| **12** | Auto-scroll-to-first-error em forms mobile com keyboard aberto; toast só após scroll | M5 | S |
| **13** | Long-press no card mobile abre bottom-sheet de ações destrutivas (separado do menu ⋮); inativar com bottom-sheet em vez de AlertDialog | F4, F5 | M |
| **14** | Documentar padrão em `mem://produto/cadastros-mobile.md` (FAB + accordion + cards) para replicar em futuros módulos | governança | XS |

**Quick wins (1 PR cada)**: 5, 7, 8, 10, 11.
**Estruturais**: 1, 2, 3, 4, 6, 9, 13.
**Cosméticos**: 12, 14.

