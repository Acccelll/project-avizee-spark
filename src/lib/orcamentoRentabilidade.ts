import type { OrcamentoItem } from "@/components/Orcamento/OrcamentoItemsGrid";

export type InternalCostSource = "ultimo_custo_compra" | "custo_medio" | "custo_manual_cotacao" | "custo_produto" | "indisponivel";
export type MarginStatus = "saudavel" | "atencao" | "critica" | "negativa" | "indisponivel";

export interface MarginThresholds {
  healthy: number;
  attention: number;
  critical: number;
  minimum: number;
}

export const DEFAULT_MARGIN_THRESHOLDS: MarginThresholds = {
  healthy: 0.2,
  attention: 0.12,
  critical: 0.05,
  minimum: 0.1,
};

export interface InternalCostCandidate {
  productCost?: number | null;
  lastPurchaseCost?: number | null;
  avgCost?: number | null;
  manualCost?: number | null;
}

export interface RentabilidadeContext {
  descontoGlobal: number;
  frete: number;
  impostoSt: number;
  impostoIpi: number;
  outrasDespesas: number;
}

export interface RentabilidadeItem {
  itemIndex: number;
  produtoId: string;
  descricao: string;
  quantidade: number;
  precoVendaUnitario: number;
  descontoPercentual: number;
  descontoRateadoUnitario: number;
  vendaLiquidaUnitaria: number;
  vendaTotalLiquida: number;
  custoBaseUnitario: number | null;
  custoSource: InternalCostSource;
  freteRateadoUnitario: number;
  impostoRateadoUnitario: number;
  outrosCustosRateadosUnitario: number;
  custoFinalUnitario: number | null;
  lucroUnitario: number | null;
  lucroTotal: number | null;
  margemPercentual: number | null;
  margemStatus: MarginStatus;
  alerts: string[];
}

export interface RentabilidadeResumo {
  custoTotalProdutos: number;
  vendaTotalLiquida: number;
  frete: number;
  impostos: number;
  descontos: number;
  outrosCustos: number;
  lucroBrutoTotal: number;
  lucroLiquidoEstimado: number;
  margemGeralPercentual: number;
  margemMinimaAtingida: boolean;
}

export interface RentabilidadeAnalise {
  items: RentabilidadeItem[];
  resumo: RentabilidadeResumo;
  alerts: string[];
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const safeNumber = (value: number | null | undefined) => (Number.isFinite(Number(value)) ? Number(value) : 0);

export function resolveCostSource(candidate: InternalCostCandidate): { cost: number | null; source: InternalCostSource } {
  if (candidate.manualCost != null && candidate.manualCost > 0) return { cost: candidate.manualCost, source: "custo_manual_cotacao" };
  if (candidate.lastPurchaseCost != null && candidate.lastPurchaseCost > 0) return { cost: candidate.lastPurchaseCost, source: "ultimo_custo_compra" };
  if (candidate.avgCost != null && candidate.avgCost > 0) return { cost: candidate.avgCost, source: "custo_medio" };
  if (candidate.productCost != null && candidate.productCost > 0) return { cost: candidate.productCost, source: "custo_produto" };
  return { cost: null, source: "indisponivel" };
}

function getMarginStatus(margin: number | null, thresholds: MarginThresholds): MarginStatus {
  if (margin == null) return "indisponivel";
  if (margin < 0) return "negativa";
  if (margin < thresholds.critical) return "critica";
  if (margin < thresholds.attention) return "atencao";
  return "saudavel";
}

export function calcularRentabilidade(
  items: OrcamentoItem[],
  context: RentabilidadeContext,
  getCostCandidate: (item: OrcamentoItem) => InternalCostCandidate,
  thresholds: MarginThresholds = DEFAULT_MARGIN_THRESHOLDS,
): RentabilidadeAnalise {
  const validItems = items.filter((item) => item.produto_id);
  const totalBrutoItens = validItems.reduce((sum, item) => sum + safeNumber(item.quantidade) * safeNumber(item.valor_unitario), 0);
  const descontoGlobal = Math.max(0, safeNumber(context.descontoGlobal));
  const frete = Math.max(0, safeNumber(context.frete));
  const impostos = Math.max(0, safeNumber(context.impostoSt) + safeNumber(context.impostoIpi));
  const outrosCustos = Math.max(0, safeNumber(context.outrasDespesas));

  const analysisItems = validItems.map((item, idx): RentabilidadeItem => {
    const quantidade = safeNumber(item.quantidade);
    const precoVendaUnitario = safeNumber(item.valor_unitario);
    const descontoPercentual = safeNumber(item.desconto_percentual);
    const descontoItemUnitario = precoVendaUnitario * (descontoPercentual / 100);
    const vendaAposDescontoItemUnitario = precoVendaUnitario - descontoItemUnitario;
    const baseRateio = quantidade * precoVendaUnitario;
    const percentualRateio = totalBrutoItens > 0 ? baseRateio / totalBrutoItens : 0;
    const descontoGlobalRateadoUnitario = quantidade > 0 ? (descontoGlobal * percentualRateio) / quantidade : 0;
    const vendaLiquidaUnitaria = round2(Math.max(0, vendaAposDescontoItemUnitario - descontoGlobalRateadoUnitario));

    const freteRateadoCalculado = quantidade > 0 ? round2((frete * percentualRateio) / quantidade) : 0;
    const impostoRateadoCalculado = quantidade > 0 ? round2((impostos * percentualRateio) / quantidade) : 0;
    const outrosCustosRateadosCalculado = quantidade > 0 ? round2((outrosCustos * percentualRateio) / quantidade) : 0;

    const freteRateadoUnitario = item.frete_rateado_simulado_unitario != null
      ? round2(Math.max(0, safeNumber(item.frete_rateado_simulado_unitario)))
      : freteRateadoCalculado;
    const impostoRateadoUnitario = item.imposto_rateado_simulado_unitario != null
      ? round2(Math.max(0, safeNumber(item.imposto_rateado_simulado_unitario)))
      : impostoRateadoCalculado;
    const outrosCustosRateadosUnitario = item.outros_custos_simulados_unitario != null
      ? round2(Math.max(0, safeNumber(item.outros_custos_simulados_unitario)))
      : outrosCustosRateadosCalculado;

    const { cost: custoBaseUnitario, source } = resolveCostSource(getCostCandidate(item));
    const custoFinalUnitario = custoBaseUnitario == null
      ? null
      : round2(custoBaseUnitario + freteRateadoUnitario + impostoRateadoUnitario + outrosCustosRateadosUnitario);

    const lucroUnitario = custoFinalUnitario == null ? null : round2(vendaLiquidaUnitaria - custoFinalUnitario);
    const lucroTotal = lucroUnitario == null ? null : round2(lucroUnitario * quantidade);
    const margemPercentual = vendaLiquidaUnitaria > 0 && lucroUnitario != null ? lucroUnitario / vendaLiquidaUnitaria : null;
    const margemStatus = getMarginStatus(margemPercentual, thresholds);

    const alerts: string[] = [];
    if (custoFinalUnitario == null) alerts.push("Custo indisponível");
    if (lucroUnitario != null && lucroUnitario < 0) alerts.push("Item com lucro negativo");
    if (margemPercentual != null && margemPercentual < thresholds.minimum) alerts.push("Margem abaixo da mínima");
    if (descontoPercentual > 0 && margemPercentual != null && margemPercentual < thresholds.attention) alerts.push("Desconto comprometeu a margem");
    if (custoBaseUnitario != null && custoFinalUnitario != null && custoFinalUnitario > custoBaseUnitario) alerts.push("Frete/impostos reduziram a rentabilidade");

    return {
      itemIndex: idx,
      produtoId: item.produto_id,
      descricao: item.descricao_snapshot || "Item sem descrição",
      quantidade,
      precoVendaUnitario,
      descontoPercentual,
      descontoRateadoUnitario: round2(descontoItemUnitario + descontoGlobalRateadoUnitario),
      vendaLiquidaUnitaria,
      vendaTotalLiquida: round2(vendaLiquidaUnitaria * quantidade),
      custoBaseUnitario,
      custoSource: source,
      freteRateadoUnitario,
      impostoRateadoUnitario,
      outrosCustosRateadosUnitario,
      custoFinalUnitario,
      lucroUnitario,
      lucroTotal,
      margemPercentual,
      margemStatus,
      alerts,
    };
  });

  const vendaTotalLiquida = round2(analysisItems.reduce((sum, item) => sum + item.vendaTotalLiquida, 0));
  const custoTotalProdutos = round2(analysisItems.reduce((sum, item) => sum + (item.custoFinalUnitario ?? 0) * item.quantidade, 0));
  const lucroBrutoTotal = round2(vendaTotalLiquida - custoTotalProdutos);
  const lucroLiquidoEstimado = lucroBrutoTotal;
  const margemGeralPercentual = vendaTotalLiquida > 0 ? lucroBrutoTotal / vendaTotalLiquida : 0;

  const alerts = new Set<string>();
  analysisItems.forEach((item) => item.alerts.forEach((alert) => alerts.add(alert)));

  return {
    items: analysisItems,
    resumo: {
      custoTotalProdutos,
      vendaTotalLiquida,
      frete,
      impostos,
      descontos: descontoGlobal,
      outrosCustos,
      lucroBrutoTotal,
      lucroLiquidoEstimado,
      margemGeralPercentual,
      margemMinimaAtingida: margemGeralPercentual >= thresholds.minimum,
    },
    alerts: [...alerts],
  };
}
