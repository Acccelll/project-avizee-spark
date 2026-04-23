

# Revisão Profunda — Navegação Global e Layout Base

Análise baseada **exclusivamente** no estado real: `AppLayout.tsx` (109 LOC), `AppSidebar.tsx` (185 LOC), `AppHeader.tsx` (250 LOC), `AppBreadcrumbs.tsx` (151 LOC), `MobileBottomNav.tsx` (94 LOC), `MobileMenu.tsx` (175 LOC), `MobileQuickActions.tsx` (55 LOC), `GlobalSearch.tsx` (227 LOC), `SidebarSection.tsx`, `SidebarFooter.tsx`, `lib/navigation.ts` (348 LOC), `useNavigationState.ts`, `useVisibleNavSections.ts`, `useSidebarBadges.ts`, `useGlobalHotkeys.ts`, `App.tsx` (router).

> **Fato central**: a fundação é boa (fonte única `navSections`, gate único `useVisibleNavSections`, hotkeys no shell, breadcrumbs com siblings). Mas há **três grupos de incoerências reais**: (1) **rotas existentes que não estão no menu nem em permission map** (`/funcionarios`, `/socios`, `/contas-bancarias`, `/fluxo-caixa`, `/conciliacao` → permissão `financeiro` mas a seção `financeiro` cobre só sub-itens listados); (2) **mobile e desktop divergem** em ações rápidas (`MobileQuickActions` repete `quickActions` que já existem no header) e em destinos das bottom tabs (`/orcamentos` em "Comercial" mas seção também tem `/pedidos`); (3) **breadcrumbs constroem segmentos sintéticos quebrados** para rotas com `:id` (ex: `/orcamentos/abc-123` vira "Dashboard › Orçamentos › abc-123" porque `getRouteLabel` cai no fallback "Orçamento" mas o segmento UUID aparece como label cru se o prefixo não for reconhecido).

---

## 1. Visão geral do módulo

- **Shell**: `AppLayout` monta uma única vez sob rotas autenticadas (`<Route element={<AppLayout />}>`). Hospeda `AppSidebar` (desktop), `AppHeader`, `MobileMenu`, `MobileBottomNav`, `MobileQuickActions`, `RelationalDrawerStack`, `GlobalSearch`, `GlobalShortcutsDialog` e registra `useGlobalHotkeys` uma única vez.
- **Modos da sidebar**: `dynamic` (default; recolhida 72px, expande no hover via `onMouseEnter` no wrapper, conteúdo nunca empurrado), `fixed-collapsed`, `fixed-expanded`. Persistência via `useAppConfigContext` (`sidebarCollapsed`, `sidebarMode`).
- **Header desktop**: breadcrumb + botão "Novo" (dropdown com `quickActions`) + busca + atalhos + notificações + avatar.
- **Header mobile**: back button (se `pathname !== '/'`) + ícone+título da página + busca + atalhos + notificações + avatar.
- **Bottom nav mobile**: 4 tabs (`Início`, `Comercial`, `Cadastros`, `Financeiro`) + botão `Menu`. Filtra tabs por `useVisibleSectionKeys()` mantendo "Início" sempre.
- **MobileQuickActions**: FAB `+` flutuante (acima da bottom nav) que abre Drawer com `quickActions`.
- **MobileMenu**: Drawer com busca, 3 atalhos (`quickActions.slice(0,3)`), todas as seções *exceto* as 3 cobertas por bottom tabs, e bloco de perfil/tema/sair.
- **Navegação derivada**:
  - `lib/navigation.ts` exporta `navSections` (fonte única, 9 seções), `flatNavItems`, `headerIcons`, `getRouteLabel`, `getNavSectionKey`, `quickActions`, `mobileBottomTabs`, `mobileMenuSections`.
  - `useVisibleNavSections` filtra seções por `can(resource:visualizar)` ou role admin (com fallback granular para usuários sem roles reconhecidos).
  - `useNavigationState` calcula `activeSectionKeys`, `isItemActive`, e gerencia colapso manual via `useUserPreference('sidebar_sections_state')` por usuário.
  - `useSidebarBadges` deriva 3 contadores reais: `financeiro` (vencidos+vencer), `estoque` (baixo), `comercial` (orçamentos pendentes).
