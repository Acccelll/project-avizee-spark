import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CompraAguardando, DashboardDateRange } from "./types";

/**
 * Local-date YYYY-MM-DD (avoids UTC off-by-one in BRT-3 sessions).
 * Mirrors the implementation in DashboardPeriodContext to keep cutoffs
 * consistent with the rest of the dashboard.
 */
function todayLocalIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface AuxData {
  clientes: number;
  fornecedores: number;
  compras: number;
  comprasAguardando: CompraAguardando[];
  /** Real count of compras with overdue delivery date (not capped by the preview list). */
  comprasAtrasadasCount: number;
  remessasAtrasadas: number;
}

export function useDashboardAuxData(range: DashboardDateRange) {
  const loadAuxData = useCallback(async (): Promise<AuxData> => {
    const { dateFrom, dateTo } = range;
    const today = todayLocalIso();

    try {
      const [
        clientesResult,
        fornecedoresResult,
        comprasResult,
        comprasAguardandoResult,
        comprasAtrasadasResult,
        remessasAtrasadasResult,
      ] = await Promise.all([
        supabase.from("clientes").select("*", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("fornecedores").select("*", { count: "exact", head: true }).eq("ativo", true),
        supabase
          .from("pedidos_compra")
          .select("*", { count: "exact", head: true })
          .eq("ativo", true)
          .gte("data_pedido", dateFrom)
          .lte("data_pedido", dateTo),
        // Preview list for the Logística block UI (capped at 10).
        supabase
          .from("pedidos_compra")
          .select("id, numero, valor_total, data_pedido, data_entrega_prevista, fornecedores(nome_razao_social)")
          .eq("ativo", true)
          .in("status", ["aprovado", "enviado_ao_fornecedor", "aguardando_recebimento", "parcialmente_recebido"])
          .is("data_entrega_real", null)
          .order("data_entrega_prevista", { ascending: true })
          .limit(10),
        // Real count of overdue deliveries for alert badges (no list limit).
        supabase
          .from("pedidos_compra")
          .select("*", { count: "exact", head: true })
          .eq("ativo", true)
          .in("status", ["aprovado", "enviado_ao_fornecedor", "aguardando_recebimento", "parcialmente_recebido"])
          .is("data_entrega_real", null)
          .lt("data_entrega_prevista", today),
        // Exclude "devolvido" in addition to "entregue"/"cancelado" so returned
        // shipments are not counted as overdue.
        supabase
          .from("remessas")
          .select("id", { count: "exact", head: true })
          .lt("previsao_entrega", today)
          .not("status_transporte", "in", '("entregue","cancelado","devolvido")'),
      ]);

      if (clientesResult.error) console.error("[dashboard:aux] clientes:", clientesResult.error.message);
      if (remessasAtrasadasResult.error) console.error("[dashboard:aux] remessas:", remessasAtrasadasResult.error.message);

      return {
        clientes: clientesResult.count ?? 0,
        fornecedores: fornecedoresResult.count ?? 0,
        compras: comprasResult.count ?? 0,
        comprasAguardando: (comprasAguardandoResult.data ?? []) as CompraAguardando[],
        comprasAtrasadasCount: comprasAtrasadasResult.count ?? 0,
        remessasAtrasadas: remessasAtrasadasResult.count ?? 0,
      };
    } catch (error) {
      console.error("[dashboard:aux] erro inesperado:", error);
      return {
        clientes: 0,
        fornecedores: 0,
        compras: 0,
        comprasAguardando: [],
        comprasAtrasadasCount: 0,
        remessasAtrasadas: 0,
      };
    }
  }, [range]);

  return { loadAuxData };
}
