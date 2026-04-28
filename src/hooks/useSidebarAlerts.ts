import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { subscribeAlerts } from "@/lib/realtime/alertsChannel";
import { fetchSidebarAlertsRaw } from "@/services/sidebarAlerts.service";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export interface SidebarAlerts {
  financeiroVencidos: number;
  financeiroVencer: number;
  estoqueBaixo: number;
  orcamentosPendentes: number;
  nfRejeitadas: number;
  filaEmailDLQ: number;
  lastUpdatedAt?: string;
}

export function useSidebarAlerts(): SidebarAlerts {
  const queryClient = useQueryClient();
  const { isAdmin } = useIsAdmin();

  // Query key inclui o flag admin: assim, quando o usuário recebe/perde a role,
  // o cache é invalidado naturalmente e o DLQ aparece/some sem refresh manual.
  const queryKey = ["sidebar-alerts", { isAdmin }] as const;

  const { data } = useQuery({
    queryKey,
    queryFn: async (): Promise<SidebarAlerts> => {
      const raw = await fetchSidebarAlertsRaw({ isAdmin });
      return { ...raw, lastUpdatedAt: new Date().toISOString() };
    },
    staleTime: 60 * 1000,
    refetchInterval: 90 * 1000,
    refetchOnWindowFocus: false,
  });

  // Realtime invalidation via shared singleton channel
  useEffect(() => {
    return subscribeAlerts(() => {
      queryClient.invalidateQueries({ queryKey: ["sidebar-alerts"] });
    });
  }, [queryClient]);

  return (
    data ?? {
      financeiroVencidos: 0,
      financeiroVencer: 0,
      estoqueBaixo: 0,
      orcamentosPendentes: 0,
      nfRejeitadas: 0,
      filaEmailDLQ: 0,
      lastUpdatedAt: undefined,
    }
  );
}
