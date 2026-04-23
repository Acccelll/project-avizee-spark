

# Revisão Profunda — Componentes Compartilhados e Design System

Análise baseada **exclusivamente** no estado real: `DataTable.tsx` (943 LOC), `ViewDrawerV2.tsx` (188 LOC), `ViewDrawer.tsx` (deprecated), `SummaryCard.tsx` (179 LOC), `StatCard.tsx` (shim), `StatusBadge.tsx`, `EmptyState.tsx` (shim), `ui/empty-state.tsx`, `ui/NoResultsState.tsx`, `ui/DetailStates.tsx`, `ui/content-skeletons.tsx`, `ConfirmDialog.tsx`, `CrossModuleActionDialog.tsx`, `RequestAccessDialog.tsx`, `QuickAddClientModal.tsx`, `FormModal.tsx` + `FormModalFooter.tsx`, `FormSection.tsx`, `FormProgress.tsx`, `FormTabsList.tsx`, `FilterBar.tsx`, `AdvancedFilterBar.tsx`, `filters/PeriodFilter.tsx`, drawers shells (`DrawerHeaderShell`, `DrawerStickyFooter`, `DrawerActionBar`, `DrawerStatusBanner`, `DrawerSummaryCard`), `RecordIdentityCard`, `MobileCardList`, `PullToRefresh`, `PreviewModal`, `JustCreatedBanner`, `OfflineBanner`, `AccessDenied`, `ErrorBoundary`, `ui/spinner`, `ui/skeleton`, `ui/badge`, `ui/chart`, `types/ui.ts`, gráficos (`VendasChart`, `FluxoCaixaChart`, `KpiDetailDrawer`, `relatorios/RelatorioChart`).

> **Fato central**: o catálogo é robusto e cresceu rapidamente — 14+ wrappers de drawer/form, 4 estados vazios, 3 spinners, 3 skeletons. Mas existem **três incoerências grandes**: (1) **três fontes paralelas para a mesma decisão visual** (status: `StatusBadge.statusConfig` x `types/ui.ts:STATUS_VARIANT_MAP` x `getStatusVariant` — apenas a primeira é usada em prod; as outras duas estão órfãs); (2) **shims legados ainda importados** (`StatCard` em 7 páginas, `ViewDrawer` em 5 lugares, `EmptyState.tsx` raiz em 1) sem prazo de migração; (3) **filtros têm dois componentes paralelos** (`FilterBar` simples e `AdvancedFilterBar` com chips/drawer mobile) — `FilterBar` está em uso zero nas páginas, mas continua exportado.

---

## 1. Visão geral do módulo

- **Listagens**: `ModulePage` (header + KPIs + toolbar + slot) + `DataTable` (pag/scroll/virtualização opcional ≥50 linhas, mobile cards, batch actions, exportação CSV/XLSX/PDF, filtros internos opcionais, persistência por user de colunas em `localStorage` + upsert em `user_preferences`).
- **Cards de KPI**: `SummaryCard` (canônico) com `density="compact"`, sparkline Recharts, meta/realizado, 5 variantes (`default|success|danger|warning|info`). `StatCard` é shim que delega.
- **Status**: `StatusBadge` consome `statusConfig` interno (45+ chaves hardcoded com `lucide` icon + Tailwind classes). `Badge` shadcn cru também é usado em muitos lugares.
- **Drawers**: `ViewDrawerV2` (fonte canônica) compõe `DrawerHeaderShell` (3 zonas) + `DrawerStickyFooter` + `DrawerActionBar` + `DrawerStatusBanner` + `DrawerSummaryCard`/`DrawerSummaryGrid` + `RecordIdentityCard` + `SectionTitle`. Re-exporta `ViewField`/`ViewSection` do legado `ViewDrawer.tsx`. `ViewDrawer.tsx` está marcado @deprecated mas é usado em `Auditoria.tsx`, `admin/Logs.tsx`, `views/PedidoCompraView.tsx`, `compras/PedidoCompraDrawer.tsx`, `lib/audit/DiffViewer.tsx`.
- **Formulários compartilhados**: `FormModal` (header rico com `mode`, `identifier`, `status`, `meta`, `isDirty`, `confirmOnDirty` via `useConfirmDialog`), `FormModalFooter` (Salvar/Cancelar + "Salvar e criar outro"), `FormSection` (header uppercase com ícone), `FormTabsList`, `FormProgress` (progresso por aba). `QuickAddClientModal` é hand-rolled (não usa `FormModal`).
- **Filtros**: `AdvancedFilterBar` (busca + chips ativos + drawer mobile + "Limpar todos") usado em 12 páginas. `FilterBar` mais simples (sem chips, sem drawer mobile) — **não tem importadores hoje**. `PeriodFilter` para janelas pré-definidas. `DataTable` tem ainda um popover interno de regras `FilterRule` (off por default).
- **Estados**: `EmptyState` (variantes `default|noResults|firstUse`, action ReactNode) e shim `EmptyState.tsx` legacy (actionLabel/onAction). `NoResultsState` empacota `EmptyState` para "filtros ativos". `DetailLoading`/`DetailError`/`DetailEmpty` para drawers/views. `TableSkeleton`/`CardSkeleton`/`FormSkeleton` para listas/cards/forms. `Spinner`/`FullPageSpinner`/`ContentSpinner` separados. `OfflineBanner`, `JustCreatedBanner`, `AccessDenied` (3 variantes), `ErrorBoundary`.
- **Gráficos**: `ui/chart.tsx` shadcn-chart (com `ChartContainer`/`ChartConfig`/CSS vars) **não tem nenhum importador** — todas as 4 telas com chart importam Recharts diretamente (`VendasChart`, `FluxoCaixaChart`, `KpiDetailDrawer`, `RelatorioChart`, `FluxoCaixa.tsx`). Cada um define paleta, eixos, tooltip duplicados.
- **Diálogos**: `ConfirmDialog` (canônico), `CrossModuleActionDialog` (para fluxos cross-módulo com lista de impactos), `RequestAccessDialog`, `PreviewModal` (impressão), além de `Dialog` raw em ~40 arquivos.
- **Mobile**: `MobileCardList` reusable (drawer/modal), mas o **`DataTable` re-implementa exatamente o mesmo card layout** dentro de `renderMobileCards` (lines 506-567).
- **Acessibilidade central**: `Spinner` com `role=status`, `DetailError` com `role=alert`, `DrawerStatusBanner` com `role=status`, `JustCreatedBanner` com `role=status`. Toaster `aria-live=polite`.

