import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subscribeAlerts } from "@/lib/realtime/alertsChannel";

export interface SidebarAlerts {
  financeiroVencidos: number;
  financeiroVencer: number;
  estoqueBaixo: number;
  orcamentosPendentes: number;
  lastUpdatedAt?: string;
}

const QUERY_KEY = ["sidebar-alerts"] as const;

async function fetchSidebarAlerts(): Promise<SidebarAlerts> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const plus3 = new Date(now);
  plus3.setDate(now.getDate() + 3);
  const dueSoon = plus3.toISOString().slice(0, 10);

  const [
    { count: vencidos },
    { count: vencer },
    estoqueBaixoRes,
    { count: orcPendentes },
  ] = await Promise.all([
    supabase
      .from("financeiro_lancamentos")
      .select("*", { count: "exact", head: true })
      .eq("ativo", true)
      .in("status", ["aberto", "vencido"])
      .lt("data_vencimento", today),
    supabase
      .from("financeiro_lancamentos")
      .select("*", { count: "exact", head: true })
      .eq("ativo", true)
      .eq("status", "aberto")
      .gte("data_vencimento", today)
      .lte("data_vencimento", dueSoon),
    // Server-side count via SECURITY DEFINER RPC — payload is a single bigint
    // instead of dozens of KB of product rows.
    supabase.rpc("count_estoque_baixo" as never),
    supabase
      .from("orcamentos")
      .select("*", { count: "exact", head: true })
      .eq("ativo", true)
      .in("status", ["pendente", "aguardando_aprovacao", "em_analise"]),
  ]);

  const baixoCount = Number((estoqueBaixoRes as { data?: number | null }).data ?? 0);

  return {
    financeiroVencidos: vencidos || 0,
    financeiroVencer: vencer || 0,
    estoqueBaixo: baixoCount,
    orcamentosPendentes: orcPendentes || 0,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function useSidebarAlerts(): SidebarAlerts {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchSidebarAlerts,
    staleTime: 60 * 1000,
    refetchInterval: 90 * 1000,
    refetchOnWindowFocus: false,
  });

  // Realtime invalidation via shared singleton channel
  useEffect(() => {
    return subscribeAlerts(() => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    });
  }, [queryClient]);

  return (
    data ?? {
      financeiroVencidos: 0,
      financeiroVencer: 0,
      estoqueBaixo: 0,
      orcamentosPendentes: 0,
      lastUpdatedAt: undefined,
    }
  );
}