- **Hotkeys globais**: Cmd+N (orçamento), Cmd+Shift+{N,C,P} (NF saída/cliente/produto), Cmd+/ (atalhos), Cmd+1..9 (rotas fixas), `?` (busca).
- **Permissão x rota**: 7 guards em uso — `ProtectedRoute` (só sessão), `PermissionRoute resource=...`, `AdminRoute`, `SocialRoute`. Quase todas as rotas usam `PermissionRoute` granular.

---

## 2. Problemas encontrados

### 2.1 Mapa permissão × menu × rota (incoerências reais)

1. **`/funcionarios` está no menu (`Cadastros`)** mas a rota é `<ProtectedRoute>` sem permissão granular. Qualquer usuário autenticado entra. O item aparece para todos que veem a seção `cadastros` (que requer `produtos|clientes|fornecedores|...`), criando situação onde quem só tem `formas_pagamento:visualizar` vê "Funcionários" no menu.
2. **`/socios` no menu Cadastros** com guard `PermissionRoute resource="socios"`. Mas `useVisibleNavSections` mapeia `cadastros` apenas para `['produtos','clientes','fornecedores','transportadoras','formas_pagamento']` — **`socios` não entra nessa lista**. Resultado: usuário com permissão *exclusivamente* a `socios` **não vê o menu Cadastros** (a seção fica oculta), mas tem acesso ao recurso. Quebra a regra "se vejo no menu, posso entrar".
3. **`/socios-participacoes` mapeado em `financeiro`** (mapa: `['financeiro','socios']`) mas o item está listado dentro da seção `Financeiro` no `navSections`. Coerente, porém: o **mesmo recurso `socios`** aparece em duas seções distintas (Cadastros e Financeiro) — o usuário com permissão `socios` vê dois links para fluxos diferentes da mesma entidade, sem indicação de qual é "cadastro" vs "operação".
4. **`/grupos-economicos` requer `clientes:visualizar`** (`<PermissionRoute resource="clientes">`), mas é um cadastro de natureza distinta. Quem perde permissão de Clientes mas precisa só de Grupos Econômicos fica travado. Acoplamento implícito não documentado.
5. **`/configuracoes` aparece em rota como `<ProtectedRoute>`** (qualquer autenticado), mas o **footer da sidebar mostra "Configurações" sempre** mesmo para usuários sem nenhuma seção visível. Coerente com o conceito (todo usuário tem perfil), mas o footer também mostra "Sincronizado há Xs" baseado em badges que dependem de permissões — se `useSidebarAlerts` falha por RLS, o ícone fica perpetuamente "fora de sincronia".
6. **`/auditoria` no submenu de Administração** + rota com `PermissionRoute resource="auditoria"`. Mas a seção `administracao` é mapeada apenas para `['administracao']`. **Quem tem `auditoria:visualizar` mas não `administracao:visualizar` não vê o menu**, mesmo podendo entrar via URL — exatamente o caso "compliance officer" descrito no roadmap recente do módulo Auditoria.
7. **`/contas-bancarias`, `/fluxo-caixa`, `/contas-contabeis-plano`, `/conciliacao`** — todos exigem `financeiro:visualizar`. Usuário com role `vendedor` que precisa só ver Fluxo de Caixa não pode. Granularidade de permissão financeira insuficiente, mas isso reflete `permissions.ts`, não a navegação per se. **A coerência está OK; a granularidade é fraca.**
8. **`/relatorios/workbook-gerencial` requer `workbook:visualizar`** e **`/relatorios/apresentacao-gerencial` requer `apresentacao:visualizar`**. Mas a seção `relatorios` no `useVisibleNavSections` é mapeada apenas para `['relatorios']`. Usuário com **só** `workbook:visualizar` (sem `relatorios`) **não vê o menu Relatórios** mas pode acessar via URL. Mesmo padrão do problema 6.
9. **Rota `/unidades-medida` redireciona para `/produtos`** mas não está no menu. Item legado ressurgindo via deep-link sem aviso na UI.
10. **Rota `/compras` redireciona para `/pedidos-compra`**; `/remessas` → `/logistica`; `/cotacoes` → `/orcamentos`; `/ordens-venda` → `/pedidos`; `/caixa` → `/financeiro`. Cinco redirects legados — corretos, mas nenhum toast/aviso "renomeado". Quem tem bookmark perde contexto silenciosamente.

### 2.2 Mobile vs desktop divergem

