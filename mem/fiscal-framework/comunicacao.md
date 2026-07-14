---
name: Framework Fiscal — núcleo de comunicação (Etapa 5)
description: XML/XSD/Signature/Transport/SOAP/Retry/Breaker em src/modules/fiscal; canal único via sefaz-proxy; consultar antes de mexer em qualquer chamada SEFAZ
type: reference
---

A Etapa 5 entregou o núcleo de comunicação em `src/modules/fiscal/`:

- `core/errors.ts` — catálogo `FISCAL_ERROR_CODES` + `makeError` + `isRetryable`. Códigos alinhados ao envelope ADR-014 (`FISCAL.REJEICAO`, `FISCAL.NETWORK.TIMEOUT`, `FISCAL.BREAKER.ABERTO`, `FISCAL.ENDPOINT.NAO_CADASTRADO`, ...).
- `infrastructure/xml/xmlEngine.ts` — `buildXml`, `parseXml`, `withProlog`, `textOf`. Client-safe (DOMParser). Escape XML nativo.
- `infrastructure/xml/xsdValidator.ts` — `ClientSideXsdValidator` checa raiz+namespace; XSD completo permanece server-side.
- `infrastructure/signature/signatureEngine.ts` — `ISignatureEngine` + `ServerSideSignatureEngine` que delega ao Edge `sefaz-proxy`. Suite default RSA-SHA1 (ADR-004); trocável.
- `infrastructure/transport/retryPolicy.ts` — `withRetry(op, {max,backoffMs,signal})`. Só reenvia se `isRetryable(err)`.
- `infrastructure/transport/circuitBreaker.ts` — `CircuitBreaker` in-memory por chave (`documento:uf:servico`).
- `infrastructure/transport/httpTransport.ts` — `HttpTransport` **único canal** para SEFAZ; sempre via `supabase.functions.invoke('sefaz-proxy', ...)`. Nunca `fetch` direto.
- `infrastructure/soap/soapClient.ts` — envelope SOAP 1.2 + `operationElementName` para double-wrapper do Ambiente Nacional.

**How to apply:** ao implementar um novo serviço fiscal (NF-e, CT-e, evento, DF-e), instancie `SoapClient(HttpTransport(CircuitBreaker))`, resolva a URL via `EndpointRegistry.resolve()`, monte o `innerXml` com `buildXml()`, chame `soap.call({...})` e propague o `FiscalError.code` no envelope de resposta. Nunca duplicar retry/breaker/transport nos módulos por documento — todos consomem este núcleo.