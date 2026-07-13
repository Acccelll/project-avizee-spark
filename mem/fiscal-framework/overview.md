---
name: Framework Fiscal — visão geral e regra core
description: Toda tarefa fiscal (NF-e, NFC-e, CT-e, MDF-e, NFS-e, DF-e, eventos) deve seguir os documentos e ADRs em docs/fiscal-framework/
type: preference
---
Regra core: **antes de tocar em qualquer código fiscal** (services, edges, migrations, componentes), consulte `docs/fiscal-framework/00-INDEX.md` e os ADRs em `docs/fiscal-framework/15-adr/`. A arquitetura alvo é TypeScript nativo em edges Deno + Postgres/RLS/Storage/Vault — sem worker externo, sem .NET. Aproveita padrões do FiscalFramework v0.21 apenas como referência (Endpoint Registry, C14N própria, SignatureSuite ágil, plugin por documento, Result Pattern). Migração da camada antiga (`sefaz-proxy`, `sefaz-distdfe`, `process-*-cron`) é gradual por feature flag `fiscal:v2:*`.

**How to apply:** ao propor mudança fiscal, primeiro identifique em qual módulo do doc 07 ela cabe e em qual etapa do backlog (doc 18) ela pertence. Nunca hardcode URL SEFAZ (ADR-003). Nunca use `console.*`, `new Date()` em módulos fiscais ou `throw` para rejeição SEFAZ (ver doc 19 §anti-padrões).