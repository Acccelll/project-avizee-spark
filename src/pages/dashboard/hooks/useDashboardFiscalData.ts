import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { summarizeFiscalStats } from "@/lib/dashboard/aggregations";
import type { DashboardDateRange, NfRow } from "./types";
import type { ScopeKind } from "@/components/dashboard/ScopeBadge";
import { logger } from "@/lib/logger";
import { fetchAllPages } from "@/services/relatorios/lib/fetchAllPages";

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
      const nfStatsRows = await fetchAllPages<NfRow>(() => {
        let q = supabase.from("notas_fiscais")
          .select("status, valor_total").eq("ativo", true).gte("data_emissao", dateFrom);
        if (dateTo) q = q.lte("data_emissao", dateTo);
        return q.order("data_emissao", { ascending: false });
      }, {
        onTruncated: () => { throw new Error("Dashboard fiscal: consulta excedeu o limite seguro"); },
      });

      return { fiscalStats: summarizeFiscalStats(nfStatsRows), _scope: scope };
    } catch (error) {
      logger.error("[dashboard:fiscal] erro inesperado:", error);
      throw error;
    }
  }, [range]);

  return { loadFiscalData };
}
