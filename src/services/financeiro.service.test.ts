import { describe, expect, it } from "vitest";
import { criarPlanoBaixaLote, type BaixaLoteParams } from "@/services/financeiro.service";

const baseParams: BaixaLoteParams = {
  selectedIds: ["1", "2"],
  selectedLancamentos: [
    { id: "1", valor: 100, saldo_restante: null },
    { id: "2", valor: 300, saldo_restante: 200 },
  ],
  tipoBaixa: "total",
  valorPagoBaixa: 0,
  totalBaixa: 0,
  baixaDate: "2026-04-15",
  formaPagamento: "pix",
  contaBancariaId: "bank-1",
};

describe("criarPlanoBaixaLote", () => {
  it("gera plano de baixa total com status pago e saldo zero", () => {
    const plan = criarPlanoBaixaLote(baseParams);

    expect(plan).toEqual([
      { id: "1", saldo: 100, valor: 100, valorPago: 100, novoSaldo: 0, novoStatus: "pago" },
      { id: "2", saldo: 200, valor: 300, valorPago: 200, novoSaldo: 0, novoStatus: "pago" },
    ]);
  });

  it("gera plano de baixa parcial proporcional com status parcial/pago", () => {
    const plan = criarPlanoBaixaLote({
      ...baseParams,
      tipoBaixa: "parcial",
      valorPagoBaixa: 150,
      totalBaixa: 300,
    });

    expect(plan[0].valorPago).toBe(50);
    expect(plan[0].novoSaldo).toBe(50);
    expect(plan[0].novoStatus).toBe("parcial");

    expect(plan[1].valorPago).toBe(100);
    expect(plan[1].novoSaldo).toBe(100);
    expect(plan[1].novoStatus).toBe("parcial");
  });

  it("falha quando falta lançamento na seleção", () => {
    expect(() =>
      criarPlanoBaixaLote({
        ...baseParams,
        selectedIds: ["1", "3"],
      }),
    ).toThrow("não encontrado");
  });

  it("falha em baixa parcial com valores inválidos", () => {
    expect(() =>
      criarPlanoBaixaLote({
        ...baseParams,
        tipoBaixa: "parcial",
        valorPagoBaixa: 0,
        totalBaixa: 0,
      }),
    ).toThrow("Baixa parcial inválida");
  });

  it("falha quando dados obrigatórios da baixa estão ausentes", () => {
    expect(() =>
      criarPlanoBaixaLote({
        ...baseParams,
        formaPagamento: "",
      }),
    ).toThrow("Dados obrigatórios da baixa");
  });

  it("arredonda baixa parcial sem gerar saldo negativo", () => {
    const plan = criarPlanoBaixaLote({
      ...baseParams,
      selectedIds: ["1"],
      selectedLancamentos: [{ id: "1", valor: 100, saldo_restante: 0.01 }],
      tipoBaixa: "parcial",
      totalBaixa: 1,
      valorPagoBaixa: 1,
    });

    expect(plan[0].valorPago).toBe(0.01);
    expect(plan[0].novoSaldo).toBe(0);
    expect(plan[0].novoStatus).toBe("pago");
  });
});
