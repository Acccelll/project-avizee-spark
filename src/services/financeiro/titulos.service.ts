/**
 * Tipos auxiliares de operações sobre títulos financeiros.
 *
 * As implementações antigas (`baixarTitulo`, `negociarTitulo`, `anteciparTitulo`)
 * foram removidas na Fase 5 — não tinham consumidor ativo e dependiam de
 * INSERT+UPDATE não-transacionais. Os fluxos canônicos passaram para:
 *   - Baixas em lote   → services/financeiro/baixas
 *   - Baixa individual → hook `useRegistrarBaixa` (RPC `registrar_baixa_financeira`)
 *   - Estornos         → services/financeiro/estornos
 *   - Cancelamento     → services/financeiro/cancelamentos
 */

import type { Parcela } from "./calculosFinanceiros.service";

export type { Parcela };

/** Dados necessários para realizar a baixa de um título. */
export interface BaixaTituloData {
  valorPago: number;
  desconto?: number;
  juros?: number;
  multa?: number;
  abatimento?: number;
  dataBaixa: string;
  formaPagamento: string;
  contaBancariaId: string;
  observacoes?: string;
}

/** Dados necessários para negociar (reparcelar) um título. */
export interface NegociacaoData {
  numParcelas: number;
  dataPrimeiroVencimento: Date;
  intervaloDias?: number;
  descricaoBase: string;
  tipo: string;
  formaPagamento?: string;
  contaBancariaId?: string;
  observacoes?: string;
}

/** Dados necessários para antecipar um título. */
export interface AntecipacaoData {
  dataAntecipacao: string;
  valorAntecipado: number;
  desconto?: number;
  formaPagamento: string;
  contaBancariaId: string;
  observacoes?: string;
}