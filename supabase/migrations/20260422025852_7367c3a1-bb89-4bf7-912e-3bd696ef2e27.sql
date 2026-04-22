
CREATE OR REPLACE FUNCTION public.save_produto_fornecedores(
  p_produto_id uuid,
  p_itens jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
BEGIN
  IF p_produto_id IS NULL THEN
    RAISE EXCEPTION 'produto_id obrigatório';
  END IF;

  DELETE FROM public.produtos_fornecedores WHERE produto_id = p_produto_id;

  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
    RETURN;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    IF (v_item->>'fornecedor_id') IS NULL THEN
      CONTINUE;
    END IF;
    INSERT INTO public.produtos_fornecedores (
      produto_id, fornecedor_id, eh_principal,
      descricao_fornecedor, referencia_fornecedor, unidade_fornecedor,
      lead_time_dias, preco_compra
    ) VALUES (
      p_produto_id,
      (v_item->>'fornecedor_id')::uuid,
      COALESCE((v_item->>'eh_principal')::boolean, false),
      NULLIF(v_item->>'descricao_fornecedor', ''),
      NULLIF(v_item->>'referencia_fornecedor', ''),
      NULLIF(v_item->>'unidade_fornecedor', ''),
      NULLIF(v_item->>'lead_time_dias','')::integer,
      NULLIF(v_item->>'preco_compra','')::numeric
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.save_produto_fornecedores(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_produto_fornecedores(uuid, jsonb) TO authenticated;
