import { statusOrcamento, statusPedido } from "@/lib/statusSchema";

export const comercialLabels = {
  quote: "Cotação",
  quotes: "Cotações",
  order: "Pedido",
  orders: "Pedidos",
  invoice: "Nota Fiscal",
} as const;

export const ORCAMENTO_STATUS_ALIAS: Record<string, string> = {
  pendente: "confirmado",
};

export function normalizeOrcamentoStatus(status?: string | null): string {
  if (!status) return "rascunho";
  return ORCAMENTO_STATUS_ALIAS[status] || status;
}

export function getOrcamentoStatusLabel(status?: string | null): string {
  const normalized = normalizeOrcamentoStatus(status);
  return statusOrcamento[normalized]?.label || normalized;
}

export function canSendOrcamento(status?: string | null): boolean {
  return normalizeOrcamentoStatus(status) === "rascunho";
}

export function canApproveOrcamento(status?: string | null): boolean {
  return normalizeOrcamentoStatus(status) === "confirmado";
}

export function canConvertOrcamento(status?: string | null): boolean {
  return normalizeOrcamentoStatus(status) === "aprovado";
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
