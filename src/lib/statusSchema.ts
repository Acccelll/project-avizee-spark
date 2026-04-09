// Centralized status definitions for all ERP modules

export const statusOrcamento: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "secondary" },
  enviado: { label: "Enviado", color: "info" },
  confirmado: { label: "Aguardando Aprovação", color: "info" },
  aprovado: { label: "Aprovado", color: "success" },
  convertido: { label: "Convertido em Pedido", color: "success" },
  rejeitado: { label: "Rejeitado", color: "destructive" },
  cancelado: { label: "Cancelado", color: "destructive" },
  expirado: { label: "Expirado", color: "warning" },
};

export const statusCompra: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Cotação", color: "secondary" },
  confirmado: { label: "Pedido Confirmado", color: "info" },
  parcial: { label: "Recebimento Parcial", color: "warning" },
  entregue: { label: "Entregue", color: "success" },
  cancelado: { label: "Cancelado", color: "destructive" },
};

// Statuses for the Pedido entity (stored as ordens_venda in DB)
export const statusPedido: Record<string, { label: string; color: string }> = {
  pendente: { label: "Aguardando", color: "warning" },
  aprovada: { label: "Aprovado", color: "success" },
  em_separacao: { label: "Em Separação", color: "info" },
  separado: { label: "Separado", color: "info" },
  em_transporte: { label: "Em Transporte", color: "info" },
  entregue: { label: "Entregue", color: "success" },
  faturado: { label: "Faturado", color: "success" },
  cancelada: { label: "Cancelado", color: "destructive" },
};

/** @deprecated Use statusPedido instead */
export const statusOrdemVenda = statusPedido;

export const statusNotaFiscal: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "warning" },
  autorizada: { label: "Autorizada", color: "success" },
  cancelada: { label: "Cancelada", color: "destructive" },
  denegada: { label: "Denegada", color: "destructive" },
  inutilizada: { label: "Inutilizada", color: "secondary" },
};

export const statusFinanceiro: Record<string, { label: string; color: string }> = {
  aberto: { label: "Em Aberto", color: "warning" },
  parcial: { label: "Parcialmente Pago", color: "info" },
  pago: { label: "Pago", color: "success" },
  vencido: { label: "Vencido", color: "destructive" },
  cancelado: { label: "Cancelado", color: "secondary" },
  estornado: { label: "Estornado", color: "destructive" },
};

export const statusRemessa: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "warning" },
  em_transito: { label: "Em Trânsito", color: "info" },
  entregue: { label: "Entregue", color: "success" },
  devolvido: { label: "Devolvido", color: "destructive" },
};

export const statusCotacaoCompra: Record<string, { label: string; color: string }> = {
  aberta: { label: "Aberta", color: "info" },
  em_analise: { label: "Em Análise", color: "warning" },
  aguardando_aprovacao: { label: "Aguardando Aprovação", color: "warning" },
  aprovada: { label: "Aprovada", color: "success" },
  finalizada: { label: "Concluída", color: "success" },
  convertida: { label: "Convertida em Pedido", color: "success" },
  rejeitada: { label: "Rejeitada", color: "destructive" },
  cancelada: { label: "Cancelada", color: "destructive" },
};

export const statusPedidoCompra: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "secondary" },
  aprovado: { label: "Aprovado", color: "info" },
  enviado_ao_fornecedor: { label: "Enviado ao Fornecedor", color: "info" },
  aguardando_recebimento: { label: "Aguardando Recebimento", color: "warning" },
  parcialmente_recebido: { label: "Parcialmente Recebido", color: "warning" },
  recebido: { label: "Recebido", color: "success" },
  cancelado: { label: "Cancelado", color: "destructive" },
};

// Helper to get label from any status schema
export function getStatusLabel(schema: Record<string, { label: string; color: string }>, status: string): string {
  return schema[status]?.label || status;
}

export function getStatusColor(schema: Record<string, { label: string; color: string }>, status: string): string {
  return schema[status]?.color || "secondary";
}

// Convert status schema to MultiSelect options
export function statusToOptions(schema: Record<string, { label: string; color: string }>): { value: string; label: string }[] {
  return Object.entries(schema).map(([value, { label }]) => ({ value, label }));
}
