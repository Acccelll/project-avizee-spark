import { supabase } from "@/integrations/supabase/client";
import type { StockShortfall } from "@/types/comercial";

/**
 * Verifica disponibilidade de estoque para todos os itens de um pedido.
 * Consumido por `Pedidos.tsx` (gate da grid) e `OrdemVendaView` (gate do drawer).
 *
 * Observação: usa `estoque_atual` desnormalizado mantido pelo trigger
 * `trg_estoque_movimentos_sync`. Não considera reservas de outros pedidos
 * em aberto — limitação documentada (otimista).
 */
export async function verificarEstoquePedido(
  pedidoId: string,
): Promise<StockShortfall[]> {
  const { data: items, error } = await supabase
    .from("ordens_venda_itens")
    .select("quantidade, produto_id, produtos(nome, estoque_atual, ativo)")
    .eq("ordem_venda_id", pedidoId);
  if (error) throw error;

  return (items || [])
    .filter((i) => {
      // Ignora itens cujo produto foi inativado — alerta do Cadastro, não do faturamento.
      const produto = i.produtos as { estoque_atual?: number | null; ativo?: boolean | null } | null;
      if (produto?.ativo === false) return false;
      const estoqueAtual = Number(produto?.estoque_atual ?? 0);
      return estoqueAtual < Number(i.quantidade);
    })
    .map((i) => {
      const produto = i.produtos as { nome?: string | null; estoque_atual?: number | null } | null;
      return {
        produto: produto?.nome || `Produto ${i.produto_id ?? ""}`,
        falta: Number(i.quantidade) - Number(produto?.estoque_atual ?? 0),
      };
    });
}