---

## 2. Problemas encontrados

### 2.1 Duplicações paralelas reais

1. **3 fontes para semântica de status, sem alinhamento**:
   - `StatusBadge.statusConfig` (45+ chaves, Tailwind classes hardcoded incluindo cores **bg-blue-50/text-blue-700/dark:bg-blue-950** que **furam o token semântico** — produto, insumo, importada usam paleta direta, quebrando dark theme corporate).
   - `types/ui.ts:STATUS_VARIANT_MAP` (29 chaves com `StatusVariant` — `success|warning|destructive|info|primary|muted`).
   - `compras/comprasStatus.ts:cotacaoStatusLabelMap`/`pedidoStatusLabelMap` (mapeamento de label específico do módulo).
   `STATUS_VARIANT_MAP` e `getStatusVariant` **não têm nenhum importador** (grep retorna apenas o próprio arquivo). Foram criados, nunca consumidos. Risco: próximo desenvolvedor adiciona status novo só em um dos três lugares.
2. **`StatCard` shim ainda em uso em 7 páginas** (`ContasContabeis`, `ContasBancarias`, `FormasPagamento`, `Funcionarios`, `UnidadesMedida`, `SociosParticipacoes`, `Socios`) — outras 19 páginas já usam `SummaryCard` direto. Sem deadline para migração.
3. **`ViewDrawer` (legacy) ainda usado em 5 arquivos** (`Auditoria.tsx`, `admin/Logs.tsx`, `views/PedidoCompraView.tsx`, `compras/PedidoCompraDrawer.tsx`, `lib/audit/DiffViewer.tsx`) — `ViewDrawerV2.tsx` re-exporta `ViewField`/`ViewSection` do legado, criando dependência circular conceitual: deletar `ViewDrawer.tsx` quebra tanto os 5 consumidores quanto o V2.
4. **`EmptyState.tsx` raiz** marcado como compatibilidade ainda usado em `usuarios/UsuariosTab.tsx`. Outros 16+ arquivos já importam `@/components/ui/empty-state` direto.
5. **`FilterBar.tsx` sem importadores** — `AdvancedFilterBar` cobre todos os casos. Componente vivo, código morto.
6. **`MobileCardList` × `DataTable.renderMobileCards`**: **dois componentes que fazem a mesma coisa** com markup quase idêntico (`relative rounded-xl border bg-card px-4 py-3 ...`). DataTable não consome MobileCardList.
7. **3 wrappers de spinner** (`Spinner`, `FullPageSpinner`, `ContentSpinner`) com 3 alturas diferentes (`min-h-screen`, `min-h-[calc(100vh-4rem)]`, inline) — escolha errada gera flicker (full page dentro de shell rola toda a página).
8. **3 skeletons** (`TableSkeleton`, `CardSkeleton`, `FormSkeleton`) versus skeletons hand-rolled em `DashboardSkeleton`, `VendasChart`, `FluxoCaixaChart`, `PendenciasList`, `NotaFiscalForm`, `SummaryCard.loading`. Mesmo `bg-muted/70` repetido em 14 arquivos.
9. **`DataTable` tem filtro interno (popover regras)** que entra em conflito com `AdvancedFilterBar` (chips no header da página). Por isso o `showInternalFilters` default é false. Mas o código dele permanece, com 130 LOC de UI/persistência (filterName/savedFilters em localStorage) que **nunca executa em prod**. Dívida silenciosa.
10. **`QuickAddClientModal`** é um Dialog hand-rolled (não usa `FormModal`/`FormModalFooter`), com seu próprio header, gestão de `closeOnly`, e estilo de footer manual. Diverge em padding (`sm:max-w-lg` × `FormModal sm: max-w-md/xl`), em layout de erros (toast só, sem `FormSection`), e em UX de salvar (label "Salvando..." x "Salvar Alterações").

