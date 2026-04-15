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

    const { data: nfStatsRows } = await supabase
      .from("notas_fiscais")
      .select("status, valor_total")
      .eq("ativo", true)
      .gte("data_emissao", inicioMes);

    return {
      fiscalStats: summarizeFiscalStats((nfStatsRows ?? []) as NfRow[]),
    };
  }, []);

  return { loadFiscalData };
}
