import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Entrega {
  id: string;
  numero_pedido: string;
  cliente: string;
  cidade_uf: string;
  transportadora: string;
  volumes: number;
  peso_total: number;
  previsao_envio: string | null;
  previsao_entrega: string | null;
  data_expedicao: string | null;
  status_logistico: string;
  responsavel: string;
  codigo_rastreio: string | null;
}

export interface EntregaFilters {
  search?: string;
  status?: string[];
  transportadora?: string[];
}

async function fetchEntregas(): Promise<Entrega[]> {
  const [ordensRes, remessasRes, clientesRes, transportadorasRes, itensOvRes] =
    await Promise.all([
      supabase
        .from("ordens_venda")
        .select(
          "id,numero,cliente_id,data_prometida_despacho,usuario_id,created_at,updated_at",
        )
        .eq("ativo", true),
      supabase
        .from("remessas")
        .select(
          "id,ordem_venda_id,transportadora_id,status_transporte,data_postagem,previsao_entrega,volumes,peso,codigo_rastreio,updated_at",
        )
        .eq("ativo", true),
      supabase.from("clientes").select("id,nome_razao_social,cidade,uf").eq("ativo", true),
      supabase.from("transportadoras").select("id,nome_razao_social").eq("ativo", true),
      supabase.from("ordens_venda_itens").select("ordem_venda_id,peso_total,quantidade"),
    ]);

  const clienteMap = new Map(
    (clientesRes.data ?? []).map((c) => [c.id, c] as const),
  );
  const transportadoraMap = new Map(
    (transportadorasRes.data ?? []).map((t) => [t.id, t.nome_razao_social] as const),
  );
  const remessaByPedido = new Map(
    (remessasRes.data ?? []).map((r) => [r.ordem_venda_id ?? "", r] as const),
  );

  const pesoByOrder = new Map<string, { peso: number; qtd: number }>();
  (itensOvRes.data ?? []).forEach((item) => {
    const current = pesoByOrder.get(item.ordem_venda_id) ?? { peso: 0, qtd: 0 };
    pesoByOrder.set(item.ordem_venda_id, {
      peso: current.peso + Number(item.peso_total ?? 0),
      qtd: current.qtd + Number(item.quantidade ?? 0),
    });
  });

  return (ordensRes.data ?? []).map((ov) => {
    const remessa = remessaByPedido.get(ov.id);
    const cliente = clienteMap.get(ov.cliente_id ?? "");
    const pesoQtd = pesoByOrder.get(ov.id) ?? { peso: 0, qtd: 0 };

    return {
      id: ov.id,
      numero_pedido: ov.numero ?? "—",
      cliente: cliente?.nome_razao_social ?? "—",
      cidade_uf: [cliente?.cidade, cliente?.uf].filter(Boolean).join("/") || "—",
      transportadora: transportadoraMap.get(remessa?.transportadora_id ?? "") ?? "—",
      volumes: Number(remessa?.volumes ?? 0),
      peso_total: Number(remessa?.peso ?? pesoQtd.peso ?? 0),
      previsao_envio: ov.data_prometida_despacho ?? null,
      previsao_entrega: remessa?.previsao_entrega ?? null,
      data_expedicao: remessa?.data_postagem ?? null,
      status_logistico: remessa?.status_transporte ?? "aguardando_separacao",
      responsavel: ov.usuario_id ?? "—",
      codigo_rastreio: remessa?.codigo_rastreio ?? null,
    };
  });
}

export function useEntregas() {
  return useQuery<Entrega[], Error>({
    queryKey: ["entregas"],
    queryFn: fetchEntregas,
    staleTime: 2 * 60 * 1000,
  });
}