### 2.2 Status, semântica e dark mode

11. **`StatusBadge` usa Tailwind palette direta** para 4 chaves: `importada`, `produto`, `insumo` (`bg-blue-50/text-blue-700`, `bg-amber-50/text-amber-700`). Quebra dark theme tokens (já tem variant `dark:bg-blue-950/30 ...` redundante quando o sistema tem `--info`).
12. **`confirmado`/`confirmada` mapeado para "Aguardando Aprovação"** com `Clock` no `StatusBadge`. Mas `STATUS_VARIANT_MAP.confirmado = "warning"` rotula como warning genérico. **Inconsistência de label** entre as duas fontes.
13. **`finalizada` mapeado para `success` com label "Finalizada"** no `StatusBadge`, mas em `comprasStatus.ts:cotacaoStatusLabelMap` **`finalizada` é alias de `aprovada`**. Texto x cor x semântica desalinhados.
14. **`StatusBadge` com `className={cn('...gap-1', config.classes, className)}`** — variantes `outline` no `Badge` shadcn forçam `text-foreground`, mas o config injeta `text-warning` etc. Funciona porque `cn` faz o merge tardio, mas é frágil — se alguém renomear a variant, o status fica preto.
15. **`statusConfig` falha silenciosamente em status desconhecido** — `defaultConfig` retorna `label: ''` e o componente exibe a string crua de status (`whatever_status`). Em alguns módulos o status crua tem underscore visível ("aguardando_aprovacao") — apenas para `aguardando_aprovacao` há entrada explícita; outros chegam sujos.
16. **Não há mapping de tom semântico para `Badge` shadcn `variant="default|secondary|destructive|outline"`** — quando uma página usa `Badge` sem ser `StatusBadge` (ex: `RecordIdentityCard.badges` ou `ItemsGrid`), os 5 tons de status semânticos não estão disponíveis (só os 4 variants). Resultado: cores soltas via `className` cru.

### 2.3 DataTable

17. **943 LOC, 13 responsabilidades misturadas**: render desktop, render mobile, sort, filter rules, column toggle, pagination, infinite scroll, batch select, export CSV/XLSX/PDF com chunked progress, persistência em localStorage + Supabase, virtualization, hint de scroll horizontal, expand de detalhes inline. Manutenção pesada.
18. **Persistência dupla**: `localStorage.setItem('datatable:<module>:columns', ...)` **e** `supabase.from('user_preferences').upsert({columns_config})`. Em refresh, ambos são lidos — mas o effect que persiste no Supabase **não recupera de lá** (só escreve). Se o usuário usar outro device, vê o estado do localStorage primeiro, depois sobrescreve com o local. Sync unidirecional silenciosa.
19. **`useEffect` de upsert no Supabase no DataTable** dispara em **toda mudança de coluna**, sem debounce — clicar 5 vezes no toggle dispara 5 upserts. Sem retry, sem feedback.
20. **`SAVED_FILTERS` em localStorage** com cap 0 no UX — não há limite, não há export/share. Filtros salvos ficam invisíveis para o usuário ver/editar/excluir individualmente (só "clicar para aplicar"). Sem botão de delete por filtro.
21. **Mobile: `renderMobileCards` re-implementa `MobileCardList`** com lógica diferente (DataTable usa `mobilePrimary`/`mobileCard` flags na coluna; `MobileCardList` usa `primary?: boolean` no field). Duas APIs paralelas para a mesma estrutura.
22. **`pageSize=25` hardcoded** no default — não há `pageSizes=[10,25,50,100]` para o usuário escolher. Pages com 100 registros forçam 4 cliques.
23. **Virtualização com `virtualizeThreshold=50`** — abaixo disso, scroll natural; acima, `useVirtualizer` com `maxHeight=600`. Quando virtualização ativa, **scroll horizontal hint não funciona** (o ResizeObserver mede o container externo, mas as linhas estão em viewport virtual).
24. **`exportData` mostra `Iniciando exportação ${format}... 0%`** mas o `chunkSize=1000` raramente atinge o gating de "ETA visible" (`sortedData.length > 10000`) — para 99% dos exports, o ETA nunca aparece e o usuário só vê 100% no fim.
25. **`emptyTitle/emptyDescription`** vai para `EmptyState` sem variant — sempre `default` (cinza). Quando há filtros ativos, deveria ser `noResults` ou usar `NoResultsState`. DataTable não recebe `hasActiveFilters` como prop.
26. **`renderActions` desktop só mostra "Visualizar"** (única ação inline) — outras ações ficam no drawer. Mas em mobile (`renderMobileActions`) mostra todas (Visualizar/Editar/Duplicar/Excluir). **Comportamento divergente** entre platforms para a mesma feature.
27. **`onView ?? onEdit` como fallback** — se a tela só passou `onEdit`, o ícone vira `Eye` (Visualizar) mas chama edit. Ícone mente.
28. **`skipDeleteConfirm` em localStorage global** (não por módulo) — usuário marca "não perguntar" em Clientes, e ao excluir Pedidos o sistema também não pergunta. Risco de exclusão acidental cross-módulo.

