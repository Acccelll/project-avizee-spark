---
name: Framework Fiscal — módulos canônicos
description: Nomes canônicos e responsabilidades de cada módulo do runtime fiscal; referência para novos serviços e edges
type: reference
---
Camadas (dependência estrita: Modules → Engines → Foundation):

- **Foundation**: `fiscal-core` (contratos, VOs, `FiscalResult<T>`, `ChaveAcesso`, `IFiscalClock`, `IXmlCanonicalizer`, `IXmlSigner`, `ISignatureValidator`, `ISigningCertificateProvider`, `ITransportChannel`, `IEndpointResolver`, `ISchemaValidator`, `IFiscalDocumentModule`).
- **Engines**: `fiscal-xml` (writer + C14N 1.0 própria), `fiscal-signature` (XMLDSig + SignatureSuite), `fiscal-schema` (XSD), `fiscal-soap` (envelope 1.2 + SoapOperationDescriptor cobrindo single/double-wrapper AN), `fiscal-transport` (fetch Deno mTLS).
- **Cross-cutting**: `fiscal-certificate-manager`, `fiscal-clock`, `fiscal-logger`, `fiscal-audit`, `fiscal-queue-manager` (pgmq), `fiscal-cache-manager`, `fiscal-idempotency`, `fiscal-endpoint-registry` (tabela `fiscal_endpoints`).
- **Modules**: `fiscal-module-nfe` (v1), `fiscal-module-eventos`, `fiscal-module-dfe`, `fiscal-module-status`; futuros `fiscal-module-nfce/cte/mdfe/nfse`.
- **Fachada**: `createFiscalRuntime(options)` compõe sem DI container; expõe `runtime.nfe/.eventos/.dfe/.status`.

Edges canônicas: `fiscal-nfe`, `fiscal-events`, `fiscal-dfe`, `fiscal-cert`, `fiscal-cron`. Legadas (`sefaz-proxy`, `sefaz-distdfe`, `process-*-cron`) permanecem até corte final. Detalhes completos em `docs/fiscal-framework/07-modulos-e-responsabilidades.md`.