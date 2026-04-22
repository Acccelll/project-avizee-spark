import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getUserFriendlyError } from "@/utils/errorMessages";
import { INVALIDATION_KEYS } from "@/services/_invalidationKeys";

interface CancelarPedidoInput {
  id: string;
  motivo?: string;
}

interface CancelarPedidoResult {
  id: string;
  numero: string;
  status: string;
}

/**
 * Cancela um pedido de venda via RPC `cancelar_pedido_venda`.
 * A RPC bloqueia se houver NF ativa vinculada e registra auditoria.
 * Invalida o conjunto de faturamento para refletir em grids/dashboard.
 */
export function useCancelarPedido() {
  const queryClient = useQueryClient();

  return useMutation<CancelarPedidoResult, Error, CancelarPedidoInput>({
    mutationFn: async ({ id, motivo }) => {
      const { data, error } = await supabase.rpc("cancelar_pedido_venda" as never, {
        p_id: id,
        p_motivo: motivo ?? null,
      } as never);
      if (error) throw new Error(error.message);
      return data as CancelarPedidoResult;
    },
    onSuccess: (result) => {
      INVALIDATION_KEYS.faturamentoPedido.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
      toast.success(`Pedido ${result.numero} cancelado.`);
    },
    onError: (err) => {
      toast.error(getUserFriendlyError(err));
    },
  });
}