---
name: Framework Fiscal — eventos e ciclo de vida NF-e
description: Etapa 7 — módulo eventos (110111/110110/manif), inutilização, DF-e, download e sincronização; expandiu máquina de estados
type: feature
---

# Framework Fiscal — Etapa 7 (Eventos, Ciclo de Vida da NF-e e DF-e)

**Local:** `src/modules/fiscal/nfe/eventos/`

## Escopo
- **Eventos suportados**: Cancelamento (110111), CC-e (110110), Manifestação
  do destinatário (210210/210200/210220/210240).
- **Inutilização de numeração** (nfeInutilizacaoNF).
- **Consulta de recibo** (nfeRetAutorizacao) e reutiliza `ConsultNFeUseCase`
  da Etapa 6 para consulta de protocolo/chave.
- **Distribuição DF-e** (nfeDistDFeInteresse) com controle de NSU/maxNSU
  incremental e persistência via portas (`IDistDFeStateRepository`).
- **Manifestação** transita pelo AN (`cOrgao=91`, `servico=recepcaoEventoAN`).
- **Download de XML** autorizado idempotente (`IXmlStorage.getAutorizado`
  antes de re-baixar) — pronto para plugar Storage `dbavizee/fiscal/`.
- **Sincronização** de status: consulta em lote e delega transição para
  o repositório, respeitando `canTransition` da máquina de estados.

## Máquina de estados (delta)
- `rascunho → inutilizada` liberado.
- `autorizada → cancelada` mantido; `autorizada → autorizada` aceito
  (idempotência de reconsulta de protocolo).

## Contratos novos (portas)
`IEventoRepository`, `IInutilizacaoRepository`, `IDistDFeStateRepository`,
`IXmlStorage` — implementações concretas (Supabase/Storage) entram em etapa
de integração; o núcleo permanece agnóstico e testável.

## Barramento
18 novos eventos `fiscal.nfe.*` (cancelamento/cce/inutilizacao/manifestacao/
recibo/protocolo/distdfe/xml/status), todos como fato passado (ADR-017).
Adicionados no union `FiscalEventName` do `eventBus.ts`.

## Regras (subset MOC 4.00)
- Cancelamento: janela 24h, `nSeqEvento=1`, `xJust` 15..255, `nProt` obrigatório.
- CC-e: `xCorrecao` 15..1000; limite de 20 por NF-e via `countCartaCorrecao`.
- Inutilização: faixa ≤ 10.000; validação de sobreposição via `existsFaixa`.
- Manifestação: "operação não realizada" exige `xJust` 15..255.

## IDs canônicos
- Evento (54 chars): `ID + tpEvento(6) + chave(44) + nSeq(2)`.
- Inutilização (43 chars): `ID + cUF(2) + ano(2) + CNPJ(14) + 55 + serie(3) + nNFIni(9) + nNFFin(9)`.

## Reuso
Toda transmissão passa por `assinarEEnviar` (`_shared.ts`) → reutiliza
`ISignatureEngine`, `IEndpointRegistry`, `SoapClient`, `IAuditoriaRepository`
e o `FiscalEventBus` da Etapa 5. Zero HTTP/certificado neste módulo.

## Testes
`src/modules/fiscal/nfe/eventos/__tests__/eventos.test.ts` — 15 cenários
(regras + IDs + builders + máquina de estados). Sem regressão nos 20 testes
da Etapa 6 nem nos da Etapa 5.