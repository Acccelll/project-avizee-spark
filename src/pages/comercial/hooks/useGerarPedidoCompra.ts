import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";
import { supabase } from "@/integrations/supabase/client";

interface CotacaoCompraBase {
  id: string;
  numero: string;
  fornecedor_id?: string | null;
  valor_total?: number | null;
  observacoes?: string | null;
}

interface GerarPedidoCompraResult {
  pedidoId: string;
  pedidoNumero: string;
}

/**
 * Hook for generating a purchase order (pedido de compra) from a purchase quotation.
 * Invalidates queries for cotacoes_compra and pedidos_compra on success.
 */
export function useGerarPedidoCompra() {
  const queryClient = useQueryClient();

  return useMutation<GerarPedidoCompraResult, Error, CotacaoCompraBase>({
    mutationFn: async (cotacao) => {
      const { data: items, error: itemsError } = await supabase
        .from("cotacoes_compra_itens")
        .select("*")
        .eq("cotacao_compra_id", cotacao.id);

      if (itemsError) throw new Error(itemsError.message);

      // Fetch selected proposals to get pricing for each item
      const { data: propostas } = await supabase
        .from("cotacoes_compra_propostas")
        .select("item_id, preco_unitario")
        .eq("cotacao_compra_id", cotacao.id)
        .eq("selecionado", true);

      const precoByItem: Record<string, number> = {};
      for (const p of propostas ?? []) {
        precoByItem[p.item_id] = Number(p.preco_unitario || 0);
      }

      // Use atomic numbering RPC
      const { data: rpcNumero } = await supabase.rpc('proximo_numero_pedido_compra');
      const numero = rpcNumero || `PC-${String(Date.now()).slice(-6)}`;

      const { data: newPedido, error: pedidoError } = await supabase
        .from("pedidos_compra")
        .insert({
          numero,
          fornecedor_id: cotacao.fornecedor_id || null,
          data_pedido: new Date().toISOString().split("T")[0],
          valor_total: cotacao.valor_total || 0,
          status: "aprovado",
          observacoes: cotacao.observacoes || null,
          cotacao_compra_id: cotacao.id,
        })
        .select()
        .single();

      if (pedidoError) throw new Error(pedidoError.message);

      if (items && items.length > 0 && newPedido) {
        const pedidoItems = items.map((i) => {
          const valorUnitario = precoByItem[i.id] ?? 0;
          return {
            pedido_compra_id: newPedido.id,
            produto_id: i.produto_id,
            quantidade: i.quantidade,
            preco_unitario: valorUnitario,
            subtotal: valorUnitario * Number(i.quantidade),
          };
        });

        const { error: itemsInsertError } = await supabase
          .from("pedidos_compra_itens")
          .insert(pedidoItems);

        if (itemsInsertError) throw new Error(itemsInsertError.message);
      }

      const { error: updateError } = await supabase
        .from("cotacoes_compra")
        .update({ status: "convertida" })
        .eq("id", cotacao.id);

      if (updateError) throw new Error(updateError.message);

      return { pedidoId: newPedido!.id, pedidoNumero: numero };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["cotacoes_compra"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos_compra"] });
      toast.success(`Pedido de compra ${result.pedidoNumero} gerado!`);
    },
    onError: (err: Error) => {
      toast.error(getUserFriendlyError(err));
    },
  });
}
