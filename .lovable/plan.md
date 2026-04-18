

# Diagnóstico técnico — Estados transversais

## Inventário de mecanismos atuais

| Estado | Mecanismo | Cobertura |
|---|---|---|
| Loading lista | `TableSkeleton`, `DataTable.loading` | ~90% das listas |
| Loading detalhe | `DetailLoading` (KPI strip + tabs) | Views relacionais ✓ |
| Loading página | `LazyPage` (Suspense spinner) | Rotas ✓ |
| Loading rota auth | `ProtectedRoute`/`AdminRoute`/`SocialRoute` (3 spinners idênticos) | duplicado |
| Loading inline | `Loader2 animate-spin`, `border-b-2 border-primary` | inconsistente (3 visuais) |
| Loading textual | `"Carregando..."`, `"Salvando..."`, `"Processando..."` | em ~22 arquivos, ad-hoc |
| Empty | `EmptyState` (2 versões!), `DetailEmpty` | duplicado: `src/components/EmptyState.tsx` vs `src/components/ui/empty-state.tsx` |
| Error | `ErrorBoundary` (global), `DetailError`, `getUserFriendlyError` | ✓, mas erros silenciosos em vários `catch` |
| Toast | `sonner` (`toast.success/error/info/warning`) | ✓ padronizado, mas mensagens divergentes |
| Sem permissão | `useCan`, `Navigate to "/"`, `Social.tsx` mostra ModulePage texto-livre | inconsistente |
| Lock submit | `useSubmitLock`, `useActionLock`, `useDetailActions` | bom, mas ~30 lugares ainda usam `setSaving` manual |
| Refetch | `useInvalidateAfterMutation`, `useSupabaseCrud` (auto), TanStack auto | ✓ |

## Problemas reais

### 1. Dois componentes `EmptyState` coexistem
- `src/components/EmptyState.tsx` (API: `actionLabel`+`onAction`)
- `src/components/ui/empty-state.tsx` (API: `action: ReactNode`)

Mesma estética, APIs diferentes. ~50 imports espalhados, alguns importam um, outros outro. Fonte clássica de bug "callback ignorado".

### 2. Spinners duplicados em 3 visuais
- `<Loader2 className="animate-spin" />` (lucide) — ~30 lugares
- `<div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />` — Recent*, AdminRoute, ProtectedRoute, SocialRoute, App.tsx (LazyPage)
- `<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />` — CotacaoCompraForm, ImportacaoLotesTable

Sem `<Spinner />` componente único. Sem aria-label. Acessibilidade comprometida.

### 3. Texto "Carregando..." solto em 22 arquivos
`<div className="p-8 text-center animate-pulse">Carregando...</div>` — `PedidoForm`, `Cte`, `EntregaDrawer`, `ContaBancariaDrawer`, `EstoquePosicaoDrawer`, etc. Inconsistente com `DetailLoading`/`TableSkeleton`. Perde feedback estrutural.

### 4. `setSaving` manual em ~30 lugares (não usa `useSubmitLock`)
`Fornecedores.tsx`, `Fiscal.tsx`, `BaixaParcialDialog`, `OrcamentoForm`, `PedidoForm`, `RemessaForm`, `ContasBancarias`, `Configuracoes`, `Funcionarios`, etc. Cada um:
- declara `setSaving(true)` e `setSaving(false)` em vários return paths;
- alguns esquecem `setSaving(false)` no catch (vaza loading);
- não tem ref síncrona → duplo clique cria duplicata.

`useSubmitLock` resolve tudo isso, mas adoção parou em ~10 lugares.

### 5. Erros silenciosos: `catch` apenas com `console.error`
- `Fornecedores.tsx:213-214` — `catch (err) { console.error(...); }` sem toast → usuário acha que salvou.
- `Fornecedores.tsx:158-162` — `loadFornContext` falha silenciosamente.
- `OrcamentoForm.tsx:617-619` — log + nada visível.
- 8 outros pontos identificados.

### 6. Mensagens de toast divergentes para o mesmo evento
- `toast.success("Registro criado com sucesso!")` (useSupabaseCrud)
- `toast.success("Transportadora criada!")` (useTransportadoras)
- `toast.success("Folha registrada!")` (Funcionarios)
- `toast.success("Vínculo removido")`, `"Lote cancelado."`, `"Caixa "X" cadastrada."`

Sem padrão. Falta um helper `toastCrud.created("Cliente")` que gere `"Cliente criado com sucesso"`.

### 7. Mensagens de erro genéricas convivendo com `getUserFriendlyError`
~17 arquivos ainda usam strings hardcoded:
- `"Erro ao salvar regra de preço"` (PrecosEspeciaisTab — ignora `err`)
- `"Erro ao carregar usuários."` (UsuariosTab)
- `"Erro ao consultar CEP"`
- `"Erro ao salvar evento: " + msg` (concat manual de mensagem técnica)

Resultado: o usuário às vezes recebe traduzido, às vezes genérico, às vezes raw.

