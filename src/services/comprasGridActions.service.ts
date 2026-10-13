import { supabase } from "@/integrations/supabase/client";
import * as cotacoes from "@/services/cotacoesCompra.service";
import * as pedidos from "@/services/pedidosCompra.service";
import { cancelarPedidoCompra } from "@/types/rpc";

/** A UI faz uma checagem defensiva; RLS/triggers/RPC continuam sendo a autoridade. */
export async function executarAcaoGridCompra(tipo: "rc" | "oc", kind: "cancelar" | "excluir", id: string, motivo: string) {
  if (tipo === "rc") {
    const atual = await cotacoes.getCotacaoCompra(id);
    if (!atual) throw new Error("RC não encontrada.");
    if (kind === "cancelar") {
      if (["convertida", "cancelada", "rejeitada"].includes(atual.status)) {
        throw new Error("Esta RC não pode mais ser cancelada.");
      }
      if (!motivo.trim()) throw new Error("Informe o motivo.");
      await cotacoes.cancelarCotacaoCompra(id, motivo.trim());
      return;
    }
    if (atual.status !== "rascunho") throw new Error("Somente RC em rascunho pode ser excluída.");
    const { data: vinculados, error: linkError } = await supabase
      .from("pedidos_compra").select("id").eq("cotacao_compra_id", id).limit(1);
    if (linkError) throw linkError;
    if (vinculados?.length) throw new Error("Esta RC já possui OC vinculada.");
    const { data, error } = await supabase.from("cotacoes_compra")
      .delete().eq("id", id).eq("status", "rascunho").select("id");
    if (error) throw error;
    if (!data?.length) throw new Error("A RC mudou de estado; exclusão não realizada.");
    return;
  }

  const atual = await pedidos.getPedidoCompra(id);
  if (!atual) throw new Error("OC não encontrada.");
  if (kind === "cancelar") {
    if (["cancelado", "recebido", "parcialmente_recebido"].includes(atual.status)) {
      throw new Error("Esta OC já está encerrada ou possui recebimentos.");
    }
    if (!motivo.trim()) throw new Error("Informe o motivo.");
    await cancelarPedidoCompra({ p_id: id, p_motivo: motivo.trim() });
    return;
  }
  if (atual.status !== "rascunho") throw new Error("Somente OC em rascunho pode ser excluída.");
  const [{ data: recebimentos, error: recebimentosError }, { data: financeiros, error: financeirosError }] = await Promise.all([
    supabase.from("compras").select("id").eq("pedido_compra_id", id).limit(1),
    supabase.from("financeiro_lancamentos").select("id").eq("pedido_compra_id", id).limit(1),
  ]);
  if (recebimentosError) throw recebimentosError;
  if (financeirosError) throw financeirosError;
  if (recebimentos?.length || financeiros?.length) {
    throw new Error("Esta OC possui recebimento ou lançamento financeiro vinculado e não pode ser excluída.");
  }
  const { data, error } = await supabase.from("pedidos_compra")
    .update({ ativo: false }).eq("id", id).eq("status", "rascunho")
    .eq("ativo", true).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("A OC mudou de estado; exclusão não realizada.");
}
