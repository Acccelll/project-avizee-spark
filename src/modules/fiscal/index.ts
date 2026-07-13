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
