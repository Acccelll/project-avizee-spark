# 32 · Estratégia de observabilidade

Quatro pilares: **logs**, **métricas**, **tracing**, **auditoria** + **alertas**.
Auditoria já detalhada no doc 30; aqui foca em logs, métricas, tracing e alertas.

## Logs estruturados

### Padrão
```
logger.info('fiscal.request.iniciada', {
  correlationId,
  operacao: 'autorizar',
  documento: 'NFe',
  empresaId,
  uf, ambiente,
  chave: chaveAcesso.parcial(),
  tentativa: 1
})
```

### Regras
- **Sempre** via `_shared/logger.ts` (nunca `console.*`).
- **Estrutura**: mensagem em snake_case + objeto de contexto tipado.
- **Level**: `debug | info | warn | error | fatal`.
- **Correlation-id obrigatório** em todo log fiscal.
- **Mascaramento**: CNPJ/CPF parciais em info; completos apenas em debug.
- **XML**: nunca completo — hash SHA-256 + tamanho.
- **Sensíveis**: senha, token, PFX bytes — sanitizador remove.

### Rotação e retenção
- Logs edge: retenção 7 dias em Deno Deploy (padrão) → sink futuro para logtail/betterstack.
- Logs de app: retenção via `fiscal_auditoria` (fonte oficial) 5 anos.
- Logs em `console.error` são banidos por eslint (`no-console`).

## Métricas

### Emissão
- Helper `metric.emit(nome, valor, tags?)` em `_shared/metrics.ts` (futuro).
- Persistência: tabela `fiscal_telemetria` (existente) + agregação em views materializadas.

### Catálogo mínimo (v1)

| Métrica | Tipo | Labels |
|---|---|---|
| `fiscal.request.duracao_ms` | histogram | uf, ambiente, servico, documento, cstat |
| `fiscal.request.total` | counter | uf, ambiente, servico, documento, cstat |
| `fiscal.request.erro_total` | counter | uf, ambiente, servico, categoria |
| `fiscal.breaker.state` | gauge | uf, ambiente, servico |
| `fiscal.queue.lag_seg` | gauge | fila |
| `fiscal.queue.tamanho` | gauge | fila |
| `fiscal.cert.dias_restantes` | gauge | empresa_id |
| `fiscal.dfe.nsu_atual` | gauge | empresa_id, ambiente |
| `fiscal.docs.autorizados_dia` | counter | empresa_id, documento |
| `fiscal.docs.rejeitados_dia` | counter | empresa_id, documento, cstat |

### Agregações prontas (views)

- `v_fiscal_saude_diaria (empresa_id, dia, total, autorizadas, rejeitadas, tempo_medio_ms)`
- `v_fiscal_saude_sefaz (uf, ambiente, cstat_ultimo, duracao_ultima, timestamp)`
- `v_fiscal_certificados_alerta (empresa_id, dias_restantes)` — apenas < 30 dias

## Tracing

### Modelo atual (v1)
- `correlation_id` funciona como trace-id simplificado.
- Header `x-correlation-id` propaga cross-edge.
- Query única em `fiscal_auditoria` reconstrói timeline por operação.

### Modelo futuro (v2)
- OpenTelemetry via Deno OTLP exporter (quando estável).
- Spans: `edge.entrypoint`, `app.usecase`, `domain.serialize`, `domain.sign`, `infra.transport`, `db.query`.
- Sink: OTLP → Grafana Tempo / Honeycomb / SignalNoise (a definir — backlog).

## Auditoria

Ver doc 30. Complemento observabilidade:
- Consulta padrão via UI `/admin/fiscal/auditoria` (futuro):
  - filtro por `correlation_id` (view timeline completa),
  - filtro por `chave_acesso` (view histórico do documento),
  - filtro por `empresa_id + range` (view operação diária).

## Alertas

### Canais
- **In-app** (sidebar de notificações — infra `notificacoes-proativas-sidebar`).
- **E-mail** (via `send-transactional-email` — infra existente).
- **Webhook** (via `mem/features/webhooks-saida` — futuro).

### Catálogo (v1)

| Alerta | Trigger | Severidade | Canal |
|---|---|---|---|
| Certificado expira em 30d | cron diário | warn | in-app + e-mail |
| Certificado expira em 7d | cron diário | crit | in-app + e-mail |
| Certificado expirado | cron diário | crit | in-app + e-mail |
| SEFAZ UF indisponível > 15min | métrica | warn | in-app |
| SEFAZ UF indisponível > 60min | métrica | crit | in-app + e-mail |
| Fila lag > 5min | métrica | warn | in-app |
| Fila lag > 30min | métrica | crit | in-app + e-mail |
| Falha em cron fiscal | `cron_health` heartbeat ausente > 15min | crit | in-app + e-mail |
| Rejeição em massa (> 10 em 5min) | métrica | crit | in-app + e-mail |
| DFe sem sync > 6h | `nfe_distdfe_sync.atualizado_em` | warn | in-app |

### Regras
- Alertas deduplicam por (tipo, empresa, janela 1h).
- Silenciamento manual permitido por 24h com registro.
- Escalonamento: sem SLA formal em v1; usuário admin recebe todos.

## Correlação de eventos

Cadeia canônica:
```
UI action  ──┐
             ▼
          correlationId gerado (edge)
             │
             ├──► logger.* (todos os módulos)
             ├──► fiscal_auditoria (todo passo)
             ├──► pgmq payload (retry preserva id)
             ├──► fiscal_telemetria (métricas)
             └──► resposta ao ERP (toast/console)
```

Nunca sobrescrever `correlationId` em retry — mesmo id atravessa toda a cadeia (facilita investigação).

## Dashboards (futuros)

- `/admin/health` — saúde geral (já existe parcial).
- `/admin/fiscal/health` — cStat SEFAZ, filas, certificados, alertas.
- `/admin/fiscal/auditoria` — busca por correlation_id, chave, período.
- `/admin/fiscal/metricas` — top rejeições, tempo médio por UF, cStat mais comuns.

Todos read-only; escrita só via operações regulares do framework.

## Checklist observabilidade por edge fiscal

- [ ] Log de entrada (`fiscal.request.iniciada`) com correlationId.
- [ ] Log de saída (`fiscal.request.finalizada`) com duração.
- [ ] Log de erro (`fiscal.request.erro`) com categoria.
- [ ] Métrica `duracao_ms` emitida.
- [ ] Métrica `total` incrementada.
- [ ] `fiscal_auditoria` gravada.
- [ ] `cron_health` batido (se cron).
- [ ] Correlation-id no header de resposta.