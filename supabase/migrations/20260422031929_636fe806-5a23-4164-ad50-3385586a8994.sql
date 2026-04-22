CREATE OR REPLACE FUNCTION public.gerar_financeiro_folha(p_folha_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folha            public.folha_pagamento%ROWTYPE;
  v_funcionario_nome text;
  v_competencia_date date;
  v_data_pagamento   date;
  v_data_fgts        date;
  v_mes_ref          text;
  v_fgts             numeric;
  v_lanc_salario_id  uuid;
  v_lanc_fgts_id     uuid;
BEGIN
  SELECT * INTO v_folha FROM public.folha_pagamento WHERE id = p_folha_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Folha nao encontrada');
  END IF;

  IF v_folha.financeiro_gerado THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Lancamentos ja foram gerados para esta folha');
  END IF;

  SELECT nome INTO v_funcionario_nome FROM public.funcionarios WHERE id = v_folha.funcionario_id;

  v_competencia_date := (v_folha.competencia || '-01')::date;
  v_data_pagamento   := (v_competencia_date + INTERVAL '1 month' + INTERVAL '4 days')::date;
  v_data_fgts        := (v_competencia_date + INTERVAL '1 month' + INTERVAL '6 days')::date;
  v_mes_ref          := to_char(v_competencia_date, 'TMMonth/YYYY');
  v_fgts             := COALESCE(v_folha.salario_base, 0) * 0.08;

  INSERT INTO public.financeiro_lancamentos (
    tipo, descricao, valor, data_vencimento, status, funcionario_id, ativo
  ) VALUES (
    'pagar',
    'Salario ' || v_mes_ref || ' - ' || COALESCE(v_funcionario_nome, ''),
    COALESCE(v_folha.valor_liquido, 0),
    v_data_pagamento,
    'aberto',
    v_folha.funcionario_id,
    true
  ) RETURNING id INTO v_lanc_salario_id;

  IF v_fgts > 0 THEN
    INSERT INTO public.financeiro_lancamentos (
      tipo, descricao, valor, data_vencimento, status, funcionario_id, ativo
    ) VALUES (
      'pagar',
      'FGTS ' || v_mes_ref || ' - ' || COALESCE(v_funcionario_nome, ''),
      v_fgts,
      v_data_fgts,
      'aberto',
      v_folha.funcionario_id,
      true
    ) RETURNING id INTO v_lanc_fgts_id;
  END IF;

  UPDATE public.folha_pagamento
     SET status = 'pago', financeiro_gerado = true
   WHERE id = p_folha_id;

  RETURN jsonb_build_object(
    'ok', true,
    'lancamento_salario_id', v_lanc_salario_id,
    'lancamento_fgts_id', v_lanc_fgts_id,
    'data_pagamento', v_data_pagamento,
    'data_fgts', v_data_fgts,
    'fgts', v_fgts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gerar_financeiro_folha(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gerar_financeiro_folha(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.gerar_financeiro_folha(uuid) IS
'Gera atomicamente os lancamentos financeiros (salario dia 5, FGTS 8% dia 7 do mes seguinte) a partir de uma folha registrada e marca a folha como financeiro_gerado=true.';