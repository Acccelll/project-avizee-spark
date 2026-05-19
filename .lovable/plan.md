# Correção: erro "Requested range not satisfiable" em grids paginados

## Diagnóstico

O toast aparece em `Produtos` (e em qualquer tela que use `useSupabaseCrud` em modo paged) quando o usuário **digita uma busca ou muda filtro estando numa página > 1**.

Sequência observada (vista no replay: 2 toasts seguidos em `/produtos?q=vr`):

1. Estado atual: `page = 2`, `searchTerm = ""`, `pageSize = 50` → range `(100, 149)`.
2. Usuário digita `vr` → `searchTerm` muda.
3. Em `src/hooks/useSupabaseCrud.ts` o `queryKey` é recomputado **com o novo `searchTerm` e o `page=2` antigo** (linhas 144–147).
4. React Query dispara a request com `range(100, 149)`, mas a busca `vr` retorna ~5 produtos. PostgREST devolve **HTTP 416 "Requested range not satisfiable"** → toast de erro.
5. Só **depois** do render, o `useEffect` das linhas 151–155 chama `setPage(0)`.
6. Re-render dispara nova query com `page=0` → sucesso e lista carrega ("No record found" ou resultado).

O segundo toast vem do StrictMode/refetch duplo ou de uma segunda mudança de tecla. Não é PostgREST instável — é race entre `setPage(0)` (efeito) e `queryKey` (síncrono).

## Correção

Tornar o reset de página **síncrono** dentro do render do hook, antes de compor o `queryKey`, usando `useRef` para detectar mudança nas deps de filtro/busca/ordem.

### Mudança única em `src/hooks/useSupabaseCrud.ts`

Substituir o `useEffect` reset (linhas 149–155) por um clamp síncrono:

```ts
// Reset síncrono: quando filtros/busca/ordem mudam em modo paged,
// força page=0 no MESMO render — evita pedir range inexistente
// (HTTP 416) na primeira query disparada com filtro novo + page antigo.
const filterDepsKey = `${filterKey}|${dateRangeKey}|${statusKey}|${orFiltersKey}|${searchTerm}|${orderBy}|${ascending}`;
const lastDepsRef = useRef(filterDepsKey);
let effectivePage = page;
if (effectiveMode === "paged" && lastDepsRef.current !== filterDepsKey) {
  lastDepsRef.current = filterDepsKey;
  if (page !== 0) {
    effectivePage = 0;
    // Agenda atualização do state para o próximo tick — o render atual
    // já usa effectivePage=0, evitando a query intermediária.
    queueMicrotask(() => setPage(0));
  }
}
```

E trocar `page` por `effectivePage` em:
- `queryKey` (linha 145)
- `const from = page * pageSize` (linha 202)

Isso elimina a janela em que `queryKey` carrega `searchTerm` novo + `page` antigo.

### Defesa secundária

Em `notifyError` (ou no `if (error)` do paged mode, linha 204), tratar especificamente o erro de range — quando `error.code === "PGRST103"` ou `message.includes("Requested range")`, **não** mostrar toast: significa apenas que a página foi pedida fora do total atual. Logar via `logger.warn` para rastreio.

## Validação

1. Em `/produtos`, paginar para a página 2.
2. Digitar uma busca que retorne poucos resultados (ex.: `vr`).
3. Esperado: lista filtrada aparece sem toast de erro.
4. Verificar que continua resetando para página 0 (a UI de paginação volta a "1 de N").
5. Smoke: rodar `vitest run src/hooks/__tests__/useSupabaseCrud.test.tsx`.

## Escopo

- Arquivo único: `src/hooks/useSupabaseCrud.ts`.
- Sem mudança em RPCs, schema, ou consumidores do hook.
- Sem alteração visual.
