CREATE OR REPLACE FUNCTION public.confirmar_cte(p_nota_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_nf          public.notas_fiscais;
  v_lanc_id     uuid;
  v_chave       text;
  v_total_nfes  numeric(15,2);
  v_valor_nfe   numeric(15,2);
  v_rateio      numeric(15,2);
  v_data_venc   date;
BEGIN
  SELECT *
    INTO v_nf
    FROM public.notas_fiscais
   WHERE id = p_nota_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nota % nao encontrada', p_nota_id;
  END IF;

  IF v_nf.tipo_documento <> 'cte' THEN
    RAISE EXCEPTION 'Nota % nao e CT-e', p_nota_id;
  END IF;

  -- Idempotencia: uma confirmacao repetida nao pode duplicar financeiro nem rateio de frete.
  IF v_nf.status = 'confirmada' THEN
    SELECT fl.id
      INTO v_lanc_id
      FROM public.financeiro_lancamentos fl
     WHERE fl.nota_fiscal_id = p_nota_id
       AND fl.ativo = true
     ORDER BY fl.created_at DESC
     LIMIT 1;
    RETURN v_lanc_id;
  END IF;

  PERFORM set_config('app.nf_internal_op', '1', true);

  v_data_venc := COALESCE(
    v_nf.data_vencimento,
    COALESCE(v_nf.data_emissao, CURRENT_DATE) + COALESCE(v_nf.intervalo_parcelas_dias, 30)
  );

  IF COALESCE(v_nf.gera_financeiro, true)
     AND COALESCE(v_nf.cte_valor_receber, 0) > 0 THEN

    SELECT fl.id
      INTO v_lanc_id
      FROM public.financeiro_lancamentos fl
     WHERE fl.nota_fiscal_id = p_nota_id
       AND fl.ativo = true
     ORDER BY fl.created_at DESC
     LIMIT 1;

    IF v_lanc_id IS NULL THEN
      INSERT INTO public.financeiro_lancamentos (
        tipo,
        descricao,
        valor,
        valor_pago,
        saldo_restante,
        data_emissao,
        data_vencimento,
        status,
        forma_pagamento,
        fornecedor_id,
        nota_fiscal_id,
        origem_tipo,
        origem_tabela,
        origem_id,
        origem_descricao,
        empresa_id,
        ativo
      ) VALUES (
        'pagar',
        'CT-e ' || COALESCE(v_nf.numero, 's/n') || ' - '
          || COALESCE(v_nf.cte_remetente_razao_social, '?')
          || ' -> ' || COALESCE(v_nf.cte_destinatario_razao_social, '?'),
        v_nf.cte_valor_receber,
        0,
        v_nf.cte_valor_receber,
        COALESCE(v_nf.data_emissao, CURRENT_DATE),
        v_data_venc,
        'aberto',
        COALESCE(v_nf.forma_pagamento, 'boleto_dda'),
        v_nf.fornecedor_id,
        v_nf.id,
        'fiscal_nota',
        'notas_fiscais',
        v_nf.id,
        'CT-e ' || COALESCE(v_nf.numero, 's/n'),
        v_nf.empresa_id,
        true
      )
      RETURNING id INTO v_lanc_id;
    END IF;
  END IF;

  -- Rateio do valor da prestacao entre NF-e referenciadas, proporcional ao valor_total.
  IF v_nf.cte_chave_nfe_ref IS NOT NULL
     AND array_length(v_nf.cte_chave_nfe_ref, 1) > 0
     AND COALESCE(v_nf.cte_valor_prestacao, 0) > 0 THEN

    SELECT COALESCE(SUM(valor_total), 0)
      INTO v_total_nfes
      FROM public.notas_fiscais
     WHERE chave_acesso = ANY(v_nf.cte_chave_nfe_ref);

    IF v_total_nfes > 0 THEN
      FOREACH v_chave IN ARRAY v_nf.cte_chave_nfe_ref LOOP
        SELECT valor_total
          INTO v_valor_nfe
          FROM public.notas_fiscais
         WHERE chave_acesso = v_chave
         LIMIT 1;

        IF FOUND AND v_valor_nfe > 0 THEN
          v_rateio := ROUND(v_nf.cte_valor_prestacao * (v_valor_nfe / v_total_nfes), 2);
          UPDATE public.notas_fiscais
             SET frete_valor = COALESCE(frete_valor, 0) + v_rateio,
                 updated_at = now()
           WHERE chave_acesso = v_chave;
        END IF;
      END LOOP;
    END IF;
  END IF;

  UPDATE public.notas_fiscais
     SET status = 'confirmada',
         confirmada_em = COALESCE(confirmada_em, now()),
         updated_at = now()
   WHERE id = p_nota_id;

  PERFORM set_config('app.nf_internal_op', '', true);

  RETURN v_lanc_id;
END;
$function$;
