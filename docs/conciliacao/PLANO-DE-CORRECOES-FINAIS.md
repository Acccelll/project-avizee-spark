# Plano de Correções Finais — Conciliação Financeira

Lista priorizada de pendências identificadas na auditoria (Etapa 8), com impacto, criticidade, esforço e recomendação.

## P0 — Bloqueantes

*Nenhum item identificado.*

## P1 — Recomendados antes do Go Live

| # | Item                                                          | Impacto                                    | Esforço | Recomendação                                             |
| - | ------------------------------------------------------------- | ------------------------------------------ | ------- | -------------------------------------------------------- |
| 1 | Alertas de saúde do worker de Outbox                          | Detecção precoce de atrasos em eventos    | S       | Configurar antes do Go Live; alerta em `cron_health`.    |
| 2 | Runbook de rollback + smoke test pós-deploy                   | Reduz MTTR em incidentes                   | S       | Documentar e executar dry-run na janela de deploy.       |
| 3 | Congelar migrations e feature flags durante janela de Go Live | Evita ruído durante monitoramento inicial  | XS      | Política operacional.                                    |

## P2 — Pós Go Live (30 dias)

| # | Item                                                       | Impacto                          | Esforço |
| - | ---------------------------------------------------------- | -------------------------------- | ------- |
| 1 | Painel de KPIs e SLA por operador                          | Governança operacional           | M       |
| 2 | UI de replay de Outbox / DLQ                               | Autonomia do suporte             | M       |
| 3 | Refatorar componente de conciliação manual (> 400 linhas)  | Manutenibilidade                 | M       |
| 4 | Views materializadas para dashboard                        | Performance de leitura           | S       |
| 5 | Backfill de hash-chain retroativo                          | Auditabilidade completa          | M       |

## P3 — Evolução contínua

| # | Item                                                        | Impacto                | Esforço |
| - | ----------------------------------------------------------- | ---------------------- | ------- |
| 1 | Helper `handleDomainError` compartilhado                    | Consistência de erros  | S       |
| 2 | Tipos de score para `zod` compartilhado com edge functions  | Segurança de contrato  | S       |
| 3 | Retreino automático a partir de `matching_feedback`         | Precisão do matching   | L       |
| 4 | Tour guiado e onboarding contextual                         | Adoção                 | M       |

## Critério de encerramento

Todos P0 e P1 concluídos antes do Go Live. P2 acompanhados no ciclo pós-produção (30 dias). P3 no roadmap trimestral.
