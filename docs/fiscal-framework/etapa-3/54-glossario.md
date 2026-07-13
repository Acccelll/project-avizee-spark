# 54 · Glossário

Termos canônicos usados em código, documentação e conversação sobre o Framework
Fiscal AVIZEE.

## Fiscais (SEFAZ / legislação)

- **AN** — Ambiente Nacional (autorizador federal, UF 91). Usado para DistDFe e alguns eventos.
- **Autorizador** — SEFAZ (estadual, SVAN, SVRS ou AN) que autoriza o documento.
- **Chave de acesso** — 44 dígitos identificadores do documento. Estrutura em RN-002.
- **cStat** — Código de status SEFAZ (3 dígitos). 100=Autorizada, 107=Serviço em operação, etc.
- **CFOP** — Código Fiscal de Operações e Prestações.
- **CRT** — Código de Regime Tributário (1=Simples, 2=Simples excesso, 3=Normal).
- **CST/CSOSN** — Situação tributária ICMS por regime.
- **CT-e** — Conhecimento de Transporte eletrônico (modelo 57).
- **CCe** — Carta de Correção Eletrônica (evento 110110).
- **CSC** — Código de Segurança do Contribuinte (NFC-e).
- **DANFE** — Documento Auxiliar da NF-e (PDF/impressão).
- **DFe / DistDFe** — Distribuição de DF-e; obtenção de docs endereçados ao CNPJ.
- **DPEC** — Declaração Prévia de Emissão em Contingência (não usado; substituído por EPEC).
- **EFD-Reinf** — Escrituração Fiscal Digital de Retenções e Outras Informações Fiscais.
- **eSocial** — Sistema de Escrituração Digital das Obrigações Fiscais Previdenciárias e Trabalhistas.
- **EPEC** — Evento Prévio de Emissão em Contingência.
- **IE** — Inscrição Estadual.
- **IM** — Inscrição Municipal.
- **`indIEDest`** — Indicador de IE do destinatário (1=contribuinte, 2=isento, 9=não contribuinte).
- **`indTot`** — Indicador se o valor do item entra no total da NF.
- **Inutilização** — pedido de invalidação de faixa de numeração não emitida.
- **Manifestação** — evento do destinatário sobre NF-e recebida (ciência, confirmação, desconhecimento, não realizada).
- **MDF-e** — Manifesto Eletrônico de Documentos Fiscais (modelo 58).
- **NCM** — Nomenclatura Comum do Mercosul (8 dígitos).
- **NF-e** — Nota Fiscal eletrônica (modelo 55).
- **NFC-e** — Nota Fiscal de Consumidor eletrônica (modelo 65).
- **NFS-e** — Nota Fiscal de Serviço eletrônica (municipal).
- **NSU** — Número Sequencial Único (DistDFe).
- **`natOp`** — Natureza da Operação.
- **PL** — Pacote de Liberação (versão de XSDs SEFAZ, ex.: PL_010).
- **Protocolo (nProt)** — número atribuído pela SEFAZ à autorização.
- **SAT** — Sistema Autenticador e Transmissor de Cupons Fiscais Eletrônicos (SP).
- **SPED** — Sistema Público de Escrituração Digital (Fiscal / Contribuições).
- **SVAN** — Sefaz Virtual do Ambiente Nacional.
- **SVRS** — Sefaz Virtual do Rio Grande do Sul.
- **SVC-AN / SVC-RS** — Sefaz Virtual de Contingência.
- **`tpEmis`** — Tipo de emissão (1=normal, 2..9=contingências).
- **UF** — Unidade Federativa (código IBGE 11..53; 91 = AN).
- **XMLDSig** — assinatura digital XML (W3C).
- **`xMotivo`** — texto de status SEFAZ (par com `cStat`).
- **`vNF`, `vProd`, ...** — grandezas monetárias da NF (fórmulas RN-020).

## Framework AVIZEE

