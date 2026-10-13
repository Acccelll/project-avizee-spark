import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { aggregateDailyFinanceiro, aggregateTopClientes, buildIsoDayRange, sumOpenFinanceiro } from "@/lib/dashboard/aggregations";
import type { DailyFinRow, DashboardDateRange, FinRow, RecDataRow } from "./types";
import { fetchAllPages } from "@/services/relatorios/lib/fetchAllPages";

interface FinanceiroData {
  contasReceber: number;
  contasPagar: number;
  contasVencidas: number;
  totalReceber: number;
  totalPagar: number;
  vencimentosHoje: { receber: number; pagar: number };
  dailyReceber: Array<{ dia: string; valor: number }>;
  dailyPagar: Array<{ dia: string; valor: number }>;
  topClientes: Array<{ nome: string; valor: number }>;
}

export function useDashboardFinanceiroData(range: DashboardDateRange) {
  const loadFinanceiroData = useCallback(async (): Promise<FinanceiroData> => {
    const { dateFrom, dateTo } = range;
    const local = new Date();
    const today = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;

    // KPIs "A Receber" / "A Pagar" são SNAPSHOT atual: não respeitam o
    // período global do dashboard. Saldo em aberto existe hoje independente
    // da janela. Top clientes e gráficos diários continuam respeitando o
    // período mais abaixo.
    const nextDays = buildIsoDayRange(0, 7);
    // Todas as consultas agregadas são paginadas e ordenadas por PK, evitando
    // truncamento no limite padrão de 1.000 registros do PostgREST.
    const allPages = <T,>(factory: () => unknown): Promise<T[]> =>
      fetchAllPages<T>(() => factory() as never, {
        onTruncated: () => { throw new Error("Dashboard financeiro: volume além do limite seguro"); },
      });
    const open = () => supabase.from("financeiro_lancamentos")
      .select("id, tipo, valor, saldo_restante, status, data_vencimento")
      .eq("ativo", true).in("status", ["aberto", "vencido", "parcial"])
      .gt("saldo_restante", 0);
    const [todos, receberHojeResult, pagarHojeResult, recData] = await Promise.all([
      allPages<FinRow & { id: string; tipo: "receber" | "pagar"; data_vencimento: string }>(
        () => open().order("id")),
      supabase.from("financeiro_lancamentos").select("id", { count: "exact", head: true })
        .eq("ativo", true).eq("tipo", "receber")
        .in("status", ["aberto", "parcial", "vencido"])
        .gt("saldo_restante", 0).eq("data_vencimento", today),
      supabase.from("financeiro_lancamentos").select("id", { count: "exact", head: true })
        .eq("ativo", true).eq("tipo", "pagar")
        .in("status", ["aberto", "parcial", "vencido"])
        .gt("saldo_restante", 0).eq("data_vencimento", today),
      allPages<RecDataRow>(() => {
        let q = supabase.from("financeiro_lancamentos")
          .select("id, valor, saldo_restante, status, clientes(nome_razao_social)")
          .eq("ativo", true).eq("tipo", "receber")
          .in("status", ["aberto", "vencido", "parcial"])
          .gt("saldo_restante", 0);
        if (dateFrom) q = q.gte("data_vencimento", dateFrom);
        if (dateTo) q = q.lte("data_vencimento", dateTo);
        return q.order("id");
      }),
    ]);
    if (receberHojeResult.error || pagarHojeResult.error) {
      throw new Error("Dashboard financeiro: falha ao consultar vencimentos de hoje");
    }
    const receber = todos.filter((r) => r.tipo === "receber");
    const pagar = todos.filter((r) => r.tipo === "pagar");
    const overdue = todos.filter((r) => r.data_vencimento < today);
    const dailyReceber = receber.filter((r) => nextDays.includes(r.data_vencimento));
    const dailyPagar = pagar.filter((r) => nextDays.includes(r.data_vencimento));

    return {
      contasReceber: receber.length,
      contasPagar: pagar.length,
      contasVencidas: overdue.length,
      totalReceber: sumOpenFinanceiro(receber),
      totalPagar: sumOpenFinanceiro(pagar),
      vencimentosHoje: { receber: receberHojeResult.count ?? 0, pagar: pagarHojeResult.count ?? 0 },
      dailyReceber: aggregateDailyFinanceiro(nextDays, dailyReceber),
      dailyPagar: aggregateDailyFinanceiro(nextDays, dailyPagar),
      topClientes: aggregateTopClientes(recData),
    };
  }, [range]);

  return { loadFinanceiroData };
}
