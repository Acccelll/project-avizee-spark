# 22 · Catálogo definitivo de módulos

Refina o doc 07 da Etapa 1 acrescentando **limites, eventos produzidos, eventos
consumidos e APIs internas** para cada módulo. Nomes canônicos permanecem.

Convenções da tabela:
- **Camada**: Foundation | Engine | Cross | Module | Facade
- **Dep.**: módulos que ele importa (nunca ao contrário)
- **APIs internas**: métodos públicos do módulo
- **Emite / Consome**: eventos de domínio (nomes canônicos)

## Foundation

### `fiscal-core`
- **Responsabilidade**: contratos, VOs, enums, `FiscalResult<T>`.
- **Limites**: sem I/O, sem lib externa além de tipos.
- **Dep.**: nenhuma.
- **APIs internas**: tipos exportados; nenhum método.
- **Emite / Consome**: nada.

## Engines

### `fiscal-xml`
- **Resp.**: writer determinístico + C14N 1.0.
- **APIs**: `serialize(node): string`, `canonicalize(xml, elementId): Uint8Array`.
- **Dep.**: core.

### `fiscal-signature`
- **Resp.**: XMLDSig enveloped, RSA-SHA1 (default) e RSA-SHA256 (pronto).
- **APIs**: `sign(xml, elementId, cert, suite?): Uint8Array`, `validate(xml): { digestOk, sigOk }`.
- **Dep.**: core, xml, certificate.

### `fiscal-schema`
- **Resp.**: validação XSD sob demanda (opcional se XSDs ausentes).
- **APIs**: `validate(xml, schemaRoot): string[]`, `schemasDisponiveis: boolean`.
- **Dep.**: core.

### `fiscal-soap`
- **Resp.**: envelope 1.2, single/double wrapper, SOAPAction.
- **APIs**: `envelopar(descriptor, body): string`, `desenvelopar(xml): string`.
- **Dep.**: core, xml.

### `fiscal-transport`
- **Resp.**: fetch Deno com mTLS via `Deno.createHttpClient({ cert, key })`.
- **APIs**: `send(req, signal): Promise<TransportResponse>`.
- **Dep.**: core, certificate. **Retry proibido aqui.**
- **Nota**: para o AN, delega ao adapter externo (proxy mTLS — ver `mem/tech/sefaz-mtls-transporte.md`).

## Cross-cutting

### `fiscal-certificate-manager`
- **Resp.**: parse .pfx, cache in-memory por invocação, alerta 30d.
- **APIs**: `carregar(empresaId): Certificate`, `metadados(empresaId): CertMeta`, `expirandoEm(empresaId): number`.
- **Emite**: `CertificadoCarregado`, `CertificadoProximoDoVencimento`, `CertificadoExpirado`.

### `fiscal-endpoint-registry`
- **Resp.**: resolver URL SEFAZ a partir de `(documento, uf, ambiente, servico, versao)`.
- **APIs**: `resolve(...): URL`, `listar(uf, amb): EndpointRow[]`.
- **Emite**: `EndpointResolvido`.
- **Falha**: `EndpointNaoCadastrado` (prescritivo).

### `fiscal-clock` / `fiscal-logger` / `fiscal-cache-manager`
- **APIs**: `now()` / `debug/info/warn/error(msg, ctx)` / `get/set/invalidate(key)`.

### `fiscal-audit`
- **APIs**: `registrar(entry: AuditEntry): Promise<void>`.
- **Consome**: `SefazRequisitado`, `SefazRespondeu`, `DocumentoAutorizado`, etc.

### `fiscal-queue-manager`
- **APIs**: `enfileirar(fila, payload)`, `consumir(fila, handler, maxMsg)`.
- **Filas canônicas**: ver doc 19.

### `fiscal-idempotency`
- **APIs**: `chaveDe(operacao, ctx): string`, `tentar(chave, fn): Promise<T>`.
- **Estratégia**: constraint UNIQUE no banco é a fonte de verdade; método é conveniência.

## Modules (documentos)

