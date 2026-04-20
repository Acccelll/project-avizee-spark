CREATE OR REPLACE FUNCTION public.limpar_dados_migracao(p_confirmar boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_apagados jsonb := '{}'::jsonb;
  v_count integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('erro','acesso_negado');
  END IF;
  IF NOT p_confirmar THEN
    RETURN jsonb_build_object('erro','confirmacao_obrigatoria');
  END IF;

  -- 1) Documentos fiscais e itens
  DELETE FROM public.notas_fiscais_itens WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('notas_fiscais_itens', v_count);
  DELETE FROM public.notas_fiscais WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('notas_fiscais', v_count);

  -- 2) Vendas (orçamentos, OV, remessas)
  DELETE FROM public.orcamentos_itens WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('orcamentos_itens', v_count);
  DELETE FROM public.orcamentos WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('orcamentos', v_count);
  DELETE FROM public.ordens_venda_itens WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('ordens_venda_itens', v_count);
  DELETE FROM public.ordens_venda WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('ordens_venda', v_count);
  DELETE FROM public.remessas WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('remessas', v_count);
  DELETE FROM public.precos_especiais WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('precos_especiais', v_count);

  -- 3) Compras
  DELETE FROM public.pedidos_compra_itens WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('pedidos_compra_itens', v_count);
  DELETE FROM public.pedidos_compra WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('pedidos_compra', v_count);
  DELETE FROM public.compras_itens WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('compras_itens', v_count);
  DELETE FROM public.compras WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('compras', v_count);
  DELETE FROM public.cotacoes_compra_propostas WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('cotacoes_compra_propostas', v_count);
  DELETE FROM public.cotacoes_compra_itens WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('cotacoes_compra_itens', v_count);
  DELETE FROM public.cotacoes_compra WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('cotacoes_compra', v_count);

  -- 4) Estoque
  DELETE FROM public.estoque_movimentos WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('estoque_movimentos', v_count);
  DELETE FROM public.fechamento_estoque_saldos WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('fechamento_estoque_saldos', v_count);

  -- 5) Financeiro
  DELETE FROM public.conciliacao_pares WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('conciliacao_pares', v_count);
  DELETE FROM public.conciliacao_bancaria WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('conciliacao_bancaria', v_count);
  DELETE FROM public.financeiro_baixas WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('financeiro_baixas', v_count);
  DELETE FROM public.caixa_movimentos WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('caixa_movimentos', v_count);
  DELETE FROM public.financeiro_lancamentos WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('financeiro_lancamentos', v_count);
  DELETE FROM public.fechamento_caixa_saldos WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('fechamento_caixa_saldos', v_count);
  DELETE FROM public.fechamento_financeiro_saldos WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('fechamento_financeiro_saldos', v_count);
  DELETE FROM public.fechamento_fopag_resumo WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('fechamento_fopag_resumo', v_count);
  DELETE FROM public.folha_pagamento WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('folha_pagamento', v_count);
  DELETE FROM public.fechamentos_mensais WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('fechamentos_mensais', v_count);

  -- 6) Cadastros mestres (clientes/fornecedores e dependências CASCADE)
  DELETE FROM public.cliente_registros_comunicacao WHERE true;
  DELETE FROM public.cliente_transportadoras WHERE true;
  DELETE FROM public.clientes_enderecos_entrega WHERE true;
  DELETE FROM public.clientes WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('clientes', v_count);
  DELETE FROM public.produtos_fornecedores WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('produtos_fornecedores', v_count);
  DELETE FROM public.fornecedores WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('fornecedores', v_count);
  DELETE FROM public.produtos WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('produtos', v_count);
  DELETE FROM public.grupos_produto WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('grupos_produto', v_count);
  DELETE FROM public.contas_contabeis WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_apagados := v_apagados || jsonb_build_object('contas_contabeis', v_count);

  -- 7) Staging e logs
  DELETE FROM public.stg_financeiro_aberto WHERE true;
  DELETE FROM public.stg_estoque_inicial WHERE true;
  DELETE FROM public.stg_cadastros WHERE true;
  DELETE FROM public.importacao_logs WHERE true;
  DELETE FROM public.importacao_lotes WHERE true;

  RETURN jsonb_build_object('ok', true, 'apagados', v_apagados);
END;
$$;