11. **Bottom tab "Cadastros" leva para `/clientes`**, mas o usuário pode ter permissão a `produtos` mas não a `clientes`. Tab fica visível (pois `useVisibleSectionKeys` aceita `cadastros` se *qualquer* recurso filho passa) e leva para tela com `AccessDenied`. Mesma trincheira para "Financeiro" → `/financeiro?tipo=receber` (alguém com só `socios` veria a tab e bateria em AccessDenied).
12. **Bottom tab "Comercial" → `/orcamentos`** mas a seção também tem `/pedidos`. Decisão arbitrária — sem indicação visual de que existem mais módulos comerciais por trás.
13. **`MobileQuickActions` (FAB)** e **botão "Novo" no header desktop** usam **a mesma lista** `quickActions` (6 itens). Mobile não tem `MobileQuickActions` aberto via header — é apenas o FAB. Mas o **MobileMenu drawer** mostra `quickActions.slice(0, 3)` no topo: **três versões do mesmo conteúdo no mobile** (FAB com 6, drawer com 3, sem botão no header).
14. **`MobileQuickActions.tsx` posiciona FAB em `bottom-[5.8rem]`** (acima da bottom nav). Em iPhone com `safe-area-inset-bottom`, o cálculo não soma o inset → FAB fica colado na bottom nav em alguns devices, sem `pb-[env(safe-area-inset-bottom)]` próprio.
15. **Header mobile não tem botão "Novo"** — usuário precisa abrir bottom nav → menu/FAB. Inconsistente com desktop, onde ação de criação é primária.
16. **`MobileMenu` mostra Atalhos com **`slice(0, 3)`** sem critério** — corta `nova-nota-saida`, `baixa-financeira`, `novo-pedido-compra`. Decisão arbitrária e silenciosa.
17. **MobileMenu re-renderiza `BOTTOM_TAB_KEYS = new Set([...])` em cada call** (linha 18 — fora do componente, ok), mas duplicado em `lib/navigation.ts` (`BOTTOM_TAB_SECTION_KEYS`). Duas fontes para a mesma decisão.

### 2.3 Breadcrumbs e títulos contextuais

18. **Breadcrumbs montam segmentos sintéticos** dividindo `pathname.split('/')` e chamando `getRouteLabel(currentPath)` para cada um (linhas 80-85). Rota `/orcamentos/abc-123-uuid`:
    - segmento `/orcamentos` → "Orçamentos" (OK)
    - segmento `/orcamentos/abc-123-uuid` → cai em `if (pathname.startsWith('/orcamentos/')) return 'Orçamento'` (OK)
    
    Mas para `/cotacoes-compra/abc-123-uuid`: **não há fallback para `/cotacoes-compra/`** em `getRouteLabel`. Cai em `'ERP AviZee'`. Breadcrumb fica "Dashboard › Cotações de Compra › ERP AviZee".
19. **Mesmo problema**: `/pedidos-compra/:id`, `/pedidos/:id`, `/fiscal/:id`, `/fiscal/:id/editar`, `/remessas/:id`. **Cinco rotas com `:id` sem fallback de label**. Todas vão render "ERP AviZee" no último segmento.
20. **`/fiscal/:id/editar`** gera `[Dashboard, /fiscal, /fiscal/:id, /fiscal/:id/editar]`. O segmento intermediário `/fiscal/:id` produz `"Fiscal"` (via fallback `startsWith('/fiscal')`). Mas `getRouteLabel('/fiscal/:id/editar')` também cai no fallback `'Fiscal'`. **Dois segmentos com a mesma label** → "Dashboard › Fiscal › Fiscal › Fiscal". A guarda `lastItem.label !== contextualLabel` (linha 89) só evita o último duplicado, não os intermediários.
21. **`siblingMap` indexa por path-base do menu** (linha 67-69). Para uma página de detalhe (`/orcamentos/123`), o segmento intermediário `/orcamentos` *tem* siblings (Orçamentos e Pedidos), mas o cabeçalho mostra dropdown apenas no penúltimo nível. A regra `siblings.length > 1` faz o dropdown aparecer só quando há >1 — para a maioria das seções com apenas 1 grupo (ex: Cadastros, Comercial), o dropdown aparece. Para a seção Comercial com 2 itens, OK. Mas o ícone só aparece no segundo item (`showIcon = index === 1`) — `/configuracoes/seguranca` (não existe; é `/configuracoes?tab=seguranca`) e outras tabs internas **não aparecem como segmento** (são query, não path).
22. **`resolvePageTitle` cobre `?tab=` para `/administracao` e `?tipo=` para `/relatorios` e `/financeiro`**, mas **não cobre** `/fiscal?tipo=entrada` vs `/fiscal?tipo=saida` — ambos são entradas distintas no menu mas o título é apenas "Fiscal".
23. **`headerIcons` deriva de `flatNavItems`**, mas dois ícones são "fixados": `'/configuracoes': Settings` e `'/fiscal': Receipt` (esse último já viria do `flatNavItems` se a entrada não tivesse `?tipo=...`). Hack porque `/fiscal` (sem query) é uma rota inexistente no menu — só `/fiscal?tipo=entrada|saida` aparece.

