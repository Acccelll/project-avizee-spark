import {
  aggregateDailyFinanceiro,
  aggregateDailyVendas,
  aggregateTopClientes,
  aggregateTopProdutos,
  computeValorTotalEstoque,
  filterEstoqueBaixo,
  sumOpenFinanceiro,
  summarizeFiscalStats,
} from "@/lib/dashboard/aggregations";

describe("dashboard aggregations", () => {
  it("soma financeiro aberto respeitando saldo restante de parciais", () => {
    expect(
      sumOpenFinanceiro([
        { valor: 100, saldo_restante: null, status: "aberto" },
        { valor: 100, saldo_restante: 40, status: "parcial" },
      ]),
    ).toBe(140);
  });

  it("trata saldo restante nulo em parcial usando valor integral", () => {
    expect(
      sumOpenFinanceiro([
        { valor: 120, saldo_restante: null, status: "parcial" },
        { valor: 80, saldo_restante: 20, status: "parcial" },
      ]),
    ).toBe(140);
  });

  it("resume estatísticas fiscais por status", () => {
    expect(
      summarizeFiscalStats([
        { status: "confirmada", valor_total: 200 },
        { status: "importada", valor_total: 150 },
        { status: "rascunho", valor_total: 50 },
        { status: "pendente", valor_total: 60 },
        { status: "cancelada", valor_total: 30 },
      ]),
    ).toEqual({ emitidas: 2, pendentes: 2, canceladas: 1, valorEmitidas: 350 });
  });

  it("gera top clientes com ordenação descrescente", () => {
    const result = aggregateTopClientes([
      { clientes: { nome_razao_social: "A" }, valor: 100, saldo_restante: null, status: "aberto" },
      { clientes: { nome_razao_social: "B" }, valor: 50, saldo_restante: null, status: "aberto" },
      { clientes: { nome_razao_social: "A" }, valor: 30, saldo_restante: null, status: "aberto" },
    ]);

    expect(result[0]).toEqual({ nome: "A", valor: 130 });
    expect(result[1]).toEqual({ nome: "B", valor: 50 });
  });

  it("gera top produtos por faturamento de itens", () => {
    const result = aggregateTopProdutos([
      { quantidade: 2, valor_unitario: 10, produtos: { nome: "X" } },
      { quantidade: 1, valor_unitario: 50, produtos: { nome: "Y" } },
      { quantidade: 3, valor_unitario: 10, produtos: { nome: "X" } },
    ]);

    expect(result[0]).toEqual({ nome: "X", valor: 50 });
    expect(result[1]).toEqual({ nome: "Y", valor: 50 });
  });

  it("agrega séries diárias de financeiro e vendas", () => {
    const days = ["2026-04-13", "2026-04-14"];

    expect(
      aggregateDailyFinanceiro(days, [
        { data_vencimento: "2026-04-13", valor: 100, saldo_restante: null, status: "aberto" },
      ]),
    ).toEqual([
      { dia: "13/04", valor: 100 },
      { dia: "14/04", valor: 0 },
    ]);

    expect(
      aggregateDailyVendas(days, [
        { data_emissao: "2026-04-13", valor_total: 20 },
        { data_emissao: "2026-04-13", valor_total: 30 },
      ]),
    ).toEqual([
      { dia: "13/04", valor: 50 },
      { dia: "14/04", valor: 0 },
    ]);
  });

  it("mantém ordenação de dias mesmo com linhas fora do intervalo", () => {
    const days = ["2026-04-13", "2026-04-14"];

    expect(
      aggregateDailyFinanceiro(days, [
        { data_vencimento: "2026-04-16", valor: 999, saldo_restante: null, status: "aberto" },
        { data_vencimento: "2026-04-14", valor: 10, saldo_restante: null, status: "aberto" },
      ]),
    ).toEqual([
      { dia: "13/04", valor: 0 },
      { dia: "14/04", valor: 10 },
    ]);
  });

  it("filtra estoque baixo e calcula valor de estoque", () => {
    expect(
      filterEstoqueBaixo([
        { id: "1", nome: "A", codigo_interno: null, unidade_medida: "un", estoque_minimo: 10, estoque_atual: 8 },
        { id: "2", nome: "B", codigo_interno: null, unidade_medida: "un", estoque_minimo: 10, estoque_atual: 15 },
      ]),
    ).toHaveLength(1);

    expect(
      computeValorTotalEstoque([
        { estoque_atual: 3, preco_custo: 10 },
        { estoque_atual: 2, preco_custo: 5 },
      ]),
    ).toBe(40);
  });
});
