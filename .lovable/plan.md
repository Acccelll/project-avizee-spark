

# Revisão Mobile — Administração

Análise focada em **<768px**, baseada em `src/pages/Administracao.tsx`, `AdminSidebar.tsx`, `UsuariosTab.tsx`, `UserFilters.tsx`, `UserRow.tsx`, `UserFormModal.tsx`, `PermissionMatrix.tsx`, `PerfisCatalogoSection.tsx`, `EmpresaSection.tsx`, `IntegracoesSection.tsx`, `SectionShell.tsx`, `DashboardAdmin.tsx`. O módulo **nunca recebeu refactor mobile** — é o último grande módulo ainda 100% desktop-first.

---

## 1. Visão geral

Administração é, por natureza, um módulo **operacional/desktop** — densidade alta, edição complexa, formulários longos. Mas hoje no mobile **bloqueia completamente** três fluxos críticos:

- **Sidebar agrupada** (`AdminSidebar`, `lg:w-60`): em mobile ela cai como **bloco vertical empilhado no topo**, com **4 grupos × 2-6 itens = ~12 botões antes de qualquer conteúdo**. O usuário rola 600-700px só para passar do sumário e chegar à seção ativa. Não há collapsible nem `Sheet`.
- **Matriz de permissões** (`PermissionMatrix`): grid de **15+ recursos × 8 ações = 120 toggles** em `sm:grid-cols-2` (1 col em mobile). Botões `text-xs px-2.5 py-1.5` (~28px de altura) com ciclo `inherited→deny→none→allow→none` por **tap**, sem long-press, sem confirmação. Inviável para edição real.
- **`UserFormModal`** (`size="lg"`) com 4 blocos sequenciais (Dados / Segurança / Acesso + Matrix / Auditoria) num `Dialog` que vira full-screen em mobile mas com **scroll vertical de >2000px** quando expande recursos.
- **Lista de usuários (`UserRow`)**: cards `flex-col sm:flex-row` razoáveis, mas os botões ⋯ e Edit têm `h-8 w-8` (32px — abaixo de touch target). `RoleBadge` + `StatusBadge` quebram em nova linha.
- **`SectionShell`** com header (Card) + conteúdo (Cards) + barra "salvar" `flex-col sm:flex-row` no final. Em formulários longos (Empresa = 478 linhas, ~10 inputs em 4 cards), o botão Salvar fica perdido no fim, sem sticky.
- **`DashboardAdmin`**: `SummaryCard`s `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` = 4 cards empilhados em mobile (~320px só de KPIs); timeline de eventos com barra horizontal pode estourar.
- **Sem navegação contextual mobile**: usuário não tem indicação visual de "qual seção estou" enquanto rola — sidebar fica acima, fora do viewport.

## 2. Problemas críticos (bloqueiam uso real)

- **C1 — Sidebar empilhada no topo**: `grid lg:grid-cols-[240px_minmax(0,1fr)]` em mobile vira `grid-cols-1`, jogando a sidebar **inteira** acima do conteúdo. 4 grupos × labels uppercase + 12 itens com `py-2 px-2.5` + separadores = ~600px de altura. Cada troca de seção exige scroll-to-top + tap + scroll-back. Pior UX possível.
- **C2 — `PermissionMatrix` impraticável em mobile**: grid de 15 recursos × 8 ações com toggles `text-xs` ~28px de altura, ciclo de 4 estados por tap único, sem feedback claro. Editar um único usuário requer dezenas de toques precisos. **Deve ser bloqueado para edição mobile** com mensagem explicativa.
- **C3 — `UserFormModal` longo demais**: `FormModal size="lg"` em mobile é full-screen mas o conteúdo tem 4 blocos sequenciais (Dados / Segurança / Acesso + Matrix com 15+ recursos / Auditoria) = scroll vertical >2000px. Botões "Cancelar/Salvar" ficam só no fim, sem sticky footer (FormModal já tem footer prop mas o modal **não usa** — mete os botões inline).
- **C4 — Sem contexto de seção ativa**: ao rolar a sidebar para baixo e chegar no conteúdo, perde-se a referência de "qual seção". Não há header sticky com nome da seção. Para voltar à navegação, scroll-to-top.
- **C5 — Touch targets < 44px** em todo o módulo: AdminSidebar `py-2 px-2.5` (~36px), UserRow ações `h-8 w-8` (32px), PermissionMatrix toggles ~28px, UserFilters botões `h-9` (36px). Falham consistentemente.
- **C6 — Edição de seções de configuração (Empresa, Integrações, Email, Notificações, Backup, Fiscal, Financeiro) sem sticky save**: `EmpresaSection` tem 10+ inputs em 4 cards (~1500px). O `SectionShell` põe a barra Salvar no final do scroll. Usuário muda 1 campo → precisa rolar 1500px para salvar.

