# 02 · Inventário — FiscalFramework v0.21 (.NET, referência)

Projeto usado **apenas como referência arquitetural**. Não é copiado.

## Estrutura de solução

```
FiscalFramework/
├── Directory.Build.props
├── FiscalFramework.slnx
├── README.md
├── docs/
│   ├── INTEGRACAO-AVIZEE-SPARK.md      # guia oficial de integração
│   └── edge-function-exemplo/
├── schemas/                             # XSDs do Pacote de Liberação SEFAZ (~100+)
├── samples/                             # TestApp, HomologacaoApp, AvizeeSync, Gateway
├── tests/
└── src/
    ├── foundation/
    │   ├── FiscalFramework.Abstractions/      # Contracts.cs (interfaces puras)
    │   ├── FiscalFramework.Common/            # Result, ValueObjects, GzipCodec
    │   └── FiscalFramework.Core/              # EndpointRegistry
    ├── engines/
    │   ├── FiscalFramework.Xml/               # XmlNodeModel, FiscalXmlWriter, C14NCanonicalizer
    │   ├── FiscalFramework.Cryptography/      # XmlDSigSigner, XmlDSigValidator
    │   ├── FiscalFramework.Security/          # PfxCertificateProvider
    │   ├── FiscalFramework.Soap/              # SoapEnvelope (1.2 genérico)
    │   ├── FiscalFramework.Transport/         # HttpTransportChannel (mTLS)
    │   └── FiscalFramework.Schema/            # DirectorySchemaValidator (XSD)
    ├── modules/
    │   └── FiscalFramework.NFe/
    │       ├── Models.cs                      # POCOs do leiaute 4.00 (subset)
    │       ├── NFeSerializer.cs               # Serializer manual (modo SEFAZ strict)
    │       ├── Parsers.cs                     # Parse de retornos
    │       ├── NFeEndpoints.cs                # Tabela declarativa por UF/ambiente
    │       ├── Eventos.cs                     # Cancelamento, CCe, Manifestação
    │       └── NFeClient.cs                   # Facade do módulo NFe
    └── facade/
        └── FiscalFramework/                   # FiscalFrameworkFactory.Create(options)
```

## Contagem

~1620 linhas de C# (foundation + engines + modules), zero dependências NuGet
(só BCL). ~100 XSDs em `schemas/`.

## Contratos principais (`FiscalFramework.Abstractions/Contracts.cs`)

| Contrato | Papel |
|----------|-------|
| `AmbienteFiscal` (enum) | `Producao = 1`, `Homologacao = 2` — sem default (ADR-09). |
| `ServicoFiscal` (enum) | Autorizacao, RetAutorizacao, ConsultaProtocolo, StatusServico, Inutilizacao, ConsultaCadastro, RecepcaoEvento, DistribuicaoDFe. |
| `FiscalContext` | `(CodigoUf, Ambiente, TipoEmissao)` — passado em toda operação. |
| `IFiscalClock` | `Agora()` — proíbe `DateTime.Now` direto. |
| `IXmlCanonicalizer` | `Canonicalize(xml, elementLocalName)` — C14N 1.0. |
| `SignatureSuite` | `RsaSha1` (default) / `RsaSha256` (pronto p/ NT futura). |
| `IXmlSigner` | Assina o elemento identificado por `Id`, injeta `<Signature>` como irmão. |
| `ISignatureValidator` | Valida assinatura em NF-es de terceiros. |
| `ISigningCertificateProvider` / `ITransportCertificateProvider` | Providers separados; hot-swap interno (§10.2). |
| `TransportRequest/Response` | Bytes + metadados; Transport **não conhece SOAP**. |
| `ITransportChannel` | HTTP real ou fake (testabilidade). |
| `SoapOperationDescriptor` | `(ServiceNamespace, DataElementName, SoapAction?, OperationElementName?)` — dado, não código; suporta ambos os padrões SOAP (WS moderno single-wrapper e AN legado double-wrapper). |
| `IEndpointResolver` | Resolve `(documento, servico, ctx) → Uri`. |
| `ISchemaValidator` | Valida XML contra XSD; ausência do PL = etapa reportada como pulada. |
| `IFiscalDocumentModule` | Contrato de plugin de documento (`Documento`, `Versao`). |

