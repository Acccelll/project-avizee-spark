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
  v_removidas int := 0;
  v_linha jsonb;
  v_hash text;
  v_lanc_fatura_id uuid;
  v_cartao_nome text;
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

  SELECT nome INTO v_cartao_nome
  FROM public.cartoes_credito
  WHERE id = p_cartao_id AND empresa_id = p_empresa_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cartao_nao_encontrado';
  END IF;

  -- Upsert da fatura preservando o total oficial vindo do PDF
  INSERT INTO public.cartao_faturas (
    empresa_id, cartao_id, competencia, data_fechamento, data_vencimento,
    valor_total, status, origem
  ) VALUES (
    p_empresa_id, p_cartao_id, p_competencia,
    COALESCE(p_data_fechamento, p_data_vencimento), p_data_vencimento,
    COALESCE(p_valor_total, 0),
    CASE WHEN COALESCE(p_valor_total,0) > 0 THEN 'fechada' ELSE 'aberta' END,
    COALESCE(p_origem, 'pdf_generico')
  )
  ON CONFLICT (cartao_id, competencia) DO UPDATE
    SET data_vencimento = EXCLUDED.data_vencimento,
        data_fechamento = EXCLUDED.data_fechamento,
        valor_total     = EXCLUDED.valor_total,
        origem          = EXCLUDED.origem,
        status          = CASE
                            WHEN public.cartao_faturas.status = 'paga' THEN 'paga'
                            WHEN EXCLUDED.valor_total > 0 THEN 'fechada'
                            ELSE public.cartao_faturas.status
                          END,
        updated_at      = now()
  RETURNING id INTO v_fatura_id;

  -- Limpa linhas pendentes anteriores (ainda não conciliadas) para permitir reimportação idempotente
  DELETE FROM public.cartao_fatura_lancamentos
   WHERE cartao_fatura_id = v_fatura_id
     AND lancamento_id IS NULL
     AND COALESCE(status, 'pendente') IN ('pendente', 'ignorada', 'ignorado');
  GET DIAGNOSTICS v_removidas = ROW_COUNT;

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

  -- Materializa/atualiza o lançamento financeiro consolidado com o total OFICIAL do PDF
  IF COALESCE(p_valor_total, 0) > 0 THEN
    SELECT id INTO v_lanc_fatura_id
    FROM public.financeiro_lancamentos
    WHERE cartao_fatura_id = v_fatura_id
      AND origem_tipo = 'cartao_fatura'
      AND ativo = true
    LIMIT 1;

    IF v_lanc_fatura_id IS NULL THEN
      INSERT INTO public.financeiro_lancamentos (
        tipo, descricao, valor, data_vencimento, status,
        cartao_id, cartao_fatura_id, origem_tipo, ativo, empresa_id, titulo
      ) VALUES (
        'pagar',
        'Fatura cartão ' || COALESCE(v_cartao_nome, '') || ' - ' || p_competencia,
        p_valor_total, p_data_vencimento, 'aberto',
        p_cartao_id, v_fatura_id, 'cartao_fatura', true, p_empresa_id,
        'Fatura ' || p_competencia
      );
    ELSE
      UPDATE public.financeiro_lancamentos
         SET valor = p_valor_total,
             data_vencimento = p_data_vencimento,
             updated_at = now()
       WHERE id = v_lanc_fatura_id
         AND status = 'aberto';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'fatura_id', v_fatura_id,
    'inseridas', v_inseridas,
    'duplicadas', v_duplicadas,
    'removidas', v_removidas,
    'valor_total', p_valor_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cartao_importar_fatura(uuid,uuid,text,date,date,numeric,text,jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.cartao_importar_fatura(uuid,uuid,text,date,date,numeric,text,jsonb) TO authenticated;