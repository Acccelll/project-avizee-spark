# ADR-005 — Plugin por documento (`IFiscalDocumentModule`)

**Status**: aceito · **Data**: 2026-07-13

## Contexto
O AVIZEE hoje é NF-e-cêntrico. Adicionar NFC-e/CT-e/MDF-e/NFS-e sem contrato
exige mexer no Core. O framework .NET expõe `IFiscalDocumentModule` — cada
documento é um plugin de primeira classe.

## Decisão
`fiscal-core` publica interface `IFiscalDocumentModule { documento, versao,
serialize, sign, validateXsd, autorizar, consultarSituacao, parseRetorno }`.
O runtime compõe módulos: `runtime.nfe`, e no futuro `runtime.nfce`,
`runtime.cte`, etc. **Engines não conhecem NF-e** — só XML/SOAP/Transport/Signature.

## Consequências
Adicionar novo documento = novo módulo, sem tocar em Core/Engines.
Testável isoladamente por documento.

## Referência
FiscalFramework `Abstractions/Contracts.cs` (`IFiscalDocumentModule`).