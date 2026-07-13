---
name: Framework Fiscal — endpoints são dados
description: Regra absoluta — URLs SEFAZ nunca em código; sempre em tabela fiscal_endpoints
type: constraint
---
Toda URL SEFAZ vive na tabela `fiscal_endpoints (documento, uf, ambiente, servico, versao, url, atualizado_em, fonte)` com UNIQUE em `(documento, uf, ambiente, servico, versao)`. Atualização = migration de dados versionada. Runtime resolve via `endpointRegistry.resolve(documento, servico, ctx)`; falha com mensagem prescritiva (não fallback silencioso).

**Why:** URLs SEFAZ mudam sem aviso. O bug hom.nfe → hom1.nfe (2022) quebrou o DistDFe do AVIZEE por meses porque estava hardcoded em `sefazUrls.service.ts`. ADR-003 registra a decisão.

**How to apply:** ao ver constante literal com host `.fazenda.gov.br` ou `.sefaz.*.gov.br` em código, é bug — enfileirar migração para `fiscal_endpoints`. Ao adicionar suporte a nova UF/serviço, primeira ação é inserir a linha no registry, nunca modificar código.