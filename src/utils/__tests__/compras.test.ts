import { describe, it, expect } from "vitest";
import {
  calcularSubtotal,
  aplicarDesconto,
  calcularFrete,
  calcularTotalCompra,
} from "../compras";

// ─── calcularSubtotal ────────────────────────────────────────────────────────

describe("calcularSubtotal", () => {
  it("sums quantidade × valor_unitario for each item", () => {
    const itens = [
      { quantidade: 2, valor_unitario: 100 },
      { quantidade: 5, valor_unitario: 20 },
    ];
    expect(calcularSubtotal(itens)).toBe(300);
  });

  it("returns 0 for an empty list", () => {
    expect(calcularSubtotal([])).toBe(0);
  });

  it("handles a single item", () => {
    expect(calcularSubtotal([{ quantidade: 3, valor_unitario: 50 }])).toBe(150);
  });

  it("handles fractional unit prices", () => {
    expect(calcularSubtotal([{ quantidade: 4, valor_unitario: 1.25 }])).toBeCloseTo(5);
  });

  it("handles zero quantity", () => {
    expect(calcularSubtotal([{ quantidade: 0, valor_unitario: 100 }])).toBe(0);
  });
});

// ─── aplicarDesconto ─────────────────────────────────────────────────────────

describe("aplicarDesconto", () => {
  it("applies 10% discount", () => {
    expect(aplicarDesconto(200, 10)).toBe(180);
  });

  it("applies 0% discount (no change)", () => {
    expect(aplicarDesconto(500, 0)).toBe(500);
  });

  it("applies 100% discount resulting in 0", () => {
    expect(aplicarDesconto(300, 100)).toBe(0);
  });

  it("applies 25% discount", () => {
    expect(aplicarDesconto(400, 25)).toBe(300);
  });

  it("throws for negative discount", () => {
    expect(() => aplicarDesconto(100, -5)).toThrow("Desconto deve ser entre 0 e 100");
  });

  it("throws for discount greater than 100", () => {
    expect(() => aplicarDesconto(100, 110)).toThrow("Desconto deve ser entre 0 e 100");
  });
});

// ─── calcularFrete ────────────────────────────────────────────────────────────

describe("calcularFrete", () => {
  it("returns the freight value when positive", () => {
    expect(calcularFrete(50)).toBe(50);
  });

  it("returns 0 for zero freight", () => {
    expect(calcularFrete(0)).toBe(0);
  });

  it("returns 0 for negative freight value (guard)", () => {
    expect(calcularFrete(-10)).toBe(0);
  });

  it("handles fractional freight", () => {
    expect(calcularFrete(12.75)).toBe(12.75);
  });
});

// ─── calcularTotalCompra ──────────────────────────────────────────────────────

describe("calcularTotalCompra", () => {
  const itens = [
    { quantidade: 2, valor_unitario: 100 },
    { quantidade: 1, valor_unitario: 50 },
  ]; // subtotal = 250

  it("calculates total without discount, frete, or impostos", () => {
    expect(calcularTotalCompra({ itens })).toBe(250);
  });

  it("applies discount before adding frete and impostos", () => {
    // subtotal 250, 20% off = 200, + frete 30, + impostos 20 = 250
    expect(calcularTotalCompra({ itens, descontoPercent: 20, freteValor: 30, impostosValor: 20 })).toBe(250);
  });

  it("adds frete to total", () => {
    expect(calcularTotalCompra({ itens, freteValor: 40 })).toBe(290);
  });

  it("adds impostos to total", () => {
    expect(calcularTotalCompra({ itens, impostosValor: 15 })).toBe(265);
  });

  it("returns 0 for empty items with no extras", () => {
    expect(calcularTotalCompra({ itens: [] })).toBe(0);
  });

  it("handles 100% discount on items plus freight", () => {
    expect(calcularTotalCompra({ itens, descontoPercent: 100, freteValor: 50 })).toBe(50);
  });

  it("throws when discount is out of range", () => {
    expect(() => calcularTotalCompra({ itens, descontoPercent: 120 })).toThrow();
  });
});
