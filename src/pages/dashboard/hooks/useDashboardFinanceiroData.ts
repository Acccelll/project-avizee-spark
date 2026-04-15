import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { aggregateDailyFinanceiro, aggregateTopClientes, buildIsoDayRange, sumOpenFinanceiro } from "@/lib/dashboard/aggregations";
import type { DailyFinRow, DashboardDateRange, FinRow, RecDataRow } from "./types";

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
    const today = new Date().toISOString().slice(0, 10);

    const buildTotalQuery = (tipo: "receber" | "pagar") => {
      let query = supabase
        .from("financeiro_lancamentos")
        .select("valor, saldo_restante, status")
        .eq("tipo", tipo)
        .eq("ativo", true)
        .in("status", ["aberto", "vencido", "parcial"]);

      if (dateFrom) query = query.gte("data_vencimento", dateFrom);
      if (dateTo) query = query.lte("data_vencimento", dateTo);

      return query;
    };

    const nextDays = buildIsoDayRange(0, 7);

    const [
      { data: receberRows },
      { data: pagarRows },
      { data: vencidasRows },
      { count: receberHoje },
      { count: pagarHoje },
      { data: recData },
      { data: dailyReceberRows },
      { data: dailyPagarRows },
    ] = await Promise.all([
      buildTotalQuery("receber"),
      buildTotalQuery("pagar"),
      supabase.from("financeiro_lancamentos").select("valor").eq("status", "vencido").eq("ativo", true),
      supabase
        .from("financeiro_lancamentos")
        .select("id", { count: "exact", head: true })
        .eq("ativo", true)
        .eq("tipo", "receber")
        .eq("status", "aberto")
        .eq("data_vencimento", today),
      supabase
        .from("financeiro_lancamentos")
        .select("id", { count: "exact", head: true })
        .eq("ativo", true)
        .eq("tipo", "pagar")
        .eq("status", "aberto")
        .eq("data_vencimento", today),
      supabase
        .from("financeiro_lancamentos")
        .select("valor, saldo_restante, status, clientes(nome_razao_social)")
        .eq("tipo", "receber")
        .eq("ativo", true)
        .in("status", ["aberto", "vencido", "parcial"]),
      supabase
        .from("financeiro_lancamentos")
        .select("data_vencimento, valor, saldo_restante, status")
        .eq("tipo", "receber")
        .eq("ativo", true)
        .in("status", ["aberto", "vencido", "parcial"])
        .in("data_vencimento", nextDays),
      supabase
        .from("financeiro_lancamentos")
        .select("data_vencimento, valor, saldo_restante, status")
        .eq("tipo", "pagar")
        .eq("ativo", true)
        .in("status", ["aberto", "vencido", "parcial"])
        .in("data_vencimento", nextDays),
    ]);

    const receber = (receberRows ?? []) as FinRow[];
    const pagar = (pagarRows ?? []) as FinRow[];

    return {
      contasReceber: receber.length,
      contasPagar: pagar.length,
      contasVencidas: (vencidasRows ?? []).length,
      totalReceber: sumOpenFinanceiro(receber),
      totalPagar: sumOpenFinanceiro(pagar),
      vencimentosHoje: { receber: receberHoje ?? 0, pagar: pagarHoje ?? 0 },
      dailyReceber: aggregateDailyFinanceiro(nextDays, (dailyReceberRows ?? []) as DailyFinRow[]),
      dailyPagar: aggregateDailyFinanceiro(nextDays, (dailyPagarRows ?? []) as DailyFinRow[]),
      topClientes: aggregateTopClientes((recData ?? []) as RecDataRow[]),
    };
  }, [range]);

  return { loadFinanceiroData };
}