## 3. Problemas médios (atrapalham uso)

- **M1 — `UsuariosTab` summary 4 KPIs empilhados** em mobile (`grid-cols-2 md:grid-cols-4` — duas linhas de 2 cards = razoável, mas o card de orientação acima `grid md:grid-cols-3` quebra em 3 linhas verticais antes mesmo dos KPIs).
- **M2 — `UserFilters`**: search full-width OK, mas 2 selects `w-36`/`w-44` + 2 botões viram `flex-wrap` — em 360px = 4 linhas de filtros. Selects `h-9` (36px) e botões idem, abaixo do touch target.
- **M3 — `PerfisCatalogoSection` Tabs + `RolesCatalog` + `PermissaoMatrix`**: matriz cruzando recursos x roles = tabela larga; em mobile força scroll horizontal sem indicação. Tabs de "Catálogo" e "Matriz" funcionam, mas conteúdo é desktop-only.
- **M4 — `DashboardAdmin` SummaryCards** `grid-cols-1` em mobile (4 cards empilhados ~320px de altura). Deveria ser `grid-cols-2` (2x2).
- **M5 — Itens externos (Migração / Auditoria)** dentro da sidebar agrupada têm ícone `ArrowUpRight` mas em mobile, num menu já compacto, são confundidos com seções internas. Ao tappar saem do módulo sem aviso.
- **M6 — `UserRow` ações ocultas no `⋯`**: a ação principal "Editar" tem botão dedicado (`h-8 w-8`) **e** está duplicada no menu. Em mobile só o tap no card todo deveria abrir edição.
- **M7 — `IntegracoesSection`** com Textarea de certificado SEFAZ em base64 (~60 linhas). Em mobile, área de texto enorme, com toggle "Mostrar/Ocultar" pequeno e validação reativa.
- **M8 — Sem skeletons reais** em `UsuariosTab` (mostra `<Loader2 /> Carregando…` num card centralizado), `PerfisCatalogoSection` idem, `EmpresaSection` (carrega via hooks mas não mostra skeleton dos campos).
- **M9 — `ToggleStatusDialog` e `TempPasswordDialog`** em mobile são `Dialog` com `max-w-md` — viram full-screen sem usar bottom-sheet, sem touch targets enlarged.
- **M10 — `PermissionMatrix` legenda no header** com 4 dots + labels em `flex-wrap`: em 360px ocupa 2 linhas e pode passar despercebida.

## 4. Problemas leves (polimento)

- **L1 — `ModulePage` subtitle** "Governança, parâmetros globais e gestão do sistema." quebra em 3 linhas em 360px.
- **L2 — Card de "orientação" (3 boxes role/complementar/revogada)** em `UsuariosTab` ocupa ~280px mobile — útil em desktop, ruído em mobile.
- **L3 — `UserRow`** badge "exceções" `text-[10px]` (10px é abaixo do recomendado 11-12px para legibilidade mobile).
- **L4 — `EmpresaSection`** preview de logo + color pickers customizados — funciona mas exige precisão de mouse para escolher cores exatas (color picker nativo mobile cobre tela inteira).
- **L5 — `UserFormModal` "Bloco 4 — Auditoria"** com 3 cards de timestamp — informação raramente consultada em mobile, deveria estar colapsada.
- **L6 — Toasts** longos como "Usuário criado e convite enviado por e-mail." cortam em mobile.

## 5. Melhorias de layout