### 2.4 Sidebar e UX de seções

24. **`SidebarSection` no modo colapsado**: clicar no ícone **expande a sidebar inteira** (`onExpandRail()`), em vez de navegar/exibir tooltip com submenu. Usuário com sidebar colapsada perde o "salto rápido" — precisa expandir, clicar, depois recolher manual. Sem flyout.
25. **No modo `dynamic` (default)**, o hover *expande visualmente* (overlay), mas clicar em uma seção **navega** ou **toggle expand** dependendo de `directPath`. Com auto-collapse no `mouseLeave`, o usuário vê o menu sumir antes de a página carregar — flicker.
26. **Favoritos vivem em localStorage** (`useFavoritos`) — não sincroniza entre devices. Para um ERP B2B com usuários multi-device, é regressão.
27. **`SidebarSection` pinta dot no canto superior direito quando colapsado e há badge** (linhas 113-118). Mas não há tooltip explicando o número. Usuário colapsado vê dot vermelho/amarelo/azul sem contexto.
28. **`SidebarFooter` mostra "Sincronizado há Xs"** (linha 24) com cor `bg-success` se < 60s. Não há indicação de "stale" prolongado (>5min) — fica muted-foreground/40 indistinguível do estado "nunca sincronizou".
29. **Item ativo na sidebar usa classes `sidebar-item-active`** (CSS global), mas o **dashboard** usa o mesmo padrão enquanto **direct-link sections** (apenas Social hoje) usam classe diferente (`sidebar-item-active` no botão, sem barrinha lateral idêntica). Inconsistência visual sutil.
30. **`useNavigationState.activeSectionKeys` permite múltiplas seções ativas simultaneamente** (`.filter(...)`). Cenário improvável (rotas não se sobrepõem), mas se acontecer, **duas seções aparecem destacadas** sem prioridade.

### 2.5 Header e área de busca

31. **`AppHeader` import do `useEffect`** está literalmente vazio: `void useEffect;` no fim do arquivo (linha 250) — comentário diz "mantido apenas pelo lint pré-existente". Dívida visível: lint regra mal calibrada ou import esquecido após refactor.
32. **`primaryRole`** prioriza admin, depois `roles[0]`. Para `[financeiro, vendedor]`, mostra "Financeiro". Decisão arbitrária — sem explicação na UI nem em mem://.
33. **Avatar mostra dot colorido por role** (4 cores), mas em hover/tooltip não há legenda. Usuário precisa abrir o dropdown para ver a label.
34. **`Plus` ("Novo") sempre visível** mesmo se nenhuma das `quickActions` for permitida ao usuário. Não há filtro de `quickActions` por permissão (`/orcamentos/novo` requer `orcamentos:editar`).
35. **`GlobalSearch` consulta 4 tabelas (`clientes`, `produtos`, `orcamentos`, `notas_fiscais`)** sem checar permissões. Usuário sem `orcamentos:visualizar` *vê resultados* na busca, clica e bate em AccessDenied. RLS provavelmente bloqueia o select, mas a UI não filtra explicitamente.
36. **`GlobalSearch` mostra resultado "Orçamentos" linkando para `/orcamentos/${o.id}`** mas para Clientes/Produtos linka para a lista (`/clientes`, `/produtos`) — sem deep-link para a entidade. Inconsistência: orçamento abre detalhe, cliente não abre drawer.
37. **`GlobalSearch` tem 3 listas separadas** (recentes, ações, navegação) + grupos de entidades. **A ordem** é: Recentes → Ações → Entidades → Navegação. Para usuário que digita "cli", o item "Clientes" (navegação) fica no fim depois de listas de clientes individuais. Hierarquia confusa.
38. **`GlobalSearch.useEffect` para Cmd+K** registra `keydown` global, **e `useGlobalHotkeys` no AppLayout também**. Não conflita pois `useGlobalHotkeys` não captura Cmd+K, mas **dois listeners globais para hotkeys** convivem sem coordenação central.

