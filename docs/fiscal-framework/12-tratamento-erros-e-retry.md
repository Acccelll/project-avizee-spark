# 12 · Tratamento de erros, retry e contingência

## Princípios

1. **Sem exceções para negócio**: rejeição SEFAZ retorna `FiscalResult.erro`,
   não `throw`. `throw` só para falhas de infraestrutura (rede, TLS, JSON malformado).
2. **Toda operação é idempotente**: retry seguro por chave natural (ver doc 07 §idempotency).
3. **Retry vive no orquestrador**, nunca no transport.
4. **Política declarativa por cStat**, não `if/else` espalhado.

## Taxonomia de erros

```
FiscalErrorKind
  ├─ Transporte           (rede, TLS, timeout)                         → retryable=true
  ├─ SoapMalformado       (SEFAZ devolveu HTML/erro fora do esperado)  → retryable=true (limitar tentativas)
  ├─ SefazRetryable       (cStat 108,109,141,151…)                     → retryable=true (backoff)
  ├─ SefazNegocio         (cStat 4xx de negócio — 539 dup, 233 CFOP…)  → retryable=false
  ├─ SefazEsquema         (cStat 225 XML mal-formado)                  → retryable=false + log crítico
  ├─ AssinaturaInvalida   (cStat 213, 215, 218 etc)                    → retryable=false + alerta cert
  ├─ CertificadoInvalido  (falha ao carregar .pfx, senha errada, expirado) → retryable=false + notifica admin
  ├─ ValidacaoLocal       (XSD, Zod, regra de negócio)                 → retryable=false
  └─ Idempotencia         (já processado — chave existe)               → não é erro; retorna ok c/ evidência
```

## Tabela de cStats (referência resumida — a completa vira dado em `fiscal_cstat_policy`)

| cStat | Descrição | Classe |
|-------|-----------|--------|
| 100 | Autorizado o uso da NF-e | sucesso |
| 101 | Cancelamento homologado | sucesso |
| 102 | Inutilização homologada | sucesso |
| 103 | Lote recebido com sucesso | intermediário (poll) |
| 104 | Lote processado | sucesso do lote (ler protNFe interno) |
| 105 | Lote em processamento | retryable (poll) |
| 107 | Serviço em operação | health OK |
| 108 | Serviço paralisado momentaneamente | SefazRetryable |
| 109 | Serviço paralisado sem previsão | SefazRetryable (backoff longo) |
| 135 | Evento registrado e vinculado | sucesso |
| 136 | Evento registrado sem vínculo | sucesso parcial |
| 137 | Nenhum documento localizado | sucesso (DistDFe) |
| 138 | Documento localizado | sucesso (DistDFe) |
| 141 | Consumidor desconhecido | SefazRetryable (aguardar cadastro) |
| 204 | Duplicidade de NF-e | Idempotencia (já autorizada) |
| 213 | CNPJ do emitente inválido | AssinaturaInvalida |
| 215 | Falha no schema XML | SefazEsquema |
| 217 | NF-e não consta na base | negócio |
| 218 | NF-e já cancelada | Idempotencia |
| 225 | Falha schema XML | SefazEsquema |
| 233 | Manif. só p/ NF-e > 100k | SefazNegocio |
| 539 | Duplicidade sob outro número | SefazNegocio |
| 656 | Consumo indevido (rate limit) | SefazRetryable (backoff longo) |

A tabela completa vira migration de dados em `fiscal_cstat_policy` (backlog).

## Política de retry (proposta)

```
backoff exponencial com jitter:
  tentativa 1  →  5s   (± 2s)
  tentativa 2  →  15s
  tentativa 3  →  45s
  tentativa 4  →  2m
  tentativa 5  →  10m
  tentativa 6  →  30m
  desiste após 6 tentativas para autorização
  desiste após 10 tentativas para eventos/DistDFe (menor criticidade)
```

cStat 109 (paralisado sem previsão) e 656 (rate limit) usam backoff **mais
longo**: 5m / 30m / 2h. Não faz sentido bater rápido em SEFAZ caída.

## Idempotência

| Operação | Chave |
|----------|-------|
| Autorização | `(empresaId, chaveAcesso)` UNIQUE em `notas_fiscais` |
| Evento | `(chaveAcesso, tpEvento, nSeqEvento)` UNIQUE em `nota_fiscal_eventos` |
| Inutilização | `(empresaId, ano, serie, nInicial, nFinal)` UNIQUE |
| DistDFe | `(cnpj, ambiente, nsu)` cursor + `chaveAcesso` UNIQUE no upsert |

Retry após crash: consulta situação por chave; se já autorizada, apenas
atualiza local com o `protNFe` retornado.

## Contingência (preparado, não implementado v1)

- **EPEC** (Evento Prévio de Emissão em Contingência): autoriza uso de série
  específica sem autorizador; regulariza depois.
- **FS-DA / DPEC**: legado, praticamente extinto.
- **SVC-RS / SVC-AN**: autorizadores de contingência regionais.

Alvo v2: `Protocol Manager` detecta falha persistente do autorizador
principal e aciona contingência automaticamente conforme política.

## Fallback e recuperação

- **Falha na assinatura** (crypto): cert corrompido → notifica admin, bloqueia emissão.
- **Falha no bucket** (upload XML): registra warning, **não bloqueia** persistência da nota.
- **Falha em `fiscal_auditoria`**: log de erro; nunca bloqueia a operação principal.
- **Falha na fila pgmq**: fallback para retry síncrono in-memory (1 tentativa) + alerta.

## Erros que **não** devem virar retry

- 215/225 (schema): significa que o motor está errado — retry vai falhar igual. Alerta crítico.
- 213/218 (cert/duplicidade): estado permanente. Persiste erro, encerra.
- Falha Zod local: bug do chamador. `FiscalResult.erro` imediato, sem tocar SEFAZ.

## Traceabilidade

Cada tentativa gera linha em `fiscal_auditoria` com `tentativa` ordinal e
`correlation_id` compartilhado. Debug: `SELECT * FROM fiscal_auditoria WHERE correlation_id = ...`.