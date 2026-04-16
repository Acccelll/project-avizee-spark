import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Recebimento {
  id: string;
  numero_compra: string;
  fornecedor: string;
  previsao_entrega: string | null;
  data_recebimento: string | null;
  quantidade_pedida: number;
  quantidade_recebida: number;
  pendencia: number;
  status_logistico: string;
  nf_vinculada: string | null;
  responsavel: string;
}

async function fetchRecebimentos(): Promise<Recebimento[]> {
  const [comprasRes, itensCompraRes, fornecedoresRes] = await Promise.all([
    supabase
      .from("pedidos_compra")
      .select(
        "id,numero,fornecedor_id,data_entrega_prevista,data_entrega_real,status,usuario_id,updated_at",
      )
      .eq("ativo", true),
    supabase.from("pedidos_compra_itens").select("pedido_compra_id,quantidade"),
    supabase.from("fornecedores").select("id,nome_razao_social"),
  ]);

  const fornecedorMap = new Map(
    (fornecedoresRes.data ?? []).map((f) => [f.id, f.nome_razao_social] as const),
  );

  const qtyByCompra = new Map<string, number>();
  (itensCompraRes.data ?? []).forEach((item) => {
    qtyByCompra.set(
      item.pedido_compra_id,
      (qtyByCompra.get(item.pedido_compra_id) ?? 0) + Number(item.quantidade ?? 0),
    );
  });

  // Status mapping from Compras domain to Logística display status.
  // NOTE: This view does NOT substitute the real receiving process in Compras.
  // The status shown here is READ-ONLY from the Compras domain; changes to
  // receiving must be performed via the Compras module.
  const comprasStatusToLogistico: Record<string, string> = {
    rascunho:              "pedido_emitido",
    aprovado:              "pedido_emitido",
    enviado_ao_fornecedor: "aguardando_envio_fornecedor",
    aguardando_recebimento:"em_transito",
    parcialmente_recebido: "recebimento_parcial",
    recebido:              "recebido",
    cancelado:             "cancelado",
  };

  return (comprasRes.data ?? []).map((compra) => {
    const qtdPedida = qtyByCompra.get(compra.id) ?? 0;

    // Derive received quantity from the Compras status domain — no binary hack.
    // "recebido" → full quantity; "parcialmente_recebido" → approximate 50%;
    // otherwise 0 (we cannot know the real amount without a dedicated column).
    const comprasStatus = compra.status ?? "rascunho";
    let qtdRecebida = 0;
    if (comprasStatus === "recebido") {
      qtdRecebida = qtdPedida;
    } else if (comprasStatus === "parcialmente_recebido") {
      // Best-effort approximation until a real quantidade_recebida column is added.
      qtdRecebida = Math.round(qtdPedida / 2);
    }
    const pendencia = Math.max(0, qtdPedida - qtdRecebida);

    const statusLogistico =
      comprasStatusToLogistico[comprasStatus] ?? "pedido_emitido";

    return {
      id: compra.id,
      numero_compra: compra.numero ?? "—",
      fornecedor: fornecedorMap.get(compra.fornecedor_id ?? "") ?? "—",
      previsao_entrega: compra.data_entrega_prevista ?? null,
      data_recebimento: compra.data_entrega_real ?? null,
      quantidade_pedida: qtdPedida,
      quantidade_recebida: qtdRecebida,
      pendencia,
      status_logistico: statusLogistico,
      nf_vinculada: null,
      responsavel: compra.usuario_id ?? "—",
    };
  });
}

export function useRecebimentos() {
  return useQuery<Recebimento[], Error>({
    queryKey: ["recebimentos"],
    queryFn: fetchRecebimentos,
    staleTime: 2 * 60 * 1000,
  });
}
