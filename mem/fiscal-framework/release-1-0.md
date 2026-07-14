---
name: fiscal-framework/release-1-0
description: Release 1.0 do Framework Fiscal — baseline oficial, certificação interna e roadmap consolidado (Etapa 14)
type: reference
---

# Framework Fiscal — Release 1.0 (Etapa 14)

Baseline oficial após 14 etapas. **Nenhuma funcionalidade de negócio nova nesta etapa** — apenas consolidação.

## Referências obrigatórias
- Documentação executiva: `docs/fiscal-framework/etapa-14/` (00–10).
- Índice de ADRs (17 vigentes): `docs/fiscal-framework/etapa-14/02-adr-index.md`.
- Baseline programática: `src/modules/fiscal/release/releaseReport.ts` (`RELEASE_1_0_BASELINE`).
- Roadmap operacional: `src/modules/fiscal/compliance/application/roadmap.ts` (`ROADMAP_PADRAO`).

## Regras
- Toda mudança arquitetural exige ADR novo.
- Toda mudança em regra fiscal passa por `GovernancaConfiguracoesService` (versão + rollback).
- Toda atualização de layout passa por `CentroAtualizacoesService.preValidar`.
- Novos documentos fiscais entram como **plugins** via `FiscalPlatform` (Etapa 13).
- Métricas de release: 109/109 testes fiscais, typecheck limpo, 17 ADRs vigentes.

## Estado apto para
Homologação funcional e preparação para produção. Riscos residuais e recomendações estratégicas em `docs/fiscal-framework/etapa-14/10-relatorio-executivo.md`.
