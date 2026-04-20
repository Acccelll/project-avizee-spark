CREATE OR REPLACE FUNCTION public.limpar_dados_migracao(p_confirmar boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_is_admin boolean;
  v_lotes int; v_logs int;
  v_stg_fin int; v_stg_estoque int; v_stg_fat int; v_stg_cad int; v_stg_xml int;
  v_baixas int; v_caixa int; v_lancamentos int;
BEGIN
  IF NOT p_confirmar THEN
    RETURN jsonb_build_object('erro', 'Confirmação obrigatória (p_confirmar = true).');
  END IF;
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('erro', 'Não autenticado.');
  END IF;
  SELECT public.has_role(v_caller, 'admin'::app_role) INTO v_is_admin;
  IF NOT COALESCE(v_is_admin, false) THEN
    RETURN jsonb_build_object('erro', 'Apenas administradores podem executar esta limpeza.');
  END IF;

  DELETE FROM public.financeiro_baixas WHERE true;
  GET DIAGNOSTICS v_baixas = ROW_COUNT;
  DELETE FROM public.caixa_movimentos WHERE true;
  GET DIAGNOSTICS v_caixa = ROW_COUNT;
  DELETE FROM public.financeiro_lancamentos WHERE true;
  GET DIAGNOSTICS v_lancamentos = ROW_COUNT;
  DELETE FROM public.stg_financeiro_aberto WHERE true;
  GET DIAGNOSTICS v_stg_fin = ROW_COUNT;
  DELETE FROM public.stg_estoque_inicial WHERE true;
  GET DIAGNOSTICS v_stg_estoque = ROW_COUNT;
  DELETE FROM public.stg_faturamento WHERE true;
  GET DIAGNOSTICS v_stg_fat = ROW_COUNT;
  DELETE FROM public.stg_cadastros WHERE true;
  GET DIAGNOSTICS v_stg_cad = ROW_COUNT;
  BEGIN
    DELETE FROM public.stg_compras_xml WHERE true;
    GET DIAGNOSTICS v_stg_xml = ROW_COUNT;
  EXCEPTION WHEN undefined_table THEN
    v_stg_xml := 0;
  END;
  DELETE FROM public.importacao_logs WHERE true;
  GET DIAGNOSTICS v_logs = ROW_COUNT;
  DELETE FROM public.importacao_lotes WHERE true;
  GET DIAGNOSTICS v_lotes = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'apagados', jsonb_build_object(
      'financeiro_baixas', v_baixas,
      'caixa_movimentos', v_caixa,
      'financeiro_lancamentos', v_lancamentos,
      'stg_financeiro_aberto', v_stg_fin,
      'stg_estoque_inicial', v_stg_estoque,
      'stg_faturamento', v_stg_fat,
      'stg_cadastros', v_stg_cad,
      'stg_compras_xml', v_stg_xml,
      'importacao_logs', v_logs,
      'importacao_lotes', v_lotes
    )
  );
END;
$function$;