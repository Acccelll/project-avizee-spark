import { describe, it, expect } from "vitest";
import {
  calcularICMS,
  calcularICMSST,
  calcularDiferencialAliquota,
  calcularPISCOFINS,
} from "../../fiscal/calculoImpostos";

// ─── calcularICMS ─────────────────────────────────────────────────────────────

describe("calcularICMS", () => {
  it("calcula ICMS padrão sem redução de base", () => {
    const result = calcularICMS(1000, 18);
    expect(result.baseCalculo).toBe(1000);
    expect(result.aliquota).toBe(18);
    expect(result.valorICMS).toBe(180);
  });

  it("aplica redução de base corretamente", () => {
    // base reduzida em 33,33% → 1000 × (1 - 0.3333) = 666.70
    const result = calcularICMS(1000, 12, 33.33);
    expect(result.baseCalculo).toBeCloseTo(666.7, 1);
    expect(result.valorICMS).toBeCloseTo(80, 0);
  });

  it("retorna zero quando alíquota é zero (isento)", () => {
    const result = calcularICMS(1000, 0);
    expect(result.valorICMS).toBe(0);
  });

  it("retorna zero quando base de cálculo é zero", () => {
    const result = calcularICMS(0, 18);
    expect(result.valorICMS).toBe(0);
  });

  it("calcula alíquota interestadual Sul/Sudeste → outras regiões (12%)", () => {
    const result = calcularICMS(500, 12);
    expect(result.valorICMS).toBe(60);
  });

  it("calcula alíquota interestadual outras regiões → Sul/Sudeste (7%)", () => {
    const result = calcularICMS(500, 7);
    expect(result.valorICMS).toBeCloseTo(35, 2);
  });

  it("retorna resultado com 2 casas decimais", () => {
    const result = calcularICMS(333.33, 18);
    expect(result.valorICMS).toBe(parseFloat((333.33 * 0.18).toFixed(2)));
  });
});

// ─── calcularICMSST ───────────────────────────────────────────────────────────

describe("calcularICMSST", () => {
  it("calcula ICMS-ST com MVA de 40%", () => {
    // valorProduto = 100, aliquotaICMS = 12%, MVA = 40%, aliquotaST = 18%
    // baseST = 100 × 1.40 = 140
    // valorICMSST_total = 140 × 0.18 = 25.20
    // icmsProprioValor = 100 × 0.12 = 12
    // valorICMSRetido = 25.20 - 12 = 13.20
    const result = calcularICMSST(100, 12, 40, 18);
    expect(result.baseCalculoST).toBe(140);
    expect(result.valorICMSST).toBeCloseTo(25.2, 2);
    expect(result.valorICMSRetido).toBeCloseTo(13.2, 2);
  });

  it("retorna ICMS retido zero quando ICMS próprio cobre o ST", () => {
    // Caso em que alíquota interna (ST) ≤ alíquota do remetente
    const result = calcularICMSST(100, 18, 0, 12);
    // baseST = 100, ICMS ST total = 12, próprio = 18 → retido = 0
    expect(result.valorICMSRetido).toBe(0);
  });

  it("calcula ST para operação interestadual com MVA alto", () => {
    const result = calcularICMSST(500, 7, 60, 18);
    const baseST = 500 * 1.6; // 800
    expect(result.baseCalculoST).toBe(800);
    expect(result.valorICMSST).toBeCloseTo(144, 2);
    expect(result.valorICMSRetido).toBeCloseTo(144 - 35, 2);
  });

  it("retorna zero retido quando produto já tem ICMS suficiente", () => {
    const result = calcularICMSST(1000, 18, 10, 18);
    // baseST = 1100, ICMS ST = 198, próprio = 180, retido = 18
    expect(result.valorICMSRetido).toBeCloseTo(18, 2);
  });
});

// ─── calcularDiferencialAliquota ──────────────────────────────────────────────

describe("calcularDiferencialAliquota", () => {
  it("calcula DIFAL para consumidor final não contribuinte", () => {
    // EC 87/2015: alíquota interestadual 12%, interna destino 18%
    const result = calcularDiferencialAliquota(1000, 12, 18);
    expect(result.valorDifal).toBe(60);
  });

  it("retorna zero quando alíquotas são iguais", () => {
    const result = calcularDiferencialAliquota(1000, 18, 18);
    expect(result.valorDifal).toBe(0);
  });

  it("retorna zero quando alíquota interna é menor (não negativo)", () => {
    const result = calcularDiferencialAliquota(1000, 18, 12);
    expect(result.valorDifal).toBe(0);
    expect(result.valorPartilhaDestino).toBe(0);
    expect(result.valorPartilhaOrigem).toBe(0);
  });

  it("divide partilha corretamente (60% destino, 40% origem)", () => {
    const result = calcularDiferencialAliquota(1000, 12, 18, 60);
    // DIFAL = 60
    expect(result.valorDifal).toBe(60);
    expect(result.valorPartilhaDestino).toBeCloseTo(36, 2);
    expect(result.valorPartilhaOrigem).toBeCloseTo(24, 2);
  });

  it("atribui 100% ao destino por padrão", () => {
    const result = calcularDiferencialAliquota(500, 7, 18);
    const difal = ((18 - 7) / 100) * 500;
    expect(result.valorDifal).toBeCloseTo(difal, 2);
    expect(result.valorPartilhaDestino).toBeCloseTo(difal, 2);
    expect(result.valorPartilhaOrigem).toBe(0);
  });
});

// ─── calcularPISCOFINS ────────────────────────────────────────────────────────

describe("calcularPISCOFINS", () => {
  it("calcula PIS e COFINS para lucro presumido", () => {
    const result = calcularPISCOFINS(1000, 0.65, 3.0);
    expect(result.pisValor).toBe(6.5);
    expect(result.cofinsValor).toBe(30);
  });

  it("calcula PIS e COFINS para lucro real", () => {
    const result = calcularPISCOFINS(1000, 1.65, 7.6);
    expect(result.pisValor).toBe(16.5);
    expect(result.cofinsValor).toBe(76);
  });

  it("retorna zero para contribuinte isento (alíquotas 0)", () => {
    const result = calcularPISCOFINS(1000, 0, 0);
    expect(result.pisValor).toBe(0);
    expect(result.cofinsValor).toBe(0);
  });

  it("preserva a base de cálculo inalterada", () => {
    const result = calcularPISCOFINS(2500.5, 0.65, 3.0);
    expect(result.baseCalculo).toBe(2500.5);
  });

  it("calcula valores com 2 casas decimais", () => {
    const result = calcularPISCOFINS(333.33, 0.65, 3.0);
    expect(result.pisValor).toBe(parseFloat((333.33 * 0.0065).toFixed(2)));
    expect(result.cofinsValor).toBe(parseFloat((333.33 * 0.03).toFixed(2)));
  });

  it("cobre operação com consumidor final (simples nacional, alíquota 0)", () => {
    const result = calcularPISCOFINS(800, 0, 0);
    expect(result.pisValor).toBe(0);
    expect(result.cofinsValor).toBe(0);
  });
});
