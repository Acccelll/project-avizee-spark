import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { aggregateDailyVendas, aggregateTopProdutos, buildIsoDayRange, sumNfValues } from "@/lib/dashboard/aggregations";
import { OPEN_ORCAMENTO_STATUSES } from "@/lib/comercialStatuses";
import type { BacklogOv, DashboardDateRange, DailyNfRow, NfItemRow, NfRow, RecentOrcamento, TopPoint } from "./types";
import { logger } from "@/lib/logger";

/** Pedidos registrados no orçamento que ainda têm saldo a faturar. */
const PEDIDO_STATUSES = ["aprovado", "convertido"];
const PEDIDO_EM_ABERTO = ["aberto", "parcial"];

interface ComercialData {
  /** Cotações abertas (non-terminal) in the selected period. */
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
    const fimMesAnterior = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

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
        nfAtualResult,
        nfAnteriorResult,
        dailyVendasResult,
        itensResult,
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
        // Preview list (capped at 15) for the UI detail view.
        supabase
          .from("orcamentos")
          .select("id, numero, pedido_cliente, valor_total, data_pedido_cliente, previsao_despacho, faturamento_status, clientes(nome_razao_social)")
          .eq("ativo", true)
          .in("status", PEDIDO_STATUSES)
          .in("faturamento_status", PEDIDO_EM_ABERTO)
          .order("previsao_despacho", { ascending: true, nullsFirst: false })
          .limit(15),
        // Real total count for alert/KPI badges.
        supabase
          .from("orcamentos")
          .select("id", { count: "exact", head: true })
          .eq("ativo", true)
          .in("status", PEDIDO_STATUSES)
          .in("faturamento_status", PEDIDO_EM_ABERTO),
        supabase
          .from("notas_fiscais")
          .select("valor_total")
          .eq("ativo", true)
          .eq("tipo", "saida")
          .in("status", ["confirmada", "importada"])
          .gte("data_emissao", inicioMesAtual),
        supabase
          .from("notas_fiscais")
          .select("valor_total")
          .eq("ativo", true)
          .eq("tipo", "saida")
          .in("status", ["confirmada", "importada"])
          .gte("data_emissao", inicioMesAnterior)
          .lt("data_emissao", fimMesAnterior),
        supabase
          .from("notas_fiscais")
          .select("data_emissao, valor_total")
          .eq("ativo", true)
          .eq("tipo", "saida")
          .in("status", ["confirmada", "importada"])
          .in("data_emissao", lastDays),
        (() => {
          let q = supabase
            .from("notas_fiscais_itens")
            .select("quantidade, valor_unitario, produtos(nome), notas_fiscais!inner(status, tipo, data_emissao)")
            .in("notas_fiscais.status", ["confirmada", "importada"])
            .eq("notas_fiscais.tipo", "saida")
            .gte("notas_fiscais.data_emissao", itensFrom);
          if (itensTo) q = q.lte("notas_fiscais.data_emissao", itensTo);
          return q;
        })(),
      ]);

      if (orcamentosResult.error) logger.error("[dashboard:comercial] orcamentos:", orcamentosResult.error.message);
      if (backlogResult.error) logger.error("[dashboard:comercial] backlog:", backlogResult.error.message);
      if (nfAtualResult.error) logger.error("[dashboard:comercial] nfAtual:", nfAtualResult.error.message);

      const nfAtual = (nfAtualResult.data ?? []) as NfRow[];

      return {
        orcamentos: orcamentosResult.count ?? 0,
        recentOrcamentos: (orcRecentResult.data ?? []) as RecentOrcamento[],
        backlogOVs: (backlogResult.data ?? []) as BacklogOv[],
        backlogOVsCount: backlogCountResult.count ?? 0,
        faturamento: {
          mesAtual: sumNfValues(nfAtual),
          mesAnterior: sumNfValues((nfAnteriorResult.data ?? []) as NfRow[]),
          nfAtualCount: nfAtual.length,
        },
        dailyVendas: aggregateDailyVendas(lastDays, (dailyVendasResult.data ?? []) as DailyNfRow[]),
        topProdutos: aggregateTopProdutos((itensResult.data ?? []) as NfItemRow[]),
      };
    } catch (error) {
      logger.error("[dashboard:comercial] erro inesperado:", error);
      return {
        orcamentos: 0,
        recentOrcamentos: [],
        backlogOVs: [],
        backlogOVsCount: 0,
        faturamento: { mesAtual: 0, mesAnterior: 0, nfAtualCount: 0 },
        dailyVendas: [],
        topProdutos: [],
      };
    }
  }, [range]);

  return { loadComercialData };
}
