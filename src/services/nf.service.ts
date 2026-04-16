/**
 * Serviço compartilhado de geração de NF de saída a partir de Pedidos (Ordens de Venda).
 * Usado tanto pela grid de Pedidos quanto pelo drawer OrdemVendaView para garantir
 * comportamento consistente e evitar duplicação de lógica.
 */
import { supabase } from "@/integrations/supabase/client";
import { confirmarNotaFiscal } from "@/services/fiscal.service";
import { calcularStatusFaturamentoOV } from "@/lib/fiscal";

export interface GerarNFResult {
  nfId: string;
  nfNumero: string;
}

/**
 * Gera uma Nota Fiscal de saída para uma Ordem de Venda.
 * Insere a NF, os itens, atualiza quantidade_faturada e status_faturamento do pedido,
 * e chama confirmarNotaFiscal para movimentar estoque e financeiro.
 */
export async function gerarNFParaPedido(
  pedidoId: string,
  pedidoNumero: string,
  clienteId: string | null,
): Promise<GerarNFResult> {
  // 1. Buscar itens do pedido
  const { data: pedidoItems, error: itemsError } = await supabase
    .from("ordens_venda_itens")
    .select("*")
    .eq("ordem_venda_id", pedidoId);
  if (itemsError) throw itemsError;

  // 2. Obter próximo número de NF
  const { data: nfNumData, error: nfNumError } = await supabase.rpc(
    "proximo_numero_nota_fiscal" as never,
  );
  if (nfNumError) throw nfNumError;
  const nfNumero = nfNumData as string;

  const totalProdutos = (pedidoItems || []).reduce(
    (s: number, i: Record<string, unknown>) => s + Number(i.valor_total || 0),
    0,
  );

  // 3. Inserir NF
  const { data: newNF, error: nfError } = await supabase
    .from("notas_fiscais")
    .insert({
      numero: nfNumero,
      tipo: "saida",
      data_emissao: new Date().toISOString().split("T")[0],
      cliente_id: clienteId,
      ordem_venda_id: pedidoId,
      valor_total: totalProdutos,
      status: "pendente",
      movimenta_estoque: true,
      gera_financeiro: true,
      observacoes: `Gerada a partir do Pedido ${pedidoNumero}`,
    })
    .select()
    .single();
  if (nfError) throw nfError;

  // 4. Inserir itens da NF
  if (pedidoItems && pedidoItems.length > 0 && newNF) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nfItems = pedidoItems.map((i: any) => ({
      nota_fiscal_id: newNF.id,
      produto_id: i.produto_id as string,
      quantidade: Number(i.quantidade),
      valor_unitario: Number(i.valor_unitario),
    }));
    const { error: nfItemsError } = await supabase
      .from("notas_fiscais_itens")
      .insert(nfItems);
    if (nfItemsError) throw nfItemsError;
  }

  // 5. Atualizar quantidade_faturada em cada item do pedido
  if (pedidoItems && pedidoItems.length > 0) {
    await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pedidoItems.map((item: any) =>
        supabase
          .from("ordens_venda_itens")
          .update({
            quantidade_faturada:
              Number(item.quantidade_faturada || 0) + Number(item.quantidade),
          })
          .eq("id", item.id as string),
      ),
    );
  }

  // 6. Recalcular e atualizar status_faturamento do pedido
  const { data: updatedItems } = await supabase
    .from("ordens_venda_itens")
    .select("quantidade, quantidade_faturada")
    .eq("ordem_venda_id", pedidoId);
  const totalQ = (updatedItems || []).reduce(
    (s: number, i: Record<string, unknown>) => s + Number(i.quantidade),
    0,
  );
  const totalF = (updatedItems || []).reduce(
    (s: number, i: Record<string, unknown>) => s + Number(i.quantidade_faturada || 0),
    0,
  );
  const newFatStatus = calcularStatusFaturamentoOV(totalQ, totalF);
  await supabase
    .from("ordens_venda")
    .update({ status_faturamento: newFatStatus })
    .eq("id", pedidoId);

  // 7. Confirmar NF (estoque + financeiro)
  await confirmarNotaFiscal({
    nf: {
      id: newNF.id,
      numero: nfNumero,
      tipo: "saida",
      data_emissao: new Date().toISOString().split("T")[0],
      valor_total: totalProdutos,
      movimenta_estoque: true,
      gera_financeiro: true,
      condicao_pagamento: "a_vista",
      forma_pagamento: "",
      fornecedor_id: "",
      cliente_id: clienteId ?? "",
      conta_contabil_id: null,
      ordem_venda_id: pedidoId,
      status: "pendente",
    },
    parcelas: 1,
  });

  return { nfId: newNF.id, nfNumero };
}
