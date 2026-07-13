---
name: Framework Fiscal — Infraestrutura Base (Etapa 4)
description: Módulo src/modules/fiscal com core/domain/application/infrastructure e tabelas fiscal_*
type: feature
---

## Localização
`src/modules/fiscal/` — camadas: `core`, `domain/entities`, `application/{contracts,dto}`, `infrastructure/{repositories,config,certificates,events,queue,cache,audit,logging}`.

## Entrada
- `bootstrapFiscal()` → devolve `FiscalContainer` singleton (endpoints, runtimeConfig, certificados, idempotency, auditoria, events, queue, cache, logger).
- Export público em `src/modules/fiscal/index.ts`.

## Tabelas criadas (Etapa 4)
- `fiscal_endpoints` (registry declarativo, ADR-003) — admin-only para escrita.
- `fiscal_runtime_config` (timeouts, retry, contingência por empresa; NULL = default).
- `fiscal_schemas_pl` (vigência de versões de schema).
- `fiscal_certificado_metadata` (metadados A1; binário fica em Storage + Vault).
- `fiscal_idempotency` (24h TTL; unique por empresa+key).
- `fiscal_circuit_state` (open/half/closed por UF/ambiente/serviço).
- `fiscal_auditoria` (append-only por trigger; retenção legal 5 anos).

RLS: leitura restrita a membros de `user_empresas`; escrita/config admin (`has_role`).

## Restrições da Etapa 4
- **Nenhuma** comunicação com SEFAZ, XML, assinatura, emissão, eventos fiscais reais.
- Serviços em `src/services/fiscal/*` seguem em produção (estrangulamento — ADR-016).
- Repositórios usam `@ts-expect-error` até `supabase/types.ts` ser regenerado (aprovação da migração dispara regeneração).

## Testes
`src/modules/fiscal/__tests__/infrastructure.test.ts` cobre cache/eventBus/queue/bootstrap.
