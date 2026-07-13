---
name: Framework Fiscal — roadmap oficial (Etapa 2)
description: Ordem das etapas de implementação; nenhum trabalho fiscal deve pular etapa nem entrar em produção sem coexistência com legacy
type: reference
---
Ordem oficial (`docs/fiscal-framework/etapa-2/35-roadmap-arquitetural.md`):

1. **Etapa 3 · Fundações** — `src/fiscal-framework/{core,engines,cross}` + migrations `fiscal_endpoints`, `fiscal_auditoria`, `fiscal_runtime_config`. Lib-only, nada em produção.
2. **Etapa 4 · Autorização NF-e sob flag** — edge `fiscal-nfe` (autorizar/consultar/status) + `fiscal:v2:autorizacao`; coexiste com `sefaz-proxy`.
3. **Etapa 5 · Eventos** — `fiscal-events` (cancel/CCe/inut/manif) sob flag.
4. **Etapa 6 · DF-e** — `fiscal-dfe` substitui `sefaz-distdfe`; `fiscal-cron` consome `fiscal.dfe.sync`.
5. **Etapa 7 · Retry/contingência/observabilidade** — filas `fiscal.retry.*`, circuit breaker, dashboards, alertas.
6. **Etapa 8 · Certificado** — `fiscal-cert` substitui parse/upload em `sefaz-proxy`.
7. **Etapa 9 · Depreciação legacy** — congela `sefaz-proxy`/`sefaz-distdfe`/`process-*-cron`; remove após 60d.
8. **Etapa 10 · Multi-empresa** — `empresa_id` do JWT; certificado/numeração por empresa.
9. **Etapa 11 · Multi-filial** — `filial_id`; `series_numeracao (empresa,filial)`.
10. **Etapa 12+** — NFC-e → CT-e/MDF-e → NFS-e (ABRASF + top 20 municípios) → SPED Fiscal/Contribuições → EFD-Reinf/eSocial.

Regras: (a) nenhuma etapa começa sem ADR quando envolve decisão; (b) coexistência 30d mínima com legacy antes de corte; (c) feature flag por operação; (d) rollback preparado; (e) docs atualizadas antes do deploy; (f) E2E em homologação antes de produção.