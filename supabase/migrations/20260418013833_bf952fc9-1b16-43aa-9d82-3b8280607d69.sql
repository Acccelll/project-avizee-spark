CREATE OR REPLACE FUNCTION public.replace_cotacao_compra_itens(
  p_cotacao_id uuid,
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
  IF p_cotacao_id IS NULL THEN
    RAISE EXCEPTION 'cotacao_id obrigatório';
  END IF;

  DELETE FROM public.cotacoes_compra_itens WHERE cotacao_compra_id = p_cotacao_id;

  IF p_itens IS NOT NULL AND jsonb_array_length(p_itens) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
      INSERT INTO public.cotacoes_compra_itens (
        cotacao_compra_id, produto_id, quantidade, unidade
      ) VALUES (
        p_cotacao_id,
        NULLIF(v_item->>'produto_id', '')::uuid,
        COALESCE((v_item->>'quantidade')::numeric, 0),
        COALESCE(v_item->>'unidade', 'UN')
      );
    END LOOP;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_cotacao_compra_itens(uuid, jsonb) TO authenticated;