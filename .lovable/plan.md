## Diagnóstico revisto

O que está acontecendo agora (BRT, 20/05 21:36):
- Servidor Postgres roda em UTC → `CURRENT_DATE = 2026-05-21`.
- O título do sistema tem `data_vencimento = 2026-05-21` (já está no "amanhã" do servidor, mas para o usuário é amanhã também — 21/05).
- RPC `kpis_financeiro` usa `CURRENT_DATE` (UTC), então conta 1 em `vence_hoje` mesmo o usuário estando em 20/05 BRT.
- Filtro de período "hoje" no cliente usa `Date` local (BRT) → `dateRange = [2026-05-20, 2026-05-20]`, que exclui o registro de 21/05. Daí o "0".

A regra correta, segundo o usuário, é **tudo em horário de Brasília**:
- "Hoje" = 00:00 a 23:59 de 20/05 BRT.
- O título de 21/05 só deve aparecer como "Vence Hoje" amanhã.
- `Todos` também deve refletir o conceito BRT de hoje no KPI "Vence Hoje" (mostrando 0 hoje, 1 amanhã).

## Correções

### 1. RPC `kpis_financeiro` — calcular "hoje" em BRT
Nova migração trocando `CURRENT_DATE` por uma data fixa em America/Sao_Paulo:

```sql
WITH params AS (SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS hoje_brt)
```

E aplicar em todos os pontos do RPC:
- `CASE WHEN status='aberto' AND data_vencimento < (SELECT hoje_brt FROM params) THEN 'vencido' ...`
- `WHERE data_vencimento > (SELECT hoje_brt FROM params)` em `a_vencer`
- `data_vencimento = (SELECT hoje_brt FROM params)` em `vence_hoje`

Manter `SET search_path = public` e `STABLE`.

### 2. `src/lib/periodFilter.ts` — manter cálculo local (já é BRT para o usuário) e corrigir `'todos'`/`'vencidos'`
- `periodToFinancialRange('hoje')` continua devolvendo `[hoje_local, hoje_local]` — para usuários em BRT isso já é correto.
- Para `'vencidos'`, o `dateTo` precisa usar a mesma data local que o RPC enxerga (BRT). Hoje em BRT === local; já é coerente.
- Nenhuma mudança funcional necessária aqui depois que o RPC passar a usar BRT — ambos os lados ficam alinhados em "hoje BRT".

### 3. `src/pages/Financeiro.tsx`
- Trocar `hojeStr` de `toISOString().split("T")[0]` (UTC) para a data local em `YYYY-MM-DD`:
  ```ts
  const yyyy = hoje.getFullYear();
  const mm = String(hoje.getMonth()+1).padStart(2,'0');
  const dd = String(hoje.getDate()).padStart(2,'0');
  const hojeStr = `${yyyy}-${mm}-${dd}`;
  ```
  Assim `dateRange` (cliente) e `kpis_financeiro` (servidor BRT) usam a mesma referência de "hoje".

### 4. Default do filtro: `30d` → `todos`
Em `src/pages/financeiro/hooks/useFinanceiroFiltros.ts`:
- Fallback de `period` passa a ser `"todos"`.
- Sentinela de "limpar URL" passa a ser `v === "todos" ? "" : v`.

## Validação manual

Hoje (20/05 BRT):
1. `/financeiro` sem querystring → chip "Todos" ativo, lista completa, KPI "Vence Hoje" = 0 (título é 21/05).
2. Clicar "Vence hoje" → lista vazia + KPI 0 (consistente).
3. Amanhã (21/05 BRT, > 03:00 UTC) → KPI "Vence Hoje" = 1 tanto em "Todos" quanto em "Vence hoje".

## Arquivos impactados

- `supabase/migrations/<novo>.sql` — recria `public.kpis_financeiro` com BRT.
- `src/pages/Financeiro.tsx` — `hojeStr` local em vez de UTC.
- `src/pages/financeiro/hooks/useFinanceiroFiltros.ts` — default `todos`.

## Fora do escopo

- Mudar timezone global do banco.
- Alterar outros RPCs que usem `CURRENT_DATE` (revisar caso a caso em pedido específico).
