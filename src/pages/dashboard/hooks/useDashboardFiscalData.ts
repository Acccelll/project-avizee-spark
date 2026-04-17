import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { summarizeFiscalStats } from "@/lib/dashboard/aggregations";
import type { NfRow } from "./types";

interface FiscalData {
  fiscalStats: {
    emitidas: number;
    pendentes: number;
    canceladas: number;
    valorEmitidas: number;
  };
}

export function useDashboardFiscalData() {
  const loadFiscalData = useCallback(async (): Promise<FiscalData> => {
    const now = new Date();
    const inicioMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    try {
      const { data: nfStatsRows, error } = await supabase
        .from("notas_fiscais")
        .select("status, valor_total")
        .eq("ativo", true)
        .gte("data_emissao", inicioMes);

      if (error) {
        console.error("[dashboard:fiscal] erro ao carregar NFs:", error.message);
        return { fiscalStats: { emitidas: 0, pendentes: 0, canceladas: 0, valorEmitidas: 0 } };
      }

      return {
        fiscalStats: summarizeFiscalStats((nfStatsRows ?? []) as NfRow[]),
      };
    } catch (error) {
      console.error("[dashboard:fiscal] erro inesperado:", error);
      return { fiscalStats: { emitidas: 0, pendentes: 0, canceladas: 0, valorEmitidas: 0 } };
    }
  }, []);

  return { loadFiscalData };
}
