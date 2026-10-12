-- NF cancelada na SEFAZ fica com status 'confirmada' e status_sefaz
-- 'cancelada_sefaz' (chk_nf_coerencia_sefaz). As funções do fechamento e a
-- regra de revenda contavam essas notas como venda; passam a ignorá-las.

DO $$
DECLARE
  v_fn text;
  v_def text;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'public.workbook_fechamento_dados(text)',
    'public.apresentacao_fechamento_dados(text)',
    'public.conta_nf_entrada_inferida(uuid)'
  ] LOOP
    v_def := pg_get_functiondef(v_fn::regprocedure);
    CONTINUE WHEN v_def ~ 'cancelada_sefaz';
    v_def := regexp_replace(
      v_def,
      '(\m\w+)\.status IN \(''confirmada'', ''importada''\)',
      '\1.status IN (''confirmada'', ''importada'') AND coalesce(\1.status_sefaz, '''') <> ''cancelada_sefaz''',
      'g');
    EXECUTE v_def;
  END LOOP;
END;
$$;
