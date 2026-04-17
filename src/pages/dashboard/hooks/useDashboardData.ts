import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useDashboardPeriod } from "@/contexts/DashboardPeriodContext";
import { useDashboardAuxData } from "./useDashboardAuxData";
import { useDashboardComercialData } from "./useDashboardComercialData";
import { useDashboardEstoqueData } from "./useDashboardEstoqueData";
import { useDashboardFinanceiroData } from "./useDashboardFinanceiroData";
import { useDashboardFiscalData } from "./useDashboardFiscalData";
import { getUserFriendlyError } from "@/utils/errorMessages";
import type { DashboardStats, FaturamentoStats, FiscalStats, ProdRow, TopPoint } from "./types";
import type { BacklogOv, CompraAguardando, RecentOrcamento } from "./types";

interface DashboardDataState {
  stats: DashboardStats;
  faturamento: FaturamentoStats;
  recentOrcamentos: RecentOrcamento[];
  backlogOVs: BacklogOv[];
  /** Real total count of OVs awaiting faturamento (not capped by the preview list). */
  backlogOVsCount: number;
  comprasAguardando: CompraAguardando[];
  /** Real count of compras with an overdue delivery date. */
  comprasAtrasadasCount: number;
  estoqueBaixo: ProdRow[];
  fiscalStats: FiscalStats;
  vencimentosHoje: { receber: number; pagar: number };
  topClientes: TopPoint[];
  topProdutos: TopPoint[];
  dailyReceber: Array<{ dia: string; valor: number }>;
  dailyPagar: Array<{ dia: string; valor: number }>;
  dailyVendas: Array<{ dia: string; valor: number }>;
  valorEstoque: number;
  remessasAtrasadas: number;
}

const INITIAL_STATE: DashboardDataState = {
  stats: {
    produtos: 0,
    clientes: 0,
    fornecedores: 0,
    orcamentos: 0,
    compras: 0,
    contasReceber: 0,
    contasPagar: 0,
    contasVencidas: 0,
    totalReceber: 0,
    totalPagar: 0,
  },
  faturamento: { mesAtual: 0, mesAnterior: 0, nfAtualCount: 0 },
  recentOrcamentos: [],
  backlogOVs: [],
  backlogOVsCount: 0,
  comprasAguardando: [],
  comprasAtrasadasCount: 0,
  estoqueBaixo: [],
  fiscalStats: { emitidas: 0, pendentes: 0, canceladas: 0, valorEmitidas: 0 },
  vencimentosHoje: { receber: 0, pagar: 0 },
  topClientes: [],
  topProdutos: [],
  dailyReceber: [],
  dailyPagar: [],
  dailyVendas: [],
  valorEstoque: 0,
  remessasAtrasadas: 0,
};

export function useDashboardData() {
  const { range } = useDashboardPeriod();
  const [loading, setLoading] = useState(true);
  const [loadedAt, setLoadedAt] = useState<Date>(new Date());
  const [state, setState] = useState<DashboardDataState>(INITIAL_STATE);

  const { loadFinanceiroData } = useDashboardFinanceiroData(range);
  const { loadComercialData } = useDashboardComercialData(range);
  const { loadEstoqueData } = useDashboardEstoqueData();
  const { loadFiscalData } = useDashboardFiscalData();
  const { loadAuxData } = useDashboardAuxData(range);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const [financeiro, comercial, estoque, fiscal, aux] = await Promise.all([
        loadFinanceiroData(),
        loadComercialData(),
        loadEstoqueData(),
        loadFiscalData(),
        loadAuxData(),
      ]);

      setState({
        stats: {
          produtos: estoque.produtos,
          clientes: aux.clientes,
          fornecedores: aux.fornecedores,
          orcamentos: comercial.orcamentos,
          compras: aux.compras,
          contasReceber: financeiro.contasReceber,
          contasPagar: financeiro.contasPagar,
          contasVencidas: financeiro.contasVencidas,
          totalReceber: financeiro.totalReceber,
          totalPagar: financeiro.totalPagar,
        },
        faturamento: comercial.faturamento,
        recentOrcamentos: comercial.recentOrcamentos,
        backlogOVs: comercial.backlogOVs,
        backlogOVsCount: comercial.backlogOVsCount,
        comprasAguardando: aux.comprasAguardando,
        comprasAtrasadasCount: aux.comprasAtrasadasCount,
        estoqueBaixo: estoque.estoqueBaixo,
        fiscalStats: fiscal.fiscalStats,
        vencimentosHoje: financeiro.vencimentosHoje,
        topClientes: financeiro.topClientes,
        topProdutos: comercial.topProdutos,
        dailyReceber: financeiro.dailyReceber,
        dailyPagar: financeiro.dailyPagar,
        dailyVendas: comercial.dailyVendas,
        valorEstoque: estoque.valorEstoque,
        remessasAtrasadas: aux.remessasAtrasadas,
      });
      setLoadedAt(new Date());
    } catch (error) {
      console.error("[dashboard] erro ao carregar dados:", error);
      toast.error(getUserFriendlyError(error));
    } finally {
      setLoading(false);
    }
  }, [loadAuxData, loadComercialData, loadEstoqueData, loadFinanceiroData, loadFiscalData]);

  /**
   * Ticket médio = faturamento confirmado no mês ÷ número de NFs emitidas no mês.
   * Usar a contagem de NFs (não de orçamentos) garante que numerador e denominador
   * venham da mesma janela e da mesma fonte de dados.
   */
  const ticketMedio = useMemo(
    () => (state.faturamento.nfAtualCount > 0 ? state.faturamento.mesAtual / state.faturamento.nfAtualCount : 0),
    [state.faturamento.mesAtual, state.faturamento.nfAtualCount],
  );

  return {
    ...state,
    loading,
    loadedAt,
    ticketMedio,
    loadData,
  };
}
