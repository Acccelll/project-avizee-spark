import { describe, it, expect } from "vitest";
import {
  getSituacaoEstoque,
  calcularMargem,
  calcularLucroBruto,
  calcularCustoComposto,
  calcularEstoqueValor,
} from "../cadastros";

// ─── getSituacaoEstoque ──────────────────────────

describe("getSituacaoEstoque", () => {
  it("returns 'zerado' when estoque is 0", () => {
    expect(getSituacaoEstoque(0, 10)).toBe("zerado");
  });

  it("returns 'zerado' when estoque is negative", () => {
    expect(getSituacaoEstoque(-5, 10)).toBe("zerado");
  });

  it("returns 'zerado' when estoque is null", () => {
    expect(getSituacaoEstoque(null, 10)).toBe("zerado");
  });

  it("returns 'zerado' when estoque is undefined", () => {
    expect(getSituacaoEstoque(undefined, 10)).toBe("zerado");
  });

  it("returns 'critico' when estoque equals minimo", () => {
    expect(getSituacaoEstoque(10, 10)).toBe("critico");
  });

  it("returns 'critico' when estoque is below minimo", () => {
    expect(getSituacaoEstoque(5, 10)).toBe("critico");
  });

  it("returns 'atencao' when estoque is between minimo and minimo*1.2", () => {
    expect(getSituacaoEstoque(11, 10)).toBe("atencao");
    expect(getSituacaoEstoque(12, 10)).toBe("atencao");
  });

  it("returns 'normal' when estoque is above minimo*1.2", () => {
    expect(getSituacaoEstoque(13, 10)).toBe("normal");
    expect(getSituacaoEstoque(100, 10)).toBe("normal");
  });

  it("returns 'normal' when minimo is 0 and estoque is positive", () => {
    expect(getSituacaoEstoque(50, 0)).toBe("normal");
    expect(getSituacaoEstoque(1, null)).toBe("normal");
  });
});

// ─── calcularMargem ──────────────────────────────

describe("calcularMargem", () => {
  it("calculates positive margin", () => {
    expect(calcularMargem(150, 100)).toBeCloseTo(50);
  });

  it("calculates negative margin", () => {
    expect(calcularMargem(80, 100)).toBeCloseTo(-20);
  });

  it("returns 0 when custo is zero", () => {
    expect(calcularMargem(100, 0)).toBe(0);
  });

  it("returns 0 when custo is null", () => {
    expect(calcularMargem(100, null)).toBe(0);
  });

  it("returns 0 when custo is undefined", () => {
    expect(calcularMargem(100, undefined)).toBe(0);
  });

  it("returns 0 when custo is negative", () => {
    expect(calcularMargem(100, -10)).toBe(0);
  });

  it("returns 100% when venda is double the custo", () => {
    expect(calcularMargem(200, 100)).toBeCloseTo(100);
  });
});

// ─── calcularLucroBruto ──────────────────────────

describe("calcularLucroBruto", () => {
  it("calculates positive profit", () => {
    expect(calcularLucroBruto(150, 100)).toBe(50);
  });

  it("calculates negative profit", () => {
    expect(calcularLucroBruto(80, 100)).toBe(-20);
  });

  it("treats null custo as 0", () => {
    expect(calcularLucroBruto(100, null)).toBe(100);
  });

  it("treats undefined custo as 0", () => {
    expect(calcularLucroBruto(100, undefined)).toBe(100);
  });
});

// ─── calcularCustoComposto ───────────────────────

describe("calcularCustoComposto", () => {
  it("calculates total from composition", () => {
    expect(
      calcularCustoComposto([
        { quantidade: 2, preco_custo: 10 },
        { quantidade: 3, preco_custo: 20 },
      ]),
    ).toBe(80);
  });

  it("returns 0 for empty composition", () => {
    expect(calcularCustoComposto([])).toBe(0);
  });

  it("treats null preco_custo as 0", () => {
    expect(
      calcularCustoComposto([
        { quantidade: 5, preco_custo: null },
        { quantidade: 2, preco_custo: 10 },
      ]),
    ).toBe(20);
  });

  it("handles single item", () => {
    expect(calcularCustoComposto([{ quantidade: 1, preco_custo: 99.9 }])).toBeCloseTo(99.9);
  });
});

// ─── calcularEstoqueValor ────────────────────────

describe("calcularEstoqueValor", () => {
  it("calculates stock value", () => {
    expect(calcularEstoqueValor(50, 10)).toBe(500);
  });

  it("returns 0 when estoque is null", () => {
    expect(calcularEstoqueValor(null, 10)).toBe(0);
  });

  it("returns 0 when custo is null", () => {
    expect(calcularEstoqueValor(50, null)).toBe(0);
  });

  it("returns 0 when both are 0", () => {
    expect(calcularEstoqueValor(0, 0)).toBe(0);
  });
});
