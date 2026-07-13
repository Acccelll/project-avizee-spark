---
name: Framework Fiscal — contratos obrigatórios
description: Interfaces TS que espelham os contratos do FiscalFramework .NET e devem existir em fiscal-core
type: reference
---
Interfaces obrigatórias em `src/fiscal-framework/core/` (equivalentes TS de `FiscalFramework.Abstractions/Contracts.cs`):

- `AmbienteFiscal = 'homologacao' | 'producao'` (sem default).
- `ServicoFiscal` (union: `autorizacao | retAutorizacao | consultaProtocolo | statusServico | inutilizacao | consultaCadastro | recepcaoEvento | distribuicaoDFe`).
- `FiscalContext { empresaId, uf, ambiente, tipoEmissao }`.
- `FiscalResult<T>` (Result Pattern: `{ ok: true, value } | { ok: false, error }`).
- `IFiscalClock.now(): Date`.
- `IXmlCanonicalizer.canonicalize(xml, elementLocalName): Uint8Array`.
- `IXmlSigner.sign(xml, elementLocalName, cert): Uint8Array` (injeta `<Signature>` como irmão).
- `ISignatureValidator.validate(xml): { digestValido, assinaturaValida, detalhe }`.
- `ISigningCertificateProvider.atual()` + `ITransportCertificateProvider.atual()` (podem ser o mesmo).
- `TransportRequest/Response`, `ITransportChannel.send(req, signal): Promise<TransportResponse>`.
- `SoapOperationDescriptor { serviceNamespace, dataElementName, soapAction?, operationElementName? }` (o `operationElementName` cobre o double-wrapper do Ambiente Nacional).
- `IEndpointResolver.resolve(documento, servico, ctx): URL`.
- `ISchemaValidator.validate(xml, schemaRootFile): string[]` + `schemasDisponiveis: boolean`.
- `IFiscalDocumentModule { documento, versao }` — plugin.
- `SignatureSuite { digestUri, signatureUri, hashName }` — `RsaSha1` default, `RsaSha256` pronto.

Não replicar `throw` para negócio; erros SEFAZ viajam em `FiscalResult.error`. Detalhes em `docs/fiscal-framework/07-modulos-e-responsabilidades.md` e `docs/fiscal-framework/03-engenharia-reversa-fiscalframework.md`.