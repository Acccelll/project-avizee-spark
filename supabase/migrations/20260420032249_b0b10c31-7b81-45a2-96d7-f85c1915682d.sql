CREATE OR REPLACE FUNCTION public.limpar_dados_migracao(p_confirmar boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_apagados jsonb := '{}'::jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('erro', 'acesso_negado');
  END IF;

  IF NOT p_confirmar THEN
    RETURN jsonb_build_object('erro', 'confirmacao_obrigatoria');
  END IF;

  v_apagados := jsonb_build_object(
    'importacao_lotes', (SELECT count(*) FROM public.importacao_lotes),
    'importacao_logs', (SELECT count(*) FROM public.importacao_logs),
    'stg_compras_xml', (SELECT count(*) FROM public.stg_compras_xml),
    'stg_estoque_inicial', (SELECT count(*) FROM public.stg_estoque_inicial),
    'stg_faturamento', (SELECT count(*) FROM public.stg_faturamento),
    'stg_financeiro_aberto', (SELECT count(*) FROM public.stg_financeiro_aberto),
    'orcamentos', (SELECT count(*) FROM public.orcamentos),
    'ordens_venda', (SELECT count(*) FROM public.ordens_venda),
    'remessas', (SELECT count(*) FROM public.remessas),
    'notas_fiscais', (SELECT count(*) FROM public.notas_fiscais),
    'cotacoes_compra', (SELECT count(*) FROM public.cotacoes_compra),
    'pedidos_compra', (SELECT count(*) FROM public.pedidos_compra),
    'compras', (SELECT count(*) FROM public.compras),
    'financeiro_lancamentos', (SELECT count(*) FROM public.financeiro_lancamentos),
    'financeiro_baixas', (SELECT count(*) FROM public.financeiro_baixas),
    'caixa_movimentos', (SELECT count(*) FROM public.caixa_movimentos),
    'conciliacao_bancaria', (SELECT count(*) FROM public.conciliacao_bancaria),
    'conciliacao_pares', (SELECT count(*) FROM public.conciliacao_pares),
    'estoque_movimentos', (SELECT count(*) FROM public.estoque_movimentos),
    'clientes', (SELECT count(*) FROM public.clientes),
    'fornecedores', (SELECT count(*) FROM public.fornecedores),
    'produtos', (SELECT count(*) FROM public.produtos),
    'grupos_produto', (SELECT count(*) FROM public.grupos_produto),
    'contas_contabeis', (SELECT count(*) FROM public.contas_contabeis)
  );

  BEGIN
    TRUNCATE TABLE
      public.importacao_logs,
      public.stg_compras_xml,
      public.stg_estoque_inicial,
      public.stg_faturamento,
      public.stg_financeiro_aberto,
      public.importacao_lotes,
      public.conciliacao_pares,
      public.conciliacao_bancaria,
      public.financeiro_baixas,
      public.caixa_movimentos,
      public.financeiro_lancamentos,
      public.fechamento_caixa_saldos,
      public.fechamento_financeiro_saldos,
      public.fechamento_estoque_saldos,
      public.fechamento_fopag_resumo,
      public.folha_pagamento,
      public.fechamentos_mensais,
      public.nota_fiscal_anexos,
      public.nota_fiscal_eventos,
      public.notas_fiscais_itens,
      public.notas_fiscais,
      public.remessa_itens,
      public.remessa_eventos,
      public.remessas,
      public.ordens_venda_itens,
      public.ordens_venda,
      public.orcamentos_itens,
      public.orcamentos,
      public.compras_itens,
      public.compras,
      public.pedidos_compra_itens,
      public.pedidos_compra,
      public.cotacoes_compra_propostas,
      public.cotacoes_compra_itens,
      public.cotacoes_compra,
      public.frete_simulacoes_opcoes,
      public.frete_simulacoes,
      public.estoque_movimentos,
      public.cliente_registros_comunicacao,
      public.cliente_transportadoras,
      public.clientes_enderecos_entrega,
      public.precos_especiais,
      public.produtos_fornecedores,
      public.produto_composicoes,
      public.clientes,
      public.fornecedores,
      public.produtos,
      public.grupos_produto,
      public.contas_contabeis
    RESTART IDENTITY CASCADE;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'erro', SQLERRM,
        'codigo', SQLSTATE
      );
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'apagados', v_apagados
  );
END;
$$;