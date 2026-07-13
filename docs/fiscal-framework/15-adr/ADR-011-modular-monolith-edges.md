# ADR-011 · Modular monolith de edges (não microserviços por documento)

**Status**: Aceito · **Data**: 2026-07-13 · **Etapa**: 2

## Contexto
Considerei uma edge por documento (fiscal-nfe, fiscal-nfce, fiscal-cte...). Deno Deploy cobra por edge ativa; volume atual não justifica.

## Decisão
Cinco edges canônicas: `fiscal-nfe`, `fiscal-events`, `fiscal-dfe`, `fiscal-cert`, `fiscal-cron`. Novos documentos usam módulo plugável dentro da edge existente até saturar.

## Consequências
- **+** Menos edges para manter/deployar/observar.
- **+** Bundle compartilhado (Core+Engines) — cache de imports.
- **−** Cold start ligeiramente maior; aceitável (< 500ms).