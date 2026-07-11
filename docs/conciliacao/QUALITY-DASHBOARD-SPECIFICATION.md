# Quality Dashboard — Especificação

Dashboard operacional para acompanhamento contínuo da qualidade do módulo.

## Público-alvo

CQO, Arquiteto, Tech Lead, PO, QA, Engenharia.

## KPIs Principais

| KPI                          | Fórmula / Fonte                                  | Meta         |
| ---------------------------- | ------------------------------------------------ | ------------ |
| Qualidade Geral              | Média ponderada dos Scorecards das últimas 5 sprints | ≥ 90       |
| Cobertura de Testes          | Cobertura de RPCs e serviços críticos            | ≥ 80%        |
| Débito Técnico               | Itens P2/P3 em aberto                            | ↓ trimestral |
| Conformidade Arquitetural    | % de PRs sem desvio                              | 100%         |
| Performance                  | p95 de RPCs críticas                             | < 2s         |
| Segurança                    | Findings críticos/altos                          | 0            |
| Documentação                 | % de PRs com docs atualizadas                    | 100%         |
| Bugs em Produção             | Bugs P0/P1 nas últimas 4 semanas                 | 0            |
| Regressões                   | Testes de regressão vermelhos                    | 0            |
| Taxa de Auto-Match           | Auto-match / total de conciliações               | ↑ mensal     |

## Métricas Secundárias

- MTTR por severidade.
- Lead time de correções.
- Aprovação por Gate (Feature/Sprint/Epic/Release/Go Live).
- Volume por domínio.
- Saúde do worker de Outbox e cron.
- Ledger: 100% íntegro (verificador agendado).

## Visualizações Recomendadas

- Gauge de Qualidade Geral.
- Série temporal por Gate.
- Heatmap de eliminatórios por domínio.
- Barras empilhadas de débito técnico por severidade.
- Funil de aprovação (Feature → Go Live).
- Tabela top-N de riscos abertos.

## Alertas

- Score da Sprint < 85.
- Eliminatório reincidente.
- Cobertura < 80%.
- p95 > 2s em RPC crítica.
- Fila de Outbox atrasada.
- Falha no verificador de hash-chain.

## Fontes de Dados

- Scorecards armazenados por Sprint.
- Suítes de teste (unit/integração/E2E).
- APM/logs estruturados.
- Ledger e Outbox.
- Ferramenta de gestão de backlog.

## Cadência

- Diária: alertas.
- Semanal: KPIs por Sprint.
- Mensal: revisão executiva.
- Trimestral: revisão do próprio dashboard.
