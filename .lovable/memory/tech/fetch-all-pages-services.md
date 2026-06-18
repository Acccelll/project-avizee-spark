---
name: fetchAllPages — paginação interna em services
description: Helper canônico para evitar o teto silencioso de 1000 linhas do PostgREST em loaders sem paginação server-side visível
type: feature
---

Quando um service precisa devolver TODAS as linhas (lookup, listagem
pequena/média sem UI paginada), use `fetchAllPages` em vez de `.limit(N)`
arbitrário:

```ts
import { fetchAllPages } from "@/services/_lib/fetchAllPages";

const rows = await fetchAllPages<MinhaRow>(() =>
  supabase.from("tabela").select("*").eq("ativo", true).order("nome"),
);
```

- Page size interno: 1000 (limite do PostgREST).
- Hard cap: 50.000 (`REPORT_HARD_CAP`) — evita travar UI se a view explodir.
- Recebe **factory** de builder (cada iteração faz `.range(from, to)`).
- Sem `.range()` ou `.limit()` no caller.

**Quando NÃO usar:**
- Listas grandes com UI paginada → `useSupabaseCrud({ pageSize })` +
  `serverPagination` no DataTable (ver `useFinanceiroLancamentosPaged`,
  `fetchNotasFiscaisPaged`).
- Lookups com teto defensivo intencional e pequeno (sócios, plano de contas)
  → `.limit(500)` continua aceitável.

Adotado em PR-2.1: orcamentos, estoque, cotacoesCompra, pedidosCompra,
recorrencias, precosEspeciais, comprasLifecycle, logistica/{remessas,
prepostagem, entregas}.