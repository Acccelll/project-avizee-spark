import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notifyError } from "@/utils/errorMessages";
import { INVALIDATION_KEYS } from "@/services/_invalidationKeys";
import {
  cancelarPedidoVenda,
  type CancelarPedidoVendaResult,
} from "@/services/comercial/pedidosVenda.service";

interface CancelarPedidoInput {
  id: string;
  motivo?: string;
}

type CancelarPedidoResult = CancelarPedidoVendaResult;

/**
 * Wrapper RQ para `cancelarPedidoVenda` (service comercial).
 */
export function useCancelarPedido() {
  const queryClient = useQueryClient();

  return useMutation<CancelarPedidoResult, Error, CancelarPedidoInput>({
    mutationFn: ({ id, motivo }) => cancelarPedidoVenda({ id, motivo: motivo ?? null }),
    onSuccess: (result) => {
      INVALIDATION_KEYS.faturamentoPedido.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
      toast.success(`Pedido ${result.numero} cancelado.`);
    },
    onError: (err) => {
      notifyError(err);
    },
  });
}