- **ADR** — Architecture Decision Record. Registra decisão arquitetural com contexto e consequências.
- **Agregado** — raiz consistente de uma transação (ex.: `NotaFiscal` inclui itens, eventos, anexos).
- **Application Layer** — camada de use cases; orquestra Domain + Infra.
- **Bounded Context** — fronteira semântica com vocabulário próprio.
- **`correlation_id`** — id que atravessa toda a cadeia de uma operação (`flx-YYYYMMDDHHMMSS-random`).
- **Cross-cutting** — módulos transversais (audit, logger, cache, endpoints, cert).
- **Domain Layer** — regras puras, sem I/O.
- **DTO** — Data Transfer Object.
- **Edge function** — Deno function em Supabase (`supabase/functions/*`).
- **Endpoint Registry** — tabela `fiscal_endpoints` (ADR-003).
- **Envelope de resposta** — `SucessoEnvelope`/`ErroEnvelope` padronizado (ADR-014).
- **Fachada** — camada fina (`src/services/fiscal/*`) que traduz DTO ERP ↔ comandos.
- **Feature flag** — chave `fiscal:v2:*` que ativa/desativa operação por request/empresa.
- **`FiscalContext`** — `{ empresaId, uf, ambiente, tipoEmissao }`.
- **`FiscalResult<T>`** — Result Pattern (`{ ok:true,value } | { ok:false,error }`).
- **`IFiscalDocumentModule`** — contrato de plugin por documento (NF-e, NFC-e, CT-e...).
- **`IEndpointResolver`** — contrato para resolução de URL SEFAZ.
- **`IXmlCanonicalizer`** — contrato de C14N.
- **`IXmlSigner`** — contrato de assinatura XMLDSig.
- **Idempotency-Key** — header que garante idempotência de operação escrita (ADR-012).
- **Modular monolith de edges** — 5 edges canônicas com módulos plugáveis (ADR-011).
- **Módulo** — pacote lógico do framework (ex.: `fiscal-module-nfe`).
- **pgmq** — extensão Postgres para filas (usada em `fiscal.*`).
- **Plugin por documento** — cada documento fiscal é um `IFiscalDocumentModule` (ADR-005).
- **RBAC** — Role-Based Access Control (escopos `fiscal:*`).
- **RLS** — Row-Level Security (Postgres).
- **Runtime** — objeto composto por `createFiscalRuntime(options)` que expõe todos os serviços.
- **`SignatureSuite`** — tupla `{ digestUri, signatureUri, hashName }`, trocável (ADR-004).
- **`SoapOperationDescriptor`** — `{ serviceNamespace, dataElementName, soapAction?, operationElementName? }`.
- **Strangler** — padrão de migração gradual (ADR-016).
- **VO** — Value Object (imutável, definido por igualdade de valor).

## Estados canônicos

- **Rascunho, Validado, Assinado, Transmitido, EmProcessamento, Autorizada, Cancelada, Denegada, Rejeitada, RejeitadaDefinitiva, Contingencia** (documento).
- **Pendente, Assinado, Transmitido, Registrado, Rejeitado** (evento).
- **Ausente, Valido, AlertaVerde, AlertaAmarelo, Expirado, Removido** (certificado).
- **Enfileirada, EmProcessamento, Deletada, Arquivada** (fila).
- **Closed, Open, HalfOpen** (circuit breaker).

## Convenções

- **`fiscal-*`** — prefixo canônico de módulos, edges e (novas) tabelas do framework.
- **`fiscal.*`** — prefixo canônico de filas pgmq.
- **`fiscal:*`** — prefixo canônico de escopos RBAC e feature flags.
- **Ambientes**: `homologacao` | `producao` (nunca `hom`/`prod`).

## Anti-termos (proibidos em código)

- `console.log/error/warn/debug` → usar `_shared/logger.ts`.
- `new Date()` em módulos fiscais → usar `runtime.clock.now()`.
- `throw` para rejeição SEFAZ → usar `FiscalResult.error`.
- URL SEFAZ hardcoded → usar `fiscal_endpoints`.
- "hom" / "prod" → usar `homologacao` / `producao`.

## Referências externas

- Portal Nacional NF-e: https://www.nfe.fazenda.gov.br/portal/
- Manuais SEFAZ (MOC NF-e, NFC-e, DistDFe): mesmo portal.
- Ajuste SINIEF 07/05: retenção 5 anos.
- W3C XMLDSig: https://www.w3.org/TR/xmldsig-core/
- Exclusive C14N: https://www.w3.org/TR/xml-exc-c14n/

## Cross-refs internos rápidos

- ADRs 001–016: `docs/fiscal-framework/15-adr/`.
- Etapa 1 (análise): `docs/fiscal-framework/*.md` (docs 01–19).
- Etapa 2 (arquitetura): `docs/fiscal-framework/etapa-2/*.md` (docs 20–35).
- Etapa 3 (spec técnica): `docs/fiscal-framework/etapa-3/*.md` (docs 40–54, este).
- Memórias: `mem/fiscal-framework/*.md`.