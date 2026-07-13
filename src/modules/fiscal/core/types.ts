/**
 * Framework Fiscal — tipos primitivos (Etapa 4).
 */
export type Ambiente = 1 | 2; // 1=Produção, 2=Homologação
export type DocumentoFiscalTipo = 'NFe' | 'NFCe' | 'CTe' | 'MDFe' | 'NFSe' | 'DFe';
export type UF =
  | 'AC' | 'AL' | 'AP' | 'AM' | 'BA' | 'CE' | 'DF' | 'ES' | 'GO' | 'MA'
  | 'MT' | 'MS' | 'MG' | 'PA' | 'PB' | 'PR' | 'PE' | 'PI' | 'RJ' | 'RN'
  | 'RS' | 'RO' | 'RR' | 'SC' | 'SP' | 'SE' | 'TO';

export interface CorrelatableRequest {
  correlationId: string;
  empresaId: string;
  idempotencyKey?: string;
}

export interface Result<T, E = FiscalError> {
  ok: boolean;
  data?: T;
  error?: E;
}

export interface FiscalError {
  code: string;
  message: string;
  retryable: boolean;
  cause?: unknown;
}

export function ok<T>(data: T): Result<T> { return { ok: true, data }; }
export function fail<T = never>(error: FiscalError): Result<T> { return { ok: false, error }; }
