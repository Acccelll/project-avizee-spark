import { statusOrcamento, statusPedido } from "@/lib/statusSchema";

export const comercialLabels = {
  quote: "Orçamento",
  quotes: "Orçamentos",
  order: "Pedido",
  orders: "Pedidos",
  invoice: "Nota Fiscal",
} as const;

export function normalizeOrcamentoStatus(status?: string | null): string {
  if (!status) return "rascunho";
  // Aliases legados (dados antigos da UI) → canônico
  if (status === "confirmado" || status === "enviado") return "pendente";
  return status;
}

export function getOrcamentoStatusLabel(status?: string | null): string {
  const normalized = normalizeOrcamentoStatus(status);
  return statusOrcamento[normalized]?.label || normalized;
}

export function canSendOrcamento(status?: string | null): boolean {
  return normalizeOrcamentoStatus(status) === "rascunho";
}

export function canApproveOrcamento(status?: string | null): boolean {
  return normalizeOrcamentoStatus(status) === "pendente";
}

export function canConvertOrcamento(status?: string | null): boolean {
  return normalizeOrcamentoStatus(status) === "aprovado";
}

/**
 * Gate único para "Gerar NF" a partir de um pedido.
 * Consumido pela grid (`Pedidos.tsx`) e pelo drawer (`OrdemVendaView.tsx`)
 * para evitar drift entre os dois pontos de entrada.
 */
export function canFaturarPedido(pedido?: {
  status?: string | null;
  status_faturamento?: string | null;
} | null): boolean {
  if (!pedido) return false;
  const status = pedido.status || "";
  const faturamento = pedido.status_faturamento || "";
  return (
    ["aprovada", "em_separacao", "separado"].includes(status) &&
    faturamento !== "total"
  );
}

export const statusFaturamentoLabels: Record<string, string> = {
  aguardando: "Aguardando",
  parcial: "Parcial",
  total: "Faturado",
};

export function getPedidoStatusLabel(status?: string | null): string {
  const key = status || "";
  return statusPedido[key]?.label || key || "—";
}

/**
 * Gate de cancelamento de pedido. Bloqueia se o pedido já está em
 * estado terminal (`cancelada`/`faturada`) ou se possui NF ativa vinculada
 * (NF não cancelada/denegada precisa ser revertida no Fiscal antes).
 */
export function canCancelarPedido(
  pedido?: { status?: string | null } | null,
  hasNFAtiva = false,
): boolean {
  if (!pedido) return false;
  const status = pedido.status || "";
  if (["cancelada", "faturada"].includes(status)) return false;
  if (hasNFAtiva) return false;
  return true;
}

/**
 * Espelha (de forma client-side) a CHECK constraint
 * `chk_ordens_venda_matriz_status` para falhar rápido na UI antes do
 * roundtrip. Combinações inválidas retornam `false`.
 *
 * Matriz (status → status_faturamento permitidos):
 *  - rascunho/pendente/aprovada/em_separacao/separado/em_transporte/entregue: aguardando
 *  - em_separacao/separado: aguardando | parcial
 *  - faturada_parcial: parcial
 *  - faturada: faturado | total
 *  - cancelada: qualquer (não bloqueia)
 */
export function validarTransicaoPedido(
  to: string,
  statusFaturamento?: string | null,
): boolean {
  const sf = statusFaturamento || "aguardando";
  if (to === "cancelada") return true;
  if (["faturada", "faturada_parcial"].includes(to)) {
    return ["parcial", "total", "faturado"].includes(sf);
  }
  if (["em_separacao", "separado"].includes(to)) {
    return ["aguardando", "parcial"].includes(sf);
  }
  // rascunho, pendente, aprovada, em_transporte, entregue
  return sf === "aguardando" || sf === "parcial";
}