### 8. `useSupabaseCrud` aciona toast com mensagem hardcoded em loading
`"Erro ao carregar dados. Tente novamente."` — ignora `getUserFriendlyError(error)`. Inconsistente com o resto do hook.

### 9. Toast duplo: hook + caller
`useSubmitLock` já dispara toast no erro (default), mas `OrcamentoForm`, `PedidoForm`, etc. fazem `try { await submit(...) } catch { toast.error(getUserFriendlyError(err)) }` — mostra **dois toasts** quando ambos disparam. Caller não percebe que `submit` já tratou.

### 10. `disabled` durante saving aplicado só ao botão primary
Botão "Cancelar" geralmente fica clicável enquanto salva (`BaixaParcialDialog` é exceção). Usuário pode cancelar no meio do submit → race com o resultado.

### 11. Sem permissão tratado de 3 formas
- `ProtectedRoute`: `Navigate to "/login"`
- `AdminRoute`: `Navigate to "/"` (silencioso, sem toast)
- `SocialRoute`: `Navigate to "/"` silencioso
- `Social.tsx`: renderiza `<ModulePage>` com texto livre "Você não possui permissão..."
- Botões dentro de páginas: simplesmente escondidos via `can(...)` sem feedback

Falta padrão. Quando o usuário entra em `/admin` sem ser admin, é redirecionado sem saber por quê.

### 12. `LazyPage`, `ProtectedRoute`, `AdminRoute`, `SocialRoute` repetem o mesmo spinner
4 implementações idênticas do mesmo `<div className="...border-4 border-primary border-t-transparent rounded-full animate-spin"/>`. Mudança visual exige editar 4 arquivos.

### 13. Loading não consistente: spinner vs skeleton
- Listas grandes: `TableSkeleton` ✓
- Drawers: às vezes skeleton, às vezes `<p>Carregando...</p>` (`FinanceiroDrawer`, `ContaBancariaDrawer`, `ContaContabilDrawer`, `EstoquePosicaoDrawer`, `EntregaDrawer`)
- Cards do dashboard: cada um tem spinner próprio (`RecentOrcamentos`, `RecentCompras`, `VencimentosProximosCard`)
- Forms: às vezes `FormSkeleton`, às vezes texto cinza

### 14. `useSupabaseCrud` mostra toast de truncamento como aviso, mas só em `paginationMode: "all"`
Hard-cap silencioso de 50000 — ok. Mas em `paged` mode, o usuário não sabe que está paginado server-side. Inconsistência semântica.

### 15. Não há helper único para "ação sem permissão tentada"
Quando o usuário clica em algo que ele teoricamente nem deveria ver (race entre carregar permissão e renderizar), a ação cai num `permission denied` do RLS → vira toast genérico via `getUserFriendlyError`. Falta:
```ts
if (!can('x:y')) { toast.error("Você não tem permissão"); return; }
```
sistematizado.

### 16. `useDetailFetch` não dispara toast em erro
Decisão consciente ("quem chama decide"), mas nenhuma View hoje chama. Resultado: `error` é mostrado via `<DetailError>` ✓, mas sem toast — usuário pode não notar se o estado de erro está fora da viewport.

## Estratégia de correção

### Fase 1 — Unificar `EmptyState` (corrige #1)
Manter `src/components/ui/empty-state.tsx` (API mais flexível: `action: ReactNode`).
Substituir `src/components/EmptyState.tsx` por re-export que mantém compat:
```ts
export { EmptyState } from "@/components/ui/empty-state";
```
Adaptador interno traduz `actionLabel`+`onAction` → `action={<Button>...}` para consumidores legados, OU migrar todos os imports. Plano: re-export + adaptador para zero quebra.

### Fase 2 — Componente `Spinner` único (corrige #2, #12)
Criar `src/components/ui/spinner.tsx`:
```tsx
export function Spinner({ size="md", label="Carregando", className }) {
  // size: sm (h-4) | md (h-6) | lg (h-8)
  return <div role="status" aria-label={label}
    className={cn("animate-spin rounded-full border-2 border-primary border-t-transparent", sizeMap[size], className)} />;
}
export function FullPageSpinner() { /* min-h-screen + Spinner lg */ }
```
Substituir nos 4 route guards + LazyPage. Demais usos podem migrar gradualmente — fora do escopo agora.

### Fase 3 — Helper `toastCrud` para mensagens consistentes (corrige #6)
`src/lib/toastMessages.ts`:
```ts
export const toastCrud = {
  created: (entity: string) => toast.success(`${entity} criado com sucesso`),
  updated: (entity: string) => toast.success(`${entity} atualizado com sucesso`),
  removed: (entity: string) => toast.success(`${entity} removido`),
  saved:   (entity: string) => toast.success(`${entity} salvo`),
};
```
Não força adoção em massa — disponibiliza. Migrar `useSupabaseCrud` (que tem toast genérico) para usar quando o caller passar `entityName`.

