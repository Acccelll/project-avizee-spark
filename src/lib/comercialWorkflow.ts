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
