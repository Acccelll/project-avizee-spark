## Objetivo

Corrigir o bug do KPI "Incompletos" em `Clientes.tsx` (que hoje conta apenas a página corrente sob paginação server-side de 50/pág) e unificar as 3 queries de KPI em `Fornecedores.tsx` em uma única RPC. Também levar os filtros "Cadastro" de Clientes para server-side.

## Passo 1 — Migration: 2 RPCs SECURITY DEFINER

Novo arquivo em `supabase/migrations/<timestamp>_kpi_qualidade_cadastros.sql`, seguindo o padrão de `20260508162908` (`STABLE`, `SECURITY DEFINER`, `SET search_path = public`, `GRANT EXECUTE TO authenticated`, `COMMENT ON FUNCTION`).

### `kpi_clientes_qualidade()`
Retorna agregados sobre `clientes WHERE COALESCE(ativo,true)=true`:
- `total_ativos`, `incompletos`, `sem_contato`, `sem_telefone`, `sem_email`, `sem_prazo`, `sem_grupo`, `com_grupo`.

Lógica replicando exatamente `getMissingFields` de `Clientes.tsx`:
- `incompletos`: `cpf_cnpj IS NULL OR TRIM(cpf_cnpj)='' OR (celular IS NULL AND telefone IS NULL) OR email IS NULL OR TRIM(email)='' OR prazo_padrao IS NULL OR prazo_padrao<=0 OR cidade IS NULL OR uf IS NULL`. (Observação: a UI exclui "grupo" do critério de incompleto — a RPC seguirá o mesmo critério, sem `grupo_economico_id`.)
- `sem_contato`: `celular IS NULL AND telefone IS NULL AND (email IS NULL OR TRIM(email)='')`.
- `sem_telefone`: `celular IS NULL AND telefone IS NULL`.
- `sem_email`: `email IS NULL OR TRIM(email)=''`.
- `sem_prazo`: `prazo_padrao IS NULL OR prazo_padrao <= 0`.
- `sem_grupo` / `com_grupo`: `grupo_economico_id IS NULL` / `IS NOT NULL`.

### `kpi_fornecedores_qualidade()`
Retorna sobre `fornecedores WHERE ativo = true`:
- `total_ativos`, `sem_contato`, `incompletos`.

Lógica replicando `SEM_CONTATO_OR` e `CADASTRO_INCOMPLETO_OR` de `Fornecedores.tsx`:
- `sem_contato`: `(email IS NULL OR TRIM(email)='') AND (telefone IS NULL OR TRIM(telefone)='') AND (celular IS NULL OR TRIM(celular)='')`.
- `incompletos`: `cpf_cnpj IS NULL OR TRIM(cpf_cnpj)='' OR cidade IS NULL OR TRIM(cidade)='' OR uf IS NULL OR TRIM(uf)=''`.

## Passo 2 — Camada de serviço

### `src/services/clientes.service.ts`
Adicionar:
```ts
export interface KpiClientesQualidade {
  total_ativos: number; incompletos: number; sem_contato: number;
  sem_telefone: number; sem_email: number; sem_prazo: number;
  sem_grupo: number; com_grupo: number;
}
export async function fetchKpiClientesQualidade(): Promise<KpiClientesQualidade> { ... }
```
Implementação usa `supabase.rpc('kpi_clientes_qualidade')` e normaliza array→objeto com defaults `0`.

### `src/services/fornecedores.service.ts`
Adicionar:
```ts
export interface KpiFornecedoresQualidade {
  total_ativos: number; sem_contato: number; incompletos: number;
}
export async function fetchKpiFornecedoresQualidade(): Promise<KpiFornecedoresQualidade> { ... }
```

Ambos seguem o padrão de `invokeRpc` (`src/types/rpc.ts`) — assim ficam tipados via `Database['public']['Functions']` após o regen do `types.ts`.

## Passo 3 — Refatorar `src/pages/Clientes.tsx`

1. Adicionar `useQuery` para `kpiQualidade` com `queryKey: ['clientes','kpi-qualidade']` e `staleTime: 60_000`.
2. Substituir `summaryIncompletosPagina` por `summaryIncompletos = kpiQualidade?.incompletos ?? 0`. Atualizar o `SummaryCard`: title/shortTitle de "Incompletos (página)" → "Incompletos", `value={summaryIncompletos}`.
3. Migrar filtros "Cadastro" para server-side: empurrar `sem_contato`, `sem_telefone`, `sem_email`, `sem_prazo`, `sem_grupo` e `incompleto` via `serverFilters` usando o mesmo formato já aceito por `useSupabaseCrud` — estender o tipo aceito para incluir `or` (string PostgREST). Confirmar que o hook propaga `or()`; caso não, adicionar suporte mínimo a `{ or: string }` nos filtros.
4. Remover do `filteredData` o bloco `if (cadastroFilters.length > 0)` (e o TODO inline). Manter apenas `hasSemGrupoFilter` para compatibilizar a opção "sem grupo" se ainda fizer sentido em conjunto com filtros server.
5. Manter `getMissingFields` apenas para tooltip por linha (já é usado em render); **não remover**.
6. Invalidar `['clientes','kpi-qualidade']` após `create`/`update`/`remove` para manter o KPI fresh.

## Passo 4 — Refatorar `src/pages/Fornecedores.tsx`

1. Substituir os 3 hooks (`useTableCount` para `totalAtivos` + 2 `useQuery` com `.or(...)`) por **um** `useQuery(['fornecedores','kpi-qualidade'], fetchKpiFornecedoresQualidade, { staleTime: 30_000 })`.
2. Atualizar os `SummaryCard` para ler `kpi?.total_ativos ?? 0`, `kpi?.sem_contato ?? 0`, `kpi?.incompletos ?? 0`.
3. Remover `SEM_CONTATO_OR`, `CADASTRO_INCOMPLETO_OR` e os imports de `supabase`/`useTableCount` se ficarem órfãos.
4. Invalidar `['fornecedores','kpi-qualidade']` após mutações.

## Validação

- Após aplicar a migration, esperar regen de `src/integrations/supabase/types.ts` para que `invokeRpc` enxergue as 2 novas funções.
- Rodar `tsc -p tsconfig.strict-core.json --noEmit` (ambos arquivos já estão no escopo strict).
- QA manual: abrir `/clientes` e confirmar que "Incompletos" passa a refletir o total global (não mais 50/pág); aplicar filtro "Incompleto" e ver `totalCount` mudar de fato.

## Notas técnicas

- A RPC `kpi_clientes_qualidade` usa o mesmo critério da UI para "incompleto", incluindo o tratamento `TRIM('')='' ` para strings em branco (a função TS atual usa `!c.email` que captura ambos; a SQL precisa ser explícita).
- `SECURITY DEFINER` é seguro porque retornam apenas agregados (sem vazar linhas), igual a `produtos_estoque_summary`.
- Não alterar lógica de negócio nem layout — apenas mover cálculo de KPI/filtros para o servidor.