- **Sidebar mobile = `Sheet` lateral**: trocar a sidebar empilhada por um `Sheet` lateral (left) acionado por botão "Menu Admin" sticky no topo do conteúdo. Em desktop (`lg+`) mantém o grid `[240px_1fr]`.
- **Header sticky com nome da seção**: bar mobile sticky `top-0 z-20` com `[← Menu]` + título da seção ativa + ações secundárias em `⋯`. Resolve C4 e dá ponto de retorno consistente.
- **Sticky save bar mobile**: nas seções de configuração (`SectionShell` quando `onSave` presente), sticky bottom bar com `safe-area-inset-bottom` contendo "Salvar". Resolve C6.
- **`PermissionMatrix` mobile read-only by default**: em mobile, render apenas em modo visualização — lista compacta de recursos com contagem de overrides. Edição mostra Alert: *"A matriz de permissões é otimizada para edição em telas maiores. No mobile você pode visualizar; para editar use desktop."* Permite edição "quick toggle" só de allow/deny via tap longo + ConfirmDialog (raro).
- **`UserFormModal` multi-step em mobile**: dividir em **Steps** ("Dados" → "Acesso" → "Permissões" → "Revisão"). Cada step cabe sem scroll, com sticky footer "Voltar / Próximo / Salvar". Permissions Step em mobile = link "Ver matriz completa (desktop)" + lista read-only de permissões herdadas do role escolhido.
- **`UsuariosTab` filtros como bottom-sheet**: substituir `UserFilters` inline por botão "Filtros (n)" abrindo `Sheet` mobile com inputs full-width `h-11`.
- **`UserRow` mobile**: card inteiro tappable abre detalhe (sheet ou navega para `/administracao/usuarios/:id`); ações secundárias (Inativar/Reativar) num único `⋯` `min-h-11 min-w-11`.
- **`DashboardAdmin` KPIs `grid-cols-2`** em mobile (2x2). Timeline com chart full-width.
- **Itens externos da sidebar destacados**: no `Sheet` mobile, mover "Migração" e "Auditoria" para um grupo separado no fim com ícone `ArrowUpRight` proeminente e label "Sai da Administração".
- **Esconder card de "orientação"** em mobile (`hidden md:block`) ou colapsar em accordion "Como funcionam permissões?".

## 6. Melhorias de navegação

- **Botão fixo "Menu Admin" sticky top mobile** que abre o `Sheet` da sidebar (substitui o bloco empilhado).
- **Voltar do modal**: `UserFormModal` em mobile com header `[← Voltar] Editar usuário` em vez de X no canto.
- **Breadcrumb mobile**: em seções, sub-header pequeno `Administração / Empresa` linkando de volta.
- **Atalho de seção via URL**: já funciona (`?tab=`); manter, e o `Sheet` reflete o `activeKey` ao abrir.

## 7. Melhorias de componentes

- **`AdminSidebar`**: detectar `useIsMobile()` e renderizar dentro de um `<Sheet side="left">` controlado por estado externo (botão no header sticky). Items com `min-h-11`, ícones `h-5 w-5`.
- **`SectionShell`**: aceitar prop `mobileStickyFooter` que renderiza a barra de salvar como sticky bottom em mobile (`fixed bottom-0 left-0 right-0 z-30 border-t bg-background pb-[env(safe-area-inset-bottom)]`).
- **`PermissionMatrix`**: nova prop `mobileMode?: 'view-only' | 'allow-edit'`; em mobile força `view-only` por padrão. Render compacto com lista de recursos + contagem allow/deny e expand para ver detalhes (sem botões cycle).
- **`UserFormModal`**: branching `useIsMobile()` → renderizar como `Sheet` bottom full-height com **stepper** (`Step 1 de 4`) em vez de modal scroll-único; sticky footer com Voltar/Próximo/Salvar `min-h-11`.
- **`UserFilters`**: em mobile, search full-width sempre visível + botão único "Filtros (n)" abrindo `Sheet`.
- **`UserRow`**: mobile compacto — card tappable abre menu de ações em `Sheet`; remover botão Edit dedicado (deduplicação).
- **`DashboardAdmin`**: `grid-cols-2` em mobile para SummaryCards.
- **`PerfisCatalogoSection`**: em mobile, `PermissaoMatrix` (cross-table) é substituída por accordion "Por role" — lista cada role com permissões herdadas em chips, sem grid horizontal.
- **`ToggleStatusDialog`/`TempPasswordDialog`**: em mobile usar `Drawer` (bottom-sheet) em vez de `Dialog`.
- **Skeletons reais** (`Skeleton` shadcn) substituindo `Loader2 + texto`.

## 8. Melhorias de fluxo