### `fiscal-module-nfe` (v1)
- **Resp.**: pipeline completo de NF-e (serialize → sign → validate → send → parse).
- **APIs**: `serialize(nota)`, `sign(xml, cert)`, `validateXsd(xml)`, `autorizar(xml, ctx)`, `consultarSituacao(chave, ctx)`, `parseRetorno(xml)`.
- **Dep.**: todos os Engines + Cross.
- **Emite**: `DocumentoSerializado`, `DocumentoAssinado`, `DocumentoAutorizado`, `DocumentoRejeitado`, `DocumentoDenegado`.

### `fiscal-module-eventos`
- **APIs**: `cancelar(chave, justificativa, ctx)`, `cartaCorrecao(chave, texto, seq, ctx)`, `inutilizar(faixa, ctx)`, `manifestar(chave, tipo, ctx)`.
- **Emite**: `CancelamentoAutorizado`, `CCeRegistrada`, `InutilizacaoAutorizada`, `ManifestacaoRegistrada`.

### `fiscal-module-dfe`
- **APIs**: `sincronizar(empresaId, ambiente): DFeResumo`, `downloadPorChave(chave)`.
- **Emite**: `DFeSincronizado`, `DFeRecebido`, `DFeNSUAvancado`.

### `fiscal-module-status`
- **APIs**: `consultarStatus(uf, ambiente): StatusServicoResult`.
- **Emite**: `SefazIndisponivel` quando cStat ≠ 107.

### `fiscal-module-nfce` / `cte` / `mdfe` / `nfse`
- **Não implementados na v1**. Contrato já publicado em core (`IFiscalDocumentModule`).

## Facade

### `createFiscalRuntime(options)`
- **Resp.**: composição — cria e injeta engines nos modules, expõe `runtime.nfe/.eventos/.dfe/.status`.
- **Dep.**: todos.
- **Não é DI container** — composição manual explícita, testável.

## Matriz de dependência (regra de ouro)

```text
Modules  ──► Engines ──► Foundation
   │           │
   ▼           ▼
  Cross ◄──── Cross
```

- Modules podem usar Engines e Cross.
- Engines podem usar Cross (ex.: signature usa certificate).
- Cross **nunca** importa Modules.
- Foundation **nunca** importa nada do framework.

## Novos módulos propostos (Etapa 2)

### `fiscal-contingency-manager`
- **Resp.**: decidir emissão em contingência (SVC-AN/SVC-RS/EPEC/FS-DA) quando autorizador principal falha.
- **APIs**: `avaliar(ctx, ultimoErro): DecisaoContingencia`, `aplicar(nota, decisao): nota`.
- **Emite**: `ContingenciaAtivada`, `ContingenciaEncerrada`.

### `fiscal-circuit-breaker`
- **Resp.**: por autorizador+ambiente, abrir após N falhas consecutivas, meio-aberto após T segundos.
- **APIs**: `permitir(autorizador, amb): boolean`, `registrar(sucesso)`.
- **Estado**: in-memory por invocação (edge é stateless) + tabela leve `fiscal_circuit_state` opcional para cross-invocation.

### `fiscal-rate-limiter`
- **Resp.**: proteção contra rejeição SEFAZ por excesso de requisições.
- **APIs**: `tomar(bucket): Promise<void>` (backoff cooperativo).

### `fiscal-notification-service`
- **Resp.**: publicar eventos operacionais em canais AVIZEE (notificações in-app, e-mail, webhook).
- **APIs**: `notificar(evento, destinatarios[])`.
- **Consome**: `CertificadoProximoDoVencimento`, `SefazIndisponivel`, `DocumentoRejeitado`, `AlertaFiscalDisparado`.

### `fiscal-schema-registry`
- **Resp.**: metadados dos PLs XSD, resolver bytes do bucket, cache.
- **APIs**: `resolver(documento, versao): XsdBundle`, `plVigente(documento, data): string`.

Todos os novos módulos seguem as mesmas regras de camada e ficam em `src/fiscal-framework/cross/*` (backlog Etapa 3+).