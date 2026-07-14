/**
 * Entrada pública do módulo Fiscal (Etapa 4).
 */
export { bootstrapFiscal, resetFiscal } from './core/bootstrap';
export type { FiscalContainer } from './core/container';
export * from './core/types';
export * from './domain/entities';
export type {
  IEndpointRegistry,
  IRuntimeConfigProvider,
  ICertificadoMetadataRepository,
  IIdempotencyRepository,
  IAuditoriaRepository,
  AuditoriaEntry,
} from './application/contracts';

// Etapa 5 — Núcleo de comunicação fiscal
export * from './core/errors';
export * from './infrastructure/xml/xmlEngine';
export * from './infrastructure/xml/xsdValidator';
export * from './infrastructure/signature/signatureEngine';
export * from './infrastructure/transport/retryPolicy';
export * from './infrastructure/transport/circuitBreaker';
export * from './infrastructure/transport/httpTransport';
export * from './infrastructure/soap/soapClient';

// Etapa 6 — Módulo NF-e (documento base)
export * as nfe from './nfe';

// Etapa 8 — Módulo de Recebimento Fiscal
export * as recebimento from './recebimento';

// Etapa 9 — Módulo de Escrituração Fiscal
export * as escrituracao from './escrituracao';
