-- Phase 8: Sincronizar status do Pedido quando a Remessa é entregue
CREATE OR REPLACE FUNCTION public.sync_pedido_status_on_remessa_entregue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status_transporte = 'entregue'
     AND (OLD.status_transporte IS DISTINCT FROM 'entregue')
     AND NEW.tipo_remessa = 'saida'
     AND NEW.ordem_venda_id IS NOT NULL THEN
    UPDATE public.ordens_venda
       SET status = 'entregue',
           updated_at = now()
     WHERE id = NEW.ordem_venda_id
       AND status NOT IN ('entregue', 'cancelada');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_remessa_entregue_sync ON public.remessas;

CREATE TRIGGER trg_remessa_entregue_sync
AFTER UPDATE OF status_transporte ON public.remessas
FOR EACH ROW
EXECUTE FUNCTION public.sync_pedido_status_on_remessa_entregue();