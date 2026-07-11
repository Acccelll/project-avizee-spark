# Definition of Ready (DoR) — Conciliação Financeira

> Etapa 10 — Processo formal de governança pré-implementação. Aplica-se a toda Sprint, Epic, Feature ou Prompt do módulo de Conciliação Financeira.

## Parte 1 — Processo Formal

**Objetivo:** garantir que nenhum item entre em desenvolvimento sem contexto, arquitetura, dependências, testes, rollback e documentação prontos.
**Momento de aplicação:** antes do início de qualquer Sprint/Feature/Prompt.
**Responsabilidades:** Tech Lead conduz; Arquiteto valida aderência; PO valida escopo; QA valida testes; Revisor Técnico assina o gate.
**Fluxo:** solicitação → preenchimento do DoR → revisão cruzada → aprovação formal → Sprint liberada.
**Exceções:** hotfix crítico com autorização do Tech Lead + Arquiteto, com registro obrigatório em ADR retroativo.
**Critérios eliminatórios:** ver Parte 6.

## Parte 2 — Critérios Obrigatórios

**Negócio:** objetivo, problema, benefício, escopo fechado, stakeholders.
**Arquitetura:** ADR referenciado, domínio identificado, responsabilidades e dependências.
**Banco:** impacto, entidades, estratégia, migração, rollback.
**Backend:** serviços, casos de uso, eventos, integrações, contratos.
**Frontend:** telas, componentes, hooks, stores, fluxos.
**Testes:** plano, critérios de aceite, cenários críticos, regressão.
**Segurança:** impacto, permissões (RBAC/RLS/SoD), auditoria, riscos.
**Documentação:** blueprint atualizado, rastreabilidade, ADR e runbook.

## Parte 3 — DoR por Domínio

Cada domínio herda os critérios da Parte 2 + requisitos específicos:

| Domínio       | Adicionais                                                     |
| ------------- | -------------------------------------------------------------- |
| Importação    | Contrato de layout (OFX/CNAB) registrado; dedupe idempotente.  |
| Parser        | Dataset canônico do layout; schema Zod versionado.             |
| Normalização  | Aliases mapeados; regras de precedência definidas.             |
| Matching      | Threshold e pesos aprovados; feedback loop previsto.           |
| Rule Engine   | Versionamento de regras + simulação prévia obrigatória.        |
| Workflow      | Máquina de estados aprovada; SoD configurada.                  |
| Conciliação   | Invariante de somatório testável; RPC atômica.                 |
| Auditoria     | Hash-chain íntegro; verificador agendado.                      |
| Dashboard     | KPIs e views definidos; filtros persistidos.                   |
| Indicadores   | Métricas mapeadas; alertas definidos.                          |
| Configuração  | Feature flag por empresa; auditoria de alteração.              |

## Parte 4 — DoR por Feature

Toda Feature deve trazer: Contexto · Objetivo · Arquitetura · Arquivos · Dependências · Critérios de aceite · Testes · Rollback · Documentação · Riscos · Validação.

## Parte 5 — DoR por Sprint

Verificar: objetivo claro; escopo fechado; dependências concluídas; arquitetura validada; prompt revisado; checklist aprovado; rollback definido; plano de testes pronto; plano de documentação pronto.

## Parte 6 — Critérios Eliminatórios

Impedem o início da Sprint: arquitetura indefinida · dependências desconhecidas · critérios de aceite ausentes · testes indefinidos · rollback inexistente · documentação incompleta · conflito com ADR · impacto desconhecido.

## Parte 7 — Fluxo de Aprovação

```text
Feature criada → Blueprint validado → Arquitetura validada
             → DoR aprovado (Scorecard ≥ 85) → Sprint liberada → Implementação
```

## Parte 8 — Matriz de Responsabilidades

| Papel             | Responsabilidade principal                                        |
| ----------------- | ------------------------------------------------------------------ |
| Product Owner     | Escopo, valor, aceite de negócio.                                  |
| Arquiteto         | Aderência à arquitetura e ADRs.                                    |
| Tech Lead         | Conduz DoR; aprova prontidão técnica.                              |
| Desenvolvedor     | Fornece plano de arquivos, dependências e riscos técnicos.         |
| QA                | Plano de testes, cenários críticos, regressão.                     |
| Revisor Técnico   | Assinatura final do gate.                                          |
| Claude / Lovable  | Executa prompt somente após DoR aprovado.                          |
| Documentação      | Blueprint, ADR, runbook, rastreabilidade atualizados.              |

## Parte 9 — Prompt Readiness (resumo)

Detalhe em `PROMPT-READINESS-GUIDE.md`. Todo prompt deve conter: contexto, objetivo, escopo, critérios, rollback, documentação, testes, dependências, arquivos e riscos.

## Parte 10 — Checklist de Dependências

Ver `PRE-IMPLEMENTATION-CHECKLIST.md`.

## Parte 11 — Matriz de Riscos Pré-Implementação

| Risco                                    | Nível   | Mitigação                                    |
| ---------------------------------------- | ------- | -------------------------------------------- |
| Escopo aberto                            | Alto    | PO fecha antes do gate.                      |
| Dependência não concluída                | Crítico | Bloqueia Sprint até resolução.               |
| ADR conflitante                          | Crítico | Requer novo ADR ou revisão do escopo.        |
| Testes indefinidos                       | Alto    | QA obrigatório no gate.                      |
| Rollback ausente                         | Crítico | Definir antes de liberar.                    |
| Impacto de banco desconhecido            | Alto    | Migração + rollback obrigatórios.            |
| Documentação desatualizada               | Médio   | Bloqueia merge, não a Sprint.                |

## Parte 12 — Critérios de Prontidão (Scorecard)

Ver `SPRINT-READINESS-SCORECARD.md`. Nota mínima para liberar Sprint: **85/100**; nenhum eliminatório em aberto.

## Parte 13 — Templates

Templates de DoR, Feature, Sprint, Epic, Prompt, Validação e Checklist consolidados em `DOR-CHECKLIST.md` e `PROMPT-READINESS-GUIDE.md`.

## Parte 14 — Integração com Execution Blueprint

Todo item do Blueprint deve possuir: responsável, documentação, teste, dependência, rollback, critério de aceite. Inconsistências são registradas em `READINESS-AUDIT.md`.

## Parte 15 — Governança da Documentação

Atualizar sempre que houver mudança: Arquitetura, ADRs, Blueprint, Runbooks, Diagramas, Modelo de Dados, Fluxos, Documentação Técnica e Histórico. Regra: **PR não faz merge sem documentação alinhada**.

## Parte 16 — Auditoria de Prontidão

Executada e registrada em `READINESS-AUDIT.md`.

## Parte 17 — Evolução do DoR

Sempre que houver novo requisito, arquitetura, domínio, integração ou ADR, o DoR é revisado pelo Arquiteto + Tech Lead + PO e a nova versão passa a valer nas próximas Sprints. Versionamento por semver documental (`vMAJOR.MINOR`).

## Parte 18 — Visão Executiva

- Pronto para iniciar implementação: **sim**, respeitando o gate.
- Decisões pendentes: nenhuma estrutural.
- Dependências críticas: Fundação (RLS/RBAC/logger/Outbox) já concluída.
- Maturidade do planejamento: **alta** (score 8.5 da Etapa 8).
- Riscos remanescentes: observabilidade de negócio e volumes > 10M, ambos com roadmap.
