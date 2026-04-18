import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";
import { supabase } from "@/integrations/supabase/client";
import { INVALIDATION_KEYS } from "@/services/_invalidationKeys";

interface PedidoBase {
  id: string;
  numero: string;
  cliente_id: string | null;
  status_faturamento: string | null;
}

interface FaturarPedidoResult {
  nfId: string;
  nfNumero: string;
}

/**
 * Hook para faturar um pedido de venda usando RPC transacional `gerar_nf_de_pedido`.
 * A RPC numera a NF, copia os itens com dados fiscais do produto, atualiza o status
 * de faturamento e registra o evento fiscal — tudo em uma única transação.
 *
 * Invalida todo o conjunto cross-módulo (`faturamentoPedido`) para que telas em
 * background (Fiscal, Estoque, Financeiro) reflitam imediatamente.
 */
export function useFaturarPedido() {
  const queryClient = useQueryClient();

  return useMutation<FaturarPedidoResult, Error, PedidoBase>({
    mutationFn: async (pedido) => {
      const { data, error } = await supabase.rpc("gerar_nf_de_pedido", {
        p_pedido_id: pedido.id,
      });
      if (error) throw new Error(error.message);
      const result = data as { nf_id: string; nf_numero: string };
      return { nfId: result.nf_id, nfNumero: result.nf_numero };
    },
    onSuccess: (result) => {
      INVALIDATION_KEYS.faturamentoPedido.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
      toast.success(`NF ${result.nfNumero} gerada com sucesso!`);
    },
    onError: (err: Error) => {
      toast.error(getUserFriendlyError(err));
    },
  });
}
