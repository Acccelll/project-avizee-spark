# ADR-007 — Fila (pgmq) para assíncrono; síncrono para o resto

**Status**: aceito · **Data**: 2026-07-13

## Contexto
Operações fiscais têm perfis distintos: autorização é interativa; DistDFe é
background; retry precisa backoff. Não faz sentido tudo síncrono nem tudo em fila.

## Decisão

| Operação | Modo |
|----------|------|
| Autorização síncrona (lote pequeno) | Síncrono na edge |
| RetAutorizacao (poll de lote assíncrono) | Fila `fiscal.retry.autorizacao` |
| Consulta situação | Síncrono |
| Cancelamento / CCe / Inutilização | Síncrono |
| Manifestação de 1 chave (UI) | Síncrono |
| Manifestação em lote / auto-ciência | Fila `fiscal.eventos.manif` |
| DistDFe (sync NSU) | Fila `fiscal.dfe.sync` (30 min) |
| Retry por falha transitória | Fila `fiscal.retry.*` (backoff exponencial) |
| Status serviço | Síncrono (cache 60s) |

Transporte: **pgmq** (Postgres Message Queue), consumidor único `fiscal-cron`
a cada minuto.

## Consequências
Substitui `nfe_emissao_pendente`, `process-nfe-retry-cron` e
`process-distdfe-cron` por infra única. Consumidor idempotente por chave
natural + `visibility_timeout` pgmq.

## Referência
`.lovable/memory/integracoes/email-notificacoes.md` (padrão pgmq já em uso).