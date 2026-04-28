-- ============================================================================
-- RPC: salvar_nota_fiscal
-- Salva (insert ou update) cabeçalho de NF + substitui todos os itens
-- em uma única transação. Substitui os 3 round-trips de
-- src/services/fiscal.service.ts::upsertNotaFiscalComItens.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.salvar_nota_fiscal(
  p_nf_id uuid,
  p_payload jsonb,
  p_itens jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nf_id uuid;
  v_item jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF p_nf_id IS NULL THEN
    -- INSERT
    INSERT INTO public.notas_fiscais (
      tipo, numero, serie, chave_acesso, data_emissao,
      fornecedor_id, cliente_id, ordem_venda_id, conta_contabil_id,
      modelo_documento, tipo_operacao, nf_referenciada_id,
      valor_total, frete_valor, icms_valor, ipi_valor, pis_valor,
      cofins_valor, icms_st_valor, desconto_valor, outras_despesas,
      status, forma_pagamento, condicao_pagamento,
      movimenta_estoque, gera_financeiro, observacoes,
      natureza_operacao, finalidade_nfe, ambiente_emissao
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
      p_payload->>'forma_pagamento',
      COALESCE(p_payload->>'condicao_pagamento', 'a_vista'),
      COALESCE((p_payload->>'movimenta_estoque')::boolean, true),
      COALESCE((p_payload->>'gera_financeiro')::boolean, true),
      p_payload->>'observacoes',
      p_payload->>'natureza_operacao',
      COALESCE(p_payload->>'finalidade_nfe', 'normal'),
      COALESCE(p_payload->>'ambiente_emissao', 'homologacao')
    RETURNING id INTO v_nf_id;
  ELSE
    -- UPDATE: usa jsonb_populate_record para atualizar dinamicamente
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
      forma_pagamento = COALESCE(p_payload->>'forma_pagamento', forma_pagamento),
      condicao_pagamento = COALESCE(p_payload->>'condicao_pagamento', condicao_pagamento),
      movimenta_estoque = COALESCE((p_payload->>'movimenta_estoque')::boolean, movimenta_estoque),
      gera_financeiro = COALESCE((p_payload->>'gera_financeiro')::boolean, gera_financeiro),
      observacoes = p_payload->>'observacoes',
      natureza_operacao = COALESCE(p_payload->>'natureza_operacao', natureza_operacao),
      finalidade_nfe = COALESCE(p_payload->>'finalidade_nfe', finalidade_nfe),
      ambiente_emissao = COALESCE(p_payload->>'ambiente_emissao', ambiente_emissao),
      updated_at = now()
    WHERE id = p_nf_id;
    v_nf_id := p_nf_id;
  END IF;

  -- Substitui itens
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

  RETURN v_nf_id;
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_nota_fiscal(uuid, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_nota_fiscal(uuid, jsonb, jsonb) TO authenticated;

COMMENT ON FUNCTION public.salvar_nota_fiscal(uuid, jsonb, jsonb) IS
  'Insert/update atômico de notas_fiscais + substituição de itens. Substitui upsertNotaFiscalComItens em fiscal.service.ts.';

-- ============================================================================
-- RPC: duplicar_orcamento
-- Duplica orçamento (cabeçalho + itens) como rascunho, com numeração atômica.
-- Substitui as 4 operações de src/services/orcamentos.service.ts::duplicateOrcamento.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.duplicar_orcamento(p_orcamento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id uuid;
  v_new_numero text;
  v_orig public.orcamentos%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_orig FROM public.orcamentos WHERE id = p_orcamento_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento % não encontrado', p_orcamento_id;
  END IF;

  -- Numeração: tenta a RPC existente, com fallback baseado em timestamp
  BEGIN
    v_new_numero := public.proximo_numero_orcamento();
  EXCEPTION WHEN OTHERS THEN
    v_new_numero := 'ORC' || LPAD(EXTRACT(EPOCH FROM clock_timestamp())::bigint::text, 6, '0');
  END;

  IF v_new_numero IS NULL THEN
    v_new_numero := 'ORC' || LPAD(EXTRACT(EPOCH FROM clock_timestamp())::bigint::text, 6, '0');
  END IF;

  -- Copia cabeçalho (zera campos que devem ser fresh)
  INSERT INTO public.orcamentos (
    numero, cliente_id, data_orcamento, validade,
    valor_total, quantidade_total, peso_total,
    status, pagamento, prazo_pagamento, prazo_entrega,
    modalidade, frete_tipo, frete_valor,
    observacoes, observacoes_internas, cliente_snapshot,
    vendedor_id, desconto, imposto_st, imposto_ipi, outras_despesas,
    transportadora_id, origem_frete, servico_frete,
    prazo_entrega_dias, volumes,
    altura_cm, largura_cm, comprimento_cm,
    frete_simulacao_id, origem
  ) VALUES (
    v_new_numero, v_orig.cliente_id, CURRENT_DATE, NULL,
    v_orig.valor_total, v_orig.quantidade_total, v_orig.peso_total,
    'rascunho', v_orig.pagamento, v_orig.prazo_pagamento, v_orig.prazo_entrega,
    v_orig.modalidade, v_orig.frete_tipo, COALESCE(v_orig.frete_valor, 0),
    v_orig.observacoes, v_orig.observacoes_internas, v_orig.cliente_snapshot,
    v_orig.vendedor_id, v_orig.desconto, v_orig.imposto_st, v_orig.imposto_ipi, v_orig.outras_despesas,
    v_orig.transportadora_id, v_orig.origem_frete, v_orig.servico_frete,
    v_orig.prazo_entrega_dias, v_orig.volumes,
    v_orig.altura_cm, v_orig.largura_cm, v_orig.comprimento_cm,
    v_orig.frete_simulacao_id, COALESCE(v_orig.origem, 'sistema')
  )
  RETURNING id INTO v_new_id;

  -- Copia itens
  INSERT INTO public.orcamentos_itens (
    orcamento_id, produto_id, codigo_snapshot, descricao_snapshot,
    variacao, quantidade, unidade, valor_unitario, valor_total,
    peso_unitario, peso_total, custo_unitario
  )
  SELECT
    v_new_id, produto_id, codigo_snapshot, descricao_snapshot,
    variacao, quantidade, unidade, valor_unitario, valor_total,
    peso_unitario, peso_total, custo_unitario
  FROM public.orcamentos_itens
  WHERE orcamento_id = p_orcamento_id;

  RETURN jsonb_build_object('id', v_new_id, 'numero', v_new_numero);
END;
$$;

REVOKE ALL ON FUNCTION public.duplicar_orcamento(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.duplicar_orcamento(uuid) TO authenticated;

COMMENT ON FUNCTION public.duplicar_orcamento(uuid) IS
  'Duplica orçamento + itens em transação única. Substitui duplicateOrcamento em orcamentos.service.ts.';
