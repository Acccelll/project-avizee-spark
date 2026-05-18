import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { notifyError } from "@/utils/errorMessages";
import { INVALIDATION_KEYS } from "@/services/_invalidationKeys";
import {
  gerarPedidoCompra,
  type GerarPedidoCompraResult,
} from "@/services/comercial/comprasLifecycle.service";

interface CotacaoCompraBase {
  id: string;
  numero?: string;
  fornecedor_id?: string | null;
  valor_total?: number | null;
  observacoes?: string | null;
}

/**
 * Hook para gerar pedido de compra a partir de cotação.
 */
export function useGerarPedidoCompra() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation<GerarPedidoCompraResult, Error, CotacaoCompraBase>({
    mutationFn: (cotacao) =>
      gerarPedidoCompra({ cotacaoId: cotacao.id, observacoes: cotacao.observacoes ?? null }),
    onSuccess: (result) => {
      INVALIDATION_KEYS.geracaoPedidoCompra.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
      toast.success(`Pedido ${result.pedidoNumero} criado com sucesso`, {
        action: {
          label: "Ver pedido",
          onClick: () => navigate(`/pedidos-compra/${result.pedidoId}`),
        },
        duration: 6000,
      });
    },
    onError: (err: Error) => {
      notifyError(err);
    },
  });
}
