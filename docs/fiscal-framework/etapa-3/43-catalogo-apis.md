# 43 · Catálogo de APIs

Refina o doc 26 (Etapa 2) especificando cada operação. Padrão de ficha:

```
API-XXX action
  Objetivo · Domínio · Recurso · Método · Auth · Escopo
  Params    { body / query }
  Response  200 / 4xx / 5xx
  Códigos   FISCAL.* mapeados
  Idempotência · Rate limit · Versionamento · Paginação
```

Convenções: doc 26 §Convenções gerais. Envelope: doc 26 §Padronização.

## API-001 · fiscal-nfe / autorizar
- **Domínio**: Documentos Fiscais.
- **Recurso**: `POST /functions/v1/fiscal-nfe` `{ action: 'autorizar' }`.
- **Auth**: JWT · Escopo `fiscal:emitir`.
- **Params body**:
  ```
  { nota: NotaFiscalDTO, ambiente?: 'homologacao'|'producao' }
  ```
- **Response 200**:
  ```
  { ok:true, data:{ chave, protocolo, dhAutorizacao, cstat:'100', xmotivo }, correlationId }
  ```
- **Response 200 (rejeição)**:
  ```
  { ok:false, error:{ codigo:'FISCAL.REJEICAO', cstat:'539', xmotivo, recuperavel:false }, correlationId }
  ```
- **4xx**: 401 auth · 403 sem escopo · 422 config/cert/endpoint · 429 rate.
- **5xx**: 504 timeout · 503 breaker/sefaz.
- **Idempotência**: header `Idempotency-Key` opcional; UNIQUE natural `(empresa_id, chave_acesso)`.
- **Rate limit**: 60/min por empresa.
- **Versionamento**: `action: 'v1/autorizar'` implícito; v2 explícito.
- **Paginação**: N/A.

## API-002 · fiscal-nfe / consultar-chave
- **Escopo**: `fiscal:emitir` (mesmo, operação sem custo).
- **Body**: `{ chave }`.
- **Response**: `{ situacao, cstat, xmotivo, protocolo?, dhAutorizacao? }`.
- **Rate limit**: 120/min.

## API-003 · fiscal-nfe / status-servico
- **Escopo**: qualquer autenticado.
- **Body**: `{ uf, ambiente }`.
- **Response**: `{ cstat, xMotivo, tMed, dhRetorno }`.
- **Rate limit**: 60/min (limite SEFAZ).
- **Cache**: 3min in-memory.

## API-004 · fiscal-nfe / exportar-xml
- **Escopo**: `fiscal:emitir` ou `fiscal:auditoria`.
- **Body**: `{ chave } | { filtro: { dhEmi:{de,ate}, status[], modelo? } }`.
- **Response**: `{ url, expiresIn: 600 }` (individual) ou `{ jobId }` (lote).
- **Lote**: > 100 chaves ou > 30d → fila.

## API-005 · fiscal-nfe / importar-xml
- **Escopo**: `fiscal:emitir`.
- **Body**: `{ xmlBase64 } | { fileRef }`.
- **Response**: `{ chave, notaId, duplicada:boolean }`.
- **Códigos**: `FISCAL.XML_INVALIDO`, `FISCAL.ASSINATURA_INVALIDA`, `FISCAL.DUPLICADA`.

## API-006 · fiscal-events / cancelar
- **Escopo**: `fiscal:cancelar`.
- **Body**: `{ chave, justificativa }`.
- **Response**: `{ cstat, nProt, dhEvento }`.
- **Códigos**: `FISCAL.FORA_PRAZO`, `FISCAL.NOTA_JA_CANCELADA`.

## API-007 · fiscal-events / carta-correcao
- **Escopo**: `fiscal:cce`.
- **Body**: `{ chave, texto, nSeqEvento }`.
- **Response**: `{ cstat, nProt, dhEvento, nSeq }`.
- **Códigos**: `FISCAL.CCE_LIMITE_ATINGIDO`, `FISCAL.CCE_TEXTO_INVALIDO`.

## API-008 · fiscal-events / inutilizar
- **Escopo**: `fiscal:inutilizar`.
- **Body**: `{ ano, serie, nInicial, nFinal, justificativa }`.
- **Response**: `{ cstat, nProt, dhRecbto }`.
- **Códigos**: `FISCAL.FAIXA_JA_UTILIZADA`, `FISCAL.PRAZO_INUTILIZACAO`.

## API-009 · fiscal-events / manifestar
- **Escopo**: `fiscal:manifestar`.
- **Body**: `{ chave, tipo: 'ciencia'|'confirmacao'|'desconhecimento'|'nao-realizada', justificativa? }`.
- **Response**: `{ cstat, dhEvento, nSeq }`.
- **Códigos**: `FISCAL.MANIFESTACAO_FORA_PRAZO`, `FISCAL.MANIFESTACAO_DUPLICADA`.

## API-010 · fiscal-dfe / sincronizar
- **Escopo**: `fiscal:dfe`.
- **Body**: `{ ambiente }`.
- **Response**: `{ ok:true, data:{ novasChaves, nsuInicio, nsuFim, cstatFinal } }`.
- **Long-running**: preferir modo assíncrono `{ modo:'fila' }` → `{ jobId }`.

## API-011 · fiscal-dfe / listar (paginado)
- **Escopo**: `fiscal:dfe`.
- **Query**: `?limit=50&cursor=<opaco>&status=pendente`.
- **Response**: `{ items[], nextCursor, hasMore }`.

## API-012 · fiscal-dfe / download
- **Escopo**: `fiscal:dfe`.
- **Body**: `{ chave }`.
- **Response**: `{ url, expiresIn }`.

