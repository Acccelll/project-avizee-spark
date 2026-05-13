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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Normaliza alias legado vindo do frontend para o valor canônico aceito
  -- pela constraint chk_nf_origem.
  v_origem := COALESCE(NULLIF(TRIM(p_payload->>'origem'), ''), 'manual');
  IF v_origem = 'importacao_xml' THEN
    v_origem := 'xml_importado';
  END IF;
  IF v_origem NOT IN ('manual','xml_importado','pedido','devolucao','importacao_historica','sefaz_externa') THEN
    v_origem := 'manual';
  END IF;

  -- Esta RPC é a única operação interna oficial para criar/atualizar NF + itens
  -- de forma atômica. Sinaliza para os triggers de proteção (cabeçalho e itens)
  -- que estamos no fluxo interno, evitando que uma NF nascendo já como
  -- 'importada' (XML com protocolo) auto-bloqueie a substituição dos itens.
  PERFORM set_config('app.nf_internal_op', '1', true);

  IF p_nf_id IS NULL THEN
    INSERT INTO public.notas_fiscais (
      tipo, numero, serie, chave_acesso, data_emissao,
      fornecedor_id, cliente_id, ordem_venda_id, conta_contabil_id,
      modelo_documento, tipo_operacao, nf_referenciada_id,
      valor_total, frete_valor, icms_valor, ipi_valor, pis_valor,
      cofins_valor, icms_st_valor, desconto_valor, outras_despesas,
      status, status_sefaz, forma_pagamento, condicao_pagamento,
      movimenta_estoque, gera_financeiro, observacoes,
      natureza_operacao, finalidade_nfe, ambiente_emissao, origem
    )
    SELECT
      COALESCE(p_payload->>'tipo', 'entrada'),
      p_payload->>'numero',
      COALESCE(p_payload->>'serie', '1'),
      p_payload->>'chave_acesso',
      COALESCE((p_payload->>'data_emissao')::date, CURRENT_DATE),
      NULLIF(p_payload->>'fornecedor_id','')::uuid,
      NULLIF(p_payload->>'cliente_id','')::uuid,
      NULLIF(p_payload->>'ordem_venda_id','')::uuid,
      NULLIF(p_payload->>'conta_contabil_id','')::uuid,
      COALESCE(p_payload->>'modelo_documento', '55'),
      p_payload->>'tipo_operacao',
      NULLIF(p_payload->>'nf_referenciada_id','')::uuid,
      COALESCE((p_payload->>'valor_total')::numeric, 0),
      COALESCE((p_payload->>'frete_valor')::numeric, 0),
      COALESCE((p_payload->>'icms_valor')::numeric, 0),
      COALESCE((p_payload->>'ipi_valor')::numeric, 0),
      COALESCE((p_payload->>'pis_valor')::numeric, 0),
      COALESCE((p_payload->>'cofins_valor')::numeric, 0),
      COALESCE((p_payload->>'icms_st_valor')::numeric, 0),
      COALESCE((p_payload->>'desconto_valor')::numeric, 0),
      COALESCE((p_payload->>'outras_despesas')::numeric, 0),
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
      v_origem
    RETURNING id INTO v_nf_id;
  ELSE
    UPDATE public.notas_fiscais SET
      tipo = COALESCE(p_payload->>'tipo', tipo),
      numero = COALESCE(p_payload->>'numero', numero),
      serie = COALESCE(p_payload->>'serie', serie),
      chave_acesso = COALESCE(p_payload->>'chave_acesso', chave_acesso),
      data_emissao = COALESCE((p_payload->>'data_emissao')::date, data_emissao),
      fornecedor_id = NULLIF(p_payload->>'fornecedor_id','')::uuid,
      cliente_id = NULLIF(p_payload->>'cliente_id','')::uuid,
      ordem_venda_id = NULLIF(p_payload->>'ordem_venda_id','')::uuid,
      conta_contabil_id = NULLIF(p_payload->>'conta_contabil_id','')::uuid,
      modelo_documento = COALESCE(p_payload->>'modelo_documento', modelo_documento),
      tipo_operacao = COALESCE(p_payload->>'tipo_operacao', tipo_operacao),
      nf_referenciada_id = NULLIF(p_payload->>'nf_referenciada_id','')::uuid,
      valor_total = COALESCE((p_payload->>'valor_total')::numeric, valor_total),
      frete_valor = COALESCE((p_payload->>'frete_valor')::numeric, frete_valor),
      icms_valor = COALESCE((p_payload->>'icms_valor')::numeric, icms_valor),
      ipi_valor = COALESCE((p_payload->>'ipi_valor')::numeric, ipi_valor),
      pis_valor = COALESCE((p_payload->>'pis_valor')::numeric, pis_valor),
      cofins_valor = COALESCE((p_payload->>'cofins_valor')::numeric, cofins_valor),
      icms_st_valor = COALESCE((p_payload->>'icms_st_valor')::numeric, icms_st_valor),
      desconto_valor = COALESCE((p_payload->>'desconto_valor')::numeric, desconto_valor),
      outras_despesas = COALESCE((p_payload->>'outras_despesas')::numeric, outras_despesas),
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
      origem = CASE
        WHEN p_payload ? 'origem' THEN v_origem
        ELSE origem
      END,
      updated_at = now()
    WHERE id = p_nf_id;
    v_nf_id := p_nf_id;
  END IF;

  DELETE FROM public.notas_fiscais_itens WHERE nota_fiscal_id = v_nf_id;

  IF p_itens IS NOT NULL AND jsonb_typeof(p_itens) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
      INSERT INTO public.notas_fiscais_itens (
        nota_fiscal_id, produto_id, cfop, ncm, cst, descricao,
        quantidade, unidade, valor_unitario, valor_total,
        icms_base, icms_aliquota, icms_valor,
        ipi_aliquota, ipi_valor,
        pis_aliquota, pis_valor,
        cofins_aliquota, cofins_valor,
        codigo_produto, cest, origem_mercadoria, csosn, cst_pis, cst_cofins
      ) VALUES (
        v_nf_id,
        NULLIF(v_item->>'produto_id','')::uuid,
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

  -- Libera a flag interna ao final do fluxo. Como é local à transação,
  -- também é descartada automaticamente em caso de exceção/rollback.
  PERFORM set_config('app.nf_internal_op', '', true);

  RETURN v_nf_id;
END;
$function$;