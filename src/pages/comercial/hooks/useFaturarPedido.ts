import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { calcularStatusFaturamentoOV } from "@/lib/fiscal";
import { registrarEventoFiscal } from "@/services/fiscal.service";

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
 * Pulls full fiscal data from products and order metadata.
 */
export function useFaturarPedido() {
  const queryClient = useQueryClient();

  return useMutation<FaturarPedidoResult, Error, PedidoBase>({
    mutationFn: async (pedido) => {
      // Fetch order items with product fiscal data
      const { data: pedidoItems, error: itemsError } = await supabase
        .from("ordens_venda_itens")
        .select("*, produtos(id, nome, sku, ncm, cfop, cst_icms, origem_mercadoria, unidade, peso_bruto, peso_liquido)")
        .eq("ordem_venda_id", pedido.id);

      if (itemsError) throw new Error(itemsError.message);

      // Fetch order details for transportadora and frete
      const { data: ordemVenda } = await supabase
        .from("ordens_venda")
        .select("transportadora_id, frete_valor, frete_tipo, observacoes")
        .eq("id", pedido.id)
        .single();

      const { count, error: countError } = await supabase
        .from("notas_fiscais")
        .select("*", { count: "exact", head: true });

      if (countError) throw new Error(countError.message);

      const nfNumero = String((count || 0) + 1).padStart(6, "0");
      const totalProdutos = (pedidoItems || []).reduce(
        (s, i) => s + Number(i.valor_total || 0),
        0,
      );

      // Calculate total weight from products
      const pesoBrutoTotal = (pedidoItems || []).reduce(
        (s, i) => s + (Number(i.produtos?.peso_bruto || 0) * Number(i.quantidade || 0)), 0
      );
      const pesoLiquidoTotal = (pedidoItems || []).reduce(
        (s, i) => s + (Number(i.produtos?.peso_liquido || 0) * Number(i.quantidade || 0)), 0
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
          valor_produtos: totalProdutos,
          status: "pendente",
          movimenta_estoque: true,
          gera_financeiro: true,
          origem: "pedido",
          natureza_operacao: "Venda de mercadoria",
          transportadora_id: ordemVenda?.transportadora_id || null,
          frete_valor: ordemVenda?.frete_valor || 0,
          frete_modalidade: ordemVenda?.frete_tipo === "CIF" ? "0" : ordemVenda?.frete_tipo === "FOB" ? "1" : "9",
          peso_bruto: pesoBrutoTotal,
          peso_liquido: pesoLiquidoTotal,
          observacoes: `Gerada a partir do Pedido ${pedido.numero}`,
        } as any)
        .select()
        .single();

      if (nfError) throw new Error(nfError.message);

      // Insert NF items with fiscal data from products
      if (pedidoItems && pedidoItems.length > 0 && newNF) {
        const nfItems = pedidoItems.map((i) => ({
          nota_fiscal_id: newNF.id,
          produto_id: i.produto_id,
          quantidade: i.quantidade,
          valor_unitario: i.valor_unitario,
          ncm: i.produtos?.ncm || null,
          cfop: i.produtos?.cfop || null,
          cst: i.produtos?.cst_icms || null,
          origem_mercadoria: i.produtos?.origem_mercadoria || "0",
          unidade: i.produtos?.unidade || "UN",
          codigo_produto: i.produtos?.sku || null,
        }));
        const { error: nfItemsError } = await supabase
          .from("notas_fiscais_itens")
          .insert(nfItems);
        if (nfItemsError) throw new Error(nfItemsError.message);
      }

      // Update OV item billing quantities
      if (pedidoItems) {
        await Promise.all(
          pedidoItems.map((item) => {
            const novaQtdFaturada = (item.quantidade_faturada || 0) + item.quantidade;
            return supabase
              .from("ordens_venda_itens")
              .update({ quantidade_faturada: novaQtdFaturada })
              .eq("id", item.id);
          }),
        );
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

      // Register fiscal event
      await registrarEventoFiscal({
        nota_fiscal_id: newNF!.id,
        tipo_evento: "criacao",
        status_novo: "pendente",
        descricao: `NF ${nfNumero} gerada automaticamente a partir do Pedido ${pedido.numero}.`,
        payload_resumido: { valor_total: totalProdutos, pedido_numero: pedido.numero, itens: (pedidoItems || []).length },
      });

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
