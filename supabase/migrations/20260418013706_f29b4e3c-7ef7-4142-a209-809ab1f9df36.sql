CREATE OR REPLACE FUNCTION public.replace_pedido_compra_itens(
  p_pedido_id uuid,
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
  IF p_pedido_id IS NULL THEN
    RAISE EXCEPTION 'pedido_id obrigatório';
  END IF;

  -- Operação transacional: tudo dentro da função roda em uma única transação.
  DELETE FROM public.pedidos_compra_itens WHERE pedido_compra_id = p_pedido_id;

  IF p_itens IS NOT NULL AND jsonb_array_length(p_itens) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
      INSERT INTO public.pedidos_compra_itens (
        pedido_compra_id, produto_id, quantidade, preco_unitario, subtotal
      ) VALUES (
        p_pedido_id,
        NULLIF(v_item->>'produto_id', '')::uuid,
        COALESCE((v_item->>'quantidade')::numeric, 0),
        COALESCE((v_item->>'preco_unitario')::numeric, 0),
        COALESCE((v_item->>'subtotal')::numeric, 0)
      );
    END LOOP;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_pedido_compra_itens(uuid, jsonb) TO authenticated;