### Fase 4 — Eliminar erros silenciosos (corrige #5)
Auditar e corrigir os 11 pontos identificados:
- adicionar `toast.error(getUserFriendlyError(err))` no catch;
- ou re-throw para que o caller (com `useSubmitLock`) trate.

Lista alvo: `Fornecedores.tsx`, `OrcamentoForm.tsx`, `ContasContabeis.tsx`, `PrecosEspeciaisTab`, `Remessas.tsx`, `Social.tsx` (mensagens genéricas → usar `getUserFriendlyError`).

### Fase 5 — Padronizar `useSupabaseCrud` mensagens (corrige #7, #8)
Trocar `toast.error("Erro ao carregar dados. Tente novamente.")` por `toast.error(getUserFriendlyError(error))`. Remove duplicação semântica.

### Fase 6 — Padronizar "sem permissão" (corrige #11, #15)
Criar `src/components/AccessDenied.tsx`:
```tsx
export function AccessDenied({ title="Acesso restrito", message }) {
  return <DetailEmpty icon={ShieldOff} title={title}
    message={message ?? "Você não tem permissão para visualizar este conteúdo."} />;
}
```
Aplicar em `AdminRoute` e `SocialRoute`: em vez de `Navigate to "/"` silencioso, mostrar `<AccessDenied />` (rota `/sem-permissao` ou inline). Atualmente `Social.tsx` já faz isso ad-hoc — extrair.

Adicionar helper `useGuardedAction(perm, fn)` que mostra toast "Sem permissão" se `!can(perm)`. Não obriga uso, mas disponível para grids onde botões podem aparecer brevemente antes do `can`.

### Fase 7 — Auditar `setSaving` manual (corrige #4)
NÃO migrar todos os 30 lugares (refactor amplo). Migrar 4 críticos com problema real:
- `Fornecedores.handleSubmit` — esquece toast de erro;
- `Fiscal.handleSubmit` (linha 489) — catch incompleto;
- `OrcamentoForm.onSubmit` — toast duplo possível;
- `BaixaParcialDialog.handleSubmit` — race com onClose.

Demais ficam como nota técnica para próxima passada.

### Fase 8 — Corrigir disable de "Cancelar" durante saving (corrige #10)
Não pelo wrapper FormModal (já tem `confirmOnDirty`), mas regra: `<Button onClick={onCancel} disabled={saving}>` em todos os modais ad-hoc identificados. Aplicar nos 4 do escopo da Fase 7.

### Fase 9 — `useSupabaseCrud` chama `getUserFriendlyError` em loading
Já listado em #5/#8 — pequena edição focada.

## Fora do escopo
- Migrar todos os 22 arquivos com `<div>Carregando...</div>` para skeletons (refactor visual).
- Substituir todos os spinners ad-hoc por `<Spinner>` (gradual).
- Refatorar todos os 30 `setSaving` para `useSubmitLock` (próxima passada).
- Não criar novos hooks de permissão — apenas componentizar resultado visual.
- Não tocar em `ErrorBoundary` (já refatorado anteriormente).

## Critério de aceite
- `EmptyState` único (sem duplicação de arquivo).
- Spinner padronizado em route guards + LazyPage.
- `toastCrud` disponível e usado em pelo menos `useSupabaseCrud`.
- Zero erro silencioso nos 11 pontos identificados.
- `useSupabaseCrud` usa `getUserFriendlyError`.
- `AccessDenied` componente único; `AdminRoute`/`SocialRoute` consistentes.
- 4 hotspots de `setSaving` migrados para `useSubmitLock` ou catch corrigido.
- Build OK; zero regressão funcional.

## Arquivos afetados
- `src/components/EmptyState.tsx` — re-export adaptador
- `src/components/ui/empty-state.tsx` — manter como fonte
- `src/components/ui/spinner.tsx` — criar
- `src/lib/toastMessages.ts` — criar
- `src/components/AccessDenied.tsx` — criar
- `src/components/AdminRoute.tsx` — usar `Spinner` + `AccessDenied`
- `src/components/ProtectedRoute.tsx` — usar `Spinner`
- `src/components/SocialRoute.tsx` — usar `Spinner` + `AccessDenied`
- `src/App.tsx` (LazyPage) — usar `Spinner`
- `src/hooks/useSupabaseCrud.ts` — `getUserFriendlyError` + `toastCrud` opcional
- `src/pages/Fornecedores.tsx` — toast no catch + cancel disabled
- `src/pages/Fiscal.tsx` — limpar catch incompleto
- `src/pages/OrcamentoForm.tsx` — evitar toast duplo
- `src/components/financeiro/BaixaParcialDialog.tsx` — cancel disabled durante saving
- `src/pages/ContasContabeis.tsx`, `src/pages/Remessas.tsx`, `src/components/precos/PrecosEspeciaisTab.tsx`, `src/pages/Social.tsx` — `getUserFriendlyError` em vez de string fixa
- `src/pages/Social.tsx` — usar `<AccessDenied>` no lugar do bloco ad-hoc

## Entregáveis
Resumo final por categoria: empty/loading/error/toast/permissão/saving lock.

