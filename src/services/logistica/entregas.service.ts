import { supabase } from "@/integrations/supabase/client";
import type { Entrega } from "@/types/logistica";
import { logger } from "@/lib/logger";
import { fetchAllPages } from "@/services/_lib/fetchAllPages";

/**
 * Carrega a visão consolidada de entregas a partir de
 * `vw_entregas_consolidadas` e enriquece com `remessas` ativas
 * (id + código de rastreio) agrupadas por `ordem_venda_id`.
 *
 * Service único — extraído de `pages/logistica/hooks/useEntregas` na
 * onda I-04 (services boundary). A camada de UI consome via
 * `useEntregas` e nunca toca `supabase.from(...)` diretamente.
 */
export async function fetchEntregasConsolidadas(): Promise<Entrega[]> {
  type RemessaLite = { id: string; ordem_venda_id: string | null; codigo_rastreio: string | null };
  type ViewRow = {
    ordem_venda_id: string;
    numero_pedido: string | null;
    cliente: string | null;
    cidade: string | null;
    uf: string | null;
    transportadora: string | null;
    total_volumes: number | null;
    peso_total: number | null;
    previsao_envio: string | null;
    previsao_entrega: string | null;
    data_expedicao: string | null;
    data_entrega: string | null;
    status_consolidado: string;
    total_remessas: number | null;
    responsavel_nome?: string | null;
  };

  const [viewRows, remessasRows] = await Promise.all([
    fetchAllPages<ViewRow>(() =>
      supabase
        .from("vw_entregas_consolidadas")
        .select(
          "ordem_venda_id,numero_pedido,cliente,cidade,uf,transportadora," +
            "total_volumes,peso_total,previsao_envio,previsao_entrega," +
            "data_expedicao,data_entrega,status_consolidado,total_remessas," +
            "responsavel_nome",
        ) as never,
    ),
    fetchAllPages<RemessaLite>(() =>
      supabase
        .from("remessas")
        .select("id,ordem_venda_id,codigo_rastreio")
        .eq("ativo", true) as never,
    ).catch((err: Error) => {
      logger.warn("[fetchEntregasConsolidadas] falha ao carregar remessas:", err.message);
      return [] as RemessaLite[];
    }),
  ]);

  const remessasByOv = new Map<string, { id: string; codigo_rastreio: string | null }[]>();
  for (const r of remessasRows) {
    const key = r.ordem_venda_id ?? "";
    const list = remessasByOv.get(key) ?? [];
    list.push({ id: r.id, codigo_rastreio: r.codigo_rastreio });
    remessasByOv.set(key, list);
  }

  return viewRows.map((r) => {
    const remessas = remessasByOv.get(r.ordem_venda_id) ?? [];
    const count = Number(r.total_remessas ?? remessas.length);
    return {
      id: r.ordem_venda_id,
      numero_pedido: r.numero_pedido ?? "—",
      cliente: r.cliente ?? "—",
      cidade_uf: [r.cidade, r.uf].filter(Boolean).join("/") || "—",
      transportadora: r.transportadora ?? "—",
      volumes: Number(r.total_volumes ?? 0),
      peso_total: Number(r.peso_total ?? 0),
      previsao_envio: r.previsao_envio,
      previsao_entrega: r.previsao_entrega,
      data_expedicao: r.data_expedicao,
      data_entrega: r.data_entrega,
      status_logistico: r.status_consolidado,
      responsavel: r.responsavel_nome ?? "—",
      codigo_rastreio: remessas[0]?.codigo_rastreio ?? null,
      remessas_count: count,
      remessa_ids: remessas.map((x) => x.id),
      exibicao_remessas: count === 0 ? "nenhuma" : count === 1 ? "unica" : "multipla",
      status_fonte: count === 0 ? "sem_remessa" : count === 1 ? "remessa_unica" : "ultima_remessa",
    };
  });
}