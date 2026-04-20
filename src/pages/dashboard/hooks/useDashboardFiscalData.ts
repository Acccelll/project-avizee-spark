import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { summarizeFiscalStats } from "@/lib/dashboard/aggregations";
import type { DashboardDateRange, NfRow } from "./types";
import type { ScopeKind } from "@/components/dashboard/ScopeBadge";

interface FiscalData {
  fiscalStats: {
    emitidas: number;
    pendentes: number;
    canceladas: number;
    valorEmitidas: number;
  };
  _scope: ScopeKind;
}

export function useDashboardFiscalData(range?: DashboardDateRange) {
  const loadFiscalData = useCallback(async (): Promise<FiscalData> => {
    const now = new Date();
    const inicioMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const usingGlobal = !!(range?.dateFrom && range?.dateTo);
    const dateFrom = usingGlobal ? range!.dateFrom! : inicioMes;
    const dateTo = usingGlobal ? range!.dateTo : undefined;

    const scope: ScopeKind = usingGlobal
      ? { kind: "global-range", eixo: "data_emissao" }
      : { kind: "fixed-window", janela: "mes-atual" };

    try {
      let q = supabase
        .from("notas_fiscais")
        .select("status, valor_total")
        .eq("ativo", true)
        .gte("data_emissao", dateFrom);
      if (dateTo) q = q.lte("data_emissao", dateTo);
      const { data: nfStatsRows, error } = await q;

      if (error) {
        console.error("[dashboard:fiscal] erro ao carregar NFs:", error.message);
        return { fiscalStats: { emitidas: 0, pendentes: 0, canceladas: 0, valorEmitidas: 0 }, _scope: scope };
      }

      return {
        fiscalStats: summarizeFiscalStats((nfStatsRows ?? []) as NfRow[]),
        _scope: scope,
      };
    } catch (error) {
      console.error("[dashboard:fiscal] erro inesperado:", error);
      return { fiscalStats: { emitidas: 0, pendentes: 0, canceladas: 0, valorEmitidas: 0 }, _scope: scope };
    }
  }, [range]);

  return { loadFiscalData };
}
