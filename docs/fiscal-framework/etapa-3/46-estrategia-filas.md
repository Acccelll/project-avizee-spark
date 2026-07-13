# 46 · Estratégia de filas

Baseado em **pgmq** (ADR-007). Refina doc 31 (Etapa 2).

## Classificação

### Filas síncronas (bloqueiam o cliente)
Nenhuma. Fluxo síncrono é chamada direta ao Application layer — não passa por fila. Motivo: latência previsível e feedback imediato ao usuário.

### Filas assíncronas

| Fila | Origem | Consumidor | Prioridade |
|---|---|---|---|
| `fiscal.retry.autorizacao` | timeout/103 lote | `fiscal-cron` | ALTA |
| `fiscal.retry.evento` | timeout em evento | `fiscal-cron` | ALTA |
| `fiscal.dfe.sync` | scheduler 30min | `fiscal-cron` | MEDIA |
| `fiscal.eventos.ciencia` | DFe c/ auto=true | `fiscal-cron` | MEDIA |
| `fiscal.import.lote` | ZIP grande | `fiscal-cron` | BAIXA |
| `fiscal.export.lote` | export ≥100 chaves | `fiscal-cron` | BAIXA |
| `fiscal.notificacao` | eventos operacionais | `fiscal-cron` | MEDIA |
| `fiscal.webhook.envio` (v3) | eventos → externo | `fiscal-cron` | MEDIA |

## Prioridade

`pgmq` não tem prioridade nativa. Implementada por **ordem de leitura** no cron:
```
cron drena por prioridade: ALTA → MEDIA → BAIXA
cada fila com janela de tempo proporcional (60% / 30% / 10% dos 45s disponíveis)
```

## Reprocessamento

### Retry transient
- `nack` com `pgmq.set_vt(msg, backoff)` — mensagem volta ao topo após backoff.
- Backoff: `min(60 · 2^readCt, 3600) + random(0..30)` segundos.
- `readCt` (contagem de leituras) é o contador natural do pgmq.

### Retry fatal
- `pgmq.archive(msg)` → move para `pgmq.a_{fila}` (arquivo).
- Emite `MensagemArquivadaDLQ`.
- Notifica admin quando N mensagens arquivadas em 1h.

### Envenenamento
- `readCt > 10` sem sucesso → arquivar independentemente do erro.
- Evita loop infinito por bug em payload.

## Dead Letter Queue (DLQ)

- Usa `pgmq.a_{fila}` (arquivo nativo).
- Retenção: 30d default; auditoria mantém histórico permanente.
- Interface admin (v2): visualizar, reenfileirar, apagar (com auditoria).

## Backoff detalhado

| Tentativa | Backoff (s) | Total acumulado |
|---|---|---|
| 1 | 60 (+j) | 1min |
| 2 | 120 | 3min |
| 3 | 240 | 7min |
| 4 | 480 | 15min |
| 5 | 960 | 31min |
| 6 | 1920 | 63min |
| 7 | 3600 (cap) | 2h |
| 8 | 3600 | 3h |
| 9 | 3600 | 4h |
| 10 | 3600 | 5h |
| >10 | arquivar | — |

Após 5h com falhas, alta chance de problema estrutural (endpoint, cert, SEFAZ). Alerta emitido em cada arquivamento.

## Recuperação

### Recuperação normal
- Cron a cada 1 min consome cada fila.
- Janela de 45s por invocação (evita atingir timeout edge de 60s).

### Recuperação após indisponibilidade prolongada
- SEFAZ volta → circuit breaker fecha → drenagem acelerada:
  - cron detecta breaker fechado → chama drenagem intensiva por 5min (janelas de 45s consecutivas).
  - Evita thundering herd via rate limiter cooperativo.

### Recuperação manual
- Admin pode: reenfileirar DLQ, resetar `readCt`, forçar drenagem imediata (button em `/admin/fiscal/filas` — v2).

## Payload padrão

Todo payload:
```
{
  correlationId,     // preservado entre tentativas
  empresaId,
  tentativa,         // ordinal (redundante com readCt para clareza)
  enfileiradoEm,     // ISO 8601
  origem,            // 'ui' | 'cron' | 'admin'
  dados: { ... }     // específico da operação
}
```

## Idempotência do consumidor

**Obrigatória**: todo handler assume "posso ser chamado 2+ vezes com o mesmo payload".
- Uso de UNIQUE constraint no banco.
- `fiscal_idempotency` para operações sem UNIQUE natural.
- Não usar contadores incrementados (`saldo += x`) sem checagem.

## Visibility timeout

| Fila | VT default |
|---|---|
| `fiscal.retry.autorizacao` | 120s |
| `fiscal.retry.evento` | 90s |
| `fiscal.dfe.sync` | 300s |
| `fiscal.eventos.ciencia` | 60s |
| `fiscal.import.lote` | 600s |
| `fiscal.export.lote` | 900s |
| `fiscal.notificacao` | 30s |

VT >> tempo esperado do handler (evita double-execution por lentidão).

## Concorrência por fila

Ver doc 31. `fiscal.dfe.sync` é sequencial por empresa (NSU é ordenado); demais suportam paralelismo.

## Métricas de fila

- `fiscal.queue.tamanho` (gauge) — mensagens pendentes.
- `fiscal.queue.lag_seg` (gauge) — idade da mensagem mais antiga.
- `fiscal.queue.processadas_total` (counter).
- `fiscal.queue.arquivadas_total` (counter).
- `fiscal.queue.retry_total` (counter).

## Alertas

- `lag > 5min` → warn.
- `lag > 30min` → crit.
- `arquivadas em 1h > 10` → crit.
- `cron sem heartbeat > 15min` → crit.

## Anti-padrões

- Consumir de fila dentro do fluxo síncrono do usuário (usuário espera confirmação).
- Enfileirar sem correlation-id.
- Handler não idempotente.
- Handler que faz I/O externo lento sem VT compatível.
- Payload > 32KB — arquivos vão para bucket, payload carrega path.
- Retry no handler + retry no orquestrador — duplicação; retry só no orquestrador.