### 2.6 Hotkeys e atalhos

39. **`QUICK_NAV_ROUTES`** (Cmd+1..9) inclui `/relatorios` e `/configuracoes` — sem checar permissão. Cmd+8 leva para `/relatorios` mesmo se usuário não pode ver.
40. **Hotkeys de criação (Cmd+N para orçamento, Cmd+Shift+N para NF)** não são exibidas em nenhum lugar visível além do `GlobalShortcutsDialog`. Usuário não descobre.
41. **`GlobalShortcutsDialog` é separado da `GlobalSearch`** — busca tem dica "⌘K" no campo, atalhos têm dica "?" no campo. Mas Cmd+/ abre atalhos e `?` (sem mod) abre busca. **Confuso: dois acessos diferentes para conteúdos relacionados.**
42. **Hotkey Cmd+/ abre Shortcuts**, mas em layouts de teclado não-US (BR ABNT2), `/` requer Shift. Sem fallback.

### 2.7 AppLayout e responsividade

43. **`md:ml-[72px]` vs `md:ml-[240px]` hardcoded** em `AppLayout` linha 78. Se algum dia a sidebar mudar de largura, há drift entre AppLayout, AppSidebar (`w-[72px]`/`w-[240px]`) e cálculo de margem. Sem CSS variable.
44. **`max-w-[1600px]`** no `<main>` e no header. Acima de 1600 CSS px, há gap nas laterais. Sem indicação visual de que o conteúdo está centralizado — pode parecer bug em monitores 4K.
45. **`pb-28` em `<main>` mobile** garante que conteúdo não fique sob bottom nav. Mas é fixo: se bottom nav crescer (ex: badge), vai sobrepor.
46. **Não há indicação de "modo dynamic"** — usuário não sabe que sidebar vai expandir no hover. Sem onboarding/tooltip na primeira visita.
47. **Modo `dynamic` + hover gera muito reflow** — a margem do conteúdo principal *não* muda (mantém 72px), mas o overlay sobe com z-50 sobre conteúdo. Para usuários com tremor/Parkinson, o hover-leave acidental colapsa rapidamente.

### 2.8 Riscos estruturais

48. **`mobileBottomTabs` hardcoded** com 3 destinos específicos (`/orcamentos`, `/clientes`, `/financeiro?tipo=receber`). Adicionar/remover seção exige editar 3 lugares (`navSections`, `mobileBottomTabs`, `BOTTOM_TAB_SECTION_KEYS`).
49. **`siblingMap` em `AppBreadcrumbs`** rebuilda em cada render mesmo memoizado por `[]` deps — **só calcula uma vez na vida do componente**. Mudança de `navSections` em runtime (ex: feature flag Social) **não atualiza siblings**.
50. **Nenhuma rota tem fallback `<NotFound />` dentro do `AppLayout`** — a `*` rota está fora (linha 179), o que significa que NotFound **não tem sidebar/header** na UX. Acaba parecendo "log out involuntário".
51. **`AppSidebar` recebe `onToggleCollapsed` que chama `saveSidebarCollapsed(!collapsed)`** — mas em modo `dynamic`, `collapsed` sempre depende do hover, e o usuário ainda pode clicar no botão de colapsar/expandir. Resultado: clicar **não tem efeito visível** porque o modo dinâmico ignora a preferência boolean. Botão fantasma.
52. **`headerIcons` cobre `/fiscal` e `/configuracoes` manualmente**, mas a função fallback no `AppHeader.useMemo Icon` faz `Object.entries(headerIcons).find(([path]) => location.pathname.startsWith(path))`. Para `/orcamentos/abc-123`, encontra `/orcamentos`. Mas a ordem das entries não é determinística — em teoria pode bater `/` antes de `/orcamentos`. Há `path !== '/'` para mitigar, mas é frágil.
53. **`useGlobalHotkeys` não tem documentação no `GlobalShortcutsDialog`** das hotkeys reais (precisei abrir o hook para ver). Se dialog não estiver sincronizado, há mentira no UI.

---

## 3. Problemas prioritários