### 2.4 Drawers (Shell + V2)

29. **`DrawerHeaderShell.recordSummary` recebe `<div className="space-y-2"><div className="flex items-center justify-end">{badge}</div>{summary}</div>`** quando há legacy badge. Stack feio: badge solto acima do summary. Workaround para preservar API antiga.
30. **`ViewDrawerV2.tabsListClass`** difere por variant (`view` x outros) na **altura** (`h-9` x `h-10`) e **bg** (`-` x `bg-muted/60`). Sutil. Mas o trigger varia em `text-xs` x `text-xs sm:text-sm font-medium`. Em apps mobile-first tablets, ver tabs slim em "view" e tabs fortes em "operational" pode confundir.
31. **`renderFooter` heurística** — `f?.type === DrawerStickyFooter` falha com `React.memo`/`forwardRef`. O comentário admite e pede `footerSticky` explícito. Mas grep mostra que páginas misturam: algumas passam `footerSticky`, outras não. Bug latente quando footer é envolvido por wrapper.
32. **`SheetContent` largura `sm:max-w-xl`** padrão → 576px. Para `operational` vai para `sm:max-w-2xl` (672px). Para módulos com tabela rica (Pedidos, Compras), 672px é apertado. Sem opção `xl/full`.
33. **`DrawerActionBar`** ordena: leading → secondary → destructive → primary. Mas o **destructive aparece ANTES do primary** (linhas 107-127 vs 128-143). UX padrão é destructive *à esquerda* separado. Como tudo é flex sem separator, o botão "Excluir" fica colado no "Confirmar" sem barreira visual — potencial misclick.
34. **`DrawerSummaryCard.mono = true` default** — para labels textuais (ex: "Cliente: Acme Ltda"), o mono fica feio. Quase todo uso real passa `mono={false}`. Default invertido.
35. **`DrawerStatusBanner` 6 tons** (`neutral|info|primary|success|warning|destructive`) — `info` e `primary` têm o **mesmo style** (linhas 31-37 e 39-46). Nunca diferenciam. Um deles é morto.
36. **`RecordIdentityCard.icon` obrigatório** — algumas entidades (lançamento financeiro genérico) não têm ícone óbvio. Forçar ícone leva a usos como `<Receipt>` por omissão (visto em `FinanceiroDrawer`).
37. **`ViewField` truncate + title fallback `typeof children === 'string'`**: quando o conteúdo é um `Badge`/`<span>`, o `title` fica undefined. Truncate visual sem hover-revealed text.

### 2.5 SummaryCard / KPIs

38. **`SummaryCard.density="compact"` esconde sparkline e meta**, sem documentar visualmente que existe modo compacto. Páginas misturam dois densos no mesmo grid (Index com cards default, Pedidos com compact) — visual inconsistente entre dashboards.
39. **`Progress` da meta** força cor `bg-success` quando `overGoal` via `[&>div]:bg-success` (CSS arbitrary). Para meta inversa (despesa abaixo do orçado), não há flag — sempre verde quando excede.
40. **`onClick` cria role=button + tabIndex** (correto), mas **falta `aria-pressed`/`aria-expanded`** quando o card abre drawer/popover. Sem feedback semântico de estado.
41. **`onDetail` botão dentro de card clicável**: `e.stopPropagation()` impede o `onClick` outer (ok), mas se o card não tem `onClick`, o "Ver detalhes" vira CTA único sem destaque (mesma cor muted). UX confusa.
42. **`variant="info"` mapa para `border-l-primary` + `bg-primary/10` icon** — `info` deveria mapear para token `--info` (existe, usado em `ui/empty-state` `bg-info/10`). Aqui `info=primary` por omissão.

