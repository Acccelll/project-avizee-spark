import { useMemo } from "react";
import { AlertTriangle, BarChart2, ClipboardList, DollarSign, Package, TrendingUp, Truck } from "lucide-react";
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
  backlogOVsCount: number;
  comprasAtrasadasCount: number;
  remessasAtrasadasCount: number;
  dailyReceber: Array<{ dia: string; valor: number }>;
  dailyPagar: Array<{ dia: string; valor: number }>;
  onOpenReceber: () => void;
  onOpenPagar: () => void;
  onOpenSaldo: () => void;
  onOpenEstoque: () => void;
  onReceberDetail: () => void;
  onPagarDetail?: () => void;
  onSaldoDetail?: () => void;
  onEstoqueDetail: () => void;
  onOpenBacklog: () => void;
  onOpenCompras: () => void;
  onOpenRemessas: () => void;
}

export function useDashboardKpis(params: KpiParams) {
  const {
    metas,
    stats,
    estoqueBaixoCount,
    backlogOVsCount,
    comprasAtrasadasCount,
    remessasAtrasadasCount,
    dailyReceber,
    dailyPagar,
    onOpenReceber,
    onOpenPagar,
    onOpenSaldo,
    onOpenEstoque,
    onReceberDetail,
    onPagarDetail,
    onSaldoDetail,
    onEstoqueDetail,
    onOpenBacklog,
    onOpenCompras,
    onOpenRemessas,
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
        // Useful variation: percentage of contas a receber, gives the user
        // a sense of "are we earning enough to cover what we owe?".
        variation:
          stats.totalReceber > 0
            ? `${Math.round((stats.totalPagar / stats.totalReceber) * 100)}% do total a receber`
            : "Sem contraparte a receber",
        variationType:
          stats.totalReceber > 0 && stats.totalPagar > stats.totalReceber
            ? ("negative" as const)
            : ("neutral" as const),
        // Variant reflects only "Pagar"'s own state — not the cross with Receber.
        variant: stats.contasPagar > 0 ? ("warning" as const) : ("success" as const),
        sparklineData: dailyPagar.length > 0 ? dailyPagar.map((d) => d.valor) : undefined,
        onClick: onOpenPagar,
        onDetail: onPagarDetail,
        "aria-label": "Ver contas a pagar no módulo financeiro",
        meta: metas.pagar,
        realizado: stats.totalPagar,
      },
      {
        id: "saldo",
        title: "Saldo Projetado",
        value: formatCurrency(saldoProjetado),
        subtitle: "receber − pagar (período global)",
        icon: BarChart2,
        variation:
          saldoProjetado >= 0
            ? `Sobra de ${formatCurrency(saldoProjetado)}`
            : `Déficit de ${formatCurrency(Math.abs(saldoProjetado))}`,
        variationType: saldoProjetado >= 0 ? ("positive" as const) : ("negative" as const),
        variant: saldoProjetado >= 0 ? ("success" as const) : ("danger" as const),
        sparklineData:
          dailyReceber.length > 0 && dailyPagar.length > 0
            ? dailyReceber.map((r, index) => r.valor - (dailyPagar[index]?.valor ?? 0))
            : undefined,
        onClick: onOpenSaldo,
        onDetail: onSaldoDetail,
        "aria-label": "Ver saldo projetado no fluxo de caixa",
        meta: metas.saldo,
        realizado: saldoProjetado,
      },
    ],
    [
      dailyPagar,
      dailyReceber,
      metas.pagar,
      metas.receber,
      metas.saldo,
      onOpenPagar,
      onOpenReceber,
      onOpenSaldo,
      onReceberDetail,
      onPagarDetail,
      onSaldoDetail,
      saldoProjetado,
      stats.contasPagar,
      stats.contasReceber,
      stats.contasVencidas,
      stats.totalPagar,
      stats.totalReceber,
    ],
  );

  /**
   * Operational exception indicators — semantically distinct from value KPIs.
   * They count exceptions (units), not money, and never have meta/sparkline.
   */
  const operationalCards = useMemo(
    () => [
      {
        id: "estoque-critico",
        title: "Estoque Crítico",
        value: formatNumber(estoqueBaixoCount),
        subtitle: estoqueBaixoCount > 0 ? "abaixo do mínimo" : "saudável",
        icon: Package,
        variant: estoqueBaixoCount > 0 ? ("danger" as const) : ("success" as const),
        onClick: onOpenEstoque,
        onDetail: onEstoqueDetail,
        scope: { kind: "snapshot" as const },
        "aria-label": "Ver produtos com estoque crítico",
      },
      {
        id: "ovs-aguardando",
        title: "Pedidos a Faturar",
        value: formatNumber(backlogOVsCount),
        subtitle: backlogOVsCount > 0 ? "aguardando NF" : "tudo faturado",
        icon: ClipboardList,
        variant: backlogOVsCount > 0 ? ("warning" as const) : ("success" as const),
        onClick: onOpenBacklog,
        scope: { kind: "snapshot" as const },
        "aria-label": "Ver pedidos aguardando faturamento",
      },
      {
        id: "compras-atrasadas",
        title: "Compras em Atraso",
        value: formatNumber(comprasAtrasadasCount),
        subtitle: comprasAtrasadasCount > 0 ? "entrega vencida" : "no prazo",
        icon: AlertTriangle,
        variant: comprasAtrasadasCount > 0 ? ("danger" as const) : ("success" as const),
        onClick: onOpenCompras,
        scope: { kind: "snapshot" as const },
        "aria-label": "Ver pedidos de compra atrasados",
      },
      {
        id: "remessas-atrasadas",
        title: "Remessas Atrasadas",
        value: formatNumber(remessasAtrasadasCount),
        subtitle: remessasAtrasadasCount > 0 ? "envios sem confirmação" : "no prazo",
        icon: Truck,
        variant: remessasAtrasadasCount > 0 ? ("warning" as const) : ("success" as const),
        onClick: onOpenRemessas,
        scope: { kind: "snapshot" as const },
        "aria-label": "Ver remessas atrasadas",
      },
    ],
    [
      backlogOVsCount,
      comprasAtrasadasCount,
      estoqueBaixoCount,
      onEstoqueDetail,
      onOpenBacklog,
      onOpenCompras,
      onOpenEstoque,
      onOpenRemessas,
      remessasAtrasadasCount,
    ],
  );

  return { kpiCards, operationalCards, saldoProjetado };
}
