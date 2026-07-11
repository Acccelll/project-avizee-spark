-- Sprint 4 — Usa rotina financeira padrão na baixa automática da conciliação

CREATE OR REPLACE FUNCTION public.conciliacao_aplicar_baixa(p_match_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_match public.conciliacao_matches;
  v_linha public.conciliacao_extrato_linhas;
  v_lanc public.financeiro_lancamentos;
  v_baixa_id uuid;
  v_valor numeric;
BEGIN
  SELECT * INTO v_match
  FROM public.conciliacao_matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Match % não encontrado', p_match_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_empresas
    WHERE user_id = v_uid AND empresa_id = v_match.empresa_id
  ) THEN
    RAISE EXCEPTION 'Sem acesso à empresa do match';
  END IF;

  IF v_match.baixa_id IS NOT NULL THEN
    RETURN v_match.baixa_id;
  END IF;

  SELECT * INTO v_linha
  FROM public.conciliacao_extrato_linhas
  WHERE id = v_match.extrato_linha_id
  FOR UPDATE;

  SELECT * INTO v_lanc
  FROM public.financeiro_lancamentos
  WHERE id = v_match.lancamento_id
  FOR UPDATE;

  IF v_linha.id IS NULL OR v_lanc.id IS NULL THEN
    RAISE EXCEPTION 'Dados do match incompletos';
  END IF;

  IF v_lanc.status NOT IN ('aberto', 'parcial') THEN
    RAISE EXCEPTION 'Lançamento % não aceita baixa no status %', v_lanc.id, v_lanc.status;
  END IF;

  v_valor := LEAST(ABS(v_linha.valor), COALESCE(v_lanc.saldo_restante, v_lanc.valor));
  IF v_valor <= 0 THEN
    RAISE EXCEPTION 'Valor de baixa inválido para o match %', p_match_id;
  END IF;

  v_baixa_id := public.registrar_baixa_financeira(
    v_match.lancamento_id,
    v_valor,
    v_linha.data_movimento,
    'conciliacao_bancaria',
    v_linha.conta_bancaria_id,
    'Baixa automática por conciliação v2',
    0,
    0,
    0,
    0,
    NULL,
    false
  );

  UPDATE public.financeiro_baixas
  SET conciliacao_status = 'conciliado',
      conciliacao_data = now(),
      conciliacao_usuario = v_uid,
      conciliacao_extrato_referencia = v_linha.id::text || ':' || v_match.lancamento_id::text,
      valor_movimento_bancario = v_valor
  WHERE id = v_baixa_id;

  UPDATE public.conciliacao_matches
  SET baixa_id = v_baixa_id, updated_at = now()
  WHERE id = p_match_id;

  RETURN v_baixa_id;
END;
$$;

REVOKE ALL ON FUNCTION public.conciliacao_aplicar_baixa(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.conciliacao_aplicar_baixa(uuid) TO authenticated;