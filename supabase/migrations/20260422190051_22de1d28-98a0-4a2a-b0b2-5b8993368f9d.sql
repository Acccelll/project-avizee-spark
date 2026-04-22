-- 1. Coluna de vínculo
ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS pedido_compra_id uuid REFERENCES public.pedidos_compra(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notas_fiscais_pedido_compra_id
  ON public.notas_fiscais(pedido_compra_id)
  WHERE pedido_compra_id IS NOT NULL;

-- 2. RPC para vincular NF a pedido de compra e atualizar status do PO
CREATE OR REPLACE FUNCTION public.vincular_nf_pedido_compra(
  p_nf_id uuid,
  p_pedido_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido_total numeric;
  v_total_nfs numeric;
  v_novo_status text;
BEGIN
  -- Validar que NF existe
  IF NOT EXISTS (SELECT 1 FROM notas_fiscais WHERE id = p_nf_id) THEN
    RAISE EXCEPTION 'Nota fiscal % não encontrada', p_nf_id USING ERRCODE = 'P0002';
  END IF;

  -- Validar que pedido existe e capturar valor total
  SELECT COALESCE(valor_total, 0) INTO v_pedido_total
  FROM pedidos_compra
  WHERE id = p_pedido_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido de compra % não encontrado', p_pedido_id USING ERRCODE = 'P0002';
  END IF;

  -- Vincular
  UPDATE notas_fiscais
     SET pedido_compra_id = p_pedido_id,
         updated_at = now()
   WHERE id = p_nf_id;

  -- Calcular soma de NFs vinculadas (excluindo canceladas)
  SELECT COALESCE(SUM(valor_total), 0) INTO v_total_nfs
  FROM notas_fiscais
  WHERE pedido_compra_id = p_pedido_id
    AND COALESCE(status, '') NOT IN ('cancelada', 'inutilizada');

  -- Definir novo status do PO
  IF v_pedido_total > 0 AND v_total_nfs >= v_pedido_total THEN
    v_novo_status := 'recebido_total';
  ELSIF v_total_nfs > 0 THEN
    v_novo_status := 'recebido_parcial';
  ELSE
    v_novo_status := NULL;
  END IF;

  IF v_novo_status IS NOT NULL THEN
    UPDATE pedidos_compra
       SET status = v_novo_status,
           updated_at = now()
     WHERE id = p_pedido_id;
  END IF;

  RETURN jsonb_build_object(
    'nf_id', p_nf_id,
    'pedido_id', p_pedido_id,
    'pedido_total', v_pedido_total,
    'total_nfs', v_total_nfs,
    'novo_status', v_novo_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.vincular_nf_pedido_compra(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vincular_nf_pedido_compra(uuid, uuid) TO authenticated;