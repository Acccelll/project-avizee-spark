import { supabase } from "@/integrations/supabase/client";

export interface SidebarAlertsRaw {
  financeiroVencidos: number;
  financeiroVencer: number;
  estoqueBaixo: number;
  orcamentosPendentes: number;
}

export async function fetchSidebarAlertsRaw(): Promise<SidebarAlertsRaw> {
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
  };
}