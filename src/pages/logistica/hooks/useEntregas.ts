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
  remessas_count: number;
  remessa_ids: string[];
  exibicao_remessas: "nenhuma" | "unica" | "multipla";
  status_fonte: "sem_remessa" | "remessa_unica" | "ultima_remessa";
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
          "id,numero,cliente_id,data_prometida_despacho,usuario_id,created_at,updated_at" as never,
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
  type RemessaRow = NonNullable<typeof remessasRes.data>[number];
  const remessasByPedido = new Map<string, RemessaRow[]>();
  for (const r of remessasRes.data ?? []) {
    const key = r.ordem_venda_id ?? "";
    const list = remessasByPedido.get(key) ?? [];
    list.push(r);
    remessasByPedido.set(key, list);
  }

  const pesoByOrder = new Map<string, { peso: number; qtd: number }>();
  (itensOvRes.data ?? []).forEach((item) => {
    const current = pesoByOrder.get(item.ordem_venda_id) ?? { peso: 0, qtd: 0 };
    pesoByOrder.set(item.ordem_venda_id, {
      peso: current.peso + Number(item.peso_total ?? 0),
      qtd: current.qtd + Number(item.quantidade ?? 0),
    });
  });

  type OrdemRow = {
    id: string;
    numero: string | null;
    cliente_id: string | null;
    data_prometida_despacho: string | null;
    usuario_id: string | null;
  };
  const ordens = (ordensRes.data ?? []) as unknown as OrdemRow[];

  return ordens.map((ov) => {
    const remessas = (remessasByPedido.get(ov.id) ?? []).sort(
      (a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""),
    );
    const remessa = remessas[0];
    const cliente = clienteMap.get(ov.cliente_id ?? "");
    const pesoQtd = pesoByOrder.get(ov.id) ?? { peso: 0, qtd: 0 };
    const remessasCount = remessas.length;

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
      remessas_count: remessasCount,
      remessa_ids: remessas.map((r) => r.id),
      exibicao_remessas:
        remessasCount === 0 ? "nenhuma" : remessasCount === 1 ? "unica" : "multipla",
      status_fonte:
        remessasCount === 0 ? "sem_remessa" : remessasCount === 1 ? "remessa_unica" : "ultima_remessa",
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
