---
name: Framework Fiscal — módulo NF-e (Etapa 6)
description: Módulo NFe em src/modules/fiscal/nfe (domain/application/infra); use AuthorizeNFeUseCase para autorizar, ConsultNFeUseCase para consultar; nunca duplicar transporte/assinatura
type: reference
---

Módulo NF-e do Framework Fiscal (documento base, referência para os
próximos). Localização: `src/modules/fiscal/nfe/`. Consome integralmente a
infra da Etapa 5.

**Componentes:**
- `domain/entities.ts` — `NFe`, `NFeIde`, `NFeEmitente`, `NFeDestinatario`, `NFeItem`, `NFeTotais`, `NFeStatus` (11 estados).
- `domain/stateMachine.ts` — `canTransition(from,to)` + `transition(from,to)`. Transições fora do mapa retornam `FISCAL.INTERNAL`.
- `domain/rules.ts` — `validarNFe()` (RN essenciais), `calcularDvChave()` (mod 11 pesos 2..9), `montarChave()` (44 dígitos oficiais).
- `infrastructure/nfeXmlBuilder.ts` — `buildNFeXml(nfe): {xml, chave}` monta `<NFe>` versão 4.00 usando `buildXml` do XML Engine; `buildEnviNFe(xmlAssinado)` produz o envelope síncrono `<enviNFe indSinc=1>`.
- `application/authorizeUseCase.ts` — `AuthorizeNFeUseCase.execute(nfe)` orquestra RN → build → XSD leve → sign (server) → resolve endpoint → SOAP → parse cStat → repositório+auditoria+evento.
- `application/consultUseCase.ts` — `ConsultNFeUseCase.execute({chave,uf,ambiente})` para `consSitNFe`; NÃO assina.
- `application/contracts.ts` — porta `INFeRepository`/`INFeXmlStorage` (implementação real virá em subetapa; legado continua em `src/services/fiscal/*`).
- `application/events.ts` + eventos adicionados ao `FiscalEventBus` (`fiscal.nfe.criada/validada/assinada/transmitida/autorizada/rejeitada/denegada/persistida/atualizada/consultada`).

**Regras invioláveis:**
- Endpoint SEFAZ sempre via `EndpointRegistry.resolve({documento:'NFe',servico:'autorizacao'|'consultaProtocolo',...})`. Nunca URL literal.
- Transporte sempre via `SoapClient(HttpTransport)`. `assinar:false` quando o XML já veio assinado (autorização) ou dispensa assinatura (consulta).
- Mapeamento `cStat → status`: `100/150→autorizada`; `110/301/302/303→denegada`; demais→`rejeitada`.
- Eventos internos usam nome no particípio passado (ADR-017).

**How to apply:** ao adicionar um novo documento fiscal (NFC-e/CT-e/MDF-e), copie a topologia `nfe/{domain,application,infrastructure}` — nunca reinventar transporte, retry, breaker, signature ou endpoint registry. Ao integrar com ERP (pedido de venda → NF-e), monte o objeto `NFe` na camada ERP e passe ao `AuthorizeNFeUseCase`; o módulo não conhece pedido/estoque/financeiro (baixo acoplamento).