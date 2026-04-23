/**
 * Tipagens explícitas para views públicas e estruturas JSON do Supabase
 * que ainda não estão refletidas em `Database['public']['Views']`.
 *
 * Existem para eliminar `as any` em pontos críticos onde a view é consumida
 * diretamente (telas públicas, dashboard) sem perder type safety.
 */

export interface OrcamentoPublicView {
  id: string;
  numero: string;
  data_orcamento: string;
  validade: string | null;
  valor_total: number | string | null;
  observacoes: string | null;
  status: string;
  prazo_entrega: string | null;
  prazo_pagamento: string | null;
  frete_tipo: string | null;
  cliente_snapshot: ClienteSnapshot | null;
  public_token: string;
}

export interface OrcamentoItemPublicView {
  descricao_snapshot: string | null;
  codigo_snapshot: string | null;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  valor_total: number;
  variacao: string | null;
  orcamento_id: string;
}

export interface ClienteSnapshot {
  nome_razao_social?: string | null;
  cpf_cnpj?: string | null;
  email?: string | null;
  telefone?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
}

export interface FluxoCaixaFinanceiroRow {
  tipo: 'receber' | 'pagar' | string;
  valor: number | string;
  data_ref: string;
  categoria: 'realizado' | 'previsto' | string;
}