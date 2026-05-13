DROP FUNCTION IF EXISTS public.sidebar_alerts_kpis();

CREATE OR REPLACE FUNCTION public.sidebar_alerts_kpis()
RETURNS TABLE(
  financeiro_vencidos integer,
  financeiro_vencer integer,
  estoque_baixo integer,
  orcamentos_pendentes integer,
  nf_rejeitadas integer,
  nfe_sem_manifestacao integer,
  pedidos_compra_pendentes integer,
  nfe_entrada_pendentes integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
       WHERE COALESCE(ativo, true) = true
         AND COALESCE(estoque_minimo, 0) > 0
         AND COALESCE(estoque_atual, 0) <= COALESCE(estoque_minimo, 0))::int,
    (SELECT COUNT(*) FROM orcamentos
       WHERE ativo = true
         AND status IN ('pendente','aguardando_aprovacao','em_analise'))::int,
    (SELECT COUNT(*) FROM notas_fiscais
       WHERE ativo = true AND status = 'rejeitada')::int,
    (SELECT COUNT(*) FROM nfe_distribuicao
       WHERE status_manifestacao = 'sem_manifestacao')::int,
    (SELECT COUNT(*) FROM pedidos_compra
       WHERE ativo = true
         AND status IN ('rascunho','em_aprovacao','aguardando_aprovacao','pendente'))::int,
    (SELECT COUNT(*) FROM notas_fiscais
       WHERE ativo = true AND tipo = 'entrada' AND status = 'pendente')::int;
$function$;