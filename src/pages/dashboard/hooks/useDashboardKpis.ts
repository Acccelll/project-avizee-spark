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
  const {
    metas,
    stats,
    estoqueBaixoCount,
    dailyReceber,
    dailyPagar,
    onOpenReceber,
    onOpenPagar,
    onOpenSaldo,
    onOpenEstoque,
    onReceberDetail,
    onEstoqueDetail,
  } = params;

  const saldoProjetado = stats.totalReceber - stats.totalPagar;

  const kpiCards = useMemo(
    () => [
      {
        id: "receber",
        title: "Contas a Receber",
        value: formatCurrency(stats.totalReceber),
        subtitle: `${formatNumber(stats.contasReceber)} título${stats.contasReceber !== 1 ? "s" : ""} em aberto`,
        icon: TrendingUp,
        variation:
          stats.contasVencidas > 0
            ? `${stats.contasVencidas} vencido${stats.contasVencidas > 1 ? "s" : ""}`
            : "Sem vencidos",
        variationType: stats.contasVencidas > 0 ? ("negative" as const) : ("positive" as const),
        variant: stats.contasVencidas > 0 ? ("warning" as const) : ("success" as const),
        sparklineData: dailyReceber.length > 0 ? dailyReceber.map((d) => d.valor) : undefined,
        onClick: onOpenReceber,
        onDetail: onReceberDetail,
        "aria-label": "Ver contas a receber no módulo financeiro",
        meta: metas.receber,
        realizado: stats.totalReceber,
      },
      {
        id: "pagar",
        title: "Contas a Pagar",
        value: formatCurrency(stats.totalPagar),
        subtitle: `${formatNumber(stats.contasPagar)} título${stats.contasPagar !== 1 ? "s" : ""} em aberto`,
        icon: DollarSign,
        variation: stats.totalPagar > stats.totalReceber ? "Saldo negativo" : "Saldo positivo",
        variationType: stats.totalPagar > stats.totalReceber ? ("negative" as const) : ("positive" as const),
        variant: stats.totalPagar > stats.totalReceber ? ("danger" as const) : ("warning" as const),
        sparklineData: dailyPagar.length > 0 ? dailyPagar.map((d) => d.valor) : undefined,
        onClick: onOpenPagar,
        "aria-label": "Ver contas a pagar no módulo financeiro",
        meta: metas.pagar,
        realizado: stats.totalPagar,
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
          dailyReceber.length > 0 && dailyPagar.length > 0
            ? dailyReceber.map((r, index) => r.valor - (dailyPagar[index]?.valor ?? 0))
            : undefined,
        onClick: onOpenSaldo,
        "aria-label": "Ver saldo projetado no fluxo de caixa",
        meta: metas.saldo,
        realizado: saldoProjetado,
      },
      {
        id: "estoque",
        title: "Estoque Crítico",
        value: formatNumber(estoqueBaixoCount),
        subtitle: estoqueBaixoCount > 0 ? "produto(s) abaixo do mínimo" : "Estoque dentro do normal",
        icon: Package,
        variation: estoqueBaixoCount > 0 ? "Reposição necessária" : "Sem itens críticos",
        variationType: estoqueBaixoCount > 0 ? ("negative" as const) : ("positive" as const),
        variant: estoqueBaixoCount > 0 ? ("danger" as const) : ("success" as const),
        sparklineData: undefined,
        onClick: onOpenEstoque,
        onDetail: onEstoqueDetail,
        "aria-label": "Ver produtos com estoque crítico",
      },
    ],
    [
      dailyPagar,
      dailyReceber,
      estoqueBaixoCount,
      metas.pagar,
      metas.receber,
      metas.saldo,
      onEstoqueDetail,
      onOpenEstoque,
      onOpenPagar,
      onOpenReceber,
      onOpenSaldo,
      onReceberDetail,
      saldoProjetado,
      stats.contasPagar,
      stats.contasReceber,
      stats.contasVencidas,
      stats.totalPagar,
      stats.totalReceber,
    ],
  );

  return { kpiCards, saldoProjetado };
}
