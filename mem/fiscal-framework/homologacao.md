---
name: Framework Fiscal — Homologação e Hardening
description: Etapa 11 — E2E runner, carga, recuperação, hardening checklist, auditoria arquitetural, relatório de homologação
type: feature
---

Módulo `src/modules/fiscal/homologacao/` (Etapa 11). Não introduz negócio.

- `E2ERunner` amarra fluxos; `CargaService` mede throughput; `RecuperacaoService` valida retry/backoff da Etapa 5.
- `HardeningChecklist` canoniza os controles já materializados (RBAC granular, RLS em fiscal_*, MFA opcional, secrets no Vault, alerta de certificado, CORS restrito, logger sem PII).
- `AuditoriaArquitetural`: domain nunca importa infrastructure; application só via contratos/portas.
- `RelatorioHomologacaoService` decide `aptoParaHomologacao` (cenários OK + hardening OK + carga sem falhas + checklist produção OK + cobertura ≥ 70%).
- Suíte fiscal consolidada: 83/83 testes; typecheck limpo.
