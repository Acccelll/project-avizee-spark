CREATE OR REPLACE FUNCTION public.salvar_nota_fiscal(p_nf_id uuid, p_payload jsonb, p_itens jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_nf_id uuid;
  v_item jsonb;
  v_origem text;
  v_tipo_doc text;
  v_chaves text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  v_origem := COALESCE(NULLIF(TRIM(p_payload->>'origem'), ''), 'manual');
  IF v_origem = 'importacao_xml' THEN
    v_origem := 'xml_importado';
  END IF;
  IF v_origem NOT IN ('manual','xml_importado','pedido','devolucao','importacao_historica','sefaz_externa') THEN
    v_origem := 'manual';
  END IF;

  v_tipo_doc := NULLIF(TRIM(p_payload->>'tipo_documento'), '');
  IF v_tipo_doc IS NOT NULL AND v_tipo_doc NOT IN ('nfe','nfce','nfse','cte','cte_os') THEN
    v_tipo_doc := NULL;
  END IF;

  IF jsonb_typeof(p_payload->'cte_chave_nfe_ref') = 'array' THEN
    SELECT array_agg(x) INTO v_chaves
    FROM jsonb_array_elements_text(p_payload->'cte_chave_nfe_ref') AS t(x)
    WHERE NULLIF(TRIM(x), '') IS NOT NULL;
  ELSE
    v_chaves := NULL;
  END IF;

  PERFORM set_config('app.nf_internal_op', '1', true);

  IF p_nf_id IS NULL THEN
    INSERT INTO public.notas_fiscais (
      tipo, numero, serie, chave_acesso, data_emissao,
      fornecedor_id, cliente_id, ordem_venda_id, conta_contabil_id,
      cartao_id, transportadora_id, data_vencimento,
      modelo_documento, tipo_documento, tipo_operacao, nf_referenciada_id,
      valor_total, valor_produtos, frete_valor, icms_valor, ipi_valor, pis_valor,
      cofins_valor, icms_st_valor, desconto_valor, outras_despesas,
      status, status_sefaz, forma_pagamento, condicao_pagamento,
      movimenta_estoque, gera_financeiro, observacoes,
      natureza_operacao, finalidade_nfe, ambiente_emissao, origem,
      nfse_codigo_servico_lc116, nfse_descricao_servico, nfse_municipio_prestacao,
      nfse_municipio_prestacao_cod, nfse_aliquota_iss, nfse_valor_iss,
      nfse_valor_servicos, nfse_valor_deducoes, nfse_valor_base_calculo_iss,
      nfse_iss_retido, nfse_optante_simples, nfse_incentivador_cultural,
      nfse_data_competencia, nfse_numero_rps, nfse_serie_rps, nfse_natureza_operacao,
      cte_tipo, cte_modal, cte_cfop, cte_natureza_operacao,
      cte_municipio_inicio, cte_municipio_inicio_uf, cte_municipio_inicio_cod,
      cte_municipio_fim, cte_municipio_fim_uf, cte_municipio_fim_cod,
      cte_tomador_tipo,
      cte_remetente_doc, cte_remetente_razao_social, cte_remetente_uf,
      cte_destinatario_doc, cte_destinatario_razao_social, cte_destinatario_uf,
      cte_expedidor_doc, cte_expedidor_razao_social,
      cte_recebedor_doc, cte_recebedor_razao_social,
      cte_produto_predominante, cte_quantidade, cte_unidade_medida,
      cte_valor_prestacao, cte_valor_receber, cte_chave_nfe_ref, cte_dados_extras
    )
    SELECT
      COALESCE(p_payload->>'tipo', 'entrada'),
      p_payload->>'numero',
      COALESCE(p_payload->>'serie', '1'),
      p_payload->>'chave_acesso',
      COALESCE((NULLIF(p_payload->>'data_emissao',''))::date, CURRENT_DATE),
      NULLIF(p_payload->>'fornecedor_id','')::uuid,
      NULLIF(p_payload->>'cliente_id','')::uuid,
      NULLIF(p_payload->>'ordem_venda_id','')::uuid,
      NULLIF(p_payload->>'conta_contabil_id','')::uuid,
      NULLIF(p_payload->>'cartao_id','')::uuid,
      NULLIF(p_payload->>'transportadora_id','')::uuid,
      NULLIF(p_payload->>'data_vencimento','')::date,
      COALESCE(p_payload->>'modelo_documento', '55'),
      COALESCE(v_tipo_doc, 'nfe'),
      p_payload->>'tipo_operacao',
      NULLIF(p_payload->>'nf_referenciada_id','')::uuid,
      COALESCE((NULLIF(p_payload->>'valor_total',''))::numeric, 0),
      COALESCE((NULLIF(p_payload->>'valor_produtos',''))::numeric, 0),
      COALESCE((NULLIF(p_payload->>'frete_valor',''))::numeric, 0),
      COALESCE((NULLIF(p_payload->>'icms_valor',''))::numeric, 0),
      COALESCE((NULLIF(p_payload->>'ipi_valor',''))::numeric, 0),
      COALESCE((NULLIF(p_payload->>'pis_valor',''))::numeric, 0),
      COALESCE((NULLIF(p_payload->>'cofins_valor',''))::numeric, 0),
      COALESCE((NULLIF(p_payload->>'icms_st_valor',''))::numeric, 0),
      COALESCE((NULLIF(p_payload->>'desconto_valor',''))::numeric, 0),
      COALESCE((NULLIF(p_payload->>'outras_despesas',''))::numeric, 0),
      COALESCE(p_payload->>'status', 'pendente'),
      COALESCE(p_payload->>'status_sefaz', 'nao_enviada'),
      p_payload->>'forma_pagamento',
      COALESCE(p_payload->>'condicao_pagamento', 'a_vista'),
      COALESCE((p_payload->>'movimenta_estoque')::boolean, true),
      COALESCE((p_payload->>'gera_financeiro')::boolean, true),
      p_payload->>'observacoes',
      p_payload->>'natureza_operacao',
      COALESCE(p_payload->>'finalidade_nfe', 'normal'),
      COALESCE(p_payload->>'ambiente_emissao', 'homologacao'),
      v_origem,
      p_payload->>'nfse_codigo_servico_lc116',
      p_payload->>'nfse_descricao_servico',
      p_payload->>'nfse_municipio_prestacao',
      p_payload->>'nfse_municipio_prestacao_cod',
      (NULLIF(p_payload->>'nfse_aliquota_iss',''))::numeric,
      (NULLIF(p_payload->>'nfse_valor_iss',''))::numeric,
      (NULLIF(p_payload->>'nfse_valor_servicos',''))::numeric,
      (NULLIF(p_payload->>'nfse_valor_deducoes',''))::numeric,
      (NULLIF(p_payload->>'nfse_valor_base_calculo_iss',''))::numeric,
      (p_payload->>'nfse_iss_retido')::boolean,
      (p_payload->>'nfse_optante_simples')::boolean,
      (p_payload->>'nfse_incentivador_cultural')::boolean,
      (NULLIF(p_payload->>'nfse_data_competencia',''))::date,
      p_payload->>'nfse_numero_rps',
      p_payload->>'nfse_serie_rps',
      (NULLIF(p_payload->>'nfse_natureza_operacao',''))::int,
      p_payload->>'cte_tipo',
      p_payload->>'cte_modal',
      p_payload->>'cte_cfop',
      p_payload->>'cte_natureza_operacao',
      p_payload->>'cte_municipio_inicio',
      p_payload->>'cte_municipio_inicio_uf',
      p_payload->>'cte_municipio_inicio_cod',
      p_payload->>'cte_municipio_fim',
      p_payload->>'cte_municipio_fim_uf',
      p_payload->>'cte_municipio_fim_cod',
      (NULLIF(p_payload->>'cte_tomador_tipo',''))::int,
      p_payload->>'cte_remetente_doc',
      p_payload->>'cte_remetente_razao_social',
      p_payload->>'cte_remetente_uf',
      p_payload->>'cte_destinatario_doc',
      p_payload->>'cte_destinatario_razao_social',
      p_payload->>'cte_destinatario_uf',
      p_payload->>'cte_expedidor_doc',
      p_payload->>'cte_expedidor_razao_social',
      p_payload->>'cte_recebedor_doc',
      p_payload->>'cte_recebedor_razao_social',
      p_payload->>'cte_produto_predominante',
      (NULLIF(p_payload->>'cte_quantidade',''))::numeric,
      p_payload->>'cte_unidade_medida',
      (NULLIF(p_payload->>'cte_valor_prestacao',''))::numeric,
      (NULLIF(p_payload->>'cte_valor_receber',''))::numeric,
      v_chaves,
      CASE WHEN jsonb_typeof(p_payload->'cte_dados_extras') = 'object' THEN p_payload->'cte_dados_extras' ELSE NULL END
    RETURNING id INTO v_nf_id;
  ELSE
    UPDATE public.notas_fiscais SET
      tipo = COALESCE(p_payload->>'tipo', tipo),
      numero = COALESCE(p_payload->>'numero', numero),
      serie = COALESCE(p_payload->>'serie', serie),
      chave_acesso = COALESCE(p_payload->>'chave_acesso', chave_acesso),
      data_emissao = COALESCE((NULLIF(p_payload->>'data_emissao',''))::date, data_emissao),
      fornecedor_id = NULLIF(p_payload->>'fornecedor_id','')::uuid,
      cliente_id = NULLIF(p_payload->>'cliente_id','')::uuid,
      ordem_venda_id = NULLIF(p_payload->>'ordem_venda_id','')::uuid,
      conta_contabil_id = NULLIF(p_payload->>'conta_contabil_id','')::uuid,
      cartao_id = CASE WHEN p_payload ? 'cartao_id' THEN NULLIF(p_payload->>'cartao_id','')::uuid ELSE cartao_id END,
      transportadora_id = CASE WHEN p_payload ? 'transportadora_id' THEN NULLIF(p_payload->>'transportadora_id','')::uuid ELSE transportadora_id END,
      data_vencimento = CASE WHEN p_payload ? 'data_vencimento' THEN NULLIF(p_payload->>'data_vencimento','')::date ELSE data_vencimento END,
      modelo_documento = COALESCE(p_payload->>'modelo_documento', modelo_documento),
      tipo_documento = COALESCE(v_tipo_doc, tipo_documento),
      tipo_operacao = COALESCE(p_payload->>'tipo_operacao', tipo_operacao),
      nf_referenciada_id = NULLIF(p_payload->>'nf_referenciada_id','')::uuid,
      valor_total = COALESCE((NULLIF(p_payload->>'valor_total',''))::numeric, valor_total),
      valor_produtos = COALESCE((NULLIF(p_payload->>'valor_produtos',''))::numeric, valor_produtos),
      frete_valor = COALESCE((NULLIF(p_payload->>'frete_valor',''))::numeric, frete_valor),
      icms_valor = COALESCE((NULLIF(p_payload->>'icms_valor',''))::numeric, icms_valor),
      ipi_valor = COALESCE((NULLIF(p_payload->>'ipi_valor',''))::numeric, ipi_valor),
      pis_valor = COALESCE((NULLIF(p_payload->>'pis_valor',''))::numeric, pis_valor),
      cofins_valor = COALESCE((NULLIF(p_payload->>'cofins_valor',''))::numeric, cofins_valor),
      icms_st_valor = COALESCE((NULLIF(p_payload->>'icms_st_valor',''))::numeric, icms_st_valor),
      desconto_valor = COALESCE((NULLIF(p_payload->>'desconto_valor',''))::numeric, desconto_valor),
      outras_despesas = COALESCE((NULLIF(p_payload->>'outras_despesas',''))::numeric, outras_despesas),
      status = COALESCE(p_payload->>'status', status),
      status_sefaz = COALESCE(p_payload->>'status_sefaz', status_sefaz),
      forma_pagamento = COALESCE(p_payload->>'forma_pagamento', forma_pagamento),
      condicao_pagamento = COALESCE(p_payload->>'condicao_pagamento', condicao_pagamento),
      movimenta_estoque = COALESCE((p_payload->>'movimenta_estoque')::boolean, movimenta_estoque),
      gera_financeiro = COALESCE((p_payload->>'gera_financeiro')::boolean, gera_financeiro),
      observacoes = p_payload->>'observacoes',
      natureza_operacao = COALESCE(p_payload->>'natureza_operacao', natureza_operacao),
      finalidade_nfe = COALESCE(p_payload->>'finalidade_nfe', finalidade_nfe),
      ambiente_emissao = COALESCE(p_payload->>'ambiente_emissao', ambiente_emissao),
      origem = CASE WHEN p_payload ? 'origem' THEN v_origem ELSE origem END,
      nfse_codigo_servico_lc116 = CASE WHEN p_payload ? 'nfse_codigo_servico_lc116' THEN p_payload->>'nfse_codigo_servico_lc116' ELSE nfse_codigo_servico_lc116 END,
      nfse_descricao_servico = CASE WHEN p_payload ? 'nfse_descricao_servico' THEN p_payload->>'nfse_descricao_servico' ELSE nfse_descricao_servico END,
      nfse_municipio_prestacao = CASE WHEN p_payload ? 'nfse_municipio_prestacao' THEN p_payload->>'nfse_municipio_prestacao' ELSE nfse_municipio_prestacao END,
      nfse_municipio_prestacao_cod = CASE WHEN p_payload ? 'nfse_municipio_prestacao_cod' THEN p_payload->>'nfse_municipio_prestacao_cod' ELSE nfse_municipio_prestacao_cod END,
      nfse_aliquota_iss = CASE WHEN p_payload ? 'nfse_aliquota_iss' THEN (NULLIF(p_payload->>'nfse_aliquota_iss',''))::numeric ELSE nfse_aliquota_iss END,
      nfse_valor_iss = CASE WHEN p_payload ? 'nfse_valor_iss' THEN (NULLIF(p_payload->>'nfse_valor_iss',''))::numeric ELSE nfse_valor_iss END,
      nfse_valor_servicos = CASE WHEN p_payload ? 'nfse_valor_servicos' THEN (NULLIF(p_payload->>'nfse_valor_servicos',''))::numeric ELSE nfse_valor_servicos END,
      nfse_valor_deducoes = CASE WHEN p_payload ? 'nfse_valor_deducoes' THEN (NULLIF(p_payload->>'nfse_valor_deducoes',''))::numeric ELSE nfse_valor_deducoes END,
      nfse_valor_base_calculo_iss = CASE WHEN p_payload ? 'nfse_valor_base_calculo_iss' THEN (NULLIF(p_payload->>'nfse_valor_base_calculo_iss',''))::numeric ELSE nfse_valor_base_calculo_iss END,
      nfse_iss_retido = CASE WHEN p_payload ? 'nfse_iss_retido' THEN (p_payload->>'nfse_iss_retido')::boolean ELSE nfse_iss_retido END,
      nfse_optante_simples = CASE WHEN p_payload ? 'nfse_optante_simples' THEN (p_payload->>'nfse_optante_simples')::boolean ELSE nfse_optante_simples END,
      nfse_incentivador_cultural = CASE WHEN p_payload ? 'nfse_incentivador_cultural' THEN (p_payload->>'nfse_incentivador_cultural')::boolean ELSE nfse_incentivador_cultural END,
      nfse_data_competencia = CASE WHEN p_payload ? 'nfse_data_competencia' THEN (NULLIF(p_payload->>'nfse_data_competencia',''))::date ELSE nfse_data_competencia END,
      nfse_numero_rps = CASE WHEN p_payload ? 'nfse_numero_rps' THEN p_payload->>'nfse_numero_rps' ELSE nfse_numero_rps END,
      nfse_serie_rps = CASE WHEN p_payload ? 'nfse_serie_rps' THEN p_payload->>'nfse_serie_rps' ELSE nfse_serie_rps END,
      nfse_natureza_operacao = CASE WHEN p_payload ? 'nfse_natureza_operacao' THEN (NULLIF(p_payload->>'nfse_natureza_operacao',''))::int ELSE nfse_natureza_operacao END,
      cte_tipo = CASE WHEN p_payload ? 'cte_tipo' THEN p_payload->>'cte_tipo' ELSE cte_tipo END,
      cte_modal = CASE WHEN p_payload ? 'cte_modal' THEN p_payload->>'cte_modal' ELSE cte_modal END,
      cte_cfop = CASE WHEN p_payload ? 'cte_cfop' THEN p_payload->>'cte_cfop' ELSE cte_cfop END,
      cte_natureza_operacao = CASE WHEN p_payload ? 'cte_natureza_operacao' THEN p_payload->>'cte_natureza_operacao' ELSE cte_natureza_operacao END,
      cte_municipio_inicio = CASE WHEN p_payload ? 'cte_municipio_inicio' THEN p_payload->>'cte_municipio_inicio' ELSE cte_municipio_inicio END,
      cte_municipio_inicio_uf = CASE WHEN p_payload ? 'cte_municipio_inicio_uf' THEN p_payload->>'cte_municipio_inicio_uf' ELSE cte_municipio_inicio_uf END,
      cte_municipio_inicio_cod = CASE WHEN p_payload ? 'cte_municipio_inicio_cod' THEN p_payload->>'cte_municipio_inicio_cod' ELSE cte_municipio_inicio_cod END,
      cte_municipio_fim = CASE WHEN p_payload ? 'cte_municipio_fim' THEN p_payload->>'cte_municipio_fim' ELSE cte_municipio_fim END,
      cte_municipio_fim_uf = CASE WHEN p_payload ? 'cte_municipio_fim_uf' THEN p_payload->>'cte_municipio_fim_uf' ELSE cte_municipio_fim_uf END,
      cte_municipio_fim_cod = CASE WHEN p_payload ? 'cte_municipio_fim_cod' THEN p_payload->>'cte_municipio_fim_cod' ELSE cte_municipio_fim_cod END,
      cte_tomador_tipo = CASE WHEN p_payload ? 'cte_tomador_tipo' THEN (NULLIF(p_payload->>'cte_tomador_tipo',''))::int ELSE cte_tomador_tipo END,
      cte_remetente_doc = CASE WHEN p_payload ? 'cte_remetente_doc' THEN p_payload->>'cte_remetente_doc' ELSE cte_remetente_doc END,
      cte_remetente_razao_social = CASE WHEN p_payload ? 'cte_remetente_razao_social' THEN p_payload->>'cte_remetente_razao_social' ELSE cte_remetente_razao_social END,
      cte_remetente_uf = CASE WHEN p_payload ? 'cte_remetente_uf' THEN p_payload->>'cte_remetente_uf' ELSE cte_remetente_uf END,
      cte_destinatario_doc = CASE WHEN p_payload ? 'cte_destinatario_doc' THEN p_payload->>'cte_destinatario_doc' ELSE cte_destinatario_doc END,
      cte_destinatario_razao_social = CASE WHEN p_payload ? 'cte_destinatario_razao_social' THEN p_payload->>'cte_destinatario_razao_social' ELSE cte_destinatario_razao_social END,
      cte_destinatario_uf = CASE WHEN p_payload ? 'cte_destinatario_uf' THEN p_payload->>'cte_destinatario_uf' ELSE cte_destinatario_uf END,
      cte_expedidor_doc = CASE WHEN p_payload ? 'cte_expedidor_doc' THEN p_payload->>'cte_expedidor_doc' ELSE cte_expedidor_doc END,
      cte_expedidor_razao_social = CASE WHEN p_payload ? 'cte_expedidor_razao_social' THEN p_payload->>'cte_expedidor_razao_social' ELSE cte_expedidor_razao_social END,
      cte_recebedor_doc = CASE WHEN p_payload ? 'cte_recebedor_doc' THEN p_payload->>'cte_recebedor_doc' ELSE cte_recebedor_doc END,
      cte_recebedor_razao_social = CASE WHEN p_payload ? 'cte_recebedor_razao_social' THEN p_payload->>'cte_recebedor_razao_social' ELSE cte_recebedor_razao_social END,
      cte_produto_predominante = CASE WHEN p_payload ? 'cte_produto_predominante' THEN p_payload->>'cte_produto_predominante' ELSE cte_produto_predominante END,
      cte_quantidade = CASE WHEN p_payload ? 'cte_quantidade' THEN (NULLIF(p_payload->>'cte_quantidade',''))::numeric ELSE cte_quantidade END,
      cte_unidade_medida = CASE WHEN p_payload ? 'cte_unidade_medida' THEN p_payload->>'cte_unidade_medida' ELSE cte_unidade_medida END,
      cte_valor_prestacao = CASE WHEN p_payload ? 'cte_valor_prestacao' THEN (NULLIF(p_payload->>'cte_valor_prestacao',''))::numeric ELSE cte_valor_prestacao END,
      cte_valor_receber = CASE WHEN p_payload ? 'cte_valor_receber' THEN (NULLIF(p_payload->>'cte_valor_receber',''))::numeric ELSE cte_valor_receber END,
      cte_chave_nfe_ref = CASE WHEN p_payload ? 'cte_chave_nfe_ref' THEN v_chaves ELSE cte_chave_nfe_ref END,
      cte_dados_extras = CASE WHEN jsonb_typeof(p_payload->'cte_dados_extras') = 'object' THEN p_payload->'cte_dados_extras' ELSE cte_dados_extras END,
      updated_at = now()
    WHERE id = p_nf_id;
    v_nf_id := p_nf_id;
  END IF;

  DELETE FROM public.notas_fiscais_itens WHERE nota_fiscal_id = v_nf_id;

  IF p_itens IS NOT NULL AND jsonb_typeof(p_itens) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
      INSERT INTO public.notas_fiscais_itens (
        nota_fiscal_id, produto_id, categoria, cfop, ncm, cst, descricao,
        quantidade, unidade, valor_unitario, valor_total,
        icms_base, icms_aliquota, icms_valor,
        ipi_aliquota, ipi_valor,
        pis_aliquota, pis_valor,
        cofins_aliquota, cofins_valor,
        codigo_produto, cest, origem_mercadoria, csosn, cst_pis, cst_cofins
      ) VALUES (
        v_nf_id,
        NULLIF(v_item->>'produto_id','')::uuid,
        CASE WHEN v_item->>'categoria' IN ('produto','insumo','servico','frete') THEN v_item->>'categoria' ELSE 'produto' END,
        v_item->>'cfop', v_item->>'ncm', v_item->>'cst', v_item->>'descricao',
        COALESCE((v_item->>'quantidade')::numeric, 1),
        COALESCE(v_item->>'unidade', 'UN'),
        COALESCE((v_item->>'valor_unitario')::numeric, 0),
        COALESCE((v_item->>'valor_total')::numeric, 0),
        COALESCE((v_item->>'icms_base')::numeric, 0),
        COALESCE((v_item->>'icms_aliquota')::numeric, 0),
        COALESCE((v_item->>'icms_valor')::numeric, 0),
        COALESCE((v_item->>'ipi_aliquota')::numeric, 0),
        COALESCE((v_item->>'ipi_valor')::numeric, 0),
        COALESCE((v_item->>'pis_aliquota')::numeric, 0),
        COALESCE((v_item->>'pis_valor')::numeric, 0),
        COALESCE((v_item->>'cofins_aliquota')::numeric, 0),
        COALESCE((v_item->>'cofins_valor')::numeric, 0),
        v_item->>'codigo_produto',
        v_item->>'cest',
        COALESCE(v_item->>'origem_mercadoria', '0'),
        v_item->>'csosn',
        v_item->>'cst_pis',
        v_item->>'cst_cofins'
      );
    END LOOP;
  END IF;

  PERFORM set_config('app.nf_internal_op', '', true);

  RETURN v_nf_id;
END;
$function$;

UPDATE public.notas_fiscais
   SET tipo_documento = 'cte'
 WHERE modelo_documento = '57' AND tipo_documento <> 'cte';