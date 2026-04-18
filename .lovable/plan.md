

# Diagnóstico técnico — Shell global do sistema

## Inventário do shell

| Camada | Responsável | Observações |
|---|---|---|
| Providers globais | `App.tsx` | QueryClient, Theme, Tooltip, Sonner, RelationalNav, Auth, AppConfig, ErrorBoundary |
| Layout global | `AppLayout.tsx` | Sidebar + Header + main + RelationalDrawerStack + MobileMenu/Bottom/Quick |
| Topbar | `AppHeader.tsx` | breadcrumbs, busca, "Novo", notificações, tema, conta + hotkeys globais |
| Sidebar | `AppSidebar.tsx` + `sidebar/*` | refatorado em fases anteriores (ok) |
| Breadcrumbs | `AppBreadcrumbs.tsx` | dropdown de irmãos, ícone do módulo |
| Drawer global | `RelationalDrawerStack` | renderizado no AppLayout (ok) |
| Banner offline | `OfflineBanner` | renderizado FORA do `<BrowserRouter>` |
| Skip link | `SkipLink.tsx` | **não usado** — AppLayout reimplementa inline |

## Problemas reais encontrados

### 1. Cada página re-renderiza o shell inteiro (acoplamento crítico)
**39 páginas** importam `AppLayout` e o renderizam no JSX (`<AppLayout>{...}</AppLayout>`). A consequência:
- Sidebar, AppHeader, MobileMenu, Bottom Nav e RelationalDrawerStack **desmontam e remontam a cada troca de rota**.
- Hotkeys globais re-registram listeners; `useUserPreference('sidebar_collapsed')` refaz o fetch ao Supabase; o estado do menu mobile (`mobileMenuOpen`, `searchRequested`) é descartado.
- Estado da sidebar (manualSections, favoritos) é preservado só porque vem de hooks externos — frágil.

**Causa raiz:** o shell deveria viver no nível das rotas via `<Route element={<AppLayout/>}>` + `<Outlet/>`, não dentro de cada página.

### 2. `useUserPreference('sidebar_collapsed', true)` é chamado em **3 lugares**
- `AppLayout.tsx:25`
- `AppConfigContext.tsx:58`
- `Configuracoes.tsx:165`
- `AppSidebar.tsx:44` (chamada "fantasma" só para namespace)

Cada chamada faz seu próprio fetch + cache. A `AppConfigContext` foi criada para centralizar, mas o `AppLayout` ignora-a e lê direto. Estados podem divergir.

### 3. `AppConfigProvider` está dentro do `BrowserRouter` e do `AuthProvider`, mas **`OfflineBanner` está FORA**
Ordem em `App.tsx`:
```
QueryClientProvider > ThemeProvider > OfflineBanner > TooltipProvider > Sonner
  > BrowserRouter > RelationalNavigationProvider > AuthProvider > AppConfigProvider > ErrorBoundary > Routes
```
- `OfflineBanner` renderiza acima do `<Routes>` mas **fora** do `BrowserRouter` — ok porque não usa router, mas fica visualmente desconectado do shell (acima da sidebar).
- `RelationalNavigationProvider` envolve `AuthProvider` — porém usa `useSearchParams`, que precisa de `BrowserRouter` (ok), mas não precisa estar acima do Auth. Inversão de ordem desnecessária.
- `ErrorBoundary` está abaixo de `AppConfigProvider` — se o provider falhar, `ErrorBoundary` não pega.

### 4. `SkipLink.tsx` existe mas não é usado
`AppLayout` reimplementa o skip-link inline (linhas 36-38) com classes diferentes do componente. Duplicação morta.

### 5. Hotkeys globais vivem dentro do `AppHeader` (componente visual)
`AppHeader.tsx` registra ~10 hotkeys (Ctrl+N, Ctrl+1..9, Ctrl+/, ?, etc.) num `useEffect`. Acoplamento errado: hotkeys são globais, não pertencem ao header. E como o header desmonta a cada rota (problema #1), os listeners são removidos/readicionados a cada navegação.

### 6. Headers de página ad-hoc (3 padrões coexistem)
- `ModulePage` (cadastros simples)
- `ListPageHeader` (listagens operacionais — só `FiscalDetail` usa)
- **Header inline** com `<ArrowLeft>` + `<h1 className="page-title">` + ações: `OrcamentoForm`, `PedidoForm`, `RemessaForm`, `CotacaoCompraForm`, `PedidoCompraForm`, `MigracaoDados` (~6 páginas)

Todos os formulários de detalhe duplicam o mesmo padrão "voltar + título + ações", cada um com classes ligeiramente diferentes (`text-xl font-bold font-mono`, `page-title text-xl md:text-2xl`, `text-2xl font-bold tracking-tight`).

### 7. Containers internos competem com `<main>` do AppLayout
`AppLayout` já define `mx-auto max-w-[1600px] px-3 py-4 pb-28 md:px-6 md:py-6`. Mas:
- `CotacaoCompraForm.tsx:307` → `<div className="max-w-5xl mx-auto p-6 space-y-6">`
- `PedidoCompraForm.tsx:223` → idem
- `MigracaoDados.tsx:298` → `<div className="flex flex-col gap-6 p-6 max-w-[1600px] mx-auto">`

Resultado: padding duplo em algumas larguras, max-width inconsistente entre páginas (5xl vs 1600px), shell perde controle do espaçamento.

### 8. AppLayout vaza props de "compatibilidade" para a sidebar
`<AppSidebar mobileOpen={false} onCloseMobile={() => undefined} ...>` — props `mobileOpen`/`onCloseMobile` existem mas o AppLayout sempre passa valores no-op (sidebar mobile está desativada porque `MobileMenu` cuida disso). Interface zumbi.

### 9. `useIsMobile` retorna `false` no primeiro render (SSR-safe pattern em SPA)
Hook inicia com `undefined → !!undefined = false`. Em telas mobile, há **flash do layout desktop** no primeiro paint (sidebar montando + escondendo). Sem skeleton, sem hidratação inicial síncrona via `window.matchMedia`.

### 10. `AppHeader` e `AppLayout` divergem nos breakpoints
- `AppLayout` decide mobile pelo hook `useIsMobile()` (768px).
- Mas a sidebar é escondida por `hidden md:block` (Tailwind md = 768px) — convergente.
- `AppHeader` também usa `useIsMobile()` — duplica a leitura, render condicional gigante (mobile vs desktop) num único componente. Poderiam ser dois (`AppHeaderMobile`, `AppHeaderDesktop`).

### 11. `transition-all duration-200` na main + `collapsedLoading` causa "salto"
```tsx
<div className={`min-h-screen ${collapsedLoading ? '' : 'transition-all duration-200'} ${collapsed ? 'md:ml-[72px]' : 'md:ml-[240px]'}`}>
```
Enquanto `collapsedLoading=true`, a margem-left é definida (240px default), mas sem transição. Quando o valor real chega do Supabase, a transição é adicionada e o conteúdo "salta" visivelmente se a preferência salva era diferente do default.

### 12. RelationalDrawerStack montado mesmo quando vazio
Renderiza sempre no AppLayout. Internamente verifica `stack.length === 0`, mas mantém `useEffect` de keydown global ativo, listeners de popstate e a contexto. OK funcionalmente, mas acoplado ao layout em vez de ser pulled-in via provider.

### 13. Faltam landmarks ARIA
- `<nav>` tem `aria-label="Módulos do sistema"` ✓
- `<main>` tem `role="main"` ✓
- `<header>` tem `role="banner"` ✓
- **Falta:** `<aside>` da sidebar tem `role="complementary"` mas deveria ser `role="navigation"` (é o menu primário, não conteúdo complementar). Screen-readers anunciam errado.

### 14. Tipagem de `AppLayoutProps` minimalista
Hoje só `children: ReactNode`. Páginas que querem header próprio passam `children`, mas não há slots para `pageHeader`, `breadcrumbsOverride`, `compact` etc. Páginas resolvem com containers custom (problema #7).

## Estratégia de correção

### Fase 1 — Layout via Outlet (corrige #1, #5, #8)

1. Converter `AppLayout` em **layout de rota**:
   ```tsx
   // App.tsx
   <Route element={<AppLayout />}>
     <Route path="/" element={<Index />} />
     <Route path="/clientes" element={<Clientes />} />
     ...
   </Route>
   ```
2. `AppLayout` passa a usar `<Outlet />` em vez de `children`.
3. Remover `<AppLayout>` de todas as 39 páginas (substituir por fragmento ou container interno simples).
4. Mover hotkeys globais do `AppHeader` para um hook `useGlobalHotkeys()` chamado em `AppLayout` (uma vez só).
5. Remover props `mobileOpen`/`onCloseMobile` zumbi do `AppSidebar`.

**Impacto:** menor reflow, listeners estáveis, sidebar não remonta, fim do flash em mobile.

### Fase 2 — Centralizar `sidebarCollapsed` no `AppConfigContext` (corrige #2)

1. `AppLayout` consome `useAppConfigContext()` em vez de chamar `useUserPreference` direto.
2. Remover chamada duplicada em `Configuracoes.tsx` (consome do contexto).
3. Remover chamada "fantasma" em `AppSidebar.tsx:44`.
4. Manter assinatura pública intacta (sem breaking change para terceiros).

### Fase 3 — Reordenar providers e ErrorBoundary (corrige #3)

```tsx
<QueryClientProvider>
  <ThemeProvider>
    <ErrorBoundary>            {/* sobe para pegar tudo */}
      <BrowserRouter>
        <AuthProvider>
          <AppConfigProvider>
            <RelationalNavigationProvider>
              <TooltipProvider>
                <Sonner />
                <OfflineBanner />   {/* dentro, vira parte do shell */}
                <Routes>...</Routes>
              </TooltipProvider>
            </RelationalNavigationProvider>
          </AppConfigProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </ThemeProvider>
</QueryClientProvider>
```

Sem mudança de comportamento; ordem semanticamente correta.

### Fase 4 — Padronizar header de página (corrige #6, #7)

1. Criar `PageShell` (ou estender `ListPageHeader`) com slots: `back`, `title`, `subtitle`, `meta`, `actions`.
2. Refatorar formulários (`OrcamentoForm`, `PedidoForm`, `RemessaForm`, `CotacaoCompraForm`, `PedidoCompraForm`, `MigracaoDados`) para usar o componente.
3. Remover containers `max-w-5xl mx-auto p-6` redundantes — o `<main>` já faz isso. Páginas que querem largura menor usam `max-w-5xl` SEM `mx-auto p-6`.

### Fase 5 — Polimento (corrige #4, #9, #10, #11, #14)

- Usar `<SkipLink />` componente em vez do inline (1 linha).
- `useIsMobile` lê `window.innerWidth` no `useState` initializer (síncrono) — fim do flash.
- Quebrar `AppHeader` em `AppHeaderDesktop` + `AppHeaderMobile`, com switch no AppLayout.
- Fixar `collapsedLoading`: usar valor do contexto que já tem default; transição sempre ligada após hidratação.
- Adicionar `pageHeader?: ReactNode` opcional ao AppLayout para casos especiais (Login, Signup, Public — embora hoje esses não usem AppLayout, o que é correto).

## Fora do escopo
- Não tocar visual da sidebar/breadcrumb (recém-revisados).
- Não mexer em RelationalDrawerStack (já refatorado).
- Não alterar lógica de permissões nem rotas.
- Não migrar `Administracao.tsx` interno.

## Critério de aceite
- Sidebar/Header/Drawer não remontam ao trocar de rota.
- Hotkeys globais registradas uma única vez.
- `sidebar_collapsed` lido em um lugar só (AppConfigContext).
- Providers reordenados com ErrorBoundary cobrindo tudo.
- Nenhuma página renderiza `<AppLayout>` no JSX.
- Headers de formulário usam componente padronizado.
- Sem flash de layout desktop em mobile.
- Build OK (`tsc --noEmit`); zero rota quebrada; comportamento preservado.

## Entregáveis
Tabela final por área: `problema → correção aplicada → arquivo(s) afetado(s)`.

