# Etapa 4 — Infraestrutura Base do Framework Fiscal

## Banco de dados
Migration criou: `fiscal_endpoints`, `fiscal_runtime_config`, `fiscal_schemas_pl`, `fiscal_certificado_metadata`, `fiscal_idempotency`, `fiscal_circuit_state`, `fiscal_auditoria` (append-only). RLS + policies em todas.

## Módulo `src/modules/fiscal/`
- `core/` — types, container, bootstrap (singleton DI).
- `domain/entities/` — EmpresaFiscal, CertificadoDigital, DocumentoFiscal, EventoFiscal, Protocolo, ConfiguracaoFiscal, FiscalEndpoint.
- `application/contracts/` — portas (IEndpointRegistry, IRuntimeConfigProvider, ICertificado…, IIdempotency…, IAuditoria…).
- `application/dto/` — DTOs stub.
- `infrastructure/`:
  - `config/endpointRegistry.ts` + `runtimeConfigProvider.ts` (cache TTL).
  - `certificates/certificadoMetadataRepository.ts`.
  - `repositories/idempotencyRepository.ts`.
  - `audit/auditoriaRepository.ts` (falhas não abortam).
  - `events/eventBus.ts` (in-process).
  - `queue/inMemoryQueue.ts` (retry/backoff/DLQ).
  - `cache/fiscalCache.ts` (TTL + invalidate por prefixo).
  - `logging/fiscalLogger.ts` (wrapper `@/lib/logger`).

## Testes
`__tests__/infrastructure.test.ts` — 5/5 passando (cache, eventBus, queue, bootstrap).

## Restrições cumpridas
Sem SEFAZ/XML/assinatura/emissão. Serviços legacy em `src/services/fiscal/*` intocados (ADR-016).

## TODOs Etapa 5+
- Regenerar `supabase/types.ts` (remove `@ts-expect-error`).
- Seed inicial de `fiscal_endpoints` (NF-e SP homolog).
- Plugar queue em pgmq/edge cron.
- Admin UI para endpoints e runtime config.
