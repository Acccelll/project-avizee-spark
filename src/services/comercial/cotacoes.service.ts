/**
 * Pure business-logic helpers for the Cotações de Compra module.
 *
 * All functions are side-effect-free so they can be unit-tested without mocks.
 */

export interface CotacaoItemAprovacao {
  id: string;
}

export interface PropostaAprovacao {
  item_id: string;
  preco_unitario: number;
  selecionado: boolean;
}

export interface CotacaoAprovacao {
  status: string;
  itens: CotacaoItemAprovacao[];
  propostas: PropostaAprovacao[];
}

/**
 * Determines whether a cotação is eligible for approval.
 *
 * Rules:
 * 1. The cotação status must be "aguardando_aprovacao".
 * 2. Every item must have at least one selected proposal with `preco_unitario > 0`.
 */
export function podeAprovarCotacao(cotacao: CotacaoAprovacao): boolean {
  if (cotacao.status !== "aguardando_aprovacao") return false;

  if (cotacao.itens.length === 0) return false;

  return cotacao.itens.every((item) =>
    cotacao.propostas.some(
      (p) => p.item_id === item.id && p.selecionado && p.preco_unitario > 0,
    ),
  );
}
