-- Sprint 4 — Correção da aplicação de baixa da conciliação v2

CREATE OR REPLACE FUNCTION public.conciliacao_aplicar_baixa(p_match_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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

  INSERT INTO public.financeiro_baixas
    (empresa_id, lancamento_id, data_baixa, valor_pago, forma_pagamento, conta_bancaria_id,
     observacoes, valor_movimento_bancario, conciliacao_status, conciliacao_data,
     conciliacao_usuario, conciliacao_extrato_referencia)
  VALUES
    (v_match.empresa_id, v_match.lancamento_id, v_linha.data_movimento, v_valor, 'conciliacao_bancaria',
     v_linha.conta_bancaria_id, 'Baixa automática por conciliação v2', v_valor,
     'conciliado', now(), auth.uid(), v_linha.id::text || ':' || v_match.lancamento_id::text)
  RETURNING id INTO v_baixa_id;

  -- O trigger financeiro já sincroniza valor_pago, saldo_restante, status e data_pagamento.
  UPDATE public.conciliacao_matches
  SET baixa_id = v_baixa_id, updated_at = now()
  WHERE id = p_match_id;

  RETURN v_baixa_id;
END;
$$;

REVOKE ALL ON FUNCTION public.conciliacao_aplicar_baixa(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.conciliacao_aplicar_baixa(uuid) TO authenticated;