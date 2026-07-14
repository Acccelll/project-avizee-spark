/**
 * Entidades de domínio da NF-e modelo 55. Puras — não conhecem infra.
 * Subconjunto essencial do layout 4.00 suficiente para exercer o fluxo
 * de autorização; campos adicionais entram sob demanda.
 */
import type { Ambiente, UF } from '../../core/types';

export type NFeStatus =
  | 'rascunho'
  | 'validada'
  | 'assinada'
  | 'transmitida'
  | 'em_processamento'
  | 'autorizada'
  | 'denegada'
  | 'rejeitada'
  | 'cancelada'
  | 'inutilizada'
  | 'arquivada';

export type IndPag = 0 | 1 | 2; // 0=À vista 1=A prazo 2=Outros
export type FinNFe = 1 | 2 | 3 | 4; // 1=Normal 2=Complementar 3=Ajuste 4=Devolução
export type TpNF = 0 | 1; // 0=Entrada 1=Saída
export type IdDest = 1 | 2 | 3; // 1=Interna 2=Interestadual 3=Exterior
export type IndFinal = 0 | 1;
export type IndPres = 0 | 1 | 2 | 3 | 4 | 5 | 9;
export type TpEmis = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 9;
export type IndIEDest = 1 | 2 | 9;

export interface NFeEmitente {
  cnpj: string;
  xNome: string;
  ie: string;
  crt: 1 | 2 | 3 | 4;
  uf: UF;
  municipioIbge: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cep: string;
}

export interface NFeDestinatario {
  cnpjOuCpf: string;
  xNome: string;
  indIEDest: IndIEDest;
  ie?: string;
  uf: UF;
  municipioIbge: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cep: string;
  email?: string;
}

export interface NFeItem {
  nItem: number;
  cProd: string;
  cEAN?: string;
  xProd: string;
  ncm: string;
  cfop: string;
  uCom: string;
  qCom: number;
  vUnCom: number;
  vProd: number;
  cstIcms: string;
  origem: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
}

export interface NFeTotais {
  vBC: number;
  vICMS: number;
  vProd: number;
  vFrete: number;
  vSeg: number;
  vDesc: number;
  vNF: number;
}

export interface NFeIde {
  cUF: string;
  natOp: string;
  serie: number;
  nNF: number;
  dhEmi: string;
  tpNF: TpNF;
  idDest: IdDest;
  cMunFG: string;
  tpImp: 0 | 1 | 2 | 3 | 4 | 5;
  tpEmis: TpEmis;
  finNFe: FinNFe;
  indFinal: IndFinal;
  indPres: IndPres;
  ambiente: Ambiente;
  cNF: string;   // 8 dígitos aleatórios
  cDV?: string;  // calculado no builder
}

export interface NFe {
  id: string;                 // uuid interno
  empresaId: string;
  status: NFeStatus;
  chaveAcesso?: string;
  protocolo?: string;
  recibo?: string;
  ide: NFeIde;
  emitente: NFeEmitente;
  destinatario: NFeDestinatario;
  itens: NFeItem[];
  totais: NFeTotais;
  infAdic?: string;
  correlationId: string;
}