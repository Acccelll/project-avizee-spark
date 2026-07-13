/**
 * Contratos (portas) da camada application.
 * Implementações concretas vivem em infrastructure/.
 */
import type { Ambiente, DocumentoFiscalTipo, UF } from '../../core/types';
import type {
  CertificadoDigital,
  ConfiguracaoFiscal,
  FiscalEndpoint,
} from '../../domain/entities';

export interface IEndpointRegistry {
  resolve(input: {
    documento: DocumentoFiscalTipo;
    uf: UF;
    ambiente: Ambiente;
    servico: string;
    versao?: string;
  }): Promise<FiscalEndpoint | null>;
}

export interface IRuntimeConfigProvider {
  getForEmpresa(empresaId: string | null): Promise<ConfiguracaoFiscal>;
}

export interface ICertificadoMetadataRepository {
  getByEmpresa(empresaId: string): Promise<CertificadoDigital | null>;
  upsert(cert: CertificadoDigital): Promise<void>;
}

export interface IIdempotencyRepository {
  register(empresaId: string, key: string): Promise<'new' | 'duplicate'>;
  complete(empresaId: string, key: string, hash: string, status: number): Promise<void>;
}

export interface IAuditoriaRepository {
  record(entry: AuditoriaEntry): Promise<void>;
}

export interface AuditoriaEntry {
  empresaId?: string | null;
  correlationId: string;
  operacao: string;
  ator?: string;
  documento?: string;
  chaveAcesso?: string;
  requestHash?: string;
  responseStatus?: number;
  cstat?: string;
  xmotivo?: string;
  duracaoMs?: number;
  endpointUrl?: string;
  retryable?: boolean;
  tentativa?: number;
  payloadExtra?: Record<string, unknown>;
}
