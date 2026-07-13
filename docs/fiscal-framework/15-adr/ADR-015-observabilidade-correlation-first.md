# ADR-015 · Observabilidade correlation-first (sem OTel em v1)

**Status**: Aceito · **Data**: 2026-07-13 · **Etapa**: 2

## Contexto
OTel/Tempo custa infra extra e Deno OTLP exporter ainda instável (2026-07).

## Decisão
v1 usa `correlation_id` como trace-id simplificado + `fiscal_auditoria` como storage de spans. Migração para OTel prevista em v2 quando exporter estabilizar (ADR futuro).

## Consequências
- **+** Zero infra extra; timeline reconstituível.
- **−** Sem visualização de span tree — mitigado por dashboards SQL.