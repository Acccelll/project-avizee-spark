import { describe, it, expect } from "vitest";
import {
  validarCep,
  calcularFreteEstimado,
  calcularPrazoEntrega,
} from "../logistica";

// ─── validarCep ───────────────────────────────────────────────────────────────

describe("validarCep", () => {
  it("accepts a formatted CEP (00000-000)", () => {
    expect(validarCep("01310-100")).toBe(true);
  });

  it("accepts a raw 8-digit CEP", () => {
    expect(validarCep("01310100")).toBe(true);
  });

  it("rejects a CEP with fewer than 8 digits", () => {
    expect(validarCep("0131010")).toBe(false);
  });

  it("rejects a CEP with more than 8 digits", () => {
    expect(validarCep("013101000")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(validarCep("")).toBe(false);
  });

  it("rejects alphanumeric input", () => {
    expect(validarCep("ABCDE-123")).toBe(false);
  });

  it("accepts leading/trailing spaces (trim)", () => {
    expect(validarCep("  01310-100  ")).toBe(true);
  });
});

// ─── calcularFreteEstimado ────────────────────────────────────────────────────

describe("calcularFreteEstimado", () => {
  const itens = [{ peso_kg: 2, quantidade: 3 }]; // 6 kg total

  it("calculates frete with defaults (5 + 6 × 100 × 0.05 = 35)", () => {
    expect(calcularFreteEstimado({ itens, distancia_km: 100 })).toBeCloseTo(35);
  });

  it("returns base cost for zero distance", () => {
    expect(calcularFreteEstimado({ itens, distancia_km: 0 })).toBeCloseTo(5);
  });

  it("returns base cost for empty items list", () => {
    expect(calcularFreteEstimado({ itens: [], distancia_km: 100 })).toBeCloseTo(5);
  });

  it("respects custom custo_base", () => {
    expect(
      calcularFreteEstimado({ itens, distancia_km: 100, custo_base: 10 }),
    ).toBeCloseTo(40);
  });

  it("respects custom custo_por_kg_km", () => {
    expect(
      calcularFreteEstimado({ itens, distancia_km: 100, custo_por_kg_km: 0.1 }),
    ).toBeCloseTo(65);
  });

  it("throws for negative distance", () => {
    expect(() => calcularFreteEstimado({ itens, distancia_km: -1 })).toThrow(
      "distancia_km não pode ser negativa",
    );
  });

  it("throws for negative item weight", () => {
    expect(() =>
      calcularFreteEstimado({ itens: [{ peso_kg: -1, quantidade: 1 }], distancia_km: 100 }),
    ).toThrow("Peso e quantidade dos itens devem ser não-negativos");
  });

  it("throws for negative item quantity", () => {
    expect(() =>
      calcularFreteEstimado({ itens: [{ peso_kg: 1, quantidade: -2 }], distancia_km: 100 }),
    ).toThrow("Peso e quantidade dos itens devem ser não-negativos");
  });
});

// ─── calcularPrazoEntrega ─────────────────────────────────────────────────────

describe("calcularPrazoEntrega", () => {
  it("returns correct days for a known distance (400 km → 1 transit + 1 handling = 2)", () => {
    expect(calcularPrazoEntrega({ distancia_km: 400 })).toBe(2);
  });

  it("adds manuseio days on top of transit days", () => {
    expect(calcularPrazoEntrega({ distancia_km: 800, dias_manuseio: 2 })).toBe(4);
  });

  it("returns at least 1 day for zero distance", () => {
    expect(calcularPrazoEntrega({ distancia_km: 0 })).toBe(1);
  });

  it("rounds fractional transit days up (ceil)", () => {
    // 50 km / 400 km/day = 0.125 → ceil = 1 + 1 manuseio = 2
    expect(calcularPrazoEntrega({ distancia_km: 50 })).toBe(2);
  });

  it("respects custom velocidade_km_por_dia", () => {
    // 1000 km / 500 km/day = 2 + 1 = 3
    expect(calcularPrazoEntrega({ distancia_km: 1000, velocidade_km_por_dia: 500 })).toBe(3);
  });

  it("throws for negative distance", () => {
    expect(() => calcularPrazoEntrega({ distancia_km: -10 })).toThrow(
      "distancia_km não pode ser negativa",
    );
  });

  it("throws for zero velocidade_km_por_dia", () => {
    expect(() =>
      calcularPrazoEntrega({ distancia_km: 100, velocidade_km_por_dia: 0 }),
    ).toThrow("velocidade_km_por_dia deve ser maior que zero");
  });
});
