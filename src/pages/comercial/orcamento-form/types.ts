import type { Json } from "@/integrations/supabase/types";

export interface ClienteSnapshot {
  nome_razao_social: string; nome_fantasia: string; cpf_cnpj: string;
  inscricao_estadual: string; email: string; telefone: string; celular: string;
  contato: string; logradouro: string; numero: string; bairro: string;
  cidade: string; uf: string; cep: string; codigo: string;
}

/** Payload para o parâmetro p_payload da RPC salvar_orcamento. */
export interface SalvarOrcamentoPayload {
  numero: string;
  data_orcamento: string;
  status: string;
  cliente_id: string | null;
  validade: string | null;
  observacoes: string;
  observacoes_internas: string | null;
  desconto: number;
  imposto_st: number;
  imposto_ipi: number;
  frete_valor: number;
  outras_despesas: number;
  valor_total: number;
  quantidade_total: number;
  peso_total: number;
  pagamento: string;
  prazo_pagamento: string;
  prazo_entrega: string;
  frete_tipo: string;
  modalidade: string;
  cliente_snapshot: ClienteSnapshot;
  transportadora_id: string | null;
  frete_simulacao_id: string | null;
  origem_frete: string | null;
  servico_frete: string | null;
  prazo_entrega_dias: number | null;
  volumes: number | null;
  altura_cm: number | null;
  largura_cm: number | null;
  comprimento_cm: number | null;
}

/** Payload para cada item no parâmetro p_itens da RPC salvar_orcamento. */
export interface SalvarOrcamentoItemPayload {
  produto_id: string | null;
  codigo_snapshot: string;
  descricao_snapshot: string;
  variacao: string | null;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  valor_total: number;
  peso_unitario: number;
  peso_total: number;
}

export const emptyCliente: ClienteSnapshot = {
  nome_razao_social: "", nome_fantasia: "", cpf_cnpj: "", inscricao_estadual: "",
  email: "", telefone: "", celular: "", contato: "", logradouro: "", numero: "",
  bairro: "", cidade: "", uf: "", cep: "", codigo: "",
};

export const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  pendente: "Aguardando aprovação",
  aprovado: "Aprovado",
  convertido: "Convertido",
  rejeitado: "Rejeitado",
  expirado: "Expirado",
  cancelado: "Cancelado",
  historico: "Histórico",
};

// Ensure Json import retained for downstream consumers.
export type _OrcamentoTypesJsonRef = Json;