import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getUserFriendlyError } from "@/utils/errorMessages";
import { INVALIDATION_KEYS } from "@/services/_invalidationKeys";

interface SalvarPedidoCompraItem {
  produto_id: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
}

interface SalvarPedidoCompraInput {
  id: string;
  header: {
    fornecedor_id: string;
    data_pedido: string;
    data_entrega_prevista: string | null;
    data_entrega_real: string | null;
    frete_valor: number;
    condicao_pagamento: string | null;
    status: string;
    observacoes: string | null;
    valor_total: number;
  };
  itens: SalvarPedidoCompraItem[];
}

/**
 * Atualiza um Pedido de Compra (cabeçalho + itens) de forma transacional.
 * - Cabeçalho: UPDATE simples na tabela.
 * - Itens: RPC `replace_pedido_compra_itens` (delete+insert atômico no servidor).
 * - Invalida queries de `geracaoPedidoCompra` (cotações + pedidos compra).
 *
 * Centraliza a lógica de save que vivia inline em `PedidoCompraForm.handleSave`,
 * garantindo que TODOS os consumidores RQ (grid, drawer, KPIs) sincronizem
 * automaticamente via React Query.
 */
export function useSalvarPedidoCompra() {
  const qc = useQueryClient();

  return useMutation<void, Error, SalvarPedidoCompraInput>({
    mutationFn: async ({ id, header, itens }) => {
      const { error: updErr } = await supabase
        .from("pedidos_compra")
        .update(header)
        .eq("id", id);
      if (updErr) throw new Error(updErr.message);

      const { error: rpcErr } = await supabase.rpc("replace_pedido_compra_itens", {
        p_pedido_id: id,
        p_itens: itens as unknown as never,
      });
      if (rpcErr) throw new Error(rpcErr.message);
    },
    onSuccess: () => {
      INVALIDATION_KEYS.geracaoPedidoCompra.forEach((key) => {
        qc.invalidateQueries({ queryKey: [key] });
      });
      toast.success("Pedido de compra salvo!");
    },
    onError: (err) => toast.error(getUserFriendlyError(err)),
  });
}
