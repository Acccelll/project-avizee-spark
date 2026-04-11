import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { calcularStatusFaturamentoOV } from "@/lib/fiscal";

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
 * Hook for invoicing a sales order (pedido) by generating a Nota Fiscal.
 * Invalidates queries for notas_fiscais and ordens_venda on success.
 */
export function useFaturarPedido() {
  const queryClient = useQueryClient();

  return useMutation<FaturarPedidoResult, Error, PedidoBase>({
    mutationFn: async (pedido) => {
      const { data: pedidoItems, error: itemsError } = await supabase
        .from("ordens_venda_itens")
        .select("*")
        .eq("ordem_venda_id", pedido.id);

      if (itemsError) throw new Error(itemsError.message);

      const { count, error: countError } = await supabase
        .from("notas_fiscais")
        .select("*", { count: "exact", head: true });

      if (countError) throw new Error(countError.message);

      const nfNumero = String((count || 0) + 1).padStart(6, "0");
      const totalProdutos = (pedidoItems || []).reduce(
        (s, i) => s + Number(i.valor_total || 0),
        0,
      );

      const { data: newNF, error: nfError } = await supabase
        .from("notas_fiscais")
        .insert({
          numero: nfNumero,
          tipo: "saida",
          data_emissao: new Date().toISOString().split("T")[0],
          cliente_id: pedido.cliente_id,
          ordem_venda_id: pedido.id,
          valor_total: totalProdutos,
          status: "pendente",
          movimenta_estoque: true,
          gera_financeiro: true,
          observacoes: `Gerada a partir do Pedido ${pedido.numero}`,
        })
        .select()
        .single();

      if (nfError) throw new Error(nfError.message);

      if (pedidoItems && pedidoItems.length > 0 && newNF) {
        const nfItems = pedidoItems.map((i) => ({
          nota_fiscal_id: newNF.id,
          produto_id: i.produto_id,
          quantidade: i.quantidade,
          valor_unitario: i.valor_unitario,
        }));
        const { error: nfItemsError } = await supabase
          .from("notas_fiscais_itens")
          .insert(nfItems);
        if (nfItemsError) throw new Error(nfItemsError.message);
      }

      if (pedidoItems) {
        for (const item of pedidoItems) {
          const novaQtdFaturada = (item.quantidade_faturada || 0) + item.quantidade;
          await supabase
            .from("ordens_venda_itens")
            .update({ quantidade_faturada: novaQtdFaturada })
            .eq("id", item.id);
        }
      }

      const { data: updatedItems } = await supabase
        .from("ordens_venda_itens")
        .select("quantidade, quantidade_faturada")
        .eq("ordem_venda_id", pedido.id);

      const totalQ = (updatedItems || []).reduce((s, i) => s + Number(i.quantidade), 0);
      const totalF = (updatedItems || []).reduce(
        (s, i) => s + Number(i.quantidade_faturada || 0),
        0,
      );
      const newFatStatus = calcularStatusFaturamentoOV(totalQ, totalF);

      await supabase
        .from("ordens_venda")
        .update({ status_faturamento: newFatStatus })
        .eq("id", pedido.id);

      return { nfId: newNF!.id, nfNumero };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["notas_fiscais"] });
      queryClient.invalidateQueries({ queryKey: ["ordens_venda"] });
      toast.success(`NF ${result.nfNumero} gerada com sucesso!`);
    },
    onError: (err: Error) => {
      toast.error(`Erro ao gerar Nota Fiscal: ${err.message}`);
    },
  });
}
