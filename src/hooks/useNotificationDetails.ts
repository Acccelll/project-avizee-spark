import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CriticalProduct {
  id: string;
  nome: string;
  estoque_atual: number;
  estoque_minimo: number;
}

export interface NotificationDetails {
  comprasAguardandoCount: number;
  ovsAguardandoCount: number;
  topCriticalProducts: CriticalProduct[];
}

async function fetchNotificationDetails(): Promise<NotificationDetails> {
  // Lightweight fetches — only run when the panel is open.
  // We keep the per-product preview limited to 20 items to avoid large payloads.
  const [
    { count: comprasAguardandoCount },
    { count: ovsAguardandoCount },
    { data: estoque },
  ] = await Promise.all([
    supabase
      .from("pedidos_compra")
      .select("*", { count: "exact", head: true })
      .eq("ativo", true)
      .in("status", [
        "aprovado",
        "enviado_ao_fornecedor",
        "aguardando_recebimento",
        "parcialmente_recebido",
      ])
      .is("data_entrega_real", null),
    supabase
      .from("ordens_venda")
      .select("*", { count: "exact", head: true })
      .eq("ativo", true)
      .in("status", ["aprovada", "em_separacao"])
      .in("status_faturamento", ["aguardando", "parcial"]),
    supabase
      .from("produtos")
      .select("id, nome, estoque_atual, estoque_minimo")
      .eq("ativo", true)
      .gt("estoque_minimo", 0)
      .order("estoque_atual", { ascending: true })
      .limit(20),
  ]);

  const topCriticalProducts: CriticalProduct[] = ((estoque || []) as CriticalProduct[])
    .filter((p) => Number(p.estoque_atual || 0) <= Number(p.estoque_minimo || 0))
    .slice(0, 5);

  return {
    comprasAguardandoCount: comprasAguardandoCount || 0,
    ovsAguardandoCount: ovsAguardandoCount || 0,
    topCriticalProducts,
  };
}

/**
 * Detailed notification data — fetched lazily only when the panel is open.
 * For passive counts (vencidos, estoque baixo, orçamentos pendentes), use
 * `useSidebarAlerts` instead.
 */
export function useNotificationDetails(open: boolean) {
  return useQuery({
    queryKey: ["notification-details"],
    queryFn: fetchNotificationDetails,
    enabled: open,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
