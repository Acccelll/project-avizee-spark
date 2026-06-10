import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/services/relatorios/lib/fetchAllPages";

/**
 * Carrega o conjunto de IDs de notas fiscais cujos lançamentos financeiros
 * vencem no mês `vencimentoMes` (formato `YYYY-MM`). Usado pelo filtro/badge
 * "vence neste mês" na grid de Fiscal.
 *
 * Recebe o setter externamente porque `vencimentoNotaIds` precisa ser
 * declarado ANTES de `useFiscalFilters` (que o consome) — ordem de hooks no
 * orquestrador. Extraído de `src/pages/Fiscal.tsx` (Frente 1 — decomposição).
 * Mantém o `fetchAllPages` introduzido na Frente 4.
 */
export function useFiscalVencimentosLoader(
  vencimentoMes: string | null | undefined,
  setVencimentoNotaIds: (set: Set<string> | null) => void,
) {
  useEffect(() => {
    if (!vencimentoMes) {
      setVencimentoNotaIds(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const start = vencimentoMes + "-01";
      const [y, m] = vencimentoMes.split("-").map(Number);
      const endDate = new Date(y, m, 0);
      const end = endDate.toISOString().slice(0, 10);
      let rows: Array<{ nota_fiscal_id: string | null }> = [];
      try {
        rows = await fetchAllPages<{ nota_fiscal_id: string | null }>(() =>
          supabase
            .from("financeiro_lancamentos")
            .select("nota_fiscal_id")
            .eq("ativo", true)
            .not("nota_fiscal_id", "is", null)
            .gte("data_vencimento", start)
            .lte("data_vencimento", end),
        );
      } catch {
        if (cancelled) return;
        setVencimentoNotaIds(new Set());
        return;
      }
      if (cancelled) return;
      const set = new Set<string>();
      (rows || []).forEach((r) => {
        if (r.nota_fiscal_id) set.add(r.nota_fiscal_id as string);
      });
      setVencimentoNotaIds(set);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setter é estável (useState)
  }, [vencimentoMes]);
}