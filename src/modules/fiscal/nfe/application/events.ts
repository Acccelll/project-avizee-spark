/**
 * Eventos internos da NF-e (fato passado, ADR-017).
 */
export type NFeEventName =
  | 'fiscal.nfe.criada'
  | 'fiscal.nfe.validada'
  | 'fiscal.nfe.assinada'
  | 'fiscal.nfe.transmitida'
  | 'fiscal.nfe.autorizada'
  | 'fiscal.nfe.rejeitada'
  | 'fiscal.nfe.denegada'
  | 'fiscal.nfe.persistida'
  | 'fiscal.nfe.atualizada'
  | 'fiscal.nfe.consultada';

export interface NFeEventPayload {
  correlationId: string;
  empresaId: string;
  chave?: string;
  status?: string;
  cstat?: string;
  xmotivo?: string;
}