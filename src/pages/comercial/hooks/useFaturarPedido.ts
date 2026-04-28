import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notifyError } from "@/utils/errorMessages";
import { INVALIDATION_KEYS } from "@/services/_invalidationKeys";
import {
  faturarPedido,
  type FaturarPedidoVendaResult,
} from "@/services/comercial/pedidosVenda.service";

interface PedidoBase {
  id: string;
  numero: string;
  cliente_id: string | null;
  status_faturamento: string | null;
}

type FaturarPedidoResult = FaturarPedidoVendaResult;

/**
 * Wrapper RQ para `faturarPedido` (service comercial).
 */
export function useFaturarPedido() {
  const queryClient = useQueryClient();

  return useMutation<FaturarPedidoResult, Error, PedidoBase>({
    mutationFn: (pedido) => faturarPedido(pedido.id),
    onSuccess: (result) => {
      INVALIDATION_KEYS.faturamentoPedido.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
      toast.success(`NF ${result.nfNumero} gerada com sucesso!`);
    },
    onError: (err: Error) => {
      notifyError(err);
    },
  });
}
