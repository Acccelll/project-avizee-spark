

# Diagnóstico técnico — Navegação (menus, submenus, rotas, estados)

## Inventário
- **Fonte de verdade**: `src/lib/navigation.ts` (navSections, quickActions, mobileBottomTabs, mobileMenuSections, headerIcons, baseRouteLabels, flatNavItems, isPathActive, getRouteLabel, getNavSectionKey)
- **Index derivado**: `src/config/navigation.config.ts` (NAVIGATION_ITEMS / NAVIGATION_ITEMS_BY_PATH)
- **Consumidores**: `AppSidebar`, `MobileBottomNav`, `MobileMenu`, `AppBreadcrumbs`, `AppHeader` (hotkeys), `GlobalSearch`, `Favoritos`, `QuickActions` (dashboard, lista própria), `Administracao` (sub-nav local)
- **Roteamento**: `src/App.tsx` (45 rotas + 9 redirects)

## Problemas encontrados

### A. Rotas vs Menu — divergências reais

**A1. `/administracao?tab=*` quebrado** — submenus apontam para `tab=empresa|usuarios|email|fiscal|financeiro` (linhas 195-199), mas `AppBreadcrumbs.configTabs` mapeia chaves `geral|usuarios|email|fiscal|financeiro|aparencia` para `/configuracoes`. Isso significa: **(a)** os links do menu vão para `/administracao?tab=empresa`, mas o breadcrumb leitor está pensado para `/configuracoes`; **(b)** se `Administracao.tsx` não lê `?tab=`, todos os 5 links abrem a mesma aba inicial. Precisa verificar `Administracao.tsx`.

**A2. `Migração de Dados` e `Auditoria` listados sob "Administração"** — porém são rotas `/migracao-dados` e `/auditoria`, que são `AdminRoute` independentes. Os submenus 1 (Empresa/Usuários/...) e 2 (Migração/Auditoria) misturam navegação por aba interna com navegação por rota. Inconsistência estrutural — usuário não distingue.

**A3. Cadastros faltando** — `formas-pagamento` está no menu mas não tem entrada em `headerIcons`/`baseRouteLabels` consistente; `unidades-medida` aparece em `headerIcons` e `baseRouteLabels` mas a rota é `<Navigate to="/produtos">` (deprecada) e **não está no menu** — ok, mas o label/ícone órfão deveria ser removido.

**A4. Aliases ainda referenciados em headerIcons/baseRouteLabels**: `/cotacoes`, `/ordens-venda`, `/remessas`, `/caixa` — todos são `<Navigate>` redirects. Manter labels é defensivo, mas duplica manutenção. `/cotacoes` ainda exibe "Cotações" no breadcrumb durante o redirect transient.

**A5. `Workbook Gerencial` (`/relatorios/workbook-gerencial`) e `Apresentação Gerencial` (`/relatorios/apresentacao-gerencial`) estão sob "Financeiro"** no `navSections`, não sob "Relatórios". Mas a rota tem prefixo `/relatorios/` — incoerência semântica entre agrupamento do menu e estrutura de URL. Quando o usuário navega para essas rotas, `getNavSectionKey` retorna **`relatorios`** (porque match por `directPath` `/relatorios`), mas o submenu expandido fica em "Financeiro". Estado ativo bagunçado.

**A6. `Social` como `directPath`** — ok, mas filtro em `visibleSections` usa `socialPermissions.canViewModule` enquanto `sectionResourcesMap.social = ['dashboard']` (linha 83). Resource `dashboard` não representa Social — efeito: filtro roda 2× com lógicas diferentes. Confuso.

### B. Estado ativo / expansão

**B1. `getNavSectionKey` falha em rotas nested**
Para `/orcamentos/123` (formulário), itera `entry.items.some(...)` checando `pathname.startsWith(item.path + '/')`. Funciona para `/orcamentos`, mas **`/orcamentos/novo`** e **`/orcamentos/123`** retornam `comercial` ✓. Porém **`/relatorios/workbook-gerencial`** começa com `/relatorios` (directPath de Relatórios) → retorna `relatorios`, mas o item está sob `financeiro` (A5).

**B2. `isItemActive` na sidebar usa `currentRoute === targetPath` para itens com `?query`** (linha 107). Significa que `/fiscal?tipo=entrada` só fica ativo no match exato; navegando para `/fiscal/123` o item "Notas de Entrada" perde o ativo. Ok? Sim, mas o **submenu Fiscal não expande** porque `isItemActive` não considera nested + query. Resultado: ao abrir uma NF detalhe, o grupo Fiscal colapsa mesmo estando "dentro" do módulo.

