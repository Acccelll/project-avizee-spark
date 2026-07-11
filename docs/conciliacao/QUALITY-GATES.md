# Quality Gates — Conciliação Financeira

> Etapa 11 — Sistema de Garantia Contínua de Qualidade. Executado obrigatoriamente ao final de cada Feature, Sprint, Epic, Release e Go Live. Reprovação bloqueia avanço.

## Parte 1 — Arquitetura do Processo

**Objetivo:** certificar continuamente qualidade arquitetural, funcional, técnica, financeira, de segurança, performance, UX, testes, observabilidade e documentação.
**Responsabilidades:** Tech Lead executa; Arquiteto valida; QA audita; PO aceita; CQO/Revisor Técnico certifica.
**Frequência:** ao final de cada Feature, Sprint, Epic, Release e antes do Go Live.
**Fluxo:**
```text
Feature concluída → Gates F → Correções → Sprint → Gates S → Epic → Gates E → Release → Gates R → Go Live
```
**Evidências obrigatórias:** relatórios de testes, logs, prints, métricas, diagramas, checklists preenchidos, ADRs atualizados.
**Aprovação:** score ≥ nota mínima do nível + zero eliminatórios.
**Reprovação:** qualquer eliminatório ou score < mínimo dispara o `CORRECTIVE-ACTION-PLAN.md`.

## Parte 2 — Estrutura por Nível

| Nível    | Nota mínima | Foco                                                              |
| -------- | ----------- | ----------------------------------------------------------------- |
| Feature  | 80          | Aderência arquitetural + aceite funcional + testes unitários.     |
| Sprint   | 85          | Integração, regressão, documentação, observabilidade.             |
| Epic     | 88          | Consolidação de fluxos, rastreabilidade e KPIs.                   |
| Release  | 90          | E2E completo, performance, segurança, runbook.                    |
| Go Live  | 92          | Checklist final, monitoramento, rollback ensaiado.                |

## Parte 3 — Gate Arquitetural

Valida aderência ao TO-BE, ADRs e Blueprint; separação de responsabilidades; baixo acoplamento; alta coesão; reutilização; modularidade; ausência de violações. Desvios são registrados (não corrigidos) no relatório da auditoria.

## Parte 4 — Gate Funcional

Requisitos implementados; casos de uso e regras financeiras cobertas; fluxos principais e alternativos; exceções; critérios de aceite mensuráveis. Qualquer funcionalidade incompleta é mapeada.

## Parte 5 — Gate Técnico

Backend, Frontend, Banco, APIs, Edge Functions, Hooks, Stores, Services, Eventos, Integrações, Observabilidade, Auditoria e Logs. Checa duplicação, código morto, complexidade, acoplamento, nomenclatura e consistência.

## Parte 6 — Gate Financeiro

Integridade financeira, rastreabilidade, conciliação, baixas, estornos, workflow, auditoria, histórico e consistência entre módulos. **Zero tolerância** a inconsistência financeira.

## Parte 7 — Gate de Banco

Integridade, FKs, índices, constraints (`chk_`), auditoria, versionamento e impacto em performance. RLS e GRANT explícitos por tabela.

## Parte 8 — Gate de Performance

Tempo de resposta, paginação, cache, processamento, consultas, paralelismo, memória, CPU, escalabilidade e volumes-alvo (100k → 10M conforme escopo).

## Parte 9 — Gate de Segurança

RBAC, RLS, SoD, autenticação, autorização, LGPD, logs sem PII, proteção contra fraude e alterações indevidas, rollback seguro.

## Parte 10 — Gate de UX

Produtividade, cliques, navegação, filtros, busca, feedback, mensagens, consistência, acessibilidade, responsividade, ações em lote.

## Parte 11 — Gate de Testes

Unit ≥ 80% RPCs · Integração cobrindo fluxos principais · E2E dataset canônico verde · Regressão financeira verde · Carga e stress conforme escopo · Segurança RLS/SoD.

## Parte 12 — Gate de Observabilidade

Logs estruturados (`operation_id`, `empresa_id`), tracing, eventos no Outbox, métricas técnicas e de negócio, alertas ativos, runbooks presentes.

## Parte 13 — Gate de Documentação

Arquitetura, ADRs, Blueprint, Modelo de Dados, Fluxos, Runbooks, Casos de Uso, Checklists, Histórico, Implementation Journal e Master Decisions atualizados.

## Parte 14 — Score

Ver `QUALITY-SCORECARD.md`.

## Parte 15 — Evidências

Cada aprovação exige evidências (Parte 1). Sem evidência, sem aprovação.

## Parte 16 — Fluxo de Aprovação

```text
Feature → Gate F → (fix?) → Sprint → Gate S → Epic → Gate E → Release → Gate R → Go Live → Gate GL → Produção
```

## Parte 17 — Critérios Eliminatórios

Bloqueiam absolutamente: falha financeira · falha arquitetural · teste crítico reprovado · performance abaixo do mínimo · segurança comprometida · documentação inexistente · rollback não validado · inconsistência de auditoria · rastreabilidade quebrada.

## Parte 18 — Templates

Ver `QUALITY-AUDIT-TEMPLATE.md`, `QUALITY-CHECKLIST.md`, `QUALITY-SCORECARD.md`, `CORRECTIVE-ACTION-PLAN.md`.

## Parte 19 — Auditoria Automatizada

Claude/Lovable devem, ao final de cada Sprint: comparar documentação vs. código vs. Blueprint vs. ADRs vs. backlog vs. rastreabilidade; identificar divergências; gerar relatório usando `QUALITY-AUDIT-TEMPLATE.md`; atribuir score; recomendar Aprovado / Aprovado com ressalvas / Reprovado.

## Parte 20 — Plano de Correção

Ver `CORRECTIVE-ACTION-PLAN.md`.

## Parte 21 — Dashboards

Ver `QUALITY-DASHBOARD-SPECIFICATION.md`.

## Parte 22 — Auditoria Cruzada

```text
DoR → Blueprint → Arquitetura → Backlog → Sprint → Implementação → Testes → Documentação
```
Todos os elos devem permanecer consistentes; divergência registrada e tratada.

## Parte 23 — Evolução dos Gates

A cada novo domínio, ADR, integração, requisito, arquitetura ou módulo, os Gates são revisados pelo CQO + Arquiteto + Tech Lead. Versionamento por `vMAJOR.MINOR`.

## Parte 24 — Visão Executiva

- Governança suficiente para evitar perda de qualidade: **sim**.
- Gates suficientes contra regressão: **sim** (regressão é gate obrigatório).
- Riscos não cobertos: nenhum estrutural; monitorar volumes > 10M.
- Métricas de sucesso: score médio ≥ 90; zero eliminatórios em produção; MTTR baixo; taxa de auto-match crescente.