- **Visualizar usuário em 1 toque**: tap no card → sheet com dados, role, permissões herdadas (read-only). Edição completa no desktop.
- **Inativar/Reativar usuário em mobile**: 1 tap no card → sheet de ações → "Inativar" com `Drawer` de confirmação. Resolve uso real comum no mobile (admin precisa revogar acesso urgente do celular).
- **Ver dashboard de segurança no mobile**: KPIs 2x2 + timeline visível sem scroll excessivo. Drill-down para `/auditoria` (já externo).
- **Editar configuração**: em mobile, recomendar via toast amarelo no topo das seções editáveis: *"Edição completa otimizada para desktop"*. Permitir mudanças simples (toggles, inputs únicos), mas não esperar formulários longos.
- **Trocar de seção**: tap no botão Menu sticky → Sheet → seleciona → fecha → conteúdo carrega (sem scroll-to-top manual).

## 9. Sugestões de redesign mobile (sem inventar sistema novo)

Reutilizar padrões consolidados:

- **`Sheet`** lateral para sidebar e bottom para filtros/ações (já usado em Comercial/Financeiro/Fiscal/Relatórios).
- **`Drawer` bottom-sheet** para confirmações destrutivas (já padronizado em `mem://produto/comercial-mobile.md`).
- **Sticky header/footer com `safe-area-inset`** (já em `FormModal.tsx` linha 147).
- **`useIsMobile()`** hook para branching condicional.
- **`Skeleton`** shadcn em todos os loadings.
- **`min-h-11 min-w-11`** como mínimo de touch target.
- **Stepper em mobile** para forms longos (já há padrão em `mem://produto/quando-drawer-quando-pagina.md`: form com itens dinâmicos vai para página).
- Documentar em **`mem://produto/administracao-mobile.md`**.

## 10. Roadmap de execução

| # | Etapa | Resolve | Esforço |
|---|---|---|---|
| **1** | `AdminSidebar` mobile como `Sheet` lateral; botão "Menu Admin" sticky no topo do conteúdo com nome da seção ativa; itens com `min-h-11` | C1, C4, C5 | M |
| **2** | `PermissionMatrix` modo `view-only` em mobile com Alert "edição otimizada para desktop"; lista compacta com contagem allow/deny, sem ciclo cycle | C2 | M |
| **3** | `UserFormModal` em mobile como `Sheet` bottom full-height com stepper de 4 passos (Dados / Status / Acesso / Auditoria); sticky footer Voltar/Próximo/Salvar `min-h-11`; passo Permissões = read-only herdado + link "Editar matriz no desktop" | C3 | L |
| **4** | `SectionShell` com prop `mobileStickyFooter`: em mobile, barra Salvar `fixed bottom-0` com safe-area; aplicar nas 7 seções editáveis (Empresa, Email, Integrações, Notificações, Backup, Fiscal, Financeiro) | C6 | S |
| **5** | `UserFilters` mobile como `Sheet` bottom: search full-width + botão "Filtros (n)" abre sheet com inputs `h-11` | M2, C5 | S |
| **6** | `UserRow` mobile: card tappable → bottom-sheet com ações; remover botão Edit dedicado; ações `min-h-11 min-w-11` | M6, C5 | S |
| **7** | `DashboardAdmin` KPIs `grid-cols-2` em mobile; timeline full-width | M4 | XS |
| **8** | `PerfisCatalogoSection` mobile: substituir `PermissaoMatrix` (grid cross-table) por accordion "Por role" com chips de permissões herdadas | M3 | M |
| **9** | `ToggleStatusDialog` e `TempPasswordDialog` em mobile como `Drawer` bottom-sheet com botões `min-h-11` | M9 | S |
| **10** | Skeletons reais (`Skeleton` shadcn) em `UsuariosTab`, `PerfisCatalogoSection`, `EmpresaSection` substituindo `Loader2 + texto` | M8 | XS |
| **11** | Polimento: ocultar card de "orientação" em mobile (`hidden md:block`); colapsar Auditoria do `UserFormModal`; itens externos (Migração/Auditoria) destacados no Sheet com label "Sai da Administração"; subtitle truncate; badge `text-[11px]` | L1, L2, L5, M5, L3 | XS |
| **12** | `IntegracoesSection`: Textarea SEFAZ em mobile com altura reduzida + `monospace text-xs`; toggle Mostrar/Ocultar `min-h-11` | M7 | XS |
| **13** | Documentar em `mem://produto/administracao-mobile.md` + atualizar `mem://index.md` | governança | XS |

**Quick wins (alto valor, baixo risco)**: 4, 5, 6, 7, 9, 10, 11, 12.
**Estruturais (mudam fluxo)**: 1, 2, 3, 8.
**Polimento**: 13.

