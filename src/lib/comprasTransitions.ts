/**
 * Máquina de estados pura para Cotação e Pedido de Compra.
 *
 * Espelha as triggers `trg_cotacao_compra_transicao` e
 * `trg_pedido_compra_transicao` (ver `docs/compras-modelo.md`).
 *
 * Use estas funções na UI para:
 * - Habilitar/desabilitar botões de ação **antes** do round-trip ao banco.
 * - Validar payloads em hooks/forms antes de submeter.
 * - Documentar visualmente o fluxo (fonte única de verdade no client).
 *
 * O servidor continua sendo a fonte canônica — estas funções nunca devem
 * ser usadas para PERMITIR algo que o servidor recusaria; só para EVITAR
 * UI inconsistente.
 */
import {
  canonicalCotacaoStatus,
  canonicalPedidoStatus,
} from "@/components/compras/comprasStatus";

export type CotacaoStatus =
  | "rascunho"
  | "aberta"
  | "em_analise"
  | "aguardando_aprovacao"
  | "aprovada"
  | "convertida"
  | "rejeitada"
  | "cancelada";

export type PedidoCompraStatus =
  | "rascunho"
  | "aguardando_aprovacao"
  | "aprovado"
  | "rejeitado"
  | "enviado_ao_fornecedor"
  | "aguardando_recebimento"
  | "parcialmente_recebido"
  | "recebido"
  | "cancelado";

const COTACAO_TERMINAIS: CotacaoStatus[] = ["convertida", "rejeitada", "cancelada"];
const PEDIDO_TERMINAIS: PedidoCompraStatus[] = ["recebido", "cancelado"];

/** Transições válidas Cotação. `from -> to[]`. Cancelar é universal (não-terminal). */
const COTACAO_TRANSICOES: Record<CotacaoStatus, CotacaoStatus[]> = {
  rascunho: ["aberta", "cancelada"],
  aberta: ["em_analise", "aguardando_aprovacao", "cancelada"],
  em_analise: ["aguardando_aprovacao", "aberta", "cancelada"],
  aguardando_aprovacao: ["aprovada", "rejeitada", "cancelada"],
  aprovada: ["convertida", "cancelada"],
  convertida: [],
  rejeitada: [],
  cancelada: [],
};

/** Transições válidas Pedido. `from -> to[]`. Cancelar até `aguardando_recebimento`. */
const PEDIDO_TRANSICOES: Record<PedidoCompraStatus, PedidoCompraStatus[]> = {
  rascunho: ["aguardando_aprovacao", "aprovado", "cancelado"],
  aguardando_aprovacao: ["aprovado", "rejeitado", "cancelado"],
  aprovado: ["enviado_ao_fornecedor", "aguardando_recebimento", "cancelado"],
  rejeitado: [],
  enviado_ao_fornecedor: ["aguardando_recebimento", "parcialmente_recebido", "recebido", "cancelado"],
  aguardando_recebimento: ["parcialmente_recebido", "recebido", "cancelado"],
  parcialmente_recebido: ["parcialmente_recebido", "recebido"],
  recebido: [],
  cancelado: [],
};

export interface ValidacaoTransicao {
  ok: boolean;
  motivo?: string;
}

export function isCotacaoTerminal(status: string | null | undefined): boolean {
  return COTACAO_TERMINAIS.includes(canonicalCotacaoStatus(status) as CotacaoStatus);
}

export function isPedidoCompraTerminal(status: string | null | undefined): boolean {
  return PEDIDO_TERMINAIS.includes(canonicalPedidoStatus(status) as PedidoCompraStatus);
}

export function validarTransicaoCotacao(
  from: string | null | undefined,
  to: string,
): ValidacaoTransicao {
  const f = canonicalCotacaoStatus(from) as CotacaoStatus;
  const t = to as CotacaoStatus;
  if (f === t) return { ok: true };
  const allowed = COTACAO_TRANSICOES[f];
  if (!allowed) return { ok: false, motivo: `Status atual desconhecido: ${f}` };
  if (allowed.includes(t)) return { ok: true };
  return {
    ok: false,
    motivo: `Transição inválida: ${f} → ${t}. Permitidas: ${allowed.join(", ") || "(terminal)"}.`,
  };
}

export function validarTransicaoPedidoCompra(
  from: string | null | undefined,
  to: string,
): ValidacaoTransicao {
  const f = canonicalPedidoStatus(from) as PedidoCompraStatus;
  const t = to as PedidoCompraStatus;
  if (f === t) return { ok: true };
  const allowed = PEDIDO_TRANSICOES[f];
  if (!allowed) return { ok: false, motivo: `Status atual desconhecido: ${f}` };
  if (allowed.includes(t)) return { ok: true };
  return {
    ok: false,
    motivo: `Transição inválida: ${f} → ${t}. Permitidas: ${allowed.join(", ") || "(terminal)"}.`,
  };
}

export function transicoesPossiveisCotacao(from: string | null | undefined): CotacaoStatus[] {
  return COTACAO_TRANSICOES[canonicalCotacaoStatus(from) as CotacaoStatus] ?? [];
}

export function transicoesPossiveisPedidoCompra(from: string | null | undefined): PedidoCompraStatus[] {
  return PEDIDO_TRANSICOES[canonicalPedidoStatus(from) as PedidoCompraStatus] ?? [];
}