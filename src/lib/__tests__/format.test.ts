import { describe, expect, it, vi } from "vitest";
import { calculateDaysBetween, daysSince, formatDate, formatMoney, formatNumber } from "@/lib/format";

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
