/**
 * Barramento interno — nomes de eventos publicados pelos use cases da
 * Etapa 7 (fato passado, ADR-017).
 */
export type EventoFiscalEventName =
  | 'fiscal.nfe.cancelamento.solicitado'
  | 'fiscal.nfe.cancelamento.homologado'
  | 'fiscal.nfe.cancelamento.rejeitado'
  | 'fiscal.nfe.cce.transmitida'
  | 'fiscal.nfe.cce.homologada'
  | 'fiscal.nfe.cce.rejeitada'
  | 'fiscal.nfe.inutilizacao.solicitada'
  | 'fiscal.nfe.inutilizacao.homologada'
  | 'fiscal.nfe.inutilizacao.rejeitada'
  | 'fiscal.nfe.manifestacao.transmitida'
  | 'fiscal.nfe.manifestacao.homologada'
  | 'fiscal.nfe.recibo.consultado'
  | 'fiscal.nfe.protocolo.consultado'
  | 'fiscal.nfe.distdfe.consultado'
  | 'fiscal.nfe.distdfe.documento_recebido'
  | 'fiscal.nfe.xml.baixado'
  | 'fiscal.nfe.status.sincronizado';

export interface EventoFiscalEventPayload {
  correlationId: string;
  empresaId: string;
  chave?: string;
  tipoEvento?: string;
  cstat?: string;
  xmotivo?: string;
  nsu?: string;
  protocolo?: string;
}