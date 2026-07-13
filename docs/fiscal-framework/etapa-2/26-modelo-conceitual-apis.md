# 26 · Modelo conceitual de APIs

O framework expõe APIs em **dois planos**:

1. **Interna do ERP** — TS via fachada (`src/services/fiscal/*`). Consumida por telas/hooks.
2. **Edge HTTP** — `supabase/functions/fiscal-*`. Consumida pela fachada e por integrações externas (webhooks, contador, outros ERPs).

Nenhuma API é implementada aqui — apenas especificada.

## Convenções gerais

- **Estilo**: REST-like sobre a edge function (uma edge por bounded context; action no body). Não é REST puro por limitação de Supabase Edge (single entrypoint por function).
- **Formato**: JSON UTF-8 request/response; XML apenas em endpoints específicos (`fiscal-nfe/exportarXml`).
- **Nomes**: kebab-case na URL, camelCase no JSON.
- **Codificação**: bytes de XML em base64 quando trafegados em JSON.

## Autenticação

- **Header**: `Authorization: Bearer <jwt Supabase>`.
- **Extração**: edge lê `auth.uid()` via `SUPABASE_ANON_KEY`. `service_role` só em crons internos.
- **empresa_id**: **nunca** vem do body — sempre derivado do JWT (`user_empresas`), evitando IDOR.
- **API key externa** (contador/integração): tabela `fiscal_api_keys (id, empresa_id, chave_hash, escopos, expira_em)` — plano futuro (backlog Etapa 5+).

## Autorização

RBAC baseado em `user_permissions` + escopos:

| Escopo | Ações |
|---|---|
| `fiscal:emitir` | POST autorizar |
| `fiscal:cancelar` | POST cancelar |
| `fiscal:cce` | POST carta-correcao |
| `fiscal:inutilizar` | POST inutilizar |
| `fiscal:manifestar` | POST manifestar |
| `fiscal:dfe` | POST sincronizar-dfe, GET download |
| `fiscal:certificado` | POST/DELETE certificado |
| `fiscal:auditoria` | GET auditoria |
| `fiscal:admin` | tudo |

Cross-check com RLS no banco (defense-in-depth).

## Versionamento

- **Path prefix**: `/v1/`, `/v2/` no body do action (`action: 'v1/autorizar'`).
- **Coexistência**: v1 e v2 rodam em paralelo por 90 dias mínimos.
- **Breaking change**: exige nova major + ADR.
- **Feature flag**: `fiscal:v2:autorizacao`, etc. permite rollback por operação sem redeploy.

## Paginação

Padrão **cursor-based** (não offset):
```
GET fiscal-dfe?action=listar&limit=50&cursor=<opaco>
→ { items: [...], nextCursor: '<opaco>' | null, hasMore: boolean }
```
Cursor é `base64(json({nsu, chave}))` — opaco ao cliente.

## Padronização de resposta

```
SucessoEnvelope<T> {
  ok: true
  data: T
  correlationId: string
  timestamp: string        // ISO 8601
}

ErroEnvelope {
  ok: false
  error: {
    codigo: string          // ex.: 'FISCAL.REJEICAO', 'FISCAL.ENDPOINT_NAO_CADASTRADO'
    mensagem: string        // legível ao usuário
    detalhe?: unknown       // opcional, estruturado
    cstat?: string
    xmotivo?: string
    recuperavel: boolean
    referencia?: string     // URL doc
  }
  correlationId: string
  timestamp: string
}
```

**Regra**: HTTP status reflete transporte (200/4xx/5xx). Regra de negócio
viaja em `error.codigo`. Rejeição SEFAZ = 200 com `ok:false` + `cstat` (não é
erro HTTP).

## Códigos de erro (taxonomia)

```
FISCAL.NAO_AUTORIZADO           → 401
FISCAL.SEM_PERMISSAO            → 403
FISCAL.EMPRESA_NAO_CONFIGURADA  → 422
FISCAL.CERTIFICADO_AUSENTE      → 422
FISCAL.CERTIFICADO_EXPIRADO     → 422
FISCAL.ENDPOINT_NAO_CADASTRADO  → 422 (prescritivo, com hint SQL)
FISCAL.XSD_INVALIDO             → 422
FISCAL.REJEICAO                 → 200 (ok:false, com cstat)
FISCAL.DENEGACAO                → 200 (ok:false, com cstat)
FISCAL.TIMEOUT                  → 504 (recuperável)
FISCAL.SEFAZ_INDISPONIVEL       → 503
FISCAL.BREAKER_ABERTO           → 503 (com retryAfter)
FISCAL.RATE_LIMIT               → 429
FISCAL.CONFLITO_IDEMPOTENCIA    → 409
FISCAL.INESPERADO               → 500 (sem stack ao cliente)
```

## Endpoints (edge functions) — v1

### `fiscal-nfe`
```
POST { action, empresaId?, ... }

action:
  'autorizar'         { nota }                       → SucessoEnvelope<{ chave, protocolo, dhAutorizacao }>
  'consultar-chave'   { chave }                      → SucessoEnvelope<{ situacao, cstat, xmotivo }>
  'status-servico'    { uf, ambiente }               → SucessoEnvelope<{ cstat, tMed, dhRetorno }>
  'exportar-xml'      { chave | filtro }             → SucessoEnvelope<{ url, expiresIn }>
  'importar-xml'      { xmlBase64 | fileRef }        → SucessoEnvelope<{ chave, notaId, duplicada }>
```

### `fiscal-events`
```
POST { action, ... }

action:
  'cancelar'          { chave, justificativa }
  'carta-correcao'    { chave, texto, nSeq }
  'inutilizar'        { ano, serie, nInicial, nFinal, justificativa }
  'manifestar'        { chave, tipo }
```

### `fiscal-dfe`
```
POST { action, ... }

action:
  'sincronizar'       { ambiente }
  'listar'            { limit, cursor, filtros? }    → paginado
  'download'          { chave }                      → { url }
```

### `fiscal-cert`
```
POST { action, ... }

action:
  'upload'            { pfxBase64, senha }
  'parse'             { pfxBase64, senha }           (sem persistir)
  'status'            { }                            → { validadeFim, diasRestantes }
  'remover'           { }
```

### `fiscal-cron` (interno — service_role apenas)
```
GET → drena filas fiscal.* e chama APP correspondentes; retorna sumário.
```

## Idempotência

Cliente pode enviar `Idempotency-Key` header. Servidor:
- registra em `fiscal_idempotency (key, empresa_id, response_hash, criado_em)`,
- retorna resposta cacheada (24h) se repetido,
- 409 se conflito (mesmo key, payload diferente).

## Rate limit

Por (empresa, action):
- autorização: 60/min
- consulta: 120/min
- distribuição: 12/min (limite SEFAZ)

Header `Retry-After` em 429.

## Webhooks de saída (futuro)

Reusa infraestrutura `mem/tech/webhooks-saida` (memória existente). Eventos
entregues:
- `fiscal.documento.autorizado`
- `fiscal.documento.rejeitado`
- `fiscal.evento.registrado`
- `fiscal.dfe.recebido`
- `fiscal.certificado.expirando`

Não implementados em v1.