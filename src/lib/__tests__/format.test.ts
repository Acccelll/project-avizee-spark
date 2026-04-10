import { describe, expect, it, vi } from "vitest";
import { calculateDaysBetween, daysSince, formatCurrency, formatDate, formatMoney, formatNumber, formatPercent } from "@/lib/format";

describe("format helpers", () => {
  it("deve formatar moeda em BRL", () => {
    expect(formatMoney(1234.56)).toContain("1.234,56");
  });

  it("deve formatar números com separador de milhar", () => {
    expect(formatNumber(15000)).toBe("15.000");
  });

  it("deve formatar datas em pt-BR", () => {
    expect(formatDate("2026-03-16T12:00:00Z")).toBe("16/03/2026");
  });

  it("deve calcular diferença em dias", () => {
    expect(calculateDaysBetween("2026-03-01", "2026-03-16")).toBe(15);
  });

  it("deve calcular dias desde uma data", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-16T12:00:00Z"));

    expect(daysSince("2026-03-10")).toBe(6);

    vi.useRealTimers();
  });
});

describe("formatCurrency - valores de borda", () => {
  it("formata zero como R$\u00a00,00", () => {
    expect(formatCurrency(0)).toContain("0,00");
  });

  it("formata valor negativo corretamente", () => {
    const result = formatCurrency(-99.99);
    expect(result).toContain("99,99");
    // Negative sign or parenthesis depending on locale
    expect(result).toMatch(/-|−/);
  });

  it("formata NaN como zero (R$\u00a00,00)", () => {
    expect(formatCurrency(NaN)).toContain("0,00");
  });

  it("formata Infinity como zero (R$\u00a00,00)", () => {
    expect(formatCurrency(Infinity)).toContain("0,00");
  });

  it("formata valor grande com separadores corretos", () => {
    expect(formatCurrency(1000000)).toContain("1.000.000");
  });
});

describe("formatDate - valores de borda", () => {
  it("retorna '-' para string vazia", () => {
    expect(formatDate("")).toBe("-");
  });

  it("aceita objeto Date diretamente", () => {
    expect(formatDate(new Date(2026, 2, 16))).toBe("16/03/2026");
  });

  it("formata string no formato YYYY-MM-DD sem shift de fuso horário", () => {
    expect(formatDate("2026-01-01")).toBe("01/01/2026");
  });
});

describe("formatPercent", () => {
  it("formata percentual com 2 casas decimais por padrão", () => {
    expect(formatPercent(50)).toContain("50,00");
    expect(formatPercent(50)).toContain("%");
  });

  it("respeita fractionDigits customizado", () => {
    expect(formatPercent(33.333, 1)).toContain("33,3");
  });

  it("formata zero", () => {
    expect(formatPercent(0)).toContain("0,00");
  });
});

describe("calculateDaysBetween", () => {
  it("retorna zero para mesma data", () => {
    expect(calculateDaysBetween("2026-03-10", "2026-03-10")).toBe(0);
  });

  it("retorna valor negativo para datas inversas", () => {
    expect(calculateDaysBetween("2026-03-16", "2026-03-01")).toBe(-15);
  });
});
