import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const PARTIAL_RECEIPT_PENDING_MESSAGE =
  "Recebimento parcial informado no pedido, mas quantidade real pendente de consolidação.";

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
  recebimento_real: boolean;
  observacao_recebimento: string | null;
}

async function fetchRecebimentos(): Promise<Recebimento[]> {
  const [comprasRes, itensCompraRes, fornecedoresRes] = await Promise.all([
    supabase
      .from("pedidos_compra")
      .select(
        "id,numero,fornecedor_id,data_entrega_prevista,data_entrega_real,status,usuario_id,updated_at" as never,
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

  const comprasStatusToLogistico: Record<string, string> = {
    rascunho:              "pedido_emitido",
    aprovado:              "pedido_emitido",
    enviado_ao_fornecedor: "aguardando_envio_fornecedor",
    aguardando_recebimento:"em_transito",
    parcialmente_recebido: "recebimento_parcial",
    recebido:              "recebido",
    cancelado:             "cancelado",
  };

  type CompraRow = {
    id: string;
    numero: string | null;
    fornecedor_id: string | null;
    data_entrega_prevista: string | null;
    data_entrega_real: string | null;
    status: string | null;
    usuario_id: string | null;
  };
  const compras = (comprasRes.data ?? []) as unknown as CompraRow[];

  return compras.map((compra) => {
    const qtdPedida = qtyByCompra.get(compra.id) ?? 0;

    const comprasStatus = compra.status ?? "rascunho";
    let qtdRecebida = 0;
    let recebimentoReal = false;
    let observacaoRecebimento: string | null = null;
    if (comprasStatus === "recebido") {
      qtdRecebida = qtdPedida;
      recebimentoReal = true;
    } else if (comprasStatus === "parcialmente_recebido") {
      // Não simular quantidades no frontend: o parcial real depende de consolidação
      // de recebimento no fluxo canônico de Compras/backend.
      qtdRecebida = 0;
      observacaoRecebimento = PARTIAL_RECEIPT_PENDING_MESSAGE;
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
      recebimento_real: recebimentoReal,
      observacao_recebimento: observacaoRecebimento,
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
