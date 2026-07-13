# 07 · Módulos e responsabilidades

Cada módulo é um pacote lógico com contrato próprio. Nomes canônicos abaixo
devem ser usados em código, tabelas, buckets e docs futuros.

## Foundation (contratos + primitivos)

### `fiscal-core`
Contratos, VOs, enums. **Depende de nada.**
- `AmbienteFiscal` (`homologacao | producao`)
- `ServicoFiscal` (`autorizacao | retAutorizacao | consultaProtocolo | statusServico | inutilizacao | consultaCadastro | recepcaoEvento | distribuicaoDFe`)
- `FiscalContext { empresaId, uf, ambiente, tipoEmissao }`
- `FiscalResult<T>` (Result Pattern)
- `ChaveAcesso` VO (44 dígitos, dígito verificador)
- `Cnpj`, `Cpf`, `Uf`, `CodigoMunicipio` VOs
- Contratos: `IFiscalClock`, `IXmlCanonicalizer`, `IXmlSigner`, `ISignatureValidator`,
  `ISigningCertificateProvider`, `ITransportCertificateProvider`,
  `ITransportChannel`, `IEndpointResolver`, `ISchemaValidator`,
  `IFiscalDocumentModule`.

## Engines (capacidades técnicas)

### `fiscal-xml`
- Modelo intermediário (`XmlNode`) determinístico.
- Writer em modo SEFAZ strict (sem `<?xml?>` embutido).
- **C14N 1.0 própria** (ordenação canônica, namespaces herdados, xml:space).

### `fiscal-signature`
- `XmlDSigSigner` (assina elemento por `Id`, injeta `<Signature>` como irmão).
- `XmlDSigValidator` (verifica digest + signature).
- `SignatureSuite` trocável (`rsa-sha1` default, `rsa-sha256` pronto).

### `fiscal-schema`
- Validador XSD sob demanda. XSDs no bucket `dbavizee/fiscal/schemas/PL_XXX/`.
- Ausência de XSDs → etapa reportada como "pulada" (não bloqueia).

### `fiscal-soap`
- Envelope SOAP 1.2 genérico.
- `SoapOperationDescriptor { serviceNamespace, dataElementName, soapAction?, operationElementName? }`.
- Suporta single-wrapper (estadual) e double-wrapper (Ambiente Nacional).

### `fiscal-transport`
- `fetch` do Deno com `Deno.createHttpClient({ cert, key })` para mTLS.
- TLS 1.2+, timeout por request, sem retry (retry é do orquestrador).
- `TransportRequest { url, body, contentType, soapAction? }` → `TransportResponse { status, body, contentType }`.

## Cross-cutting

### `fiscal-certificate-manager`
- Providers: `fromStorage(empresaId)` (bucket + Vault), `fromMemory(bytes, senha)`, `fromPkcs11(...)` (futuro).
- Cache em memória por invocação (edge é stateless — sem hot-swap complexo).
- Validação de validade + alerta 30d antes.

### `fiscal-endpoint-registry`
- Origem: tabela `fiscal_endpoints (documento, uf, ambiente, servico, url, versao, atualizado_em)`.
- Fallback: para UFs sem autorizador próprio, resolve via SVAN/SVRS.
- Cache in-memory por invocação.
- Falha prescritiva ("endpoint não cadastrado para NFe/Autorizacao/SP/producao — atualize `fiscal_endpoints`").

### `fiscal-clock`
- `system()`, `fixed(dt)` (testes).
- Toda operação fiscal usa `runtime.clock.now()` — proibido `new Date()` direto em módulos.

### `fiscal-logger`
- Wrapper sobre `src/lib/logger.ts`.
- Correlation-id obrigatório por operação.
- Máscaras: CNPJ/CPF parciais em info; completo só em `debug`. Chave completa sempre (é pública).
- Nunca loga XML assinado completo (sensível se contiver dados pessoais).

### `fiscal-audit`
- Tabela `fiscal_auditoria (id, empresa_id, correlation_id, operacao, ator, timestamp, request_hash, response_status, cstat, motivo)`.
- Escrita síncrona; retenção mínima 5 anos (obrigação legal).

