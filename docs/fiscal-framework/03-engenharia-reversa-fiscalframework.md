# 03 · Engenharia reversa do FiscalFramework

Foco em **conceitos e padrões** que serão reaproveitados na arquitetura alvo,
não em portar código.

## 1. Camadas

```
┌─────────────────────────────────────────────────────┐
│  Facade  (FiscalFrameworkFactory.Create)            │  raiz de composição
├─────────────────────────────────────────────────────┤
│  Modules (NFe, futuros NFCe/CTe/MDFe/NFSe)          │  domínio por documento
├─────────────────────────────────────────────────────┤
│  Engines (Xml, Cryptography, Security, Soap,        │  capacidades técnicas
│           Transport, Schema)                        │
├─────────────────────────────────────────────────────┤
│  Foundation (Abstractions, Common, Core)            │  contratos + VOs
└─────────────────────────────────────────────────────┘
```

Regra de dependência estrita: **Modules → Engines → Foundation**. Foundation
não referencia ninguém. Engines não conhecem documentos específicos.

## 2. Fluxo de emissão NF-e (referência)

```
cliente.NFe.AutorizarAsync(nota, ctx)
  │
  ▼
 [1] NFeSerializer.Serialize(nota)              → xmlInf (bytes UTF-8)
  │
  ▼
 [2] IXmlSigner.Sign(xmlInf, "infNFe", cert)    → NFe assinada
     └─ interno: IXmlCanonicalizer.Canonicalize (C14N 1.0)
                 SHA-1 do digest
                 RSA-SHA1 sobre SignedInfo canônico
  │
  ▼
 [3] ISchemaValidator.Validate(NFe, "leiauteNFe_v4.00.xsd")
     └─ se DiretorioSchemas=null → pulado com log
  │
  ▼
 [4] MontarLote(NFe)                            → enviNFe (SEM <?xml?>)
  │
  ▼
 [5] SoapEnvelope.Wrap(enviNFe, descriptor)     → envelope SOAP 1.2
  │
  ▼
 [6] IEndpointResolver.Resolve("NFe", Autorizacao, ctx) → Uri
  │
  ▼
 [7] ITransportChannel.SendAsync(TransportRequest{Uri, envelope, "application/soap+xml"}, ct)
     └─ HttpClient com mTLS (client cert = transport cert)
  │
  ▼
 [8] Parsers.ParseRetEnviNFe(response)          → Result<Protocolo>
  │
  ▼
 [9] Se cStat=103 (lote em processamento) → RetAutorizacao (poll com backoff)
     Se cStat=100 (autorizado) → compõe nfeProc (NFe + protNFe)
  │
  ▼
  Result devolvido ao chamador (facade decide o que persistir)
```

**Não persiste nada por conta própria** — ADR-08 explícito no framework.

## 3. Fluxo de Distribuição DF-e

```
cliente.NFe.DistribuicaoDFeAsync(cnpj, cursorNSU, ctx)
  │
  ▼
 [1] Monta consNSU (ou distNSU) com ultNSU + CNPJ
 [2] Assina (obrigatório também no DistDFe)
 [3] SoapEnvelope (Ambiente Nacional — SOAP com double-wrapper: nfeDistDFeInteresse + nfeDadosMsg)
 [4] Transport → hom1.nfe.fazenda.gov.br / www1.nfe.fazenda.gov.br
 [5] Parse retDistDFeInt
 [6] Para cada docZip: GzipCodec.Decompress → XML original (resNFe, resEvento, procNFe, procEventoNFe)
 [7] Retorna lista de documentos + próximo NSU
 [8] Chamador decide persistir (worker AvizeeSync faz upsert em nfe_distribuicao)
```

## 4. Fluxos de eventos

| Evento | tpEvento | Payload |
|--------|----------|---------|
| Cancelamento | 110111 | chave, protocolo autorizado, justificativa (15-255 chars) |
| Carta de Correção | 110110 | chave, xCorrecao, nSeqEvento |
| Ciência da Operação | 210210 | chave, CNPJ manifestante |
| Confirmação | 210200 | chave, CNPJ |
| Desconhecimento | 210220 | chave, CNPJ |
| Não Realizada | 210240 | chave, CNPJ, justificativa |
| Inutilização | (envio próprio) | ano, série, faixa nNF, justificativa |

Todos passam pelo mesmo pipeline: montagem → assinatura (id="ID{tpEvento}{chave}{nSeqEvento}") → SOAP → transport → parse.

