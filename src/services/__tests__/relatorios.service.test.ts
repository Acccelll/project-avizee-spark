import { describe, it, expect } from "vitest";
import { formatCellValue } from "../relatorios.service";

describe("formatCellValue", () => {
  it("formats currency-like number keys", () => {
    const result = formatCellValue(1500.5, "valor_total");
    expect(result).toBeDefined();
    expect(typeof result).toBe("string");
  });

  it("formats date strings", () => {
    const result = formatCellValue("2025-03-15", "data_emissao");
    expect(typeof result).toBe("string");
    expect(result).toContain("15");
  });

  it("returns dash for null", () => {
    expect(formatCellValue(null, "campo")).toBe("-");
  });

  it("returns dash for undefined", () => {
    expect(formatCellValue(undefined, "campo")).toBe("-");
  });

  it("formats number as quantity in quantity report", () => {
    const result = formatCellValue(42, "estoqueAtual", true);
    expect(result).toBeDefined();
  });

  it("passes through plain strings", () => {
    expect(formatCellValue("hello", "nome")).toBe("hello");
  });
});