| # | Problema | Severidade | Impacto |
|---|---|---|---|
| 1 | Itens de menu × permissão de seção desalinhados (itens 2, 6, 8) | **Alta** | Usuários ficam invisíveis a menus, mas têm acesso via URL — pior UX de descoberta |
| 2 | Bottom tab leva para tela com AccessDenied (item 11) | **Alta** | Tap → erro |
| 3 | `/funcionarios` sem `PermissionRoute` (item 1) | **Alta** | Vazamento de cadastro de RH para qualquer autenticado |
| 4 | Breadcrumbs vazam "ERP AviZee" em rotas `:id` sem fallback (itens 18-19) | **Alta** | Quebra visual em 5+ telas |
| 5 | "Cadastros" mostra `socios` que não conta na visibilidade (item 2) | Média | Decisão de design quebrada |
| 6 | Quick actions não filtradas por permissão (itens 34, 39) | Média | Atalhos inúteis para o usuário |
| 7 | GlobalSearch não filtra por permissão (item 35) | Média | Resultados levam a AccessDenied |
| 8 | Modo `dynamic` + botão de toggle = sem efeito (item 51) | Média | Botão fantasma |
| 9 | NotFound fora do AppLayout (item 50) | Média | Parece logout |
| 10 | `pageTitle` não distingue entrada vs saída fiscal (item 22) | Baixa | Header genérico |
| 11 | `siblingMap` cacheado uma vez (item 49) | Baixa | Feature flag não atualiza siblings |
| 12 | `void useEffect;` no AppHeader (item 31) | Baixa | Dívida visual |

---

## 4. Melhorias de UI/UX

- **Filtrar `quickActions` por permissão**: cada `QuickAction` ganha campo opcional `requires?: PermissionKey`. `AppHeader` e `MobileQuickActions` filtram via `can(...)` antes de renderizar.
- **Filtrar `QUICK_NAV_ROUTES`** em `useGlobalHotkeys` por `useVisibleSectionKeys()`.
- **Tornar `GlobalSearch` permission-aware**: cada `EntityResult` carrega `requiredPermission`; resultados sem permissão são omitidos (não dependem só de RLS). Resultados de Cliente/Produto deveriam abrir drawer via `pushView` (`useRelationalNavigation`) em vez de listar.
- **Bottom tabs**: cada tab valida `can(resource:visualizar)` para o destino real, não só a presença da seção. Se não pode entrar em `/clientes`, redirecionar para `/produtos` ou `/fornecedores` (primeiro permitido).
- **Sidebar collapsed**: adicionar **flyout** (popover) ao hover de cada seção colapsada com lista de subitens, em vez de expandir a sidebar inteira.
- **Indicação de "modo dynamic"**: tooltip "Sidebar expande ao passar o mouse" na primeira sessão. Esconder o botão de toggle quando `sidebarMode === 'dynamic'` ou trocar para botão de "Mudar para fixo".
- **`MobileMenu`**: remover slice arbitrário; mostrar todas as `quickActions` filtradas por permissão.
- **`MobileQuickActions`**: somar `safe-area-inset-bottom` ao `bottom-[5.8rem]`.
- **Breadcrumb**: melhorar `getRouteLabel` cobrindo todas as 7 rotas com `:id`. Adicionar fallback genérico "Detalhe" só quando nada bate.
- **Resolver `/fiscal/:id/editar`**: detectar sufixo `/editar` e adicionar item explícito "Editar" no breadcrumb em vez de duplicar "Fiscal".
- **`resolvePageTitle`**: cobrir `/fiscal?tipo=entrada` → "Notas de Entrada" e `/fiscal?tipo=saida` → "Notas de Saída".
- **NotFound dentro do AppLayout**: rota catch-all aninhada em `<Route element={<AppLayout />}>` para preservar shell.
- **Footer "Sincronizado"**: três estados visuais (recente <60s verde / 60s-5min amarelo / >5min ou nunca cinza com tooltip).
- **Avatar**: tooltip mostrando role na hover (não só no dropdown).
- **`primaryRole`**: documentar prioridade ou mostrar todas as roles como chips no dropdown.

---

## 5. Melhorias estruturais

