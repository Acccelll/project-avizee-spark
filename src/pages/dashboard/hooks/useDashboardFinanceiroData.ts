import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  const [dashboardErrors, setDashboardErrors] = useState<string[]>([]);

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
      receberResult,
      pagarResult,
      vencidasResult,
      receberHojeResult,
      pagarHojeResult,
      recDataResult,
      dailyReceberResult,
      dailyPagarResult,
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

    const erros: string[] = [];

    if (receberResult.error) {
      console.error("[dashboard] erro ao carregar receber:", receberResult.error.message);
      erros.push("receber");
    }
    if (pagarResult.error) {
      console.error("[dashboard] erro ao carregar pagar:", pagarResult.error.message);
      erros.push("pagar");
    }
    if (vencidasResult.error) {
      console.error("[dashboard] erro ao carregar vencidas:", vencidasResult.error.message);
      erros.push("vencidas");
    }
    if (receberHojeResult.error) {
      console.error("[dashboard] erro ao carregar receberHoje:", receberHojeResult.error.message);
      erros.push("receberHoje");
    }
    if (pagarHojeResult.error) {
      console.error("[dashboard] erro ao carregar pagarHoje:", pagarHojeResult.error.message);
      erros.push("pagarHoje");
    }
    if (recDataResult.error) {
      console.error("[dashboard] erro ao carregar topClientes:", recDataResult.error.message);
      erros.push("topClientes");
    }
    if (dailyReceberResult.error) {
      console.error("[dashboard] erro ao carregar dailyReceber:", dailyReceberResult.error.message);
      erros.push("dailyReceber");
    }
    if (dailyPagarResult.error) {
      console.error("[dashboard] erro ao carregar dailyPagar:", dailyPagarResult.error.message);
      erros.push("dailyPagar");
    }

    setDashboardErrors(erros);
    if (erros.length > 0) {
      toast.warning(`Alguns dados do dashboard não puderam ser carregados (${erros.join(", ")})`);
    }

    const receber = (receberResult.data ?? []) as FinRow[];
    const pagar = (pagarResult.data ?? []) as FinRow[];

    return {
      contasReceber: receber.length,
      contasPagar: pagar.length,
      contasVencidas: (vencidasResult.data ?? []).length,
      totalReceber: sumOpenFinanceiro(receber),
      totalPagar: sumOpenFinanceiro(pagar),
      vencimentosHoje: { receber: receberHojeResult.count ?? 0, pagar: pagarHojeResult.count ?? 0 },
      dailyReceber: aggregateDailyFinanceiro(nextDays, (dailyReceberResult.data ?? []) as DailyFinRow[]),
      dailyPagar: aggregateDailyFinanceiro(nextDays, (dailyPagarResult.data ?? []) as DailyFinRow[]),
      topClientes: aggregateTopClientes((recDataResult.data ?? []) as RecDataRow[]),
    };
  }, [range]);

  return { loadFinanceiroData, dashboardErrors };
}
