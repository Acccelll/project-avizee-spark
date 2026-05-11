## Objetivo

Migrar chamadas diretas ao Supabase nos módulos **Produto**, **Orçamento (público)** e em utilitários (**Help**, **Município IBGE**) para a camada de serviços, seguindo o padrão de `src/services/CONTRACTS.md`: funções async tipadas, `throw` em erro, sem `toast`/`navigate` dentro do service, e tipagem via `@/integrations/supabase/types`.

## Serviços — estender

### 1. `src/services/produtos.service.ts`
Adicionar (não duplicar nada já existente — apenas `deleteProduto` e `fetchProdutoDetalhes` cobrem hoje o CRUD):

- `getProdutoById(id: string): Promise<Tables<'produtos'> | null>`
  Wrap de `from('produtos').select('*').eq('id', id).maybeSingle()`. Retorna `data` ou `null`; `throw` no erro.
- `createProduto(payload: TablesInsert<'produtos'>): Promise<Tables<'produtos'>>`
  Wrap de `from('produtos').insert(payload).select('*').single()`.
- `updateProduto(id: string, payload: TablesUpdate<'produtos'>): Promise<void>`
  Wrap de `from('produtos').update(payload).eq('id', id)`.
- `fetchProdutosEstoqueSummary(): Promise<{ criticos: number; zerados: number; abaixo_minimo: number }>`
  Wrap de `rpc('produtos_estoque_summary')` — normaliza array/objeto e converte para `Number(...)` (move a lógica que hoje vive na queryFn de `Produtos.tsx`).

Imports novos: `Tables`, `TablesInsert`, `TablesUpdate` de `@/integrations/supabase/types`.

### 2. `src/services/orcamentos.service.ts`
Adicionar:

- `acaoClienteOrcamento(token: string, acao: string, comentario: string | null): Promise<void>`
  Wrap de `rpc('acao_cliente_orcamento' as never, { p_token, p_acao, p_comentario } as never)`. `throw` no erro (caller mostra toast).
- `notifyOrcamentoResposta(token: string, acao: string): Promise<void>`
  Wrap de `functions.invoke('notify-orcamento-resposta', { body: { token, acao } })`. **Best-effort**: faz `try/catch` interno e loga via `logger`, nunca `throw` (mantém o comportamento `.catch(() => {})` atual).

Sem `toast`/`navigate` nas novas funções.

## Serviços — criar

### 3. `src/services/help.service.ts` (novo)
- `submitHelpFeedback(userId: string, route: string, helpful: boolean): Promise<void>`
  Wrap de `from('help_feedback').insert({ user_id: userId, route, helpful })`. `throw` no erro.

### 4. `src/services/municipio.service.ts` (novo)
- Reexporta `MunicipioIbge` (mover a interface para o service e re-export do hook para compatibilidade).
- `buscarMunicipioIbgeDb(nome: string, uf: string): Promise<MunicipioIbge | null>`
  Wrap de `rpc('buscar_municipio_ibge', { p_nome, p_uf })`. **Não faz throw** — em qualquer erro ou data vazio retorna `null` (é apenas o cache local; o fallback HTTP do IBGE roda no hook).

O `upsert` em `ibge_municipios` e o fetch da API pública do IBGE permanecem no hook (não fazem parte do escopo).

## Refatorações (apenas trocar a chamada — UX/toasts/invalidações intactos)

| Arquivo | Substituições |
|---|---|
| `src/pages/Produtos.tsx` | queryFn passa a chamar `fetchProdutosEstoqueSummary()` direto |
| `src/pages/produtos/ProdutoForm.tsx` | linha 189 → `getProdutoById(id)`; linha 340 → `createProduto(payload)`; linha 344 → `updateProduto(id, payload)` |
| `src/pages/OrcamentoPublico.tsx` | bloco do `rpc('acao_cliente_orcamento')` → `try { await acaoClienteOrcamento(...) } catch { toast.error(...) }`; chamada à edge function → `notifyOrcamentoResposta(token, acao)` (sem `.catch`, já é best-effort) |
| `src/components/help/HelpDrawer.tsx` | `sendFeedback` usa `try { await submitHelpFeedback(user.id, entry.route, helpful) } catch { toast.error(...) }` |
| `src/hooks/useMunicipioIbge.ts` | passo (1) usa `buscarMunicipioIbgeDb(nome, uf)`; passo (2) fallback IBGE API + upsert em `ibge_municipios` permanece inalterado |

Imports diretos a `@/integrations/supabase/client` removidos dos arquivos refatorados quando não restar uso. No `useMunicipioIbge.ts` o import permanece (upsert em `ibge_municipios`).

## Fora de escopo
- Mover o `upsert` do `ibge_municipios` ou o fetch IBGE para service.
- Alterar lógica de UX, toasts, invalidação de cache ou navegação.
- Refatorar outros call-sites (apenas os 5 arquivos listados).
