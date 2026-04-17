import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";
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

interface ProdutoFiscal {
  id: string;
  nome: string | null;
  sku: string | null;
  ncm: string | null;
  cst: string | null;
  cfop_padrao: string | null;
  origem_mercadoria: string | null;
  unidade_medida: string | null;
  peso_bruto: number | null;
  peso_liquido: number | null;
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
        .select("*, produtos(id, nome, sku, ncm, cst, cfop_padrao, origem_mercadoria, unidade_medida, peso_bruto, peso_liquido)")
        .eq("ordem_venda_id", pedido.id);

      if (itemsError) throw new Error(itemsError.message);

      // Fetch order details
      const { data: ordemVenda } = await supabase
        .from("ordens_venda")
        .select("observacoes")
        .eq("id", pedido.id)
        .single();

      // Numeração atômica via RPC (sequence) — evita race condition com COUNT
      const { data: nfNumero, error: numError } = await supabase.rpc("proximo_numero_nf");
      if (numError) throw new Error(numError.message);
      const totalProdutos = (pedidoItems || []).reduce(
        (s, i) => s + Number(i.valor_total || 0),
        0,
      );

      // Calculate total weight from products
      const pesoBrutoTotal = (pedidoItems || []).reduce(
        (s, i) => s + (Number((i.produtos as ProdutoFiscal | null)?.peso_bruto || 0) * Number(i.quantidade || 0)), 0
      );
      const pesoLiquidoTotal = (pedidoItems || []).reduce(
        (s, i) => s + (Number((i.produtos as ProdutoFiscal | null)?.peso_liquido || 0) * Number(i.quantidade || 0)), 0
      );

      const { data: newNF, error: nfError } = await supabase
        .from("notas_fiscais")
        .insert({
          numero: nfNumero,
          tipo: "saida" as const,
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
          peso_bruto: pesoBrutoTotal,
          peso_liquido: pesoLiquidoTotal,
          observacoes: `Gerada a partir do Pedido ${pedido.numero}`,
        })
        .select()
        .single();

      if (nfError) throw new Error(nfError.message);

      // Insert NF items with fiscal data from products
      if (pedidoItems && pedidoItems.length > 0 && newNF) {
        const nfItems = pedidoItems.map((i) => {
          const prod = i.produtos as ProdutoFiscal | null;
          return {
            nota_fiscal_id: newNF.id,
            produto_id: i.produto_id,
            quantidade: i.quantidade,
            valor_unitario: i.valor_unitario,
            ncm: prod?.ncm || null,
            cfop: prod?.cfop_padrao || null,
            cst: prod?.cst || null,
            origem_mercadoria: prod?.origem_mercadoria || "0",
            unidade: prod?.unidade_medida || "UN",
            codigo_produto: prod?.sku || null,
          };
        });
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

      // Parallel: update OV faturamento status + register fiscal event
      await Promise.all([
        supabase
          .from("ordens_venda")
          .update({ status_faturamento: newFatStatus })
          .eq("id", pedido.id),
        registrarEventoFiscal({
          nota_fiscal_id: newNF!.id,
          tipo_evento: "criacao",
          status_novo: "pendente",
          descricao: `NF ${nfNumero} gerada automaticamente a partir do Pedido ${pedido.numero}.`,
          payload_resumido: { valor_total: totalProdutos, pedido_numero: pedido.numero, itens: (pedidoItems || []).length },
        }),
      ]);

      return { nfId: newNF!.id, nfNumero };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["notas_fiscais"] });
      queryClient.invalidateQueries({ queryKey: ["ordens_venda"] });
      toast.success(`NF ${result.nfNumero} gerada com sucesso!`);
    },
    onError: (err: Error) => {
      toast.error(getUserFriendlyError(err));
    },
  });
}
