# Etapa 5 — Núcleo de Comunicação Fiscal

Implementação da fundação de comunicação com a SEFAZ (**sem** regras específicas
de nenhum documento fiscal). Toda a lógica vive em `src/modules/fiscal/` e
respeita os ADRs 001–017.

## Componentes entregues

| Camada          | Módulo                                                     | Arquivo |
| --------------- | ---------------------------------------------------------- | ------- |
| Core            | Catálogo de erros canônicos + `makeError`/`isRetryable`    | `core/errors.ts` |
| XML             | Builder/serializer/parser (client-safe, DOMParser)         | `infrastructure/xml/xmlEngine.ts` |
| XSD             | Validador leve (raiz + namespace); XSD real fica no proxy  | `infrastructure/xml/xsdValidator.ts` |
| Assinatura      | Contrato `ISignatureEngine` + adaptador `sefaz-proxy`      | `infrastructure/signature/signatureEngine.ts` |
| Certificados    | Repositório de metadados (Etapa 4) + delegação ao Vault    | `infrastructure/certificates/certificadoMetadataRepository.ts` |
| Endpoint Reg.   | Resolução em `fiscal_endpoints` com cache TTL              | `infrastructure/config/endpointRegistry.ts` |
| Retry           | `withRetry` com backoff exponencial + jitter               | `infrastructure/transport/retryPolicy.ts` |
| Circuit Breaker | `CircuitBreaker` in-memory (closed/open/half-open)         | `infrastructure/transport/circuitBreaker.ts` |
| Transport       | `HttpTransport` — canal único via Edge `sefaz-proxy`       | `infrastructure/transport/httpTransport.ts` |
| SOAP            | `SoapClient` — envelope SOAP 1.2 + double-wrapper AN       | `infrastructure/soap/soapClient.ts` |

## Regras invioláveis reafirmadas

- **Transporte único:** todo tráfego SEFAZ sai pelo Edge `sefaz-proxy`
  (mem `sefaz-mtls-transporte`). Nenhum `fetch` direto no client.
- **Endpoints são dados:** `EndpointRegistry` lê de `fiscal_endpoints`;
  URLs SEFAZ nunca em código (ADR-003).
- **Envelope padronizado:** todo `Result<T>` do módulo carrega
  `FiscalError.code` do catálogo (ADR-014).
- **Retryability por código:** `withRetry` só reenvia quando
  `isRetryable(err) === true`; rejeições SEFAZ (RN/negócio) não retentam.
- **Circuit breaker por chave:** default `documento:uf:servico`; abre em
  5 falhas consecutivas, cooldown 30s.

## Não incluso (permanece para etapas seguintes)

- Módulos por documento (`NFe`, `NFCe`, `CTe`, `MDFe`, `DFe`) e eventos.
- Upload/rotação de certificado A1 pela UI (metadados já modelados).
- C14N/XMLDSig client-side — permanece **exclusivamente** server-side
  em `supabase/functions/_shared/xml-c14n.ts` + `pfx.ts`.
- Persistência de estado do breaker em `fiscal_circuit_state`.

## Testes

`src/modules/fiscal/__tests__/comunicacao.test.ts` cobre XML round-trip,
escape, XSD raiz, breaker, retry (retryable vs não-retryable) e catálogo
de erros. Suite completa do módulo: **12 testes passando**.

## ADRs relacionadas

- ADR-001 (runtime), ADR-002 (C14N), ADR-003 (endpoint registry),
  ADR-004 (signature suite), ADR-011 (edges canônicas),
  ADR-014 (envelope de resposta), ADR-015 (correlation-first).