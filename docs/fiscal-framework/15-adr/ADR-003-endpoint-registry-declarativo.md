# ADR-003 — Endpoint Registry declarativo (tabela `fiscal_endpoints`)

**Status**: aceito · **Data**: 2026-07-13

## Contexto
URLs SEFAZ mudam sem aviso. Em 2022 o Ambiente Nacional migrou
`hom.nfe.fazenda.gov.br` → `hom1.nfe.fazenda.gov.br`. O AVIZEE tinha
endpoints hardcoded em `sefazUrls.service.ts` e o DistDFe quebrou
silenciosamente até alguém notar. O framework .NET evita isso com
`EndpointRegistry` — dados, não código.

## Decisão
Toda URL SEFAZ vive em `fiscal_endpoints (documento, uf, ambiente, servico,
versao, url, atualizado_em, fonte)`, com UNIQUE em `(documento, uf, ambiente,
servico, versao)`. Runtime resolve via `EndpointResolver`. Atualização vira
migration de dados — reviewable, versionada, rollbackable.

## Consequências
- (+) Atualizar URL vira PR de 1 linha; audit trail via migration.
- (+) Multi-versão convive (v4.00 hoje, futura NT simultaneamente).
- (+) Teste local injeta registry alternativo.
- (−) Uma tabela extra + seed (~50 linhas). Aceito.

## Referência
FiscalFramework `Core/EndpointRegistry.cs`, `NFe/NFeEndpoints.cs`; doc 04 §D1.