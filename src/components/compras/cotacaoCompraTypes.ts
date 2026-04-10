export interface CotacaoCompra {
  id: string;
  numero: string;
  data_cotacao: string;
  data_validade: string | null;
  status: string;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
}

export interface CotacaoItem {
  id: string;
  cotacao_compra_id: string;
  produto_id: string;
  quantidade: number;
  unidade: string;
  produtos?: { nome: string; codigo_interno: string; sku: string };
}

export interface CotacaoSummary {
  itens_count: number;
  fornecedores_count: number;
  vencedor_nome: string | null;
  tem_vencedor: boolean;
}

export interface Proposta {
  id?: string;
  cotacao_compra_id: string;
  item_id: string;
  fornecedor_id: string;
  preco_unitario: number;
  prazo_entrega_dias: number | null;
  observacoes: string | null;
  selecionado: boolean;
  fornecedores?: { nome_razao_social: string };
}

export interface LocalItem {
  _localId: string;
  id?: string;
  produto_id: string;
  quantidade: number;
  unidade: string;
}

export const statusLabels: Record<string, string> = {
  aberta: "Aberta",
  em_analise: "Em Análise",
  aguardando_aprovacao: "Aguardando Aprovação",
  aprovada: "Aprovada",
  finalizada: "Concluída",
  convertida: "Convertida em Pedido",
  rejeitada: "Rejeitada",
  cancelada: "Cancelada",
};

/** Maps legacy 'finalizada' status to 'aprovada' for flow/stepper logic */
export function normalizeStatus(status: string): string {
  return status === "finalizada" ? "aprovada" : status;
}

export const FLOW_STEPS = [
  { key: "aberta", label: "Em Cotação" },
  { key: "em_analise", label: "Em Análise" },
  { key: "aguardando_aprovacao", label: "Aprovação" },
  { key: "aprovada", label: "Aprovada" },
  { key: "convertida", label: "Convertida" },
];

export const FLOW_STEP_ORDER = ["aberta", "em_analise", "aguardando_aprovacao", "aprovada", "convertida"];

export function getFlowStepIndex(status: string): number {
  return FLOW_STEP_ORDER.indexOf(normalizeStatus(status));
}

export const emptyForm = {
  numero: "",
  data_cotacao: new Date().toISOString().split("T")[0],
  data_validade: "",
  observacoes: "",
  status: "aberta",
};