**B3. Manual override vs derivado** — `manualSections[key]` sobrepõe estado derivado. Se o usuário fechar manualmente "Comercial" e depois clicar em `/orcamentos`, o submenu **não reabre** (linhas 166-171). Comportamento ambíguo: em ERPs maduros o clique em rota força expansão.

**B4. `activeSectionKeys` deps incompletas** — `useMemo([currentRoute, visibleSections])` mas `isItemActive` (closure) depende de `location.pathname`. Há um eslint-disable na linha 132 mascarando. Em prática `currentRoute` cobre, mas vale anotar.

### C. Permissões

**C1. `sectionResourcesMap` não casa com `permissions.ts`** — vou abrir para validar; provável que recursos como `'compras'`, `'logistica'`, `'faturamento_fiscal'` não existam todos no enum `ErpResource`. Cast implícito esconderia erros se houvesse `as`.

**C2. Filtro de Admin é binário** — `isAdmin ? all : remove(administracao)`. Mas `Migração de Dados` e `Auditoria` (dentro de "Administração") são `AdminRoute`. Para um não-admin, a seção inteira somem ✓. Mas **se um dia houver não-admin com acesso a Auditoria**, eles não verão. Acoplamento rígido.

**C3. Mobile `MobileMenu` filtra apenas por `isAdmin`**, ignora `can(resource, 'visualizar')`. Desktop usa permissões; mobile não. **Vazamento de itens visíveis no mobile** que não deveriam aparecer.

**C4. `MobileBottomNav` não filtra nada** — sempre mostra "Comercial", "Cadastros", "Financeiro" mesmo para usuários sem permissão.

### D. Estrutura de código

**D1. Duas fontes de verdade quase iguais**
- `flatNavItems` (em `lib/navigation.ts`)
- `NAVIGATION_ITEMS` (em `config/navigation.config.ts`)
Ambas derivam de `navSections` com lógica idêntica. **Duplicação literal**. `NAVIGATION_ITEMS` adiciona `icon` no Dashboard e tipa como `MenuItem`. `flatNavItems` tipa como `FlatNavItem`. Consolidar em uma só.

**D2. `headerIcons` + `baseRouteLabels` separados de `navSections`** — para adicionar uma rota nova, precisa atualizar 3 lugares (navSections + headerIcons + baseRouteLabels). Tipagem não enforça. **Fonte única deveria ser `navSections` com ícone por leaf**.

**D3. `mobileMenuSections` é hardcoded** (linhas 215-217) — lista as keys `['compras', 'estoque', 'fiscal', 'relatorios', 'administracao']`. Se adicionar uma seção nova, esquecer aqui é fácil. E **omite** `cadastros`, `comercial`, `financeiro`, `social` do menu mobile (porque já estão em quickActions/bottom tabs?), mas sem documentação.

**D4. `mobileBottomTabs` keys (`inicio`, `comercial`, `cadastros`, `financeiro`)** não correspondem a `navSections.key` (`comercial` ✓, `cadastros` ✓, `financeiro` ✓, mas `inicio` não existe — `getNavSectionKey('/')` retorna `'inicio'` ad-hoc). Funciona por sorte; deveria ter uma constante compartilhada.

**D5. AppSidebar com 433 linhas** — múltiplas responsabilidades: render de Dashboard, Favoritos, Sections, Footer; lógica de expansion (manual+derivado), badges (3 fontes), filtro de permissões, tooltips. Candidato a quebrar em `<SidebarFavorites>`, `<SidebarSection>`, `<SidebarSectionItem>`, `<SidebarFooter>`.

### E. Performance e tipagem

**E1. `useSidebarAlerts` re-renderiza a sidebar inteira** a cada update de alerta — ok porque está no topo, mas seria melhor consumir só onde os badges são renderizados.

**E2. `as const` ausente em `navSections`** — dificulta autocomplete de keys (`section.key`).

**E3. Tipagem de `MenuItem.children`** existe mas nunca é usada (todas as Views são 1 nível).

### F. Acessibilidade

**F1. `aria-current="page"` correto na sidebar para itens ativos** ✓
**F2. `aria-expanded` nas seções** ✓
**F3. Botão favoritar dentro de botão de nav** — `<button>` aninhado dentro de `<div>` ao lado de outro `<button>`. Estrutura ok (não aninhado), mas screen-reader anuncia ambos ao tabular.
**F4. Foco visível** ok via Tailwind defaults.

### G. Breadcrumbs

**G1. Duplica resolução de label** — `resolvePageTitle` tem casos especiais para `/configuracoes`, `/relatorios`, `/financeiro`, mas `configTabs` usa **`geral`** (não `empresa`!) — divergente do menu Administração que usa `?tab=empresa`. Bug latente.

**G2. Builder do path** — quebra `pathname.split('/')` cumulativamente, então `/relatorios/workbook-gerencial` produz items `Dashboard / Relatórios / Workbook Gerencial`. Funciona. Para `/orcamentos/123/edit` (não existe hoje) seria `Dashboard / Orçamentos / 123`. Sem caso especial.

## Estratégia de correção

### Fase 1 — Fonte única de navegação

**1.1 Consolidar `flatNavItems` e `NAVIGATION_ITEMS`**
- Eliminar `src/config/navigation.config.ts` ou torná-lo apenas um re-export.
- `NavLeafItem` ganha campo opcional `icon?: LucideIcon`.
- `flatNavItems` passa a expor `icon` derivado da seção pai (para favoritos).

**1.2 Mover `headerIcons` e `baseRouteLabels` para dentro de `navSections`**
- Cada `NavLeafItem` ganha `icon?` opcional (default = ícone da seção).
- `getRouteLabel` e `headerIcons` passam a derivar de `flatNavItems`.
- Remove a triplicação de manutenção.

**1.3 Tipar keys de seção com `as const`**
- `export const NAV_SECTION_KEYS = ['cadastros', 'comercial', ...] as const`.
- `mobileBottomTabs.key` e `mobileMenuSections` referenciam o tipo.

### Fase 2 — Correções funcionais

**2.1 Mover Workbook/Apresentação para "Relatórios"** (ou converter Relatórios em seção expansível)
- Opção A: criar `relatorios` como seção expansível com sub-itens [Workbook, Apresentação, Relatórios Operacionais (`/relatorios`)].
- Opção B: manter Relatórios como direct + criar uma seção "Gerencial" dentro de Financeiro.
- **Decisão recomendada: A** — alinha URL e agrupamento, conserta `getNavSectionKey`.

**2.2 Reorganizar Administração**
- Remover sub-itens `?tab=` do submenu lateral (Administração tem sua própria sidebar interna em `/administracao`).
- Manter no menu lateral apenas: Administração (rota direta `/administracao`), Migração de Dados, Auditoria.
- Corrigir `configTabs` em `AppBreadcrumbs` (`geral` → `empresa`, ou ler de constante única).

**2.3 Remover labels/ícones órfãos** — `/unidades-medida`, `/cotacoes`, `/ordens-venda`, `/remessas`, `/caixa` (manter no router como redirect, **remover** do `headerIcons`/`baseRouteLabels`).

**2.4 Estado ativo robusto**
- `isItemActive` com query: aceitar match base+query exato OU pathname-only quando query do target é "tipo de view".
- `getNavSectionKey`: priorizar match em `items` específico antes de match em `directPath` (corrige A5/B1).
- Forçar expansão da seção quando rota muda para item dentro dela (limpa `manualSections[key]` no navigate).

**2.5 Permissões coerentes em mobile**
- `MobileMenu` aplicar mesma lógica de `visibleSections` da sidebar.
- `MobileBottomNav` filtrar tabs por permissão.
- Extrair função `useVisibleNavSections()` reutilizável.

**2.6 Validar `sectionResourcesMap` contra `ErpResource`**
- Trocar `Record<string, ErpResource[]>` por mapa tipado.
- Corrigir `social` (não usar `'dashboard'`; usar a flag dedicada).

### Fase 3 — Componentização

**3.1 Quebrar `AppSidebar`** (433 → ~150 linhas):
- `SidebarFavorites`
- `SidebarSection` (recebe section, renderiza header + items)
- `SidebarSectionItem` (item + badge + favorito)
- `SidebarFooter`
- `useSidebarBadges()` (extrai mapa de badges)

**3.2 Hook `useNavigationState()`**
- Centraliza `activeSectionKeys`, `isItemActive`, `isSectionOpen`, manual sections.
- Reaproveitável por mobile menu se quisermos.

### Fora do escopo
- Não mudar visual da sidebar (foco técnico).
- Não tocar `RelationalDrawerStack` nem rotas de detalhe.
- Não migrar `Administracao.tsx` interno.

## Critério de aceite
- Uma só fonte de verdade para itens, ícones e labels (nav/header/breadcrumb).
- `getNavSectionKey` retorna a seção correta para todas as rotas (incluindo `/relatorios/*`).
- Item ativo + submenu expandido funcionando para rotas com query e nested.
- Mobile respeita permissões (paridade com desktop).
- Submenu de Administração coerente (sem `?tab=` quebrados).
- `sectionResourcesMap` 100% tipado contra `ErpResource`.
- AppSidebar < 200 linhas, dividido em sub-componentes.
- Build OK (`tsc --noEmit`); zero rota quebrada.

## Entregáveis
Tabela final por área: `problema → correção aplicada → pendência (se houver)`.

