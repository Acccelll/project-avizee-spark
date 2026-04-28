import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";
import { INVALIDATION_KEYS } from "@/services/_invalidationKeys";
import {
  salvarPedidoCompra,
  type SalvarPedidoCompraInput,
} from "@/services/comercial/comprasLifecycle.service";

export type { SalvarPedidoCompraInput };

/**
 * Wrapper React Query para `salvarPedidoCompra` (service em `services/comercial`).
 * Mantém invalidations e toast aqui (camada de UI/RQ).
 */
export function useSalvarPedidoCompra() {
  const qc = useQueryClient();

  return useMutation<void, Error, SalvarPedidoCompraInput>({
    mutationFn: salvarPedidoCompra,
    onSuccess: () => {
      INVALIDATION_KEYS.geracaoPedidoCompra.forEach((key) => {
        qc.invalidateQueries({ queryKey: [key] });
      });
      toast.success("Pedido de compra salvo!");
    },
    onError: (err) => toast.error(getUserFriendlyError(err)),
  });
}
