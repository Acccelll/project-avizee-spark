# Etapa 7 — Eventos Fiscais, Ciclo de Vida da NF-e e Distribuição DF-e

**Status:** ✅ Concluída  
**Local do código:** `src/modules/fiscal/nfe/eventos/`

## Entregas

| Área | Arquivo |
|------|---------|
| Entidades | `domain/entities.ts` (`EventoFiscal`, `InutilizacaoNumeracao`, `DistDFeState`, `TIPO_EVENTO`) |
| Regras | `domain/rules.ts` (`validarCancelamento`, `validarCartaCorrecao`, `validarManifestacao`, `validarInutilizacao`, IDs canônicos) |
| Builders XML | `infrastructure/eventoXmlBuilder.ts`, `infrastructure/inutilizacaoXmlBuilder.ts`, `infrastructure/distDFeXmlBuilder.ts` |
| Contratos | `application/contracts.ts` (`IEventoRepository`, `IInutilizacaoRepository`, `IDistDFeStateRepository`, `IXmlStorage`) |
| Cancelamento | `application/cancelarNFe.ts` — evento 110111, janela 24h, transição `autorizada → cancelada` |
| CC-e | `application/cartaCorrecao.ts` — evento 110110, até 20 por NF-e, sequência automática |
| Inutilização | `application/inutilizarNumeracao.ts` — nfeInutilizacaoNF, controle de sobreposição |
| Consulta de recibo | `application/consultarRecibo.ts` — nfeRetAutorizacao (lote) |
| Manifestação | `application/manifestacaoDestinatario.ts` — recepção AN, cOrgao=91 |
| Distribuição DF-e | `application/distribuicaoDFe.ts` — incremental por NSU, persistência via portas |
| Download XML | `application/downloadXml.ts` — idempotente (checa Storage antes de re-baixar) |
| Sincronização | `application/sincronizarStatus.ts` — reconsulta pendentes e atualiza status |
| Barramento | `application/events.ts` + união `FiscalEventName` (+18 nomes) |
| Testes | `__tests__/eventos.test.ts` — 15 cenários (regras/IDs/builders/máquina) |

## Máquina de estados — delta

- `rascunho → inutilizada` (novo)
- `autorizada → autorizada` (idempotência de reconsulta)
- `autorizada → cancelada` (mantido)

## Reuso obrigatório

O helper `_shared.ts::assinarEEnviar` encapsula o pipeline
`ISignatureEngine → IEndpointRegistry → SoapClient → IAuditoriaRepository`
e é o único caminho de saída. Nenhum use case da Etapa 7 faz HTTP direto,
manipula certificado ou grava auditoria bypassando as portas da Etapa 5.

## Restrições respeitadas

Não foram implementados nesta etapa: NFC-e, CT-e, MDF-e, NFS-e, SPED,
EFD-Reinf, eSocial, escrita fiscal, apuração e obrigações acessórias.

## Validação

```
bunx tsgo --noEmit                                    → 0 erros
bunx vitest run src/modules/fiscal/nfe/eventos/…      → 15/15 passando
```

ADRs relacionados: 002 (c14n), 004 (signature suite), 014 (envelope de
resposta), 016 (strangler por operação), 017 (eventos como fato passado).