### 2.6 Filtros

43. **`AdvancedFilterBar` mobile drawer** abre com label "Filtros" e mostra `children` (campos). Mas **não** mostra os filter chips ativos *dentro* do drawer — só fora dele. Usuário no mobile que abre o drawer perde contexto do que já está aplicado.
44. **`onClearAll` aparece só quando `activeFilters.length > 1`** (linha 78). Para 1 filtro ativo, o usuário precisa removê-lo manualmente clicando no `X` do chip. Para múltiplos, o "Limpar todos" aparece. Inconsistência arbitrária.
45. **`hideCount` flag**: `ModulePage` também mostra contagem. Páginas precisam saber qual delas mostra a contagem. Easy double-render.
46. **`PeriodFilter` 6 períodos hardcoded** (`hoje, 7d, 15d, 30d, 90d, year`) — sem "personalizado", sem range picker. Para Financeiro (que usa ranges customizados), há `financialPeriods` em `filters/periodTypes.ts`, mas o componente não aceita range custom inline.
47. **`DataTable.showInternalFilters` (popover regras)** — quando ativado, **regras não aparecem em chips**: o `AdvancedFilterBar` chips só refletem o que a página passar. Dois sistemas de filtro convivem sem unificação.

### 2.7 FormModal / Forms

48. **`FormModal.confirmOnDirty` usa `useConfirmDialog` interno** — mas o `confirmDialog` é renderizado *fora* do `<Dialog>` (linha 153), criando segundo overlay. Em z-index baixo do shadcn, fica atrás se Dialog tem alto z. Já vi esse bug em outros wrappers; aqui pode estar latente.
49. **`mode="create"` mostra chip "Novo" amarelo-verde** mas `mode="edit"` mostra... nada (sem chip). Sem `mode="readonly"`/`mode="duplicate"`. Falta granularidade.
50. **`isDirty` chip "Alterações não salvas" duplicado**: aparece no `FormModal.meta` e em `FormModalFooter` (`Circle + label`). Mesma info em dois lugares.
51. **`FormSection`** assume todas as seções subsequentes têm border-top (`pt-5 border-t border-border/60`). Se a primeira seção tem `noBorder`, OK. Mas se a página renderiza um único `FormSection`, o pt-5 first:pt-0 funciona; se render 2 seções com `noBorder` na primeira mas a segunda tem border, separator some entre elas (porque o `pt-5 border-t` não atinge `:first`). Edge case de estilização.
52. **`FormProgress`** calcula `overallPct` por contagem agregada de `filled/total`, mas não considera **campos obrigatórios vs opcionais**. Em forms onde `total=15` mas só 5 são obrigatórios, o pct mostra 33% mesmo com tudo necessário preenchido. Sem distinção.
53. **`FormTabsList`** força `flex-wrap` — em mobile com 6 tabs, vira 2 linhas. Sem `overflow-x-auto` alternativo.
54. **`FormModalFooter.onSaveAndNew`** só renderiza em `mode="create"`. Mas o label "Salvar e criar outro" sugere que após salvar, abre form vazio. **Sem callback explícito de "qual é o novo estado"** — o caller é responsável por resetar form. UX consistente entre páginas? Grep mostra usos em apenas 2 lugares.

### 2.8 Diálogos

55. **`ConfirmDialog` x `CrossModuleActionDialog`**: o segundo é "ConfirmDialog rico" — mas não compartilha base. ConfirmDialog mostra ícone (AlertTriangle/HelpCircle), CrossModuleActionDialog não tem ícone no header, só lista de impactos. Usuário não sabe que CrossModuleActionDialog é confirmação até ler tudo.
56. **`PreviewModal.print-area` CSS isolation** pressupõe `index.css` define `.print-area` + `.no-print`. Sem fallback se faltar.
57. **40 arquivos importam `Dialog`/`AlertDialog` raw** — sem usar `FormModal`/`ConfirmDialog`/`PreviewModal`. Resulta em 40 implementações de header (alguns com `DialogClose`, outros com botão X manual, outros sem). Reuso fraco apesar dos wrappers existirem.

### 2.9 Gráficos