1. **Centralizar mapping seção→recursos × rotas reais**: `sectionResourcesMap` precisa cobrir TODOS os recursos cujas rotas estão na seção. Adicionar `socios` em `cadastros` e em `financeiro`; `auditoria` em `administracao`; `workbook`+`apresentacao` em `relatorios`. Ou inverter o cálculo: para cada seção, derivar resources do `flatNavItems` lendo a tabela de rotas em `App.tsx`.
2. **Adicionar `<PermissionRoute resource="usuarios">` ou similar a `/funcionarios`**. Reutilizar `usuarios` ou criar recurso `funcionarios` em `ERP_RESOURCES`.
3. **Substituir hardcoded `mobileBottomTabs`** por derivação de `navSections.slice(0, 3)` filtrada por permissão, ou marcar tabs em `navSections` com flag `mobileTab: true`. Eliminar `BOTTOM_TAB_SECTION_KEYS` duplicado.
4. **Mover `sibling` derivation para `lib/navigation.ts`** como função pura `getSiblings(path)` — uma fonte só, testável.
5. **Adicionar fallbacks de `getRouteLabel`** para cada prefixo `:id` real (`/cotacoes-compra/`, `/pedidos-compra/`, `/pedidos/`, `/fiscal/`, `/remessas/`).
6. **Sincronizar favoritos no backend** (`user_preferences`) — já existe infraestrutura `useUserPreference`.
7. **CSS variable para largura da sidebar** (`--sidebar-w-collapsed`, `--sidebar-w-expanded`) usada em `AppLayout` e `AppSidebar`. Elimina drift.
8. **NotFound aninhado** dentro do `<Route element={<AppLayout />}>`.
9. **Esconder/disable o botão de toggle de sidebar quando `sidebarMode === 'dynamic'`**.
10. **`GlobalSearch` consultar via RPC unificada** (`global_search(term)`) que respeita RLS e retorna entidades + permissão de leitura, em vez de 4 selects separados não-tipados.
11. **Atalho `Cmd+K`** centralizado em `useGlobalHotkeys` (remover listener de `GlobalSearch`).
12. **Documentar em `mem://navegacao/regras-visibilidade.md`** o contrato "se está no menu, o usuário pode entrar" (e o oposto).

---

## 6. Roadmap de execução

| Fase | Entrega | Dep. | Esforço | Impacto |
|---|---|---|---|---|
| 1 | Adicionar `socios`, `auditoria`, `workbook`, `apresentacao` ao `sectionResourcesMap` | — | S | Resolve crítico 1 |
| 2 | `/funcionarios` com `PermissionRoute resource="usuarios"` (ou novo `funcionarios`) | — | S | Fecha vazamento de RH |
| 3 | `getRouteLabel` cobre todas as rotas `:id`; tratar sufixo `/editar` em breadcrumbs | — | S | **Resolve crítico 4** |
| 4 | `resolvePageTitle` cobre `/fiscal?tipo=entrada|saida` | — | S | Header preciso |
| 5 | Filtrar `quickActions` por `requires?: PermissionKey` no header e mobile | — | M | Atalhos coerentes |
| 6 | Filtrar `QUICK_NAV_ROUTES` em `useGlobalHotkeys` por permissões | — | S | Hotkeys coerentes |
| 7 | Bottom tabs validam permissão do destino real; redirecionar para primeiro permitido | Fase 1 | M | Sem AccessDenied no tap |
| 8 | NotFound dentro do AppLayout; hide/disable toggle no modo `dynamic` | — | S | UX consistente |
| 9 | `MobileMenu`: remover slice; `MobileQuickActions` soma `safe-area-inset-bottom` | — | S | Mobile decente |
| 10 | Sidebar collapsed: flyout de subitens em vez de expandir o painel inteiro | — | M | Power-user UX |
| 11 | CSS variables para largura da sidebar; `siblingMap` movido para `lib/navigation.ts` | — | S | Eliminar drift |
| 12 | Sincronizar favoritos via `useUserPreference` (backend) | — | M | Multi-device |
| 13 | RPC `global_search(term)` retornando entidades autorizadas; consolidar Cmd+K | — | L | Permission-aware search |
| 14 | `GlobalSearch` resultados de Cliente/Produto/Orçamento abrem drawer via `pushView` | Fase 13 | M | Coerência relacional |
| 15 | `mem://navegacao/regras-visibilidade.md` documentando contrato menu↔permissão | Fases 1, 2 | S | Governança |

**Quick wins (1 PR cada)**: 1, 2, 3, 4, 8, 9, 11, 15.
**Refatoração estrutural**: 5, 6, 7, 10, 12, 14.
**Evolução de produto**: 13.