## Engines

- **Xml/C14NCanonicalizer.cs** — C14N 1.0 própria, ordenação canônica de atributos, tratamento de namespaces herdados, sem depender de `XmlDsigC14NTransform`.
- **Xml/XmlNodeModel.cs** — modelo intermediário para geração determinística.
- **Xml/FiscalXmlWriter.cs** — writer que respeita o modo SEFAZ strict (sem prolog `<?xml?>` quando embutido em envelope).
- **Cryptography/XmlDSigSigner.cs** — implementa assinatura com `SignatureSuite` variável, gera `<Signature>` conforme perfil SEFAZ.
- **Cryptography/XmlDSigValidator.cs** — verifica DigestValue + SignatureValue.
- **Security/PfxCertificateProvider.cs** — carrega `.pfx` (arquivo, memória, bytes); trata `EphemeralKeySet` diferente por SO (Win vs Linux/macOS).
- **Soap/SoapEnvelope.cs** — envelope SOAP 1.2 genérico; monta com base em `SoapOperationDescriptor`.
- **Transport/HttpTransportChannel.cs** — `HttpClient` com `SocketsHttpHandler` + mTLS (`ClientCertificates`), TLS 1.2+, timeout, sem retry (retry vive acima).
- **Schema/SchemaValidator.cs** — validador XSD, retorna lista de violações.

## Core

- **EndpointRegistry.cs** — dicionário `(doc, servico, uf, ambiente) → Uri`.
  Falha com mensagem prescritiva quando endpoint não cadastrado, apontando o
  arquivo de dados (ADR-12). Endpoints são **dados versionados**, nunca código.

## Módulo NFe

- **Models.cs** — subset do leiaute 4.00 (ide, emit, dest, det, ICMSSN, PIS/COFINS NT, total, transp, pag, infAdic).
- **NFeSerializer.cs** — 269 linhas, serializer manual determinístico.
- **Parsers.cs** — parse de `retEnviNFe`, `protNFe`, `retConsSitNFe`, `retDistDFeInt`.
- **NFeEndpoints.cs** — tabela declarativa: SP, RS, AM, BA, GO, MG, MS, MT, PE, PR (próprios); SVAN (MA); SVRS (16 UFs sem infraestrutura); Ambiente Nacional (`www1.nfe.fazenda.gov.br` prod, `hom1.nfe.fazenda.gov.br` hom).
- **Eventos.cs** — Cancelamento, CCe, Manifestação (210210 Ciência, 210200 Confirmação, 210220 Desconhecimento, 210240 Não Realizada).
- **NFeClient.cs** — `AutorizarAsync`, `ConsultarSituacaoAsync`, `DistribuicaoDFeAsync`, `StatusServicoAsync`, `CancelarAsync`, `CartaCorrecaoAsync`, `ManifestarAsync`, `InutilizarAsync`.

## Fachada

`FiscalFrameworkFactory.Create(options)` compõe o runtime sem container DI.
`FiscalRuntime` expõe módulos (`.NFe`, futuramente `.CTe`, `.NFCe`, `.MDFe`, `.NFSe`).

## Samples relevantes

- **TestApp** — 18 verificações offline com `FakeSefazTransport`.
- **HomologacaoApp** — CLI para SEFAZ real: `--acao status|autorizar|consultar|distribuicao`.
- **AvizeeSync** — worker que consome DistDFe e escreve em `nfe_distribuicao`/`nfe_distdfe_sync` via PostgREST (service_role).
- **Gateway** — HTTP API (`/health`, `/api/sync`, `/api/status-servico`, `/api/nfe/{chave}`, `/api/manifestar`, `/api/cancelar`, `/api/cce`, `/api/certificado/reload`), lê certificado do bucket `dbavizee` + senha do Vault.

## Changelog resumido (do README)

- **v0.4** — `EphemeralKeySet` fix Windows.
- **v0.5** — remove `<?xml?>` de payloads embutidos em `nfeDadosMsg`; `FakeSefazTransport` valida com `XmlReader` estrito.
- **v0.6** — `ConsultarSituacaoAsync` + `DistribuicaoDFeAsync`; endpoints AN atualizados hom→hom1.
- **v0.8+** — validação real contra SEFAZ-SP homologação.