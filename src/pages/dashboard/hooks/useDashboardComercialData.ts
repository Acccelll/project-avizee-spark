import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { aggregateDailyVendas, aggregateTopProdutos, buildIsoDayRange, sumNfValues } from "@/lib/dashboard/aggregations";
import type {
  BacklogOV,
  DashboardDateRange,
  DailyNfRow,
  NfItemRow,
  NfRow,
  RecentOrcamento,
} from "./types";

interface ComercialData {
  orcamentos: number;
  recentOrcamentos: RecentOrcamento[];
  backlogOVs: BacklogOV[];
  faturamento: { mesAtual: number; mesAnterior: number };
  dailyVendas: Array<{ dia: string; valor: number }>;
  topProdutos: Array<{ nome: string; valor: number }>;
}

export function useDashboardComercialData(range: DashboardDateRange) {
  const loadComercialData = useCallback(async (): Promise<ComercialData> => {
    const { dateFrom, dateTo } = range;

    const now = new Date();
    const inicioMesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const inicioMesAnterior = (() => {
      const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
    })();
    const fimMesAnterior = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const lastDays = buildIsoDayRange(-6, 7);

    const [
      { count: orcamentosCount },
      { data: orcRecent },
      { data: backlog },
      { data: nfAtual },
      { data: nfAnterior },
      { data: dailyVendasRows },
      { data: itensRows },
    ] = await Promise.all([
      supabase
        .from("orcamentos")
        .select("*", { count: "exact", head: true })
        .eq("ativo", true)
        .gte("data_orcamento", dateFrom)
        .lte("data_orcamento", dateTo),
      supabase
        .from("orcamentos")
        .select("id, numero, valor_total, status, data_orcamento, clientes(nome_razao_social)")
        .eq("ativo", true)
        .gte("data_orcamento", dateFrom)
        .lte("data_orcamento", dateTo)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("ordens_venda")
        .select("id, numero, valor_total, data_emissao, data_prometida_despacho, prazo_despacho_dias, status, status_faturamento, clientes(nome_razao_social)")
        .eq("ativo", true)
        .in("status", ["aprovada", "em_separacao"])
        .in("status_faturamento", ["aguardando", "parcial"])
        .order("data_emissao", { ascending: true })
        .limit(15),
      supabase
        .from("notas_fiscais")
        .select("valor_total")
        .eq("ativo", true)
        .eq("tipo", "saida")
        .eq("status", "confirmada")
        .gte("data_emissao", inicioMesAtual),
      supabase
        .from("notas_fiscais")
        .select("valor_total")
        .eq("ativo", true)
        .eq("tipo", "saida")
        .eq("status", "confirmada")
        .gte("data_emissao", inicioMesAnterior)
        .lt("data_emissao", fimMesAnterior),
      supabase
        .from("notas_fiscais")
        .select("data_emissao, valor_total")
        .eq("ativo", true)
        .eq("tipo", "saida")
        .eq("status", "confirmada")
        .in("data_emissao", lastDays),
      supabase
        .from("notas_fiscais_itens")
        .select("quantidade, valor_unitario, produtos(nome), notas_fiscais!inner(status, tipo, data_emissao)")
        .eq("notas_fiscais.status", "confirmada")
        .eq("notas_fiscais.tipo", "saida")
        .gte("notas_fiscais.data_emissao", inicioMesAtual),
    ]);

    return {
      orcamentos: orcamentosCount ?? 0,
      recentOrcamentos: (orcRecent ?? []) as RecentOrcamento[],
      backlogOVs: (backlog ?? []) as BacklogOV[],
      faturamento: {
        mesAtual: sumNfValues((nfAtual ?? []) as NfRow[]),
        mesAnterior: sumNfValues((nfAnterior ?? []) as NfRow[]),
      },
      dailyVendas: aggregateDailyVendas(lastDays, (dailyVendasRows ?? []) as DailyNfRow[]),
      topProdutos: aggregateTopProdutos((itensRows ?? []) as NfItemRow[]),
    };
  }, [range]);

  return { loadComercialData };
}