### `fiscal-queue-manager`
- pgmq como transporte.
- Filas: `fiscal.dfe.sync`, `fiscal.eventos.manif`, `fiscal.retry.autorizacao`, `fiscal.retry.evento`.
- Consumidor: cron edge (`process-fiscal-queues`) — substitui `process-nfe-retry-cron` e `process-distdfe-cron` atuais.

### `fiscal-cache-manager`
- Cache leve (in-memory por invocação) para endpoint registry, status serviço, cert válido.
- Sem Redis (não é necessário no volume atual).

### `fiscal-idempotency`
- Chave natural de idempotência por operação:
  - Autorização: `(empresaId, chaveAcesso)`.
  - Evento: `(chaveAcesso, tpEvento, nSeqEvento)`.
  - DistDFe: `(cnpj, ambiente, nsu)`.
- Constraint UNIQUE em cada tabela alvo garante deduplicação no banco.

## Modules (documentos)

### `fiscal-module-nfe` (v1)
Implementa `IFiscalDocumentModule` com:
- `serialize(nota) → xml`
- `sign(xml, cert) → xmlAssinado`
- `validateXsd(xml) → violacoes[]`
- `autorizar(xmlAssinado, ctx) → FiscalResult<Protocolo>`
- `consultarSituacao(chave, ctx)`
- `parseRetorno(xml) → objetoTipado`
- Eventos: cancelar, cartaCorrecao, inutilizar.

### `fiscal-module-nfce`, `fiscal-module-cte`, `fiscal-module-mdfe`, `fiscal-module-nfse`
**Não implementados na v1**, mas o contrato `IFiscalDocumentModule` já
deve estar publicado no `fiscal-core` para permitir adição sem refactor.

### `fiscal-module-eventos` (transversal)
Manifestação do destinatário (ciência, confirmação, desconhecimento, não realizada).
Vale para NF-e recebida.

### `fiscal-module-dfe`
Distribuição DF-e (consulta NSU do Ambiente Nacional, decodificação de docZip).

### `fiscal-module-status`
Status serviço por autorizador.

## Integration Layer (edges)

Nome canônico | Substitui | Papel
---|---|---
`fiscal-nfe` | parte de `sefaz-proxy` | Autorização + consulta + eventos NFe
`fiscal-events` | parte de `sefaz-proxy` | Cancel, CCe, manifestação, inutilização
`fiscal-dfe` | `sefaz-distdfe` | Distribuição DF-e
`fiscal-cert` | `sefaz-proxy action=parse/upload` | Parse .pfx, upload seguro
`fiscal-cron` | `process-nfe-retry-cron` + `process-distdfe-cron` | Consumidor de filas

**Migração**: edges antigas coexistem até corte final; nova camada usa nomes
`fiscal-*`. Rota antiga entra em modo proxy → nova durante transição.

## Onde cada módulo mora (proposta)

```
src/fiscal-framework/            # runtime + engines + modules (código TS)
  core/                          # contracts, VOs
  engines/xml/                   # writer + c14n
  engines/signature/             # signer + validator
  engines/schema/                # xsd validator
  engines/soap/                  # envelope + descriptor
  engines/transport/             # fetch mTLS
  cross/certificate/
  cross/clock/
  cross/logger/
  cross/audit/
  cross/queue/
  cross/cache/
  cross/idempotency/
  cross/endpoints/
  modules/nfe/
  modules/eventos/
  modules/dfe/
  modules/status/
  runtime.ts                     # createFiscalRuntime

src/services/fiscal/             # fachada fina, chama edges (existente)
supabase/functions/fiscal-*/     # edges (novas, na Etapa X futura)
supabase/migrations/YYYY_fiscal_endpoints.sql   # tabela declarativa (futuro)
```

A pasta `src/fiscal-framework/` é **candidata** para o alvo; a decisão final
(reusar `src/services/fiscal/` ou não) fica para o backlog (doc 18).