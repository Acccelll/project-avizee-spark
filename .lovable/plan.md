## Objetivo

Migrar chamadas diretas ao Supabase nos hooks de página de **Financeiro**, **Comercial** e **Admin (sessões)** para a camada de serviços, mantendo o padrão: funções async tipadas, `throw` no erro, sem `toast`/`navigate`/invalidação dentro do service.

## Serviços — estender / criar

### 1. Financeiro — novo submódulo `src/services/financeiro/listagem.ts`

`financeiro.service.ts` é um facade que re-exporta de `services/financeiro/*`. Em vez de inflar o barrel raiz, adiciono um novo submódulo dedicado e re-exporto via `services/financeiro/index.ts`:

- `FinanceiroListarParams` — `{ dateFrom, dateTo, tipos, status, bancos, origens, formas, cartoes, search, orderBy, ascending, offset, limit }` (todos opcionais/nulos exceto `offset`/`limit`).
- `FinanceiroPagedResult` — `{ ids: string[]; totalCount: number }`.
- `listarFinanceiroLancamentosIds(params): Promise<FinanceiroPagedResult>` — wrap de `rpc('listar_financeiro_lancamentos_ids', { p_date_from, p_date_to, p_tipos, p_status, p_bancos, p_origens, p_formas, p_cartoes, p_search, p_order_by, p_ascending, p_offset, p_limit })`. Normaliza `data` (objeto com `ids` / `total_count`) para o shape acima. `throw` no erro.
- `KpisFinanceiroParams` — mesmos filtros sem paginação/ordem.
- `KpisFinanceiroResult` — mover `FinanceiroKpisResult` (10 campos numéricos) e a constante `EMPTY` para o service.
- `fetchKpisFinanceiro(params): Promise<KpisFinanceiroResult>` — wrap de `rpc('kpis_financeiro', { ...mesmos p_* })`. Mescla com `EMPTY` antes de retornar.

Re-exporta tudo em `src/services/financeiro/index.ts` e (opcional) também via `src/services/financeiro.service.ts` para simetria com os demais símbolos. Tipos importam de `@/integrations/supabase/types` quando necessário.

### 2. Comercial — estender `src/services/comercial/pedidosVenda.service.ts`

Adicionar:
- `PedidoOperacionalPatch` — `{ status?, po_number?, data_po_cliente?, data_prometida_despacho?, prazo_despacho_dias?, observacoes? }` (todos `string | number | null` opcionais; mover do hook).
- `salvarPedidoOperacional(id: string, patch: PedidoOperacionalPatch): Promise<void>` — wrap de `rpc('salvar_pedido_operacional', { p_id: id, p_patch: patch as never })`. `throw` no erro com a `error.message` original.

### 3. Admin — novo arquivo `src/services/admin/adminSessions.service.ts`

⚠️ `src/services/admin/sessoes.service.ts` já existe mas opera **na tabela `user_sessions`** — semântica diferente do fluxo `admin-sessions` (Edge Function com `service_role`). Para evitar colisão de nomes/significado, criar arquivo separado:

- `SessaoAtiva` — mover a interface (`id, user_id, user_email, user_name, created_at, last_sign_in_at, user_agent, ip`) do hook para o service.
- `listSessoesAtivas(): Promise<SessaoAtiva[]>` — wrap de `functions.invoke<SessaoAtiva[]>('admin-sessions', { body: { action: 'list' } })`. `throw` com `error.message` ou fallback.
- `revogarSessaoAtiva(userId: string): Promise<void>` — wrap de `functions.invoke('admin-sessions', { body: { action: 'revoke', userId } })`. Nome com sufixo `Ativa` evita colidir com `revogarSessao` (DB) já exportado por `sessoes.service.ts`.

## Refatorações (somente troca da chamada — query keys, invalidações, toasts e UX intactos)

| Arquivo | Substituições |
|---|---|
| `src/pages/financeiro/hooks/useFinanceiroLancamentosPaged.ts` | bloco `supabase.rpc('listar_financeiro_lancamentos_ids', ...)` → `await listarFinanceiroLancamentosIds({ ...filters, orderBy: 'data_vencimento', ascending: false, offset, limit: pageSize })`. O segundo passo (`from('financeiro_lancamentos').select(...).in('id', ids)`) permanece — está fora do escopo. |
| `src/pages/financeiro/hooks/useFinanceiroKpisRpc.ts` | queryFn passa a chamar `fetchKpisFinanceiro(filters)`. Tipo `FinanceiroKpisResult` re-exportado pelo service (mantém `export type` no hook por compat). |
| `src/pages/comercial/hooks/useSalvarPedido.ts` | `mutationFn` chama `salvarPedidoOperacional(id, patch)`. |
| `src/hooks/useSessoes.ts` | funções locais `fetchSessoes`/`revogarSessao` substituídas por `listSessoesAtivas` e `revogarSessaoAtiva`; `mutationFn: (userId) => revogarSessaoAtiva(userId)`. |

Imports diretos a `@/integrations/supabase/client` removidos dos 4 hooks (nenhum usa supabase fora das chamadas migradas, exceto `useFinanceiroLancamentosPaged` que mantém o import por causa do segundo passo `from(...).in('id', ids)`).

## Fora de escopo

- Mover o `select` relacional + reidratação por `Map<id,row>` em `useFinanceiroLancamentosPaged` para o service (segundo passo continua no hook).
- Refatorar `sessoes.service.ts` (DB-based) ou unificá-lo com o novo service de Edge Function.
- Alterar query keys, invalidações, toasts ou nomes de mutações públicas dos hooks.
