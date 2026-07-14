# 07 — Plano de Sustentação e Governança Técnica

## Ciclos de manutenção
| Tipo | Cadência | Responsável |
|------|----------|-------------|
| Corretiva | Sob demanda | Squad fiscal |
| Evolutiva | A cada release | Squad fiscal + arquiteto |
| Atualização de layouts / NT | Imediata após publicação SEFAZ | Squad fiscal |
| Atualização legal | Contínua via `MonitorRegulatorioService` | Analista fiscal + squad |
| Atualização de dependências | Trimestral | Squad plataforma |
| Rotação de certificados A1 | Anual (por empresa) | Cliente + suporte |

## Governança de mudanças
- Toda mudança arquitetural exige **ADR**.
- Toda mudança em regra tributária passa por `GovernancaConfiguracoesService.registrar` (versão, autor, aprovador, rollback).
- Toda atualização de layout usa `CentroAtualizacoesService.preValidar` → `aplicar`.
- Feature flags (`fiscal:v2:*`) para strangler migration (ADR-016).
- Migrações fiscais executadas via `MigracaoRunner` (rollback automático).

## Versionamento e releases
- SemVer.
- Breaking changes exigem major + entrada no changelog.
- APIs internas dos módulos são estáveis; alterações em contratos públicos (`application/contracts.ts`) exigem major do módulo.
