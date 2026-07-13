# ADR-004 — SignatureSuite trocável (RSA-SHA1 hoje, RSA-SHA256 pronto)

**Status**: aceito · **Data**: 2026-07-13

## Contexto
O perfil SEFAZ vigente usa RSA-SHA1. Notas Técnicas futuras podem migrar para
RSA-SHA256 (movimento comum em padrões governamentais). Sem abstração, a
troca exige refactor. O framework .NET tem `SignatureSuite` como VO trocável.

## Decisão
`SignatureEngine` recebe `SignatureSuite` (contendo `digestUri`,
`signatureUri`, `hashName`). Default `RsaSha1`; `RsaSha256` implementado e
pronto para ativação por config (ou por versão de leiaute).

## Consequências
Ativação da NT quando publicada = mudar 1 config, sem tocar em código.

## Referência
FiscalFramework `Abstractions/Contracts.cs` (`SignatureSuite`),
`Cryptography/XmlDSigSigner.cs`.