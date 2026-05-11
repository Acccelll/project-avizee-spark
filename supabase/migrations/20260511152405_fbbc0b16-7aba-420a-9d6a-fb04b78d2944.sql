CREATE OR REPLACE FUNCTION public.sidebar_alerts_kpis()
RETURNS TABLE(
  financeiro_vencidos integer,
  financeiro_vencer integer,
  estoque_baixo integer,
  orcamentos_pendentes integer,
  nf_rejeitadas integer,
  nfe_sem_manifestacao integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Consolida os 6 contadores do sidebar em um único round-trip.
  -- SECURITY DEFINER: retorna apenas agregados, não vaza linhas.
  SELECT
    (SELECT COUNT(*) FROM financeiro_lancamentos
       WHERE ativo = true
         AND status IN ('aberto','vencido')
         AND data_vencimento < CURRENT_DATE)::int AS financeiro_vencidos,
    (SELECT COUNT(*) FROM financeiro_lancamentos
       WHERE ativo = true
         AND status = 'aberto'
         AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days')::int AS financeiro_vencer,
    (SELECT COUNT(*) FROM produtos
       WHERE COALESCE(ativo, true) = true
         AND COALESCE(estoque_minimo, 0) > 0
         AND COALESCE(estoque_atual, 0) <= COALESCE(estoque_minimo, 0))::int AS estoque_baixo,
    (SELECT COUNT(*) FROM orcamentos
       WHERE ativo = true
         AND status IN ('pendente','aguardando_aprovacao','em_analise'))::int AS orcamentos_pendentes,
    (SELECT COUNT(*) FROM notas_fiscais
       WHERE ativo = true AND status = 'rejeitada')::int AS nf_rejeitadas,
    (SELECT COUNT(*) FROM nfe_distribuicao
       WHERE status_manifestacao = 'sem_manifestacao')::int AS nfe_sem_manifestacao;
$$;

GRANT EXECUTE ON FUNCTION public.sidebar_alerts_kpis() TO authenticated;
COMMENT ON FUNCTION public.sidebar_alerts_kpis() IS
  'Retorna em uma chamada todos os contadores usados pelo sidebar de alertas (polling de 90s). Substitui 6 SELECTs paralelos por 1 round-trip.';