## 5. Padrão dos contratos (por que funciona)

- **Result Pattern** (`Common/Result.cs`) — sem exceções para fluxo de negócio.
  Rejeição SEFAZ (cStat != 100) é `Result.Fail`, não `throw`.
- **Providers separados de certificado** — assinatura pode usar cert diferente do transporte.
- **`IFiscalClock`** — proíbe `DateTime.Now`; tornam testes determinísticos.
- **`SoapOperationDescriptor` como dado** — módulos declaram, engine não decide.
- **`FiscalContext` transversal** — UF e ambiente viajam em todas as chamadas.
- **Zero DI container** — `Create(options)` compõe manualmente; facilita adoção em qualquer host.

## 6. C14N 1.0 própria (por que não usa lib)

O framework implementou C14N 1.0 do zero porque:
1. `System.Security.Cryptography.Xml.XmlDsigC14NTransform` do .NET falha com
   detalhes do perfil SEFAZ (namespaces herdados, ordem de atributos, xml:space).
2. Reprodutibilidade: mesmo XML → mesmos bytes canônicos, sempre.
3. Testável offline sem provider crypto do OS.

A implementação cobre: normalização de espaços em atributos, ordenação
lexicográfica de atributos, resolução de namespaces herdados, tratamento de
elementos vazios como `<x></x>` (não `<x/>`).

**Consequência para o AVIZEE**: precisamos de C14N própria em TS/Deno também
(há registro em `mem/features/c14n-sefaz`).

## 7. Endpoint Registry (padrão a copiar)

```csharp
registry.Registrar("NFe", ServicoFiscal.Autorizacao, uf: 35, amb: Homologacao,
    url: "https://homologacao.nfe.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx");
```

Endpoints **nunca são hardcoded no código de negócio**. A tabela é dado
versionado. Isso corrige exatamente o bug `hom.nfe → hom1.nfe` que quebrou o
DistDFe do AVIZEE por meses.

## 8. SOAP: dois padrões suportados no mesmo motor

- **Serviços estaduais (SEFAZ SP, RS, MG…)** — SOAP 1.2 Document/Literal moderno:
  `soap:Body` contém apenas o elemento de dados (`nfeDadosMsg`).
- **Ambiente Nacional (DistDFe, RecepcaoEvento4)** — legado ASMX/WCF: dois
  níveis — operação + parâmetro (`nfeDistDFeInteresse` > `nfeDadosMsg`).

O `SoapOperationDescriptor` diferencia com o campo opcional
`OperationElementName`. Motor único, comportamentos declarativos.

## 9. Transport: o mínimo suficiente

- `HttpClient` com `SocketsHttpHandler`.
- `ClientCertificates.Add(transportCert)` para mTLS.
- `SslProtocols = Tls12 | Tls13`.
- Timeout configurável por request (padrão 30s status, 60s autorização).
- **Sem retry no transport** — retry vive no orquestrador acima (idempotência por chave).

## 10. Certificado A1

- `PfxCertificateProvider.DeArquivo(path, senha)` ou `.DeBytes(bytes, senha)`.
- `X509KeyStorageFlags`:
  - Windows → `DefaultKeySet` (SChannel exige).
  - Linux/macOS → `EphemeralKeySet`.
- Hot-swap: `provider.Recarregar()` troca o certificado interno sem reiniciar
  o processo (útil para renovação anual).

## 11. O que **não** está no framework (por decisão)

- Persistência (ADR-08) — quem chama decide.
- Fila / retry entre chamadas (fica no orquestrador).
- UI, DANFE, e-mail.
- Multi-empresa nativa (uma instância por CNPJ é o modelo).

## 12. Guia de integração com o AVIZEE (`docs/INTEGRACAO-AVIZEE-SPARK.md`)

O próprio framework propõe duas formas de plugar no AVIZEE:

1. **Worker externo (`AvizeeSync`)** — CLI .NET agendada, PostgREST + service_role.
2. **Fiscal Gateway** — HTTP API .NET, lê cert do bucket `dbavizee` + Vault.

**A Etapa 1 rejeita ambas** para o alvo: introduz dependência de host .NET
externo. A decisão está no ADR-001 — reimplementação nativa em TS/Deno
aproveitando os padrões (Endpoint Registry, C14N própria, Signature Suite,
Result Pattern, plugin por documento).