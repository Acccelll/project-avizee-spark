import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { aggregateDailyVendas, aggregateTopProdutos, buildIsoDayRange, sumNfValues } from "@/lib/dashboard/aggregations";
import { OPEN_ORCAMENTO_STATUSES, BACKLOG_OV_STATUSES, BACKLOG_FATURAMENTO_STATUSES } from "@/lib/comercialStatuses";
import type { BacklogOv, DashboardDateRange, DailyNfRow, NfItemRow, NfRow, RecentOrcamento, TopPoint } from "./types";
import { logger } from "@/lib/logger";
import { fetchAllPages } from "@/services/relatorios/lib/fetchAllPages";

/** Pedidos registrados no orçamento que ainda têm saldo a faturar. */

interface ComercialData {
  /** Orçamentos não-terminais do sistema, independentemente do período. */
  orcamentos: number;
  recentOrcamentos: RecentOrcamento[];
  backlogOVs: BacklogOv[];
  /** Real count of OVs awaiting faturamento (not limited by the preview list). */
  backlogOVsCount: number;
  faturamento: { mesAtual: number; mesAnterior: number; nfAtualCount: number };
  dailyVendas: Array<{ dia: string; valor: number }>;
  topProdutos: TopPoint[];
}

export function useDashboardComercialData(range: DashboardDateRange) {
  const loadComercialData = useCallback(async (): Promise<ComercialData> => {
    const { dateFrom, dateTo } = range;

    const now = new Date();
    const inicioMesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const inicioMesAnterior = (() => {
      const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
    })();
    const fimMesAnterior = inicioMesAtual;
    const proximoMes = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const inicioProximoMes = `${proximoMes.getFullYear()}-${String(proximoMes.getMonth() + 1).padStart(2, "0")}-01`;

    const lastDays = buildIsoDayRange(-6, 7);

    try {
      // For top produtos: respect global range when explicit; fallback to mês atual.
      const usingGlobalRange = !!(dateFrom && dateTo);
      const itensFrom = usingGlobalRange ? dateFrom : inicioMesAtual;
      const itensTo = usingGlobalRange ? dateTo : undefined;

      const [
        orcamentosResult,
        orcRecentResult,
        backlogResult,
        backlogCountResult,
      ] = await Promise.all([
        // Snapshot: orçamentos abertos (não-terminais) — sem filtro de período,
        // para se alinhar a `pedidosPendentes` (também snapshot) no bloco
        // Comercial e a doutrina de "backlog real".
        supabase
          .from("orcamentos")
          .select("*", { count: "exact", head: true })
          .eq("ativo", true)
          .neq("origem", "importacao_historica")
          .in("status", OPEN_ORCAMENTO_STATUSES),
        // Últimos 5 orçamentos criados — independe de período.
        supabase
          .from("orcamentos")
          .select("id, numero, valor_total, status, data_orcamento, clientes(nome_razao_social)")
          .eq("ativo", true)
          .neq("origem", "importacao_historica")
          .order("created_at", { ascending: false })
          .limit(5),
        // Backlog é da entidade canônica ordens_venda, não de orçamentos.
        supabase.from("ordens_venda")
          .select("id, numero, pedido_cliente_ref, valor_total, data_po_cliente, data_prometida_despacho, status_faturamento, clientes:cliente_id(nome_razao_social)")
          .eq("ativo", true)
          .in("status", [...BACKLOG_OV_STATUSES])
          .in("status_faturamento", [...BACKLOG_FATURAMENTO_STATUSES])
          .order("data_prometida_despacho", { ascending: true, nullsFirst: false })
          .limit(15),
        supabase.from("ordens_venda")
          .select("id", { count: "exact", head: true })
          .eq("ativo", true)
          .in("status", [...BACKLOG_OV_STATUSES])
          .in("status_faturamento", [...BACKLOG_FATURAMENTO_STATUSES]),
      ]);

      // Paginação explícita evita totais silenciosamente truncados pelo limite do PostgREST.
      // Se o teto de segurança for alcançado, a consulta falha em vez de mostrar um número parcial.
      const allPages = <T,>(build: () => unknown): Promise<T[]> =>
        fetchAllPages<T>(() => build() as never, {
          onTruncated: () => { throw new Error("Dashboard comercial: volume ultrapassou limite seguro de consulta"); },
        });

      const nfBase = () => supabase.from("notas_fiscais")
        .select("valor_total").eq("ativo", true).eq("tipo", "saida")
        .in("status", ["confirmada", "importada"]);
      const [nfAtual, nfAnterior, dailyVendas, itens] = await Promise.all([
        allPages<NfRow>(() => nfBase().gte("data_emissao", inicioMesAtual).lt("data_emissao", inicioProximoMes)),
        allPages<NfRow>(() => nfBase().gte("data_emissao", inicioMesAnterior).lt("data_emissao", fimMesAnterior)),
        allPages<DailyNfRow>(() => supabase.from("notas_fiscais")
          .select("data_emissao, valor_total").eq("ativo", true).eq("tipo", "saida")
          .in("status", ["confirmada", "importada"]).in("data_emissao", lastDays)),
        allPages<NfItemRow>(() => {
          let q = supabase.from("notas_fiscais_itens")
            .select("quantidade, valor_unitario, produtos(nome), notas_fiscais!inner(status, tipo, data_emissao, ativo)")
            .eq("notas_fiscais.ativo", true)
            .in("notas_fiscais.status", ["confirmada", "importada"])
            .eq("notas_fiscais.tipo", "saida")
            .gte("notas_fiscais.data_emissao", itensFrom);
          if (itensTo) q = q.lte("notas_fiscais.data_emissao", itensTo);
          return q;
        }),
      ]);
      for (const [label, result] of [
        ["orcamentos", orcamentosResult], ["recentes", orcRecentResult],
        ["pedidos", backlogResult], ["pedidos-contagem", backlogCountResult],
      ] as const) {
        if (result.error) throw new Error(`Dashboard comercial (${label}): ${result.error.message}`);
      }

      return {
        orcamentos: orcamentosResult.count ?? 0,
        recentOrcamentos: (orcRecentResult.data ?? []) as RecentOrcamento[],
        backlogOVs: (backlogResult.data ?? []).map((ov) => ({
          id: ov.id, numero: ov.numero, pedido_cliente: ov.pedido_cliente_ref,
          valor_total: ov.valor_total, data_pedido_cliente: ov.data_po_cliente,
          previsao_despacho: ov.data_prometida_despacho,
          faturamento_status: ov.status_faturamento,
          clientes: ov.clientes,
        })) as BacklogOv[],
        backlogOVsCount: backlogCountResult.count ?? 0,
        faturamento: {
          mesAtual: sumNfValues(nfAtual),
          mesAnterior: sumNfValues(nfAnterior),
          nfAtualCount: nfAtual.length,
        },
        dailyVendas: aggregateDailyVendas(lastDays, dailyVendas),
        topProdutos: aggregateTopProdutos(itens),
      };
    } catch (error) {
      logger.error("[dashboard:comercial] erro inesperado:", error);
      throw error;
    }
  }, [range]);

  return { loadComercialData };
}
