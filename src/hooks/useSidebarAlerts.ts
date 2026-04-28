import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { subscribeAlerts } from "@/lib/realtime/alertsChannel";
import { fetchSidebarAlertsRaw } from "@/services/sidebarAlerts.service";

export interface SidebarAlerts {
  financeiroVencidos: number;
  financeiroVencer: number;
  estoqueBaixo: number;
  orcamentosPendentes: number;
  lastUpdatedAt?: string;
}

const QUERY_KEY = ["sidebar-alerts"] as const;

async function fetchSidebarAlerts(): Promise<SidebarAlerts> {
  const raw = await fetchSidebarAlertsRaw();
  return { ...raw, lastUpdatedAt: new Date().toISOString() };
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
