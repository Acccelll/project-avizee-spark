import { describe, it, expect } from "vitest";
import {
  calcularJuros,
  calcularDesconto,
  calcularMulta,
  gerarParcelas,
} from "@/services/financeiro/calculosFinanceiros.service";

describe("calcularJuros", () => {
  it("retorna zero para zero dias de atraso", () => {
    expect(calcularJuros(1000, 0.033, 0)).toBe(0);
  });

  it("retorna zero quando taxa é zero", () => {
    expect(calcularJuros(1000, 0, 30)).toBe(0);
  });

  it("retorna zero quando valor é zero", () => {
    expect(calcularJuros(0, 0.033, 10)).toBe(0);
  });

  it("calcula juros simples diários corretamente para 1 dia", () => {
    // R$1000 × 0,033% × 1 = R$0,33
    expect(calcularJuros(1000, 0.033, 1)).toBe(0.33);
  });

  it("calcula juros simples diários corretamente para 30 dias", () => {
    // R$1000 × 0,033% × 30 = R$9,90
    expect(calcularJuros(1000, 0.033, 30)).toBe(9.9);
  });

  it("arredonda para 2 casas decimais", () => {
    // R$500 × 0,01% × 3 = R$0,15
    expect(calcularJuros(500, 0.01, 3)).toBe(0.15);
  });

  it("retorna zero para dias negativos", () => {
    expect(calcularJuros(1000, 0.033, -1)).toBe(0);
  });
});

describe("calcularDesconto", () => {
  it("calcula 10% de desconto sobre R$1000", () => {
    expect(calcularDesconto(1000, 10)).toBe(100);
  });

  it("retorna zero quando percentual é zero", () => {
    expect(calcularDesconto(1000, 0)).toBe(0);
  });

  it("retorna zero quando valor é zero", () => {
    expect(calcularDesconto(0, 10)).toBe(0);
  });

  it("arredonda para 2 casas decimais", () => {
    // R$333,33 × 5% = R$16,67
    expect(calcularDesconto(333.33, 5)).toBe(16.67);
  });

  it("calcula 100% de desconto corretamente", () => {
    expect(calcularDesconto(500, 100)).toBe(500);
  });
});

describe("calcularMulta", () => {
  it("calcula 2% de multa sobre R$1000", () => {
    expect(calcularMulta(1000, 2)).toBe(20);
  });

  it("retorna zero quando percentual é zero", () => {
    expect(calcularMulta(1000, 0)).toBe(0);
  });

  it("arredonda para 2 casas decimais", () => {
    expect(calcularMulta(333.33, 2)).toBe(6.67);
  });
});

describe("gerarParcelas", () => {
  it("gera parcelas com valores iguais quando divisível", () => {
    const data = new Date("2026-01-10");
    const parcelas = gerarParcelas(300, 3, data, 30);
    expect(parcelas).toHaveLength(3);
    expect(parcelas[0].valor).toBe(100);
    expect(parcelas[1].valor).toBe(100);
    expect(parcelas[2].valor).toBe(100);
  });

  it("adiciona o resíduo centavos na primeira parcela", () => {
    const data = new Date("2026-01-10");
    const parcelas = gerarParcelas(100, 3, data, 30);
    const soma = parcelas.reduce((s, p) => s + p.valor, 0);
    // Soma deve bater com o total (tolerância de 1 centavo)
    expect(Math.abs(soma - 100)).toBeLessThanOrEqual(0.01);
    // Primeira parcela deve ser maior ou igual às demais
    expect(parcelas[0].valor).toBeGreaterThanOrEqual(parcelas[1].valor);
  });

  it("gera as datas de vencimento com intervalo correto", () => {
    const data = new Date("2026-01-10");
    const parcelas = gerarParcelas(300, 3, data, 30);
    expect(parcelas[0].dataVencimento).toBe("2026-01-10");
    expect(parcelas[1].dataVencimento).toBe("2026-02-09");
    expect(parcelas[2].dataVencimento).toBe("2026-03-11");
  });

  it("numera as parcelas sequencialmente", () => {
    const data = new Date("2026-01-10");
    const parcelas = gerarParcelas(200, 2, data, 30);
    expect(parcelas[0].numero).toBe(1);
    expect(parcelas[1].numero).toBe(2);
  });

  it("retorna array vazio para numParcelas menor que 1", () => {
    const data = new Date("2026-01-10");
    expect(gerarParcelas(1000, 0, data)).toHaveLength(0);
    expect(gerarParcelas(1000, -1, data)).toHaveLength(0);
  });

  it("gera uma única parcela quando numParcelas é 1", () => {
    const data = new Date("2026-01-10");
    const parcelas = gerarParcelas(500, 1, data);
    expect(parcelas).toHaveLength(1);
    expect(parcelas[0].valor).toBe(500);
    expect(parcelas[0].numero).toBe(1);
  });

  it("usa intervalo de 30 dias como padrão", () => {
    const data = new Date("2026-01-01");
    const parcelas = gerarParcelas(200, 2, data);
    expect(parcelas[1].dataVencimento).toBe("2026-01-31");
  });
});
