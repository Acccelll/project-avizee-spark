import { describe, it, expect } from "vitest";
import {
  calcularTotalPedido,
  aplicarDesconto,
  calcularComissao,
  calcularMargem,
} from "../comercial";

// ─── calcularTotalPedido ─────────────────────────────────────────────────────

describe("calcularTotalPedido", () => {
  it("sums items without discount", () => {
    const itens = [
      { valor_unitario: 100, quantidade: 2 },
      { valor_unitario: 50, quantidade: 4 },
    ];
    expect(calcularTotalPedido(itens)).toBe(400);
  });

  it("applies per-item discount correctly", () => {
    const itens = [{ valor_unitario: 200, quantidade: 1, desconto: 10 }];
    expect(calcularTotalPedido(itens)).toBe(180);
  });

  it("handles mixed items with and without discount", () => {
    const itens = [
      { valor_unitario: 100, quantidade: 2, desconto: 0 },
      { valor_unitario: 100, quantidade: 1, desconto: 50 },
    ];
    expect(calcularTotalPedido(itens)).toBe(250);
  });

  it("returns 0 for empty list", () => {
    expect(calcularTotalPedido([])).toBe(0);
  });

  it("treats missing desconto as 0", () => {
    const itens = [{ valor_unitario: 80, quantidade: 5 }];
    expect(calcularTotalPedido(itens)).toBe(400);
  });

  it("applies 100% discount resulting in 0", () => {
    const itens = [{ valor_unitario: 100, quantidade: 3, desconto: 100 }];
    expect(calcularTotalPedido(itens)).toBe(0);
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
    expect(() => aplicarDesconto(100, -5)).toThrow();
  });

  it("throws for discount greater than 100", () => {
    expect(() => aplicarDesconto(100, 110)).toThrow();
  });
});

// ─── calcularComissao ────────────────────────────────────────────────────────

describe("calcularComissao", () => {
  it("calculates 5% commission on 2000", () => {
    expect(calcularComissao(2000, 5)).toBe(100);
  });

  it("calculates 0% commission results in 0", () => {
    expect(calcularComissao(1000, 0)).toBe(0);
  });

  it("calculates 100% commission equals full value", () => {
    expect(calcularComissao(500, 100)).toBe(500);
  });

  it("calculates fractional percentages", () => {
    expect(calcularComissao(1000, 2.5)).toBe(25);
  });

  it("throws for negative percentage", () => {
    expect(() => calcularComissao(500, -1)).toThrow();
  });

  it("throws for percentage greater than 100", () => {
    expect(() => calcularComissao(500, 101)).toThrow();
  });
});

// ─── calcularMargem ──────────────────────────────────────────────────────────

describe("calcularMargem", () => {
  it("calculates 50% margin when cost is half the price", () => {
    expect(calcularMargem(200, 100)).toBe(50);
  });

  it("returns 0 when precoVenda is 0", () => {
    expect(calcularMargem(0, 0)).toBe(0);
  });

  it("returns 100% margin when cost is 0", () => {
    expect(calcularMargem(300, 0)).toBe(100);
  });

  it("calculates negative margin when cost exceeds price", () => {
    expect(calcularMargem(100, 150)).toBe(-50);
  });

  it("calculates 0% margin when cost equals price", () => {
    expect(calcularMargem(250, 250)).toBe(0);
  });

  it("calculates correct margin for typical case", () => {
    // precoVenda=1000, custo=700 => margem=30%
    expect(calcularMargem(1000, 700)).toBeCloseTo(30);
  });
});
