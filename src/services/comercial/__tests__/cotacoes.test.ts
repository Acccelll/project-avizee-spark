import { describe, it, expect } from "vitest";
import { podeAprovarCotacao, type CotacaoAprovacao } from "../cotacoes.service";

const item1 = { id: "item-1" };
const item2 = { id: "item-2" };

function buildCotacao(overrides: Partial<CotacaoAprovacao> = {}): CotacaoAprovacao {
  return {
    status: "aguardando_aprovacao",
    itens: [item1, item2],
    propostas: [
      { item_id: "item-1", preco_unitario: 100, selecionado: true },
      { item_id: "item-2", preco_unitario: 200, selecionado: true },
    ],
    ...overrides,
  };
}

// ─── podeAprovarCotacao ───────────────────────────────────────────────────────

describe("podeAprovarCotacao", () => {
  it("returns true when all items have a selected proposal with price > 0", () => {
    expect(podeAprovarCotacao(buildCotacao())).toBe(true);
  });

  it("returns false when status is not 'aguardando_aprovacao'", () => {
    expect(podeAprovarCotacao(buildCotacao({ status: "aberta" }))).toBe(false);
    expect(podeAprovarCotacao(buildCotacao({ status: "aprovada" }))).toBe(false);
    expect(podeAprovarCotacao(buildCotacao({ status: "rejeitada" }))).toBe(false);
    expect(podeAprovarCotacao(buildCotacao({ status: "pendente" }))).toBe(false);
  });

  it("returns false when there are no items", () => {
    expect(podeAprovarCotacao(buildCotacao({ itens: [] }))).toBe(false);
  });

  it("returns false when an item has no proposal", () => {
    const cotacao = buildCotacao({
      propostas: [
        // only item-1 has a proposal; item-2 has none
        { item_id: "item-1", preco_unitario: 100, selecionado: true },
      ],
    });
    expect(podeAprovarCotacao(cotacao)).toBe(false);
  });

  it("returns false when a proposal is not selected", () => {
    const cotacao = buildCotacao({
      propostas: [
        { item_id: "item-1", preco_unitario: 100, selecionado: true },
        { item_id: "item-2", preco_unitario: 200, selecionado: false },
      ],
    });
    expect(podeAprovarCotacao(cotacao)).toBe(false);
  });

  it("returns false when a selected proposal has preco_unitario = 0", () => {
    const cotacao = buildCotacao({
      propostas: [
        { item_id: "item-1", preco_unitario: 100, selecionado: true },
        { item_id: "item-2", preco_unitario: 0, selecionado: true },
      ],
    });
    expect(podeAprovarCotacao(cotacao)).toBe(false);
  });

  it("returns false when a selected proposal has negative price", () => {
    const cotacao = buildCotacao({
      propostas: [
        { item_id: "item-1", preco_unitario: 100, selecionado: true },
        { item_id: "item-2", preco_unitario: -10, selecionado: true },
      ],
    });
    expect(podeAprovarCotacao(cotacao)).toBe(false);
  });

  it("returns true with a single item that has a selected proposal", () => {
    const cotacao = buildCotacao({
      itens: [item1],
      propostas: [{ item_id: "item-1", preco_unitario: 50, selecionado: true }],
    });
    expect(podeAprovarCotacao(cotacao)).toBe(true);
  });

  it("accepts multiple proposals per item as long as at least one is selected with price > 0", () => {
    const cotacao = buildCotacao({
      itens: [item1],
      propostas: [
        { item_id: "item-1", preco_unitario: 80, selecionado: false },
        { item_id: "item-1", preco_unitario: 90, selecionado: true },
      ],
    });
    expect(podeAprovarCotacao(cotacao)).toBe(true);
  });
});
