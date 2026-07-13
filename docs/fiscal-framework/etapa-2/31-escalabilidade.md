# 31 · Estratégia de escalabilidade

## Premissas de volume (2026)

| Métrica | v1 target | v2 (12 meses) |
|---|---|---|
| Empresas ativas por instância | 1 | 20 |
| Filiais por empresa | 1 | 5 |
| NF-e/mês por empresa | 5k | 20k |
| Eventos/mês por empresa | 2k | 10k |
| DFe chegando/mês | 10k | 100k |
| Requests SEFAZ/hora pico | 200 | 2000 |

Arquitetura projetada para o cenário v2 sem refactor.

## Multi-empresa

- `empresa_id` desde o dia 1 (ADR-006).
- RLS + índices `(empresa_id, ...)` em toda tabela fiscal.
- Certificado por empresa (Vault + storage prefixado).
- Numeração por empresa (sequences distintas).
- `fiscal_runtime_config` por empresa (fallback default).

## Multi-filial

- Coluna `filial_id UUID NULL` em `notas_fiscais`, `nfe_distribuicao`.
- Série por filial (`series_numeracao (empresa_id, filial_id, documento, serie)`).
- Certificado por filial (opcional — herda da empresa por default).
- Backlog Etapa 5 — modelo já preparado.

## Processamento paralelo

- **Edge functions** são naturalmente concorrentes (Deno Deploy).
- **pgmq** permite N consumidores concorrentes com `read_ct` como controle de visibilidade.
- **Idempotência natural** (UNIQUE constraints) permite retry seguro sem coordenação.
- **Sem locks pessimistas** — usa `INSERT ... ON CONFLICT DO NOTHING`/`UPDATE` conditional.

### Nível de paralelismo por fila

| Fila | Concorrência | Razão |
|---|---|---|
| `fiscal.retry.autorizacao` | 5 | limite SEFAZ ~10/s por CNPJ |
| `fiscal.retry.evento` | 3 | idem |
| `fiscal.dfe.sync` | 1 por empresa | NSU é sequencial |
| `fiscal.eventos.ciencia` | 3 | idem |

Ajustável por `fiscal_runtime_config.parallelism`.

## Filas (pgmq)

- **Vantagens**: nativo Postgres, sem infra extra, visibilidade timeout, arquivamento.
- **Uso**: retry, sincronização periódica, manifestação em lote.
- **Não usar para**: fluxo síncrono do usuário (UI espera resposta).

### Padrão de consumo

```
cron fiscal-cron (a cada 1 min):
  para cada fila fiscal.*:
    while now() - start < 45s:
      msg = pgmq.read(fila, vt=60, limit=1)
      if !msg: break
      try: handler(msg) → ack
      catch transient: pgmq.set_vt(msg, backoff)
      catch fatal: pgmq.archive(msg) + audit
```

45s de janela por invocação (limite edge = 60s) — sobra margem para finalizar.

## Processamento assíncrono vs síncrono (ADR-007)

| Operação | Modo | Razão |
|---|---|---|
| Autorização NF-e (v3+) | Síncrono | usuário aguarda protocolo |
| Autorização em lote (retorno assíncrono) | Fila | modelo SEFAZ é async |
| Cancel/CCe/Inutilização | Síncrono | usuário confirma |
| Manifestação individual | Síncrono | idem |
| Manifestação em lote | Fila | operação massiva |
| DFe sync | Fila (cron) | não interativo |
| Retry | Fila | por definição |
| Import XML (1 arquivo) | Síncrono | usuário confirma |
| Import ZIP (N arquivos) | Fila | operação massiva |

## Tolerância a falhas

- **Circuit breaker** por (uf, ambiente, servico) — evita amplificar indisponibilidade SEFAZ.
- **Retry com backoff** — evita thundering herd.
- **Idempotência natural** — retry seguro.
- **Dead letter** via `pgmq.archive` após esgotamento — investigação manual.
- **Compensating action**: cancelamento de nota autorizada por engano → evento de cancelamento (não delete).
- **Rollback local**: transação Postgres cobre escrita cross-tabela dentro do mesmo agregado.

## Alta disponibilidade

- **Postgres**: Supabase Cloud (HA gerenciada, backups PITR).
- **Edge functions**: Deno Deploy multi-região (rota mais próxima).
- **Storage**: replicação transparente.
- **SEFAZ**: fora do controle — mitigar com contingência.
- **Falha total do provider**: backups PITR + disaster recovery documentado (backlog).

## Bottlenecks conhecidos e mitigação

| Bottleneck | Mitigação |
|---|---|
| Deno edge sem long connection (60s max) | Fluxos longos vão para fila |
| mTLS incompatível com AN nativo Deno | Proxy externo mTLS (memória `sefaz-mtls-transporte`) |
| RLS overhead em tabelas grandes | Índices `(empresa_id, ...)` sempre |
| pgmq com milhares de msgs stalled | Alerta em `queue.lag_seg` > 5min |
| Certificado parse repetido | Cache in-memory por invocação; reuso via bundle inicial da edge |
| SEFAZ rate limit (não documentado) | Rate limiter próprio + backoff cooperativo |

## Estratégia de crescimento

### Fase 1 (v1): single-tenant, 1 empresa, 5k NF/mês
- Arquitetura atual roda com folga.

### Fase 2 (v1.1): multi-empresa, até 5 empresas
- Ativação de `empresa_id` no path completo.
- Certificado por empresa.
- Numeração por empresa.

### Fase 3 (v2): multi-filial, 20 empresas × 5 filiais
- Ativação de `filial_id`.
- Particionamento opcional de `fiscal_auditoria` (mensal).
- Isolamento de circuit breaker por (empresa, uf).

### Fase 4 (v3): 100+ empresas
- Migração pgmq → filas dedicadas por tenant (avaliar).
- Read replicas para relatórios.
- Cache distribuído (Redis) para endpoint + status serviço.

## Preparação para crescimento (agora)

Decisões tomadas em v1 que **evitam refactor** em v2/v3:

1. `empresa_id` em todo lugar (ADR-006).
2. Contratos separados de implementação (Ports & Adapters).
3. Fachada única — trocar backend sem tocar UI.
4. Filas pgmq — trocar por SQS/Rabbit sem mudar código de negócio.
5. Cache abstraído — trocar in-memory por Redis via adapter.
6. Endpoint registry declarativo — sem alteração de código para novo autorizador.
7. Plugin por documento — NFC-e/CT-e entram sem tocar Application.
8. `fiscal_runtime_config` por empresa — comportamento variável sem redeploy.