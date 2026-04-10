import { describe, expect, it } from "vitest";
import {
  calcularRentabilidade,
  DEFAULT_MARGIN_THRESHOLDS,
  resolveCostSource,
} from "@/lib/orcamentoRentabilidade";
import type { OrcamentoItem } from "@/components/Orcamento/OrcamentoItemsGrid";

function makeItem(overrides: Partial<OrcamentoItem> = {}): OrcamentoItem {
  return {
    produto_id: "prod-1",
    codigo_snapshot: "P001",
    descricao_snapshot: "Produto Teste",
    variacao: "",
    quantidade: 1,
    unidade: "UN",
    valor_unitario: 100,
    desconto_percentual: 0,
    valor_total: 100,
    peso_unitario: 0,
    peso_total: 0,
    ...overrides,
  };
}

describe("resolveCostSource", () => {
  it("prioriza custo manual quando disponível", () => {
    const result = resolveCostSource({ manualCost: 50, lastPurchaseCost: 40, avgCost: 30, productCost: 20 });
    expect(result.source).toBe("custo_manual_cotacao");
    expect(result.cost).toBe(50);
  });

  it("usa ultimo_custo_compra quando manual não informado", () => {
    const result = resolveCostSource({ lastPurchaseCost: 40, avgCost: 30, productCost: 20 });
    expect(result.source).toBe("ultimo_custo_compra");
    expect(result.cost).toBe(40);
  });

  it("usa custo_medio quando apenas avgCost disponível", () => {
    const result = resolveCostSource({ avgCost: 30, productCost: 20 });
    expect(result.source).toBe("custo_medio");
    expect(result.cost).toBe(30);
  });

  it("usa custo_produto como fallback", () => {
    const result = resolveCostSource({ productCost: 20 });
    expect(result.source).toBe("custo_produto");
    expect(result.cost).toBe(20);
  });

  it("retorna indisponivel quando nenhum custo informado", () => {
    const result = resolveCostSource({});
    expect(result.source).toBe("indisponivel");
    expect(result.cost).toBeNull();
  });

  it("ignora valores zero ou negativos", () => {
    const result = resolveCostSource({ manualCost: 0, lastPurchaseCost: -5, avgCost: 30 });
    expect(result.source).toBe("custo_medio");
    expect(result.cost).toBe(30);
  });
});

describe("calcularRentabilidade", () => {
  const ctx = { descontoGlobal: 0, frete: 0, impostoSt: 0, impostoIpi: 0, outrasDespesas: 0 };

  it("calcula margem corretamente para item simples", () => {
    const items = [makeItem({ quantidade: 2, valor_unitario: 100 })];
    const result = calcularRentabilidade(items, ctx, () => ({ productCost: 60 }));

    const item = result.items[0];
    expect(item.vendaLiquidaUnitaria).toBe(100);
    expect(item.custoFinalUnitario).toBe(60);
    expect(item.lucroUnitario).toBe(40);
    expect(item.lucroTotal).toBe(80);
    expect(item.margemPercentual).toBeCloseTo(0.4, 5);
    expect(item.margemStatus).toBe("saudavel");
  });

  it("calcula resumo com valores totais corretos", () => {
    const items = [
      makeItem({ produto_id: "p1", quantidade: 2, valor_unitario: 100 }),
      makeItem({ produto_id: "p2", quantidade: 1, valor_unitario: 200 }),
    ];
    const result = calcularRentabilidade(items, ctx, () => ({ productCost: 80 }));

    expect(result.resumo.vendaTotalLiquida).toBe(400);
    expect(result.resumo.custoTotalProdutos).toBe(240);
    expect(result.resumo.lucroBrutoTotal).toBe(160);
    expect(result.resumo.margemGeralPercentual).toBeCloseTo(0.4, 5);
  });

  it("ignora itens sem produto_id", () => {
    const items = [
      makeItem({ produto_id: "p1", quantidade: 1, valor_unitario: 100 }),
      makeItem({ produto_id: "", quantidade: 1, valor_unitario: 50 }),
    ];
    const result = calcularRentabilidade(items, ctx, () => ({ productCost: 60 }));
    expect(result.items).toHaveLength(1);
  });

  it("aplica desconto percentual no item", () => {
    const items = [makeItem({ quantidade: 1, valor_unitario: 100, desconto_percentual: 10 })];
    const result = calcularRentabilidade(items, ctx, () => ({ productCost: 50 }));

    expect(result.items[0].vendaLiquidaUnitaria).toBe(90);
    expect(result.items[0].lucroUnitario).toBe(40);
  });

  it("rateia frete entre itens pelo valor total", () => {
    const items = [
      makeItem({ produto_id: "p1", quantidade: 1, valor_unitario: 100 }),
      makeItem({ produto_id: "p2", quantidade: 1, valor_unitario: 100 }),
    ];
    const ctxFrete = { ...ctx, frete: 20 };
    const result = calcularRentabilidade(items, ctxFrete, () => ({ productCost: 50 }));

    // Each item has equal value so each gets R$ 10 freight
    expect(result.items[0].freteRateadoUnitario).toBe(10);
    expect(result.items[1].freteRateadoUnitario).toBe(10);
  });

  it("status negativa quando lucro é negativo", () => {
    const items = [makeItem({ quantidade: 1, valor_unitario: 50 })];
    const result = calcularRentabilidade(items, ctx, () => ({ productCost: 80 }));

    expect(result.items[0].lucroUnitario).toBeLessThan(0);
    expect(result.items[0].margemStatus).toBe("negativa");
    expect(result.items[0].alerts).toContain("Item com lucro negativo");
  });

  it("margemStatus indisponivel quando custo não disponível", () => {
    const items = [makeItem({ quantidade: 1, valor_unitario: 100 })];
    const result = calcularRentabilidade(items, ctx, () => ({}));

    expect(result.items[0].custoFinalUnitario).toBeNull();
    expect(result.items[0].margemStatus).toBe("indisponivel");
    expect(result.items[0].alerts).toContain("Custo indisponível");
  });

  it("arredonda valores para 2 casas decimais", () => {
    const items = [makeItem({ quantidade: 3, valor_unitario: 10 })];
    const ctxFrete = { ...ctx, frete: 10 };
    const result = calcularRentabilidade(items, ctxFrete, () => ({ productCost: 5 }));

    // frete 10 / total bruto 30 = 33.33% por item; 10 * 33.33% / 3 = 1.11...
    expect(Number.isFinite(result.items[0].freteRateadoUnitario)).toBe(true);
    const str = result.items[0].freteRateadoUnitario.toString();
    const decimals = str.includes(".") ? str.split(".")[1].length : 0;
    expect(decimals).toBeLessThanOrEqual(2);
  });

  it("margemMinimaAtingida é false quando margem abaixo do mínimo", () => {
    const items = [makeItem({ quantidade: 1, valor_unitario: 100 })];
    const result = calcularRentabilidade(items, ctx, () => ({ productCost: 95 }));

    expect(result.resumo.margemMinimaAtingida).toBe(false);
  });

  it("margemMinimaAtingida é true quando margem acima do mínimo", () => {
    const items = [makeItem({ quantidade: 1, valor_unitario: 100 })];
    const result = calcularRentabilidade(items, ctx, () => ({ productCost: 50 }));

    expect(result.resumo.margemMinimaAtingida).toBe(true);
  });

  it("margem critica quando entre 0 e threshold.critical", () => {
    const items = [makeItem({ quantidade: 1, valor_unitario: 100 })];
    // margin ~3% (cost=97)
    const result = calcularRentabilidade(items, ctx, () => ({ productCost: 97 }));
    expect(result.items[0].margemStatus).toBe("critica");
  });

  it("usa thresholds customizados", () => {
    const items = [makeItem({ quantidade: 1, valor_unitario: 100 })];
    const customThresholds = { ...DEFAULT_MARGIN_THRESHOLDS, critical: 0.3 };
    // cost=85, margin=15% which is below custom critical=30%
    const result = calcularRentabilidade(items, ctx, () => ({ productCost: 85 }), customThresholds);
    expect(result.items[0].margemStatus).toBe("critica");
  });

  it("lista de itens vazia retorna resumo zerado", () => {
    const result = calcularRentabilidade([], ctx, () => ({}));
    expect(result.items).toHaveLength(0);
    expect(result.resumo.vendaTotalLiquida).toBe(0);
    expect(result.resumo.lucroBrutoTotal).toBe(0);
  });
});
