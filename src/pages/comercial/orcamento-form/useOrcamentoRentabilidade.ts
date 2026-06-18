import { useMemo } from "react";
import type { OrcamentoItem } from "@/components/Orcamento/OrcamentoItemsGrid";
import type { RentabilidadeScenarioConfig } from "@/components/Orcamento/OrcamentoInternalAnalysisPanel";
import { calcularRentabilidade, type InternalCostCandidate } from "@/lib/orcamentoRentabilidade";
import type { ProductWithForn } from "@/components/ui/DataSelector";

interface UseOrcamentoRentabilidadeArgs {
  produtos: ProductWithForn[];
  items: OrcamentoItem[];
  desconto: number;
  freteValor: number;
  impostoSt: number;
  impostoIpi: number;
  outrasDespesas: number;
  scenarioConfig: RentabilidadeScenarioConfig;
}

/**
 * Memoização do mapa de custos e dos cenários (base + simulado) usados pelo
 * `OrcamentoInternalAnalysisPanel`. Toda lógica pura — sem efeitos colaterais.
 */
export function useOrcamentoRentabilidade({
  produtos,
  items,
  desconto,
  freteValor,
  impostoSt,
  impostoIpi,
  outrasDespesas,
  scenarioConfig,
}: UseOrcamentoRentabilidadeArgs) {
  const productCostMap = useMemo(() => {
    const map = new Map<string, InternalCostCandidate>();
    for (const product of produtos) {
      const fornecedores = product.produtos_fornecedores || [];
      const lastPurchase = [...fornecedores]
        .filter((row) => row.preco_compra && Number(row.preco_compra) > 0)
        .sort((a, b) => {
          const ua = (a as { ultima_compra?: string | null }).ultima_compra;
          const ub = (b as { ultima_compra?: string | null }).ultima_compra;
          const dateA = ua ? new Date(ua).getTime() : 0;
          const dateB = ub ? new Date(ub).getTime() : 0;
          return dateB - dateA;
        })[0];

      map.set(product.id, {
        productCost: product.preco_custo,
        lastPurchaseCost: lastPurchase?.preco_compra ?? null,
        avgCost: null,
      });
    }
    return map;
  }, [produtos]);

  const baseAnalysis = useMemo(
    () =>
      calcularRentabilidade(
        items,
        {
          descontoGlobal: desconto,
          frete: freteValor,
          impostoSt,
          impostoIpi,
          outrasDespesas,
        },
        (item) => ({
          ...(productCostMap.get(item.produto_id) || {}),
          manualCost: item.custo_manual_unitario ?? null,
        }),
      ),
    [items, desconto, freteValor, impostoSt, impostoIpi, outrasDespesas, productCostMap],
  );

  const scenarioItems = useMemo(
    () =>
      items.map((item) => {
        const useScenarioItem = Boolean(item.usar_cenario);
        const priceAdjusted =
          item.valor_unitario * (1 + (scenarioConfig.reajusteGlobalPrecoPercent || 0) / 100);
        return {
          ...item,
          valor_unitario:
            useScenarioItem && item.preco_simulado_unitario != null
              ? item.preco_simulado_unitario
              : priceAdjusted,
          desconto_percentual:
            useScenarioItem && item.desconto_simulado_percentual != null
              ? item.desconto_simulado_percentual
              : item.desconto_percentual || 0,
          frete_rateado_simulado_unitario: useScenarioItem ? item.frete_rateado_simulado_unitario : null,
          imposto_rateado_simulado_unitario: useScenarioItem ? item.imposto_rateado_simulado_unitario : null,
          outros_custos_simulados_unitario: useScenarioItem ? item.outros_custos_simulados_unitario : null,
        };
      }),
    [items, scenarioConfig.reajusteGlobalPrecoPercent],
  );

  const scenarioAnalysis = useMemo(
    () =>
      calcularRentabilidade(
        scenarioItems,
        {
          descontoGlobal: scenarioConfig.descontoGlobalSimulado || desconto,
          frete: scenarioConfig.freteSimulado || freteValor,
          impostoSt: scenarioConfig.impostosSimulados || impostoSt + impostoIpi,
          impostoIpi: 0,
          outrasDespesas: scenarioConfig.outrosCustosSimulados || outrasDespesas,
        },
        (item) => {
          const baseCandidate = productCostMap.get(item.produto_id) || {};
          const costFactor = 1 + (scenarioConfig.reajusteGlobalCustoPercent || 0) / 100;
          return {
            productCost: baseCandidate.productCost != null ? baseCandidate.productCost * costFactor : null,
            lastPurchaseCost:
              baseCandidate.lastPurchaseCost != null ? baseCandidate.lastPurchaseCost * costFactor : null,
            avgCost: baseCandidate.avgCost != null ? baseCandidate.avgCost * costFactor : null,
            manualCost:
              item.usar_cenario && item.custo_simulado != null
                ? item.custo_simulado
                : item.custo_manual_unitario ?? null,
          };
        },
      ),
    [scenarioItems, scenarioConfig, desconto, freteValor, impostoSt, impostoIpi, outrasDespesas, productCostMap],
  );

  return { productCostMap, baseAnalysis, scenarioAnalysis };
}