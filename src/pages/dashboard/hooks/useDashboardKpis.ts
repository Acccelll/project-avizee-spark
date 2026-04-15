import { useMemo } from "react";
import { BarChart2, DollarSign, Package, TrendingUp } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";

interface KpiParams {
  metas: {
    receber?: number;
    pagar?: number;
    saldo?: number;
  };
  stats: {
    totalReceber: number;
    totalPagar: number;
    contasReceber: number;
    contasPagar: number;
    contasVencidas: number;
  };
  estoqueBaixoCount: number;
  dailyReceber: Array<{ dia: string; valor: number }>;
  dailyPagar: Array<{ dia: string; valor: number }>;
  onOpenReceber: () => void;
  onOpenPagar: () => void;
  onOpenSaldo: () => void;
  onOpenEstoque: () => void;
  onReceberDetail: () => void;
  onEstoqueDetail: () => void;
}

export function useDashboardKpis(params: KpiParams) {
  const saldoProjetado = params.stats.totalReceber - params.stats.totalPagar;

  const kpiCards = useMemo(
    () => [
      {
        id: "receber",
        title: "Contas a Receber",
        value: formatCurrency(params.stats.totalReceber),
        subtitle: `${formatNumber(params.stats.contasReceber)} título${params.stats.contasReceber !== 1 ? "s" : ""} em aberto`,
        icon: TrendingUp,
        variation:
          params.stats.contasVencidas > 0
            ? `${params.stats.contasVencidas} vencido${params.stats.contasVencidas > 1 ? "s" : ""}`
            : "Sem vencidos",
        variationType: params.stats.contasVencidas > 0 ? ("negative" as const) : ("positive" as const),
        variant: params.stats.contasVencidas > 0 ? ("warning" as const) : ("success" as const),
        sparklineData: params.dailyReceber.length > 0 ? params.dailyReceber.map((d) => d.valor) : undefined,
        onClick: params.onOpenReceber,
        onDetail: params.onReceberDetail,
        "aria-label": "Ver contas a receber no módulo financeiro",
        meta: params.metas.receber,
        realizado: params.stats.totalReceber,
      },
      {
        id: "pagar",
        title: "Contas a Pagar",
        value: formatCurrency(params.stats.totalPagar),
        subtitle: `${formatNumber(params.stats.contasPagar)} título${params.stats.contasPagar !== 1 ? "s" : ""} em aberto`,
        icon: DollarSign,
        variation: params.stats.totalPagar > params.stats.totalReceber ? "Saldo negativo" : "Saldo positivo",
        variationType: params.stats.totalPagar > params.stats.totalReceber ? ("negative" as const) : ("positive" as const),
        variant: params.stats.totalPagar > params.stats.totalReceber ? ("danger" as const) : ("warning" as const),
        sparklineData: params.dailyPagar.length > 0 ? params.dailyPagar.map((d) => d.valor) : undefined,
        onClick: params.onOpenPagar,
        "aria-label": "Ver contas a pagar no módulo financeiro",
        meta: params.metas.pagar,
        realizado: params.stats.totalPagar,
      },
      {
        id: "saldo",
        title: "Saldo Projetado",
        value: formatCurrency(saldoProjetado),
        subtitle: "receber − pagar",
        icon: BarChart2,
        variation: saldoProjetado >= 0 ? "Caixa positivo" : "Caixa negativo",
        variationType: saldoProjetado >= 0 ? ("positive" as const) : ("negative" as const),
        variant: saldoProjetado >= 0 ? ("success" as const) : ("danger" as const),
        sparklineData:
          params.dailyReceber.length > 0 && params.dailyPagar.length > 0
            ? params.dailyReceber.map((r, index) => r.valor - (params.dailyPagar[index]?.valor ?? 0))
            : undefined,
        onClick: params.onOpenSaldo,
        "aria-label": "Ver saldo projetado no fluxo de caixa",
        meta: params.metas.saldo,
        realizado: saldoProjetado,
      },
      {
        id: "estoque",
        title: "Estoque Crítico",
        value: formatNumber(params.estoqueBaixoCount),
        subtitle: params.estoqueBaixoCount > 0 ? "produto(s) abaixo do mínimo" : "Estoque dentro do normal",
        icon: Package,
        variation: params.estoqueBaixoCount > 0 ? "Reposição necessária" : "Sem itens críticos",
        variationType: params.estoqueBaixoCount > 0 ? ("negative" as const) : ("positive" as const),
        variant: params.estoqueBaixoCount > 0 ? ("danger" as const) : ("success" as const),
        sparklineData: undefined,
        onClick: params.onOpenEstoque,
        onDetail: params.onEstoqueDetail,
        "aria-label": "Ver produtos com estoque crítico",
      },
    ],
    [params, saldoProjetado],
  );

  return { kpiCards, saldoProjetado };
}
