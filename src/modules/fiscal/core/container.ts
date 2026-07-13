/**
 * Container mínimo de DI para o módulo Fiscal.
 * Substituível por biblioteca formal em etapa posterior.
 */
import { EndpointRegistry } from '../infrastructure/config/endpointRegistry';
import { RuntimeConfigProvider } from '../infrastructure/config/runtimeConfigProvider';
import { CertificadoMetadataRepository } from '../infrastructure/certificates/certificadoMetadataRepository';
import { IdempotencyRepository } from '../infrastructure/repositories/idempotencyRepository';
import { AuditoriaRepository } from '../infrastructure/audit/auditoriaRepository';
import { FiscalEventBus } from '../infrastructure/events/eventBus';
import { InMemoryQueue } from '../infrastructure/queue/inMemoryQueue';
import { FiscalCache } from '../infrastructure/cache/fiscalCache';
import { fiscalLogger, type FiscalLogger } from '../infrastructure/logging/fiscalLogger';

export interface FiscalContainer {
  endpoints: EndpointRegistry;
  runtimeConfig: RuntimeConfigProvider;
  certificados: CertificadoMetadataRepository;
  idempotency: IdempotencyRepository;
  auditoria: AuditoriaRepository;
  events: FiscalEventBus;
  queue: InMemoryQueue;
  cache: FiscalCache;
  logger: FiscalLogger;
}

export function createContainer(): FiscalContainer {
  const cache = new FiscalCache();
  return {
    endpoints: new EndpointRegistry(cache),
    runtimeConfig: new RuntimeConfigProvider(cache),
    certificados: new CertificadoMetadataRepository(),
    idempotency: new IdempotencyRepository(),
    auditoria: new AuditoriaRepository(),
    events: new FiscalEventBus(),
    queue: new InMemoryQueue(),
    cache,
    logger: fiscalLogger,
  };
}
