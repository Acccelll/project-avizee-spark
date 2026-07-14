/**
 * Entidades de domínio dos eventos fiscais da NF-e (Etapa 7).
 * Códigos oficiais conforme MOC NF-e 4.00.
 */

export const TIPO_EVENTO = {
  CANCELAMENTO: '110111',
  CARTA_CORRECAO: '110110',
  MANIF_CIENCIA: '210210',
  MANIF_CONFIRMACAO: '210200',
  MANIF_DESCONHECIMENTO: '210220',
  MANIF_NAO_REALIZADA: '210240',
  EPEC: '110140',
} as const;

export type TipoEventoNFe = typeof TIPO_EVENTO[keyof typeof TIPO_EVENTO];

export type EventoStatus = 'pendente' | 'transmitido' | 'homologado' | 'rejeitado' | 'cancelado';

export interface EventoFiscal {
  id: string;
  empresaId: string;
  chaveAcesso: string;                  // 44 dígitos
  tipoEvento: TipoEventoNFe;
  nSeqEvento: number;                   // 1..20
  cnpjOrgao: string;                    // CNPJ emitente ou destinatário
  dhEvento: string;                     // ISO 8601 com fuso
  detEvento: Record<string, string | number>;
  status: EventoStatus;
  protocolo?: string;
  cstat?: string;
  xmotivo?: string;
  correlationId: string;
  criadoEm?: string;
}

export interface InutilizacaoNumeracao {
  id: string;
  empresaId: string;
  ano: number;                          // 2 dígitos (ex.: 26)
  cnpj: string;
  serie: number;
  nNFIni: number;
  nNFFin: number;
  justificativa: string;                // >= 15 caracteres
  uf: string;
  ambiente: 1 | 2;
  status: 'pendente' | 'homologada' | 'rejeitada';
  protocolo?: string;
  cstat?: string;
  xmotivo?: string;
  correlationId: string;
}

export interface DistDFeState {
  empresaId: string;
  cnpj: string;
  ultNSU: string;                       // 15 dígitos
  maxNSU?: string;
  ultimaConsulta?: string;
}

export interface DistDFeDocumento {
  nsu: string;
  schema: string;                       // ex.: resNFe_v1.01.xsd
  chaveAcesso?: string;
  cnpjEmit?: string;
  xmlBase64: string;
  recebidoEm: string;
}