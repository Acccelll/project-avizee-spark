CREATE OR REPLACE FUNCTION public.conciliacao_dashboard_kpis(
  p_empresa_id uuid,
  p_periodo_inicio date,
  p_periodo_fim date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_totais jsonb;
  v_por_conta jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_empresas WHERE user_id = v_uid AND empresa_id = p_empresa_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'total_linhas', COUNT(*),
    'conciliadas', COUNT(*) FILTER (WHERE l.status = 'conciliado'),
    'pendentes', COUNT(*) FILTER (WHERE l.status = 'pendente'),
    'divergentes', COUNT(*) FILTER (WHERE l.status = 'divergente'),
    'ticket_medio', COALESCE(AVG(ABS(l.valor)), 0),
    'total_creditos', COALESCE(SUM(l.valor) FILTER (WHERE l.valor > 0), 0),
    'total_debitos', COALESCE(SUM(ABS(l.valor)) FILTER (WHERE l.valor < 0), 0)
  ) INTO v_totais
  FROM public.conciliacao_extrato_linhas l
  WHERE l.empresa_id = p_empresa_id
    AND l.data_movimento BETWEEN p_periodo_inicio AND p_periodo_fim;

  WITH auto_manual AS (
    SELECT
      COUNT(*) FILTER (WHERE m.status = 'aprovado' AND m.aprovado_por IS NOT NULL) AS aprovados,
      COUNT(*) FILTER (WHERE m.status = 'aprovado' AND m.observacao LIKE 'auto:%') AS auto_aprovados
    FROM public.conciliacao_matches m
    JOIN public.conciliacao_extrato_linhas l ON l.id = m.extrato_linha_id
    WHERE m.empresa_id = p_empresa_id
      AND l.data_movimento BETWEEN p_periodo_inicio AND p_periodo_fim
  )
  SELECT v_totais
    || jsonb_build_object(
        'aprovados_total', aprovados,
        'auto_aprovados', auto_aprovados,
        'pct_auto', CASE WHEN aprovados > 0 THEN ROUND(100.0 * auto_aprovados / aprovados, 2) ELSE 0 END
      )
  INTO v_totais
  FROM auto_manual;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.total_linhas DESC), '[]'::jsonb)
  INTO v_por_conta
  FROM (
    SELECT
      cb.id AS conta_id,
      cb.nome AS conta_nome,
      COUNT(l.id) AS total_linhas,
      COUNT(l.id) FILTER (WHERE l.status = 'conciliado') AS conciliadas,
      COUNT(l.id) FILTER (WHERE l.status = 'pendente') AS pendentes,
      COALESCE(SUM(l.valor) FILTER (WHERE l.valor > 0), 0) AS creditos,
      COALESCE(SUM(ABS(l.valor)) FILTER (WHERE l.valor < 0), 0) AS debitos
    FROM public.conciliacao_extrato_linhas l
    JOIN public.contas_bancarias cb ON cb.id = l.conta_bancaria_id
    WHERE l.empresa_id = p_empresa_id
      AND l.data_movimento BETWEEN p_periodo_inicio AND p_periodo_fim
    GROUP BY cb.id, cb.nome
  ) t;

  RETURN jsonb_build_object(
    'periodo', jsonb_build_object('inicio', p_periodo_inicio, 'fim', p_periodo_fim),
    'totais', v_totais,
    'por_conta', v_por_conta
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.conciliacao_dashboard_kpis(uuid, date, date) TO authenticated;