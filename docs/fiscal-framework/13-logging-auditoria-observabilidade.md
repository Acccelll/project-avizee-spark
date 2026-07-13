# 13 · Logging, auditoria e observabilidade

## Camadas

```
┌──────────────────────────────────────────────────────┐
│  LOG (src/lib/logger.ts)                             │  técnico, curto prazo
│  - console-like estruturado                          │  (edge logs Supabase)
│  - nível: debug|info|warn|error                      │
│  - correlation-id sempre                             │
├──────────────────────────────────────────────────────┤
│  AUDIT (tabela fiscal_auditoria)                     │  compliance, 5 anos
│  - toda comunicação SEFAZ                            │
│  - hash do payload (não o payload)                   │
│  - resultado + duração + tentativa                   │
├──────────────────────────────────────────────────────┤
│  METRICS (tabela fiscal_telemetria / view agregada)  │  operacional, dashboards
│  - contadores: emitidas, canceladas, rejeitadas      │
│  - histogramas: latência autorização                 │
│  - por UF, ambiente, empresa                         │
└──────────────────────────────────────────────────────┘
```

## Correlation-id

- Gerado no ponto de entrada (edge function ou UI que dispara).
- Formato: `flx-{yyyymmddhhmmss}-{6 chars random}`.
- Propagado em:
  - Header `x-correlation-id` entre edges (quando aplicável).
  - Todo `logger.*` da operação.
  - Coluna `correlation_id` em `fiscal_auditoria`.
- Retornado ao chamador em `FiscalResult.meta.correlationId` para debug.

## Mascaramento

| Dado | Info | Debug |
|------|------|-------|
| CNPJ emitente/dest | `12.***.***/****-91` | completo |
| CPF dest | `***.***.***-91` | completo |
| Chave de acesso | completa (pública) | completa |
| Valor da nota | agregado (faixa) | exato |
| Nome dest | primeiras 3 letras + `***` | completo |
| XML enviado/recebido | **nunca em log**; só hash | apenas em `debug` local, com truncamento |

## O que sempre logar (info)

- Início de operação: `operacao`, `documento`, `chave` (se houver), `correlationId`, `empresaId`, `ambiente`, `uf`.
- Fim de operação: mesmos + `duracaoMs`, `resultado` (ok/erro), `cStat`, `xMotivo`.
- Transições de retry: `tentativa`, `proximaTentativaEm`.

## O que **nunca** logar

- Senha do certificado.
- Bytes do `.pfx`.
- Response SEFAZ completo com dados do destinatário (só hash + cStat + motivo).
- Service role key.
- Vault secrets.

## Auditoria detalhada — schema conceitual

`fiscal_auditoria`:
```
id                    uuid pk
empresa_id            uuid fk
correlation_id        text  (indexado)
operacao              text  (autorizar, consultar, cancelar, cce, inutilizar, manifestar, dfe_sync, status)
documento             text  (NFe, NFCe, CTe, MDFe, NFSe)
chave_acesso          text  (nullable, indexado)
ator                  uuid  (auth.uid nullable — cron não tem)
timestamp             timestamptz
endpoint_url          text
request_hash          text  (sha256 do body enviado)
response_status       integer (HTTP)
cstat                 text
xmotivo               text
duracao_ms            integer
retryable             boolean
tentativa             integer (1..N)
erro_tipo             text  (Transporte|Sefaz*|Certificado|Validacao|Idempotencia)
erro_detalhe          text  (sanitizado)
```

Índices: `(correlation_id)`, `(chave_acesso)`, `(empresa_id, timestamp desc)`.

## Métricas / dashboards

### KPIs por período (dia/semana/mês)
- NF-e emitidas (autorizadas, rejeitadas, canceladas, denegadas).
- Taxa de rejeição (%).
- Latência média/p95 de autorização.
- Rejeições por cStat (top 5).
- DistDFe: NSU avançado, docs novos, ciências disparadas.

### Alertas
- Taxa de rejeição > 5% em 1h → warn.
- Latência p95 > 10s em 15min → warn.
- SEFAZ da UF em cStat 108/109 por > 30min → warn ao operador fiscal.
- Certificado a vencer em 30/15/7d → e-mail ao admin.
- Vencido → bloqueio + e-mail crítico.

## Rastreamento fim-a-fim de um erro

Cenário: operador emite NF-e, recebe erro "rejeitada".

1. UI mostra `correlationId` no toast.
2. Operador consulta no dashboard fiscal → busca por correlationId.
3. `SELECT * FROM fiscal_auditoria WHERE correlation_id = 'flx-...' ORDER BY timestamp`:
   - linha 1: `autorizar`, HTTP 200, cStat 233, motivo "Manifestação só p/ NF > 100k" → não, exemplo bom seria cStat 215.
   - linha 2 (se houve retry): `autorizar`, tentativa=2, cStat 215.
4. Edge logs (Supabase) do mesmo correlationId trazem o traceback técnico.
5. Se schema falhou (cStat 215): abrir XML no bucket (`fiscal/YYYY/MM/saida/CHAVE.xml`) e diffar contra o XSD.

## Sinks (destinos de log)

| Sink | Papel | Retenção |
|------|-------|----------|
| Supabase edge logs | Debug/técnico | 7-30 dias |
| `fiscal_auditoria` | Compliance | 5 anos |
| `fiscal_telemetria` | Métricas agregadas | 2 anos |
| Bucket `fiscal/*.xml` | Provas | 5 anos (obrigação legal) |
| E-mail (`process-email-queue`) | Alertas críticos | conforme SMTP |

## Regras Core aplicáveis

- `console.*` proibido: usar `src/lib/logger.ts`.
- Toda RPC/trigger fiscal com `search_path = public`.
- Escrita em `fiscal_auditoria` sempre via service_role (edge) — nunca do client.