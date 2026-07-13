/**
 * Entidades base do domínio fiscal (Etapa 4 — apenas estrutura).
 */
import type { Ambiente, DocumentoFiscalTipo, UF } from '../../core/types';

export interface EmpresaFiscal {
  id: string;
  cnpj: string;
  razaoSocial: string;
  ie?: string;
  im?: string;
  uf: UF;
  regimeTributario: 1 | 2 | 3;
}

export interface AmbienteFiscal {
  empresaId: string;
  ambiente: Ambiente;
  contingenciaHabilitada: boolean;
}

export interface CertificadoDigital {
  empresaId: string;
  cnpj: string;
  serial?: string;
  subjectCn?: string;
  validadeInicio?: string;
  validadeFim?: string;
  storagePath?: string;
  vaultSecretName?: string;
}

export interface DocumentoFiscal {
  id: string;
  tipo: DocumentoFiscalTipo;
  empresaId: string;
  chaveAcesso?: string;
  ambiente: Ambiente;
  status: string;
}

export interface EventoFiscal {
  id: string;
  chaveAcesso: string;
  tpEvento: string;
  nSeqEvento: number;
  status: string;
}

export interface Protocolo {
  nProt: string;
  cStat: string;
  xMotivo: string;
  dhRecbto: string;
}

export interface ConfiguracaoFiscal {
  empresaId: string | null;
  timeoutAutorizacaoMs: number;
  timeoutStatusMs: number;
  politicaRetry: { max: number; backoffMs: number[] };
  contingenciaHabilitada: boolean;
  syncAutoCiencia: boolean;
}

export interface FiscalEndpoint {
  documento: DocumentoFiscalTipo;
  uf: UF;
  ambiente: Ambiente;
  servico: string;
  versao: string;
  url: string;
}
