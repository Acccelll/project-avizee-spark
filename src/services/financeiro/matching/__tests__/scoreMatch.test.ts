import { describe, it, expect } from "vitest";
import { scoreMatch, type ExtratoInput, type CandidatoInput } from "../scoreMatch";

const baseCand: CandidatoInput = {
  id: "l1",
  tipo: "pagar",
  valor: 150,
  data_vencimento: "2026-07-10",
  fornecedor_nome: "Energia SA",
  fornecedor_documento: "12345678000199",
};

describe("scoreMatch", () => {
  it("match perfeito: valor+data+documento", () => {
    const ex: ExtratoInput = {
      data: "2026-07-10",
      valor: -150,
      favorecido_documento: "12.345.678/0001-99",
      forma_pagamento: "pix",
    };
    const r = scoreMatch(ex, { ...baseCand, forma_pagamento: "pix" });
    expect(r.score).toBeGreaterThanOrEqual(0.95);
  });

  it("sinal incorreto zera peso do valor", () => {
    const r = scoreMatch(
      { data: "2026-07-10", valor: 150 },
      baseCand,
    );
    // débito esperado; extrato é crédito → valor 0
    expect(r.score).toBeLessThan(0.4);
  });

  it("data distante decai suavemente", () => {
    const r = scoreMatch(
      { data: "2026-07-17", valor: -150 },
      baseCand,
    );
    expect(r.score).toBeGreaterThan(0.4);
    expect(r.score).toBeLessThan(0.9);
  });

  it("nome fuzzy quando não há documento", () => {
    const r = scoreMatch(
      { data: "2026-07-10", valor: -150, favorecido: "ENERGIA S A" },
      { ...baseCand, fornecedor_documento: null },
    );
    expect(r.motivos.some((m) => m.startsWith("nome"))).toBe(true);
  });
});