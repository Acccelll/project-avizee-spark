/**
 * Catálogo canônico de erros do Framework Fiscal (Etapa 5).
 * Códigos são estáveis (contrato público). Alinhado ao envelope ADR-014.
 */
import type { FiscalError } from './types';

export const FISCAL_ERROR_CODES = {
  // Rede/transporte
  NETWORK_TIMEOUT: 'FISCAL.NETWORK.TIMEOUT',
  NETWORK_UNREACHABLE: 'FISCAL.NETWORK.UNREACHABLE',
  NETWORK_TLS: 'FISCAL.NETWORK.TLS',
  // SOAP
  SOAP_MALFORMED: 'FISCAL.SOAP.MALFORMED',
  SOAP_FAULT: 'FISCAL.SOAP.FAULT',
  // XML/XSD
  XML_PARSE: 'FISCAL.XML.PARSE',
  XML_BUILD: 'FISCAL.XML.BUILD',
  XSD_INVALID: 'FISCAL.XSD.INVALID',
  XSD_UNAVAILABLE: 'FISCAL.XSD.UNAVAILABLE',
  // Assinatura
  SIGN_FAILED: 'FISCAL.SIGN.FAILED',
  SIGN_INVALID: 'FISCAL.SIGN.INVALID',
  // Certificado
  CERT_NOT_FOUND: 'FISCAL.CERT.NOT_FOUND',
  CERT_EXPIRED: 'FISCAL.CERT.EXPIRED',
  CERT_INVALID_PASSWORD: 'FISCAL.CERT.INVALID_PASSWORD',
  CERT_CORRUPT: 'FISCAL.CERT.CORRUPT',
  // Endpoint / Registry
  ENDPOINT_NOT_REGISTERED: 'FISCAL.ENDPOINT.NAO_CADASTRADO',
  // Resiliência
  BREAKER_OPEN: 'FISCAL.BREAKER.ABERTO',
  RETRY_EXHAUSTED: 'FISCAL.RETRY.ESGOTADO',
  // SEFAZ (fato de negócio)
  SEFAZ_REJEICAO: 'FISCAL.REJEICAO',
  SEFAZ_DENEGACAO: 'FISCAL.DENEGACAO',
  // Genéricos
  INTERNAL: 'FISCAL.INTERNAL',
  UNAUTHORIZED: 'FISCAL.UNAUTHORIZED',
  ENV_INVALIDO: 'FISCAL.AMBIENTE.INVALIDO',
} as const;

export type FiscalErrorCode = typeof FISCAL_ERROR_CODES[keyof typeof FISCAL_ERROR_CODES];

const RETRYABLE = new Set<string>([
  FISCAL_ERROR_CODES.NETWORK_TIMEOUT,
  FISCAL_ERROR_CODES.NETWORK_UNREACHABLE,
  FISCAL_ERROR_CODES.SOAP_MALFORMED,
  FISCAL_ERROR_CODES.BREAKER_OPEN,
]);

export function makeError(
  code: FiscalErrorCode,
  message: string,
  cause?: unknown,
): FiscalError {
  return { code, message, retryable: RETRYABLE.has(code), cause };
}

export function isRetryable(err: FiscalError): boolean {
  return err.retryable === true;
}