58. **`ui/chart.tsx` (shadcn ChartContainer/ChartConfig/ChartStyle)** — **0 importadores**. O wrapper "oficial" não tem cliente. Todos os 5 charts importam Recharts puro com configuração própria de cores, eixos, tooltip.
59. **Cada chart faz `<Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }}/>` próprio** — sem token comum. Dark theme tooltip fica branco em alguns, escuro em outros.
60. **`stroke="hsl(var(--primary))"` em `VendasChart`, mas `fill="hsl(var(--primary))"` em outros** — ok. Mas quando paleta tem 5 séries (Fluxo de Caixa: entradas real/prev, saídas real/prev, saldo), é hardcoded `#22c55e`/`#ef4444` etc. Quebra dark theme.
61. **Sem componente `<Chart>` shared para Empty/Error states em gráficos** — cada um tem seu `Sem dados...` cru.

### 2.10 Acessibilidade & semântica

62. **`PullToRefresh` desktop não-op** — mas em desktop com touchscreen (Surface, iPad ProDesktop view), ainda detecta touch e `useIsMobile()` retorna false → gesto silenciosamente perdido.
63. **`OfflineBanner` cor `bg-amber-500/90 text-amber-950`** — paleta crua, sem token semântico (`--warning` existe). Fica laranja garrido em dark mode.
64. **`AccessDenied.variant="action"`** retorna `<div className="inline-flex">` sem `role` semântico — leitor de tela não sabe que é um aviso de acesso.
65. **`JustCreatedBanner` auto-dismiss em 12s**, mas se usuário não vê o toast (multi-tab), perde a info. Sem rota persistente para "últimas criações".
66. **`ErrorBoundary` `<pre className="text-xs text-left bg-muted ...">` mostra `error.message` cru** em prod. Pode vazar PII (CPF/CNPJ em payloads). Sem mascaramento.
67. **`QuickAddClientModal.tipo_pessoa as any`** (linha 94) — TypeScript escape, dívida técnica visível.
68. **`EmptyState.action`** sem ARIA context — quando ação é `Button`, ok; quando é texto descritivo, vira link sem role.

### 2.11 Mobile / responsividade

69. **`SheetContent` no V2 — `w-full sm:max-w-xl`** mas em iPad portrait (768px), `sm:` aplica e o drawer fica metade da tela. Para tablets `md+`, sem ajuste — drawer sempre 576px.
70. **`DataTable` mobile cards** não têm scroll-into-view ou pull-to-refresh natos — `PullToRefresh` é wrapper externo opcional.
71. **`MobileCardList`/`renderMobileCards`** usa `text-[10px]` para label uppercase — abaixo de 12px viola WCAG AA.
72. **`FormModal` em mobile** força `max-sm:rounded-none max-sm:border-x-0 max-sm:max-h-none` — vira tela cheia. Mas o footer `border-t` sticky **não tem `pb-[env(safe-area-inset-bottom)]`** — em iPhone com notch inferior, botão Salvar fica sob a barra do home indicator.

### 2.12 Riscos estruturais

73. **`STATUS_VARIANT_MAP`/`getStatusVariant` órfãs** sinaliza tentativa de unificação abandonada. Próximo dev vai descobrir, achar que é a fonte canônica, migrar half-way, deixar status divergente.
74. **`ViewDrawer.tsx` deprecated mas re-exportado por V2** — qualquer remoção quebra V2. Sem `index.ts` central com re-export estável; cada página importa direto. Refactor caro.
75. **`ui/chart.tsx` morto** — código vivo (testado por shadcn) mas sem clientes, indica decisão arquitetural que não pegou.
76. **`FilterBar.tsx` sem importadores** — pode ser deletado, mas existe e confunde grep.
77. **`DataTable.show_internalFilters` 130 LOC mortas no path padrão** — ninguém ativou, mas continua lá.
78. **`StatCard` é shim, mas ele importa `SummaryCard` e re-exporta props parciais** — mudança em `SummaryCardProps` quebra `StatCard` silently.
79. **3 fontes de skeleton** + skeletons hand-rolled em pages — cada nova tela inventa o seu.
80. **`Badge` shadcn sem variants `success`/`warning`/`info`** — todo lugar que precisa colore via `className` cru. Para um ERP com semântica forte, é decisão estrutural a corrigir.

---

## 3. Problemas prioritários

| # | Problema | Severidade | Impacto |
|---|---|---|---|
| 1 | `STATUS_VARIANT_MAP`/`getStatusVariant` órfãos vs `StatusBadge.statusConfig` em uso (item 1) | **Alta** | Próximo refactor de status quebra UI em massa |
| 2 | `StatusBadge` usa Tailwind palette direta para 4 chaves, dark mode inconsistente (item 11) | **Alta** | Dark theme quebrado em produto/insumo/importada |
| 3 | `ViewDrawer` deprecated em 5 lugares + V2 depende dele (item 3, 74) | **Alta** | Não dá para deletar — bloqueio de cleanup |
| 4 | `DataTable` 943 LOC + persistência dupla local/Supabase sem dedup (itens 17-19) | **Alta** | Manutenção e bugs de sync entre devices |
| 5 | `MobileCardList` × `DataTable.renderMobileCards` duplicados (item 6, 21) | Média | Manter dois layouts paralelos |
| 6 | `ui/chart.tsx` sem clientes; cada chart inventa estilo (itens 58-61) | Média | Dark theme/ paleta inconsistente em gráficos |
| 7 | `StatCard` shim ainda em 7 páginas (item 2) | Média | Migração inacabada |
| 8 | `EmptyState` no DataTable sem `noResults` quando há filtros ativos (item 25) | Média | UX confusa: "vazio" mesmo com filtros aplicados |
| 9 | `FormModal` no mobile sem `safe-area-inset-bottom` no footer (item 72) | Média | Botão Salvar coberto em iPhone |
| 10 | `Badge` shadcn sem tons semânticos (item 80) | Média | Cor solta via className cru em vários lugares |
| 11 | `DrawerActionBar` ordem destructive antes de primary (item 33) | Baixa | Misclick em Excluir |
| 12 | `OfflineBanner` cor crua amber em vez de token (item 63) | Baixa | Quebra em dark |
| 13 | `ErrorBoundary` exibe error.message sem mascaramento (item 66) | Baixa | Vazamento de PII em prod |

---

## 4. Melhorias de UI/UX

- **`StatusBadge` consumir `STATUS_VARIANT_MAP`/`getStatusVariant`** como tom semântico, e `statusConfig` ficar só com `{icon, label}`. Cor vira função de `variant` mapeado para token (`bg-${variant}/10 text-${variant} border-${variant}/20`). Mata as 4 chaves Tailwind palette direta.
- **Estender `ui/badge.tsx`** com variants `success|warning|info|muted` consumindo os mesmos tokens — todo lugar que usa `<Badge variant="default">` para status deveria poder `<Badge variant="success">`.
- **`DataTable` aceitar `hasActiveFilters: boolean` + `onClearFilters`** — quando filtros ativos e vazio, renderiza `<NoResultsState>` em vez de `<EmptyState>`.
- **`DataTable.renderMobileCards` consumir `MobileCardList`** internamente — eliminar duplicação. Unificar APIs (`mobilePrimary`/`mobileCard` no DataTable mapeia para `primary`/`render` do MobileCardList).
- **`pageSize` configurável** com seletor `[10, 25, 50, 100]` no toolbar.
- **`skipDeleteConfirm` por moduleKey** (não global).
- **`AdvancedFilterBar` mostrar chips ativos dentro do drawer mobile**, com sticky no top do drawer.
- **`onClearAll` aparecer com ≥1 filtro** (não ≥2).
- **`DrawerActionBar`** trocar ordem para `[leading, primary, separator, secondary, destructive]` — destructive separado visualmente à direita ou à esquerda com `Separator` vertical.
- **`DrawerStatusBanner`** colapsar `info` e `primary` em uma única tone, ou diferenciar via `border-l-2` mais forte.
- **`SummaryCard.variant="info"`** mapear para token `--info` (não `--primary`).
- **`FormModal` footer** somar `pb-[max(0.75rem,env(safe-area-inset-bottom))]` em mobile.
- **`OfflineBanner` usar `bg-warning/15 text-warning border-warning/30`** com `Alert` shadcn, não palette crua.
- **`AccessDenied.variant="action"`** add `role="status" aria-label="Acesso restrito ao recurso"`.
- **`FormProgress`** receber `requiredFields` por aba, calcular pct sobre obrigatórios, mostrar opcionais como contador secundário.
- **`PreviewModal`** mover header de impressão fora do `print-area` (atualmente é `no-print`, mas o `DialogContent` tem `print-area` na raiz — risco de imprimir o modal frame).
- **`ErrorBoundary`** trocar `<pre>{error.message}</pre>` por copy genérica + botão "Copiar detalhes técnicos" (só em dev) — e enviar evento para logger.

---

## 5. Melhorias estruturais

1. **Unificar fontes de status**: `StatusBadge` consome `STATUS_VARIANT_MAP` para cor; `statusConfig` interno fica apenas `{icon, label}` indexado pelo mesmo conjunto de chaves. `comprasStatus.ts` deixa de duplicar labels e passa a fornecer apenas aliases (`finalizada → aprovada`). Single source of truth.
2. **Deletar `FilterBar.tsx`** (sem importadores) e remover do barrel.
3. **Migrar 5 consumidores de `ViewDrawer.tsx` para `ViewDrawerV2`**, mover `ViewField`/`ViewSection` para arquivo neutro `src/components/ui/ViewField.tsx`, deletar `ViewDrawer.tsx`.
4. **Migrar 7 consumidores de `StatCard` para `SummaryCard`**, deletar shim.
5. **Migrar `usuarios/UsuariosTab` `EmptyState` legacy** para `@/components/ui/empty-state`, deletar shim raiz.
6. **`DataTable.renderMobileCards` delegar a `MobileCardList`** com adapter de tipos.
7. **Decidir destino de `ui/chart.tsx`**: ou migrar charts para usar `ChartContainer`/`ChartConfig` (paleta unificada via CSS vars), ou deletar.
8. **Extrair `DataTable.exportData`** para hook `useDataTableExport(rows, columns, format)` — reduz God component.
9. **Mover `DataTable.savedFilters`/`rules`** para hook `useDataTableFilters(moduleKey)` — ou remover de vez se ninguém usa.
10. **Persistência de preferências unificada**: criar `useUserPreference<DataTablePrefs>(moduleKey)` que sync local↔Supabase com debounce. DataTable consome esse hook em vez de gerenciar localStorage + upsert manual.
11. **`Badge` variants** estender para `success|warning|info|muted` em `badge.tsx`.
12. **`Spinner`** adicionar `inline` mode (sem div wrapper) para inputs/buttons.
13. **Skeleton presets**: padronizar `<KpiRowSkeleton n={4}/>`, `<ChartSkeleton h={200}/>` no `content-skeletons.tsx`. Migrar 14 hand-rolled.
14. **`QuickAddClientModal` reescrever sobre `FormModal` + `FormSection`**, eliminando hand-rolled dialog.
15. **Documentar em `mem://tech/design-system-fontes-canonicas.md`** quais wrappers são canônicos (V2, ConfirmDialog, FormModal, AdvancedFilterBar, EmptyState/ui), quais são deprecated, e o contrato de status.

---

## 6. Roadmap de execução

| Fase | Entrega | Dep. | Esforço | Impacto |
|---|---|---|---|---|
| 1 | `StatusBadge` consome `STATUS_VARIANT_MAP`; remove cores Tailwind palette direta; `Badge` ganha variants `success/warning/info/muted` | — | M | Resolve críticos 1, 2, 10 |
| 2 | `DataTable` `EmptyState` → `NoResultsState` quando há filtros ativos (props `hasActiveFilters`/`onClearFilters`) | — | S | Resolve crítico 8 |
| 3 | `DrawerActionBar` reordenar `[primary, separator, destructive]`; `Spinner inline` mode | — | S | UX consistente |
| 4 | `DataTable.renderMobileCards` delega a `MobileCardList` (adapter de props) | — | M | Resolve crítico 5 |
| 5 | Migrar 5 consumidores de `ViewDrawer` para V2 + extrair `ViewField`/`ViewSection` para `ui/ViewField.tsx`; deletar `ViewDrawer.tsx` | Fase 1 | M | Resolve crítico 3 |
| 6 | Migrar 7 consumidores de `StatCard` para `SummaryCard`; deletar shim | — | M | Resolve crítico 7 |
| 7 | Migrar `UsuariosTab.EmptyState` legacy → `ui/empty-state`; deletar shim | — | S | Cleanup |
| 8 | Deletar `FilterBar.tsx` (sem clientes) | — | S | Cleanup |
| 9 | `FormModal` footer `pb-[max(0.75rem,env(safe-area-inset-bottom))]` em mobile | — | S | Resolve crítico 9 |
| 10 | Hook `useDataTablePrefs(moduleKey)` substitui persistência dupla local+Supabase no DataTable | — | M | Resolve crítico 4 (parte 1) |
| 11 | Extrair `useDataTableExport(rows, columns)` do DataTable | Fase 10 | M | Resolve crítico 4 (parte 2) |
| 12 | Decidir destino de `ui/chart.tsx`: adotar para todos os 5 charts (`VendasChart`, `FluxoCaixaChart`, `KpiDetailDrawer`, `RelatorioChart`, `FluxoCaixa`) **ou** deletar | — | L | Resolve crítico 6 |
| 13 | `OfflineBanner` migra para `Alert` shadcn com tone warning; `ErrorBoundary` mascara error.message em prod | — | S | Resolve críticos 12, 13 |
| 14 | `QuickAddClientModal` reescrito sobre `FormModal` + `FormSection` + `FormModalFooter` | — | M | Coerência |
| 15 | `mem://tech/design-system-fontes-canonicas.md` documenta wrappers canônicos, deprecated e contrato de status | Fases 1, 5, 6 | S | Governança |

**Quick wins (1 PR cada)**: 2, 3, 7, 8, 9, 13.
**Refatoração estrutural**: 1, 4, 5, 6, 10, 11, 14, 15.
**Evolução de produto**: 12.

