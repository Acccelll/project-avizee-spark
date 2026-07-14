/**
 * Eventos internos publicados pelo módulo de recebimento (fato passado,
 * ADR-017). Adicionados também ao union `FiscalEventName`.
 */
export type RecebimentoEventName =
  | 'fiscal.recebimento.xml.recebido'
  | 'fiscal.recebimento.xml.duplicado'
  | 'fiscal.recebimento.xml.invalido'
  | 'fiscal.recebimento.xml.validado'
  | 'fiscal.recebimento.lote.iniciado'
  | 'fiscal.recebimento.lote.progresso'
  | 'fiscal.recebimento.lote.finalizado'
  | 'fiscal.recebimento.conciliacao.executada'
  | 'fiscal.recebimento.pendente_aprovacao'
  | 'fiscal.recebimento.integrado.compras'
  | 'fiscal.recebimento.integrado.estoque'
  | 'fiscal.recebimento.integrado.financeiro'
  | 'fiscal.recebimento.aprovado'
  | 'fiscal.recebimento.rejeitado'
  | 'fiscal.recebimento.reprocessado';

export interface RecebimentoEventPayload {
  correlationId: string;
  empresaId: string;
  documentoRecebidoId?: string;
  chave?: string;
  hash?: string;
  origem?: string;
  total?: number;
  processados?: number;
  falhas?: number;
}