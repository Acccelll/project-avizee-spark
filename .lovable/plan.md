## Roadmap de UX da Navegação — AviZee ERP

Execução sequencial dos 12 itens do roadmap, com commit atômico por item. Antes de cada edição, leitura completa do arquivo-alvo para preservar lógica existente. Sem alterações em testes, tipos gerados do Supabase ou migrações.

### Escopo por item

**1. Fiscal em 2 subgrupos** (`src/lib/navigation.ts`)
- Substituir o array `items` da seção `fiscal` por dois subgrupos: "Operacional" (Emitir NF-e, Backlog, Notas de Entrada, Notas de Saída) e "Gestão e consulta" (Dashboard Fiscal, Consulta de documentos, Histórico DistDF-e, Cadastros fiscais).
- Remover item "Faturamento" (`/faturamento`) do menu.
- Atribuir ícones distintos: `FilePlus2`, `ClipboardList`, `FileInput`, `FileOutput`, `BarChart3`, `FileSearch`, `History`, `FolderCog`.
- Garantir cobertura de `/faturamento` em `getRouteLabel`/breadcrumb.

**2. Ocultar Social sem feature flag** (`src/lib/navigation.ts`)
- Trocar `disabled` condicional por inclusão condicional via spread no array `navSections`.
- Validar que `mobileMenuSections`, `flatNavItems`, `mobileBottomTabs` continuam derivando corretamente.

**3. Animar abertura/fechamento de seções** (`src/components/sidebar/SidebarSection.tsx`, `src/index.css`)
- Envolver botão+conteúdo em `Collapsible` controlado (`open={isOpen}`), preservando `onToggleSection`.
- Adicionar keyframes `collapsible-down`/`collapsible-up` e classes utilitárias em `src/index.css` se ausentes.

**4. Tooltips nativos em itens longos** (`SidebarSectionItem.tsx`, `SidebarSection.tsx`)
- Adicionar `title={item.title}` no botão principal do item.
- Adicionar `title={section.title}` no botão de seção em modo expandido.

**5. Delay de hover no modo dinâmico** (`src/components/AppLayout.tsx`)
- Introduzir `hoverTimerRef` com `setTimeout(150ms)` no enter; cancelar no leave.
- Cleanup do timer em `useEffect`.

**6. Confirmar ícones Fiscal** (verificação)
- `rg` por uso hardcoded de `Receipt` ligado aos itens fiscais; resolvido pelo Item 1.

**7. GlobalPeriodChip no header desktop** (`src/components/navigation/AppHeader.tsx`)
- Renderizar `<GlobalPeriodChip />` no bloco desktop, após breadcrumb e antes do botão "Novo", sem as classes mobile-only.

**8. Mesclar Compras em Comercial** (`src/lib/navigation.ts`)
- Adicionar subgrupo "Compras" (Cotações de Compra, Pedidos de Compra) na seção `comercial`.
- Remover seção `compras` de `navSections` e da union `NavSectionKey`/`NAV_SECTION_KEYS`.
- Buscar (`rg "'compras'"`) usos em `useSidebarBadges`, `useVisibleNavSections`, `useNavigationState` e atualizar.

**9. Simplificar dropdown do avatar** (`AppHeader.tsx`)
- Em `AccountMenuItems`, manter apenas: Configurações, toggle de Tema, Sair.
- Remover imports não utilizados (`User`, etc.).

**10. Onboarding de favoritos** (`src/components/sidebar/SidebarFavorites.tsx`)
- Quando `items.length === 0` e flag `avizee:favorites-hint-dismissed` ausente em `localStorage`, renderizar hint dispensável.
- Marcar flag ao adicionar primeiro favorito (efeito controlado, não no render).

**11. Breadcrumbs de rotas não mapeadas** (`src/lib/navigation.ts` e/ou `AppBreadcrumbs.tsx`)
- Estender `getRouteLabel` para `/admin/*`, `/admin/audit-duplicidades`, `/faturamento` e subrotas, `/socios`, `/funcionarios`, `/grupos-economicos`, `/contas-contabeis-plano`, `/cartoes-credito`.
- Estender `extraRouteLabels`/`resolvePageTitle` para query-params faltantes.

**12. Renomear seção** (`src/lib/navigation.ts`)
- `title` da seção `estoque` → `'Estoque e Logística'`.
- `rg` por ocorrências hardcoded de "Suprimentos e Logística" em testes/docs e atualizar (exceto migrations e tipos gerados).

### Verificação final

- `npm run lint` limpo.
- Build TS sem erros (executado pelo harness automaticamente).
- Testes existentes verdes.
- QA visual: sidebar expandida/colapsada com novos subgrupos Fiscal, Social ausente sem flag, animações suaves, GlobalPeriodChip no header, breadcrumb em `/admin/audit-duplicidades`, dropdown do avatar com 3 itens, hint de favoritos.

### Notas técnicas

- Commits atômicos por item (12 commits).
- Não tocar `src/integrations/supabase/*`, `supabase/migrations/*`, `.env`.
- Cada item começa com `code--view` no(s) arquivo(s) alvo + `rg` por referências cruzadas antes de editar.
- Flyout colapsado da sidebar (`SidebarSection`) deve continuar funcional após Item 3 — o `Collapsible` substitui apenas o painel inline, não o flyout.
