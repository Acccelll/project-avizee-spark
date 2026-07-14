# Etapa 6 — Módulo NF-e (documento base)

Primeiro documento fiscal do Framework, servindo de referência arquitetural
para NFC-e/CT-e/MDF-e nas etapas seguintes. Todo o módulo vive em
`src/modules/fiscal/nfe/` e **consome** integralmente o núcleo da Etapa 5
(XML Engine, XSD Validator, Signature Engine, EndpointRegistry, SoapClient,
HttpTransport, CircuitBreaker, catálogo de erros, EventBus, AuditoriaRepository).

## Estrutura entregue

```
src/modules/fiscal/nfe/
├── domain/
│   ├── entities.ts        # NFe, NFeIde, Emitente, Destinatario, Item, Totais
│   ├── stateMachine.ts    # 11 estados canônicos + transição controlada
│   └── rules.ts           # validarNFe(), montarChave(), calcularDvChave()
├── application/
│   ├── contracts.ts       # INFeRepository, INFeXmlStorage
│   ├── events.ts          # NFeEventName (fato passado)
│   ├── authorizeUseCase.ts# AuthorizeNFeUseCase (fluxo síncrono)
│   └── consultUseCase.ts  # ConsultNFeUseCase (consSitNFe)
├── infrastructure/
│   └── nfeXmlBuilder.ts   # buildNFeXml() + buildEnviNFe()
└── __tests__/nfe.test.ts  # 8 testes (regras, chave, state machine, XML)
```

## Fluxo de autorização (síncrono)

`AuthorizeNFeUseCase.execute(nfe)` orquestra:

1. `validarNFe` — regras de negócio (RN) puras
2. Transição `rascunho → validada`
3. `buildNFeXml` — monta `<NFe>` + `<infNFe>` (versao 4.00)
4. `ClientSideXsdValidator` — checa raiz `<NFe>` + namespace
5. `ISignatureEngine.sign` — assina server-side via `sefaz-proxy` (Vault + A1)
6. Transição `validada → assinada` + evento `fiscal.nfe.assinada`
7. `IEndpointRegistry.resolve({documento:'NFe',servico:'autorizacao'})` — sem URL hardcoded
8. `SoapClient.call` — envelope SOAP 1.2 com `enviNFe`; retry/breaker/logging
   herdados da Etapa 5
9. Parse do retorno, mapeamento `cStat → status` (`100/150→autorizada`,
   `110/301-303→denegada`, demais→`rejeitada`)
10. `INFeRepository.updateStatus` + `IAuditoriaRepository.record`
11. Evento correspondente emitido no `FiscalEventBus`

## Máquina de estados

```
rascunho → validada → assinada → transmitida → em_processamento
                                            ↘  autorizada → cancelada → arquivada
                                            ↘  denegada  → arquivada
                                            ↘  rejeitada → rascunho | arquivada
                                inutilizada → arquivada
```

`transition(from, to)` devolve `Result<NFeStatus>` — qualquer salto fora do mapa
vira `FISCAL.INTERNAL`, protegendo o invariant.

## Persistência (contrato)

A porta `INFeRepository` (`save`/`updateStatus`/`getById`/`getByChave`)
será plugada em subetapa dedicada ao mapeamento com `notas_fiscais` +
`nota_fiscal_eventos`. O legado (`src/services/fiscal/*`) continua ativo em
paralelo por 60 dias (ADR-016 · strangler).

## Restrições reafirmadas

- Nenhuma chamada direta à SEFAZ — só via `HttpTransport → sefaz-proxy`.
- Não incluído nesta etapa: NFC-e, CT-e, MDF-e, NFS-e, DF-e, manifestação,
  cancelamento, CC-e, inutilização, download automático, importação de terceiros.

## Testes

`src/modules/fiscal/nfe/__tests__/nfe.test.ts` — **8 testes**:
validação (mínima, vNF inconsistente, idDest interna), DV mod 11,
chave 44 dígitos, transições válidas/inválidas, builder XML (raiz, Id,
versão, CNPJ). Suite completa do módulo fiscal: **20/20 verdes**.

## ADRs relacionadas

- ADR-005 (plugin por documento), ADR-011 (edges canônicas),
  ADR-014 (envelope), ADR-016 (strangler), ADR-017 (eventos passado).