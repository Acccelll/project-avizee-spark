## Objetivo

Reduzir os 6 round-trips paralelos do sidebar de alertas (executados a cada 90s) para 1 só, criando a RPC `sidebar_alerts_kpis` e refatorando `sidebarAlerts.service.ts` para consumi-la. O bloco DLQ admin-only permanece como chamada separada.

## Passo 1 — Migration

Novo arquivo em `supabase/migrations/<timestamp>_sidebar_alerts_kpis.sql`, seguindo o padrão de `produtos_estoque_summary` / `kpi_clientes_qualidade` (`STABLE`, `SECURITY DEFINER`, `SET search_path = public`, `GRANT EXECUTE TO authenticated`, `COMMENT`).

```sql
CREATE OR REPLACE FUNCTION public.sidebar_alerts_kpis()
RETURNS TABLE(
  financeiro_vencidos integer,
  financeiro_vencer integer,
  estoque_baixo integer,
  orcamentos_pendentes integer,
  nf_rejeitadas integer,
  nfe_sem_manifestacao integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM financeiro_lancamentos
       WHERE ativo = true
         AND status IN ('aberto','vencido')
         AND data_vencimento < CURRENT_DATE)::int,
    (SELECT COUNT(*) FROM financeiro_lancamentos
       WHERE ativo = true
         AND status = 'aberto'
         AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days')::int,
    (SELECT COUNT(*) FROM produtos
       WHERE COALESCE(ativo,true) = true
         AND COALESCE(estoque_minimo,0) > 0
         AND COALESCE(estoque_atual,0) <= COALESCE(estoque_minimo,0))::int,
    (SELECT COUNT(*) FROM orcamentos
       WHERE ativo = true
         AND status IN ('pendente','aguardando_aprovacao','em_analise'))::int,
    (SELECT COUNT(*) FROM notas_fiscais
       WHERE ativo = true AND status = 'rejeitada')::int,
    (SELECT COUNT(*) FROM nfe_distribuicao
       WHERE status_manifestacao = 'sem_manifestacao')::int;
$$;

GRANT EXECUTE ON FUNCTION public.sidebar_alerts_kpis() TO authenticated;
```

`SECURITY DEFINER` é seguro porque retorna apenas agregados (sem vazar linhas) — mesmo padrão das RPCs já existentes.

## Passo 2 — Refatorar `src/services/sidebarAlerts.service.ts`

Mantém a assinatura `fetchSidebarAlertsRaw(options)` e o shape `SidebarAlertsRaw` intactos. Apenas o corpo muda:

1. Substituir o `Promise.all` com 6 queries por uma chamada única:
   ```ts
   const { data, error } = await supabase.rpc("sidebar_alerts_kpis");
   if (error) throw error;
   const row = (Array.isArray(data) ? data[0] : data) ?? {};
   ```
2. Remover toda a montagem de `today` / `dueSoon` (a RPC usa `CURRENT_DATE` no servidor — fonte única de verdade, evita drift de timezone).
3. Mapear o row para os campos camelCase do `SidebarAlertsRaw`.
4. **Manter inalterado** o bloco `if (options.isAdmin) { … email_queue_metrics … }` que calcula `filaEmailDLQ` — RPC com GRANT restrito não pode entrar na consolidação.

## Passo 3 — Tipagem RPC

Após a migration, `Database['public']['Functions']` vai expor `sidebar_alerts_kpis`. Em `src/types/rpc.ts`, adicionar atalho na seção de wrappers tipados:

```ts
export const fetchSidebarAlertsKpis = () =>
  invokeRpc("sidebar_alerts_kpis", {} as RpcArgs<"sidebar_alerts_kpis">);
```

(Opcionalmente o service pode passar a usar esse helper; o plano original mantém `supabase.rpc` direto no service e expõe o helper para futuros consumidores.)

## Não-mudanças

- `src/hooks/useSidebarAlerts.ts` — intacto.
- Polling de 90s, lógica de admin gating, formato `SidebarAlertsRaw` — intactos.

## Validação

- Rodar `tsc -p tsconfig.strict-core.json --noEmit`.
- QA manual: abrir o app, conferir contadores do sidebar idênticos aos atuais; com Network DevTools, ver 1 chamada `sidebar_alerts_kpis` (+ opcionalmente `email_queue_metrics` se admin) em vez de 6.