## API-013 · fiscal-cert / upload
- **Escopo**: `fiscal:certificado`.
- **Body**: `{ pfxBase64, senha }`.
- **Response**: `{ validadeInicio, validadeFim, cnpj, subjectCN }`.
- **Códigos**: `FISCAL.CERT_SENHA_INVALIDA`, `FISCAL.CERT_CNPJ_DIVERGENTE`, `FISCAL.CERT_EXPIRADO`.
- **Rate limit**: 5/min (evita brute force senha).

## API-014 · fiscal-cert / parse (sem persistir)
- **Escopo**: `fiscal:certificado`.
- **Body**: idem upload.
- **Response**: metadados sem gravar.
- **Uso**: pré-visualização antes de confirmar upload.

## API-015 · fiscal-cert / status
- **Escopo**: qualquer com `fiscal:*`.
- **Response**: `{ validadeFim, diasRestantes, cnpj }` ou `{ ausente:true }`.

## API-016 · fiscal-cert / remover
- **Escopo**: `fiscal:admin`.
- **Body**: `{ confirmacao:'REMOVER' }`.

## API-017 · fiscal-cron (interno)
- **Auth**: `service_role` apenas (cron scheduler).
- **Response**: `{ processadas: {fila:count}, duracaoMs }`.
- **Rate limit**: N/A (invocação controlada).

## API-018 · fiscal-nfe / consulta-cadastro (v1.1)
- **Escopo**: `fiscal:emitir`.
- **Body**: `{ uf, cnpj | ie }`.
- **Response**: dados de cadastro SEFAZ ou `FISCAL.UF_NAO_SUPORTA`.

## API-019 · fiscal-portal (read RPC — existente)
- **Descrição**: `buscar_nfe_portal(filtros)` — já operacional, adaptado à nova auditoria.

## API-020 · fiscal-auditoria / consultar
- **Escopo**: `fiscal:auditoria` ou `fiscal:admin`.
- **Query**: `?correlationId=` ou `?chave=` ou `?empresaId=&de=&ate=&op=`.
- **Response**: `{ items[], nextCursor }` paginado.

## API-021 · fiscal-endpoints / listar/atualizar
- **Listar**: `fiscal:admin`.
- **Atualizar**: `fiscal:admin` + confirmação.
- **Auditado**.

## API-022 · fiscal-runtime-config
- **GET**: `fiscal:emitir` (leitura da própria empresa).
- **PUT**: `fiscal:admin` da empresa.

## API-023 · fiscal-webhooks (v3)
- **CRUD**: `fiscal:admin`.
- **Segredo**: rotacionável, HMAC-SHA256.

## Rate limit consolidado (por empresa)

| Grupo | Limite |
|---|---|
| Autorização | 60/min |
| Consulta | 120/min |
| Status serviço | 60/min |
| DFe sincronizar | 12/min |
| Cert upload | 5/min |
| Eventos | 60/min |
| Import XML | 30/min (individual) / 3/min (ZIP) |

Header `Retry-After` em 429.

## Versionamento consolidado

- Coexistência mínima: 90 dias entre v1 e v2 de qualquer action.
- Deprecation warning via header `Deprecation: true`, `Sunset: <data>`.
- Breaking change → nova major action + ADR.

## Idempotência consolidada

- Header `Idempotency-Key: <ulid ou uuid>` (recomendado obrigatório em v2).
- TTL 24h.
- Conflito (mesma key, payload diferente por hash) → 409 `FISCAL.CONFLITO_IDEMPOTENCIA`.
- Sucesso repetido → devolve resposta cacheada com header `Idempotent-Replay: true`.

## Códigos de erro consolidados (extensão do doc 26)

```
FISCAL.XML_INVALIDO             422
FISCAL.ASSINATURA_INVALIDA      422
FISCAL.DUPLICADA                409
FISCAL.NOTA_JA_CANCELADA        409
FISCAL.FORA_PRAZO               422
FISCAL.CCE_LIMITE_ATINGIDO      422
FISCAL.CCE_TEXTO_INVALIDO       422
FISCAL.FAIXA_JA_UTILIZADA       409
FISCAL.PRAZO_INUTILIZACAO       422
FISCAL.MANIFESTACAO_FORA_PRAZO  422
FISCAL.MANIFESTACAO_DUPLICADA   409
FISCAL.CERT_SENHA_INVALIDA      401
FISCAL.CERT_CNPJ_DIVERGENTE     422
FISCAL.UF_NAO_SUPORTA           422
FISCAL.CONFLITO_IDEMPOTENCIA    409
```

## Headers padrão

**Request**: `Authorization: Bearer <jwt>`, `Idempotency-Key`, `x-correlation-id?`, `Content-Type: application/json`.

**Response**: `x-correlation-id`, `x-fiscal-versao: v1`, `Retry-After?`, `Deprecation?`, `Sunset?`, `Idempotent-Replay?`.

## Autorização — matriz escopo × action

| Action | Escopo mínimo |
|---|---|
| autorizar / consultar-chave / status-servico / exportar / importar | `fiscal:emitir` |
| cancelar | `fiscal:cancelar` |
| carta-correcao | `fiscal:cce` |
| inutilizar | `fiscal:inutilizar` |
| manifestar | `fiscal:manifestar` |
| dfe/* | `fiscal:dfe` |
| cert/* | `fiscal:certificado` |
| auditoria/* | `fiscal:auditoria` |
| endpoints/* runtime-config PUT | `fiscal:admin` |

`fiscal:admin` implica todos.