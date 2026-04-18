import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";
import { supabase } from "@/integrations/supabase/client";
import { INVALIDATION_KEYS } from "@/services/_invalidationKeys";

interface CotacaoCompraBase {
  id: string;
  numero?: string;
  fornecedor_id?: string | null;
  valor_total?: number | null;
  observacoes?: string | null;
}

interface GerarPedidoCompraResult {
  pedidoId: string;
  pedidoNumero: string;
}

/**
 * Hook para gerar pedido de compra a partir de cotação.
 * Usa RPC transacional `gerar_pedido_compra` para garantir atomicidade.
 * Invalida `geracaoPedidoCompra` (cotações + pedidos de compra).
 */
export function useGerarPedidoCompra() {
  const queryClient = useQueryClient();

  return useMutation<GerarPedidoCompraResult, Error, CotacaoCompraBase>({
    mutationFn: async (cotacao) => {
      const { data, error } = await supabase.rpc("gerar_pedido_compra", {
        p_cotacao_id: cotacao.id,
        p_observacoes: cotacao.observacoes ?? null,
      });
      if (error) throw new Error(error.message);
      const result = data as { pedido_id: string; pedido_numero: string };
      return { pedidoId: result.pedido_id, pedidoNumero: result.pedido_numero };
    },
    onSuccess: (result) => {
      INVALIDATION_KEYS.geracaoPedidoCompra.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
      toast.success(`Pedido de compra ${result.pedidoNumero} gerado!`);
    },
    onError: (err: Error) => {
      toast.error(getUserFriendlyError(err));
    },
  });
}
