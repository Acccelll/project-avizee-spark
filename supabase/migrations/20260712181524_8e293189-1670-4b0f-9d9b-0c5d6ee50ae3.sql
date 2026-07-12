
-- 1) Reescreve gerar_fatura_cartao corrigindo tipo, empresa, datas e fonte de agregação
CREATE OR REPLACE FUNCTION public.gerar_fatura_cartao(p_cartao_id uuid, p_competencia text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cartao        record;
  v_ano           int;
  v_mes           int;
  v_fech_last     int;
  v_vcto_last     int;
  v_data_fechamento date;
  v_data_vencimento date;
  v_data_abertura date;
  v_fatura_id     uuid;
  v_total_linhas  numeric := 0;
  v_total_vinc    numeric := 0;
  v_total         numeric := 0;
  v_lanc_fatura_id uuid;
  v_empresa_id    uuid;
  v_qtd_itens     int := 0;
BEGIN
  IF p_competencia !~ '^\d{4}-\d{2}$' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Competência inválida (use YYYY-MM)');
  END IF;
  v_ano := substring(p_competencia, 1, 4)::int;
  v_mes := substring(p_competencia, 6, 2)::int;

  SELECT * INTO v_cartao FROM public.cartoes_credito WHERE id = p_cartao_id AND ativo;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Cartão não encontrado ou inativo');
  END IF;

  v_empresa_id := v_cartao.empresa_id;

  -- Último dia do mês de fechamento
  v_fech_last := EXTRACT(DAY FROM (make_date(v_ano, v_mes, 1) + interval '1 month - 1 day'))::int;
  v_data_fechamento := make_date(v_ano, v_mes, LEAST(v_cartao.dia_fechamento, v_fech_last));

  IF v_cartao.dia_vencimento <= v_cartao.dia_fechamento THEN
    -- Vencimento no mês seguinte ao fechamento
    v_vcto_last := EXTRACT(DAY FROM ((v_data_fechamento + interval '1 month') + interval '1 month - 1 day' - (EXTRACT(DAY FROM v_data_fechamento + interval '1 month')::int - 1) * interval '1 day'))::int;
    v_data_vencimento := (date_trunc('month', v_data_fechamento + interval '1 month'))::date;
    v_vcto_last := EXTRACT(DAY FROM (v_data_vencimento + interval '1 month - 1 day'))::int;
    v_data_vencimento := make_date(
      EXTRACT(YEAR FROM v_data_vencimento)::int,
      EXTRACT(MONTH FROM v_data_vencimento)::int,
      LEAST(v_cartao.dia_vencimento, v_vcto_last)
    );
  ELSE
    v_data_vencimento := make_date(v_ano, v_mes, LEAST(v_cartao.dia_vencimento, v_fech_last));
  END IF;

  v_data_abertura := (date_trunc('month', v_data_fechamento) - interval '1 month'
                      + (LEAST(v_cartao.dia_fechamento, v_fech_last) - 1) * interval '1 day')::date;

  -- Resolve / cria fatura (idempotente)
  INSERT INTO public.cartao_faturas (
    empresa_id, cartao_id, competencia, data_abertura, data_fechamento, data_vencimento, valor_total, status
  )
  VALUES (v_empresa_id, p_cartao_id, p_competencia, v_data_abertura, v_data_fechamento, v_data_vencimento, 0, 'aberta')
  ON CONFLICT (cartao_id, competencia) DO UPDATE
    SET data_fechamento = EXCLUDED.data_fechamento,
        data_vencimento = EXCLUDED.data_vencimento,
        data_abertura   = COALESCE(public.cartao_faturas.data_abertura, EXCLUDED.data_abertura),
        empresa_id      = COALESCE(public.cartao_faturas.empresa_id, EXCLUDED.empresa_id),
        updated_at      = now()
  RETURNING id INTO v_fatura_id;

  IF v_fatura_id IS NULL THEN
    SELECT id INTO v_fatura_id FROM public.cartao_faturas
    WHERE cartao_id = p_cartao_id AND competencia = p_competencia LIMIT 1;
  END IF;

  -- Fonte 1: linhas importadas do PDF ainda NÃO transformadas em lançamento
  SELECT COALESCE(SUM(valor), 0) INTO v_total_linhas
  FROM public.cartao_fatura_lancamentos
  WHERE cartao_fatura_id = v_fatura_id
    AND lancamento_id IS NULL
    AND COALESCE(status,'pendente') <> 'ignorada';

  -- Fonte 2: lançamentos "a pagar" vinculados diretamente à fatura (evita duplicidade)
  SELECT COALESCE(SUM(valor), 0) INTO v_total_vinc
  FROM public.financeiro_lancamentos
  WHERE cartao_fatura_id = v_fatura_id
    AND tipo = 'pagar'
    AND ativo = true
    AND origem_tipo <> 'cartao_fatura';

  v_total := COALESCE(v_total_linhas,0) + COALESCE(v_total_vinc,0);

  UPDATE public.cartao_faturas
  SET valor_total = v_total,
      status = CASE
                 WHEN status = 'paga' THEN 'paga'
                 WHEN v_total > 0 THEN 'fechada'
                 ELSE status
               END,
      updated_at = now()
  WHERE id = v_fatura_id;

  -- Materializa lançamento consolidado (idempotente)
  SELECT id INTO v_lanc_fatura_id
  FROM public.financeiro_lancamentos
  WHERE cartao_fatura_id = v_fatura_id
    AND origem_tipo = 'cartao_fatura'
    AND ativo = true
  LIMIT 1;

  IF v_total > 0 AND v_empresa_id IS NOT NULL THEN
    IF v_lanc_fatura_id IS NULL THEN
      INSERT INTO public.financeiro_lancamentos (
        tipo, descricao, valor, data_vencimento, status,
        cartao_id, cartao_fatura_id, origem_tipo, ativo, empresa_id, titulo
      ) VALUES (
        'pagar',
        'Fatura cartão ' || v_cartao.nome || ' - ' || p_competencia,
        v_total, v_data_vencimento, 'aberto',
        p_cartao_id, v_fatura_id, 'cartao_fatura', true, v_empresa_id,
        'Fatura ' || p_competencia
      );
    ELSE
      UPDATE public.financeiro_lancamentos
      SET valor = v_total,
          data_vencimento = v_data_vencimento,
          updated_at = now()
      WHERE id = v_lanc_fatura_id
        AND status = 'aberto';
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_qtd_itens FROM public.cartao_fatura_lancamentos
   WHERE cartao_fatura_id = v_fatura_id;

  RETURN jsonb_build_object(
    'ok', true,
    'fatura_id', v_fatura_id,
    'valor_total', v_total,
    'total_linhas_importadas', v_total_linhas,
    'total_lancamentos_vinculados', v_total_vinc,
    'itens', v_qtd_itens,
    'data_fechamento', v_data_fechamento,
    'data_vencimento', v_data_vencimento
  );
END;
$function$;

-- 2) Ao importar fatura via PDF, fecha automaticamente
CREATE OR REPLACE FUNCTION public.cartao_importar_fatura(
  p_empresa_id uuid,
  p_cartao_id uuid,
  p_competencia text,
  p_data_vencimento date,
  p_data_fechamento date,
  p_valor_total numeric,
  p_origem text,
  p_linhas jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fatura_id uuid;
  v_inseridas int := 0;
  v_duplicadas int := 0;
  v_linha jsonb;
  v_hash text;
  v_fechamento jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro')) THEN
    RAISE EXCEPTION 'permissao_negada';
  END IF;

  IF p_competencia IS NULL OR p_competencia !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'competencia_invalida';
  END IF;
  IF p_data_vencimento IS NULL THEN
    RAISE EXCEPTION 'data_vencimento_invalida';
  END IF;
  IF jsonb_typeof(p_linhas) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'linhas_invalidas';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.cartoes_credito
    WHERE id = p_cartao_id AND empresa_id = p_empresa_id
  ) THEN
    RAISE EXCEPTION 'cartao_nao_encontrado';
  END IF;

  INSERT INTO public.cartao_faturas (
    empresa_id, cartao_id, competencia, data_fechamento, data_vencimento,
    valor_total, status, origem
  ) VALUES (
    p_empresa_id, p_cartao_id, p_competencia, COALESCE(p_data_fechamento, p_data_vencimento), p_data_vencimento,
    COALESCE(p_valor_total, 0), 'aberta', COALESCE(p_origem, 'pdf_generico')
  )
  ON CONFLICT (cartao_id, competencia) DO UPDATE
    SET data_vencimento = EXCLUDED.data_vencimento,
        data_fechamento = EXCLUDED.data_fechamento,
        valor_total = EXCLUDED.valor_total,
        origem = EXCLUDED.origem,
        updated_at = now()
  RETURNING id INTO v_fatura_id;

  FOR v_linha IN SELECT * FROM jsonb_array_elements(p_linhas)
  LOOP
    IF COALESCE(v_linha->>'data_compra', '') = ''
       OR COALESCE(v_linha->>'descricao', '') = ''
       OR COALESCE(v_linha->>'valor', '') = '' THEN
      RAISE EXCEPTION 'linha_invalida';
    END IF;

    v_hash := encode(
      extensions.digest(
        coalesce(v_linha->>'data_compra','') || '|' ||
        coalesce(v_linha->>'valor','') || '|' ||
        coalesce(v_linha->>'descricao','') || '|' ||
        coalesce(v_linha->>'parcela_atual','') || '/' || coalesce(v_linha->>'parcela_total',''),
        'sha256'
      ),
      'hex'
    );

    BEGIN
      INSERT INTO public.cartao_fatura_lancamentos (
        empresa_id, cartao_fatura_id, data_compra, descricao, estabelecimento,
        valor, parcela_atual, parcela_total, hash, status
      ) VALUES (
        p_empresa_id, v_fatura_id,
        (v_linha->>'data_compra')::date,
        v_linha->>'descricao',
        v_linha->>'estabelecimento',
        (v_linha->>'valor')::numeric,
        NULLIF(v_linha->>'parcela_atual','')::int,
        NULLIF(v_linha->>'parcela_total','')::int,
        v_hash,
        'pendente'
      );
      v_inseridas := v_inseridas + 1;
    EXCEPTION WHEN unique_violation THEN
      v_duplicadas := v_duplicadas + 1;
    END;
  END LOOP;

  -- Fecha a fatura automaticamente ao final da importação
  BEGIN
    v_fechamento := public.gerar_fatura_cartao(p_cartao_id, p_competencia);
  EXCEPTION WHEN OTHERS THEN
    v_fechamento := jsonb_build_object('ok', false, 'erro', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'fatura_id', v_fatura_id,
    'inseridas', v_inseridas,
    'duplicadas', v_duplicadas,
    'fechamento', v_fechamento
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cartao_importar_fatura(uuid,uuid,text,date,date,numeric,text,jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.cartao_importar_fatura(uuid,uuid,text,date,date,numeric,text,jsonb) TO authenticated;
