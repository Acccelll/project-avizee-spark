

# Diagnóstico visual — Estados transversais

## Inventário visual atual

| Estado | Componente | Visual hoje |
|---|---|---|
| Loading rota | `FullPageSpinner` | spinner lg centralizado, sem mensagem |
| Loading conteúdo | `ContentSpinner` | spinner md, sem mensagem |
| Loading lista | `TableSkeleton` | linhas de skeleton ✓ |
| Loading detalhe | `DetailLoading` | KPI strip + tabs skeleton ✓ |
| Empty genérico | `EmptyState` | ícone em círculo `bg-muted`, título, descrição, ação |
| Empty detalhe | `DetailEmpty` | mesmo padrão, menor (`py-12`) |
| Erro detalhe | `DetailError` | ícone `bg-destructive/10`, título destrutivo, mensagem |
| Erro global | `ErrorBoundary` | tela cheia com botões reload/dashboard |
| Sem permissão | `AccessDenied` | usa `DetailEmpty` com `ShieldOff` |
| Toast | `sonner` (default config) | posição padrão, sem ícone semântico explícito |
| Skeleton | `Skeleton` | `bg-muted animate-pulse` ✓ |

## Problemas reais

### 1. Spinners sem mensagem contextual
`FullPageSpinner` e `ContentSpinner` mostram apenas o círculo girando. Em rotas que demoram (auth + permissões), o usuário fica 1-2s olhando spinner mudo. Sem texto "Carregando..." abaixo, parece travado.

### 2. Empty/Error/AccessDenied parecem o mesmo "card cinza"
Os 3 estados usam o mesmo padrão visual: círculo com ícone + título + mensagem. Diferenciação só pela cor do ícone (`text-muted-foreground` vs `text-destructive`). Em telas onde aparecem alternadamente (ex: filtro vazio → erro de carga), o usuário não percebe a mudança de severidade.

### 3. EmptyState sem distinção entre "nada cadastrado" e "filtro sem resultado"
Mesma `EmptyState` usada para:
- "Nenhum cliente cadastrado" (precisa CTA "Novo Cliente")
- "Nenhum resultado para os filtros" (precisa CTA "Limpar filtros")
- "Nenhuma notificação" (informativo, sem CTA)

Cada caller decide ad-hoc qual ícone/mensagem/ação usar. Sem variant `noResults` para filtro.

### 4. Sem helper para "limpar filtros"
Páginas com filtros aplicados (Pedidos, Clientes, Produtos) mostram `EmptyState` genérico quando o filtro não retorna nada. Não há botão automático "Limpar filtros" — usuário tem que voltar e desmarcar manualmente. Padrão Linear/Notion: empty state de filtro mostra "X filtros ativos · Limpar".

### 5. Toasts sem ícones e sem hierarquia visual consistente
`sonner` aceita `richColors` e `icon`, mas o `<Toaster />` global não está configurado com `richColors`. Resultado: success/error/warning aparecem com mesmo background neutro, diferenciação só pelo título. Em ERPs maduros, success = verde, error = vermelho, warning = amarelo (subtle).

### 6. Toast position e duration não padronizados
Default sonner: `top-right`, 4s. Em telas com sidebar+topbar de 56px, top-right cai colado ao topo. ERPs costumam usar `bottom-right` (menos intrusivo) ou `top-right` com offset. Duration de 4s é curta para mensagens de erro com ação.

### 7. `DetailError` não oferece retry
`DetailError` aceita `action: ReactNode` (opt-in), mas a maioria dos consumidores não passa nada. Erro de rede em drawer mostra "Erro ao carregar dados" sem botão "Tentar novamente". Padrão básico de UX faltando.

### 8. ErrorBoundary global muito "ruidoso"
Tela cheia com gradient, AlertCircle 64px, dois botões grandes. Para erros de componente isolado (ex: card do dashboard quebrar), derruba a página inteira. Mas o `BlockErrorBoundary` (mais leve) só é usado no dashboard. Falta variante "card" do ErrorBoundary para conteúdos secundários.

### 9. AccessDenied sem ação clara
Hoje mostra "Você não tem permissão" + nada. Falta CTA "Voltar ao início" ou "Solicitar acesso" para o usuário sair do beco.

### 10. Skeleton sem variação de "cor"
`Skeleton` é `bg-muted` puro. Em fundo `bg-card` (drawers), o contraste é mínimo — parece que nada está acontecendo. Falta `bg-muted/60` ou tom mais escuro para skeleton sobre card.

### 11. Mensagens de loading genéricas demais
"Carregando..." em toda parte. Em ERPs maduros, mensagens contextuais ajudam:
- "Carregando pedidos..."
- "Verificando permissões..."
- "Sincronizando estoque..."

`FullPageSpinner` aceita `label` mas ninguém passa.

### 12. Sucesso visual após ação destrutiva pouco enfatizado
Toast de "Cliente removido" passa em 4s sem destaque. Para ações destrutivas (delete, cancel), o feedback poderia ser mais forte (ícone check verde, duração 5s).

### 13. Inconsistência de ícones entre estados
- Empty genérico: `PackageOpen` (default)
- Empty detalhe: `FileQuestion`
- Acesso negado: `ShieldOff`
- Erro: `AlertTriangle`
- Loading: spinner

Sem catálogo. Páginas escolhem ícones aleatórios (`Inbox`, `SearchX`, `FilterX`).

### 14. Spinner full-page bloqueia visual completamente
`min-h-screen bg-background` cobre tudo, inclusive sidebar. Em rotas que demoram, parece que o app travou (não vê nem header). Padrão melhor: spinner dentro do `<main>`, mantendo shell visível.

## Padrão-base proposto

### Spinner com mensagem
- `FullPageSpinner` e `ContentSpinner` ganham `label` opcional renderizado abaixo (`text-sm text-muted-foreground mt-3`).
- Adotar default "Carregando..." quando não passado.
- `FullPageSpinner` apenas para route guards (sem shell ainda); `ContentSpinner` mantém comportamento dentro do shell.

### EmptyState com variants semânticos
Adicionar prop `variant?: 'default' | 'noResults' | 'firstUse'`:
- `default`: ícone `bg-muted` (atual)
- `noResults`: ícone `bg-info/10 text-info` + ação default "Limpar filtros" se `onClearFilters` passado
- `firstUse`: ícone `bg-primary/10 text-primary` + CTA primária destacada

### NoResultsState helper
Componente novo `NoResultsState` (wrapper sobre EmptyState) específico para filtros:
```tsx
<NoResultsState
  activeFiltersCount={3}
  onClearFilters={() => clearAll()}
  searchTerm={search}
/>
```
Mostra: "Nenhum resultado para os filtros aplicados" + chip "3 filtros ativos · Limpar".

### Toast com richColors + posição
Configurar `<Toaster />` global:
```tsx
<Toaster
  position="bottom-right"
  richColors
  closeButton
  toastOptions={{ duration: 4000 }}
/>
```
- `richColors`: success verde, error vermelho, warning amarelo, info azul
- `closeButton`: dismissable
- Duration 5000 para `toast.error` (mais tempo para ler)

### DetailError com retry padrão
Adicionar prop `onRetry?: () => void`:
```tsx
<DetailError onRetry={() => refetch()} />
```
Renderiza botão "Tentar novamente" automático quando passado.

### AccessDenied com ação padrão
Adicionar botão "Voltar ao início" default (link para `/`), opcional via prop `showBackButton?: boolean = true`.

### Skeleton com tom contextual
Adicionar variant `Skeleton` com prop `tone?: 'default' | 'card'`:
- `default`: `bg-muted` (atual)
- `card`: `bg-muted-foreground/10` (mais escuro, contrasta com `bg-card`)

### Diferenciação visual entre Empty/Error/AccessDenied
- Empty: ícone neutro em círculo `bg-muted` (mantém)
- Error: ícone em círculo `bg-destructive/10`, título `text-destructive` (mantém)
- AccessDenied: ícone em círculo `bg-warning/10 text-warning`, título neutro (muda — hoje usa DetailEmpty)
- NoResults: ícone em círculo `bg-info/10 text-info`

Cada um com cor de fundo do círculo diferente → leitura instantânea.

## Arquivos afetados

### Core (componentes)
- `src/components/ui/spinner.tsx` — `label` renderizado abaixo do spinner em `FullPageSpinner`/`ContentSpinner`
- `src/components/ui/empty-state.tsx` — adicionar prop `variant` com cores diferenciadas
- `src/components/ui/NoResultsState.tsx` — **novo**: wrapper para filtros vazios
- `src/components/ui/DetailStates.tsx` — `DetailError` aceita `onRetry`; `DetailEmpty` aceita `variant`
- `src/components/AccessDenied.tsx` — botão "Voltar ao início" default + ícone com `bg-warning/10`
- `src/components/ui/skeleton.tsx` — prop `tone` opcional
- `src/components/ui/sonner.tsx` — `richColors`, `closeButton`, position `bottom-right`, duration por tipo

### Adopters (sample, não exaustivo)
- `src/components/ProtectedRoute.tsx` — passar `label="Carregando sessão..."`
- `src/components/AdminRoute.tsx` — `label="Verificando permissões..."`
- `src/components/SocialRoute.tsx` — `label="Verificando permissões..."`
- `src/App.tsx` (LazyPage) — `label="Carregando página..."`

### Documentação inline
- Adicionar exemplos JSDoc em cada componente afetado mostrando os 4 cenários (default, noResults, firstUse, error com retry).

## Fora do escopo
- Migrar todos os ~50 callers de `EmptyState` para variants apropriados (refactor amplo).
- Trocar todos os ícones de empty/error nas páginas (catálogo de ícones futuro).
- Configurar i18n de mensagens de loading.
- Refatorar `ErrorBoundary` global para variante "card" (próxima passada).
- Migrar todos os toasts hardcoded para `toastCrud` (passada anterior já cobriu hooks).

## Critério de aceite
- Spinner com mensagem "Carregando..." (default) e específica nos route guards.
- Empty/Error/NoResults/AccessDenied com cores de fundo distintas no círculo do ícone.
- `NoResultsState` disponível como helper para filtros vazios.
- Toast com `richColors` + `closeButton` + posição bottom-right.
- `DetailError` aceita `onRetry` com botão automático.
- `AccessDenied` com botão "Voltar ao início".
- `Skeleton` com tom opcional para fundos de card.
- Build OK; zero regressão funcional.

## Entregáveis
Resumo final por categoria: spinner/loading, empty state (default/noResults/firstUse), error (com retry), accessDenied, skeleton, toast.

