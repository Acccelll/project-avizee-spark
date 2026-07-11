# Master Decisions — Conciliação Financeira

> Etapa 13 — Repositório oficial e consolidado de todas as decisões arquiteturais, técnicas e funcionais do módulo. Fonte primária de governança arquitetural.

## Parte 1 — Inventário

Decisões consolidadas a partir de: ADRs (12), TO-BE, Execution Blueprint, DoR, Quality Gates, Roadmap, Plano de Testes, Plano de Migração, Auditoria Final e Implementation Journal.

## Parte 2 — Catálogo Oficial (resumo)

Ver `DECISION-CATALOG.md` para a lista completa com IDs, status e responsáveis. Este documento consolida a **narrativa** por categoria.

## Parte 3 — Decisões por Categoria

### Arquitetura
- **MD-001** Monólito Modular em Ports & Adapters. *Alt.: microsserviços, monolito puro.* Trade-off: simplicidade × prontidão para extração futura.
- **MD-002** Strangler Fig com Feature Toggle por empresa. *Alt.: big-bang.* Permite rollback e coexistência v1/v2.

### Backend
- **MD-003** RPCs `SECURITY DEFINER` com `search_path = public` para operações transacionais.
- **MD-004** Idempotência por `operation_id` obrigatória em toda escrita.
- **MD-005** Outbox Pattern para eventos de domínio.

### Banco
- **MD-006** Postgres/Supabase como single store; sem duplicação de estado em cache autoritativo.
- **MD-007** RLS + `GRANT` explícito por tabela; `chk_` para invariantes de domínio.
- **MD-008** Auditoria com hash-chain (Ledger imutável append-only).

### Matching / Regras
- **MD-009** Motor de regras versionado por empresa, com precedência determinística.
- **MD-010** Scoring multi-critério (valor, data ±, doc, contraparte, histórico) com Top-N e feedback loop.

### Workflow / Conciliação / Baixa
- **MD-011** Máquina de estados explícita (Sugerida → Em revisão → Aprovada/Rejeitada) com SoD via RBAC.
- **MD-012** Conciliação N×N com invariante de somatório aplicada na RPC.
- **MD-013** Baixa/estorno atômicos com preservação de histórico (append-only).

### Segurança / Governança
- **MD-014** RBAC via `user_permissions` + `has_role`; SoD obrigatória em ações críticas.
- **MD-015** LGPD via anonimização e trilha em `lgpd_solicitacoes`.
- **MD-016** DoR + Quality Gates como gates obrigatórios em toda Sprint.

### Observabilidade
- **MD-017** Logger estruturado (`logger.ts`) com `operation_id`/`empresa_id`; `console.*` proibido.
- **MD-018** Verificador agendado da integridade do ledger.

### UX / Frontend
- **MD-019** Design tokens semânticos; sem hardcode de cor.
- **MD-020** `useSupabaseCrud` paginado por padrão; `QueryState` padronizado.

### Testes / Qualidade
- **MD-021** Pirâmide unit/integração/E2E + dataset canônico + regressão financeira.
- **MD-022** Cobertura mínima ≥ 80% em RPCs críticas.

### Roadmap
- **MD-023** IA/ML fora do escopo atual; reavaliação após 12 meses.
- **MD-024** Particionamento físico por período previsto para volumes > 10M.

## Parte 4 — Matriz de Impacto

Ver `DECISION-IMPACT-MATRIX.md`.

## Parte 5 — Rastreabilidade

Ver `DECISION-TRACEABILITY.md`.

## Parte 6 — Dependências (grafo)

```text
MD-001 ──► MD-002, MD-005
MD-003 ──► MD-004, MD-012, MD-013
MD-006 ──► MD-007, MD-008
MD-008 ──► MD-018
MD-009 ──► MD-010, MD-011
MD-014 ──► MD-011, MD-013, MD-016
MD-017 ──► MD-005, MD-018
MD-021 ──► MD-016, MD-022
```
Estruturantes (efeito cascata alto): MD-001, MD-003, MD-006, MD-008, MD-014.
Alteráveis isoladamente: MD-019, MD-020, MD-022 (limiar), MD-023.

## Parte 7 — Revisões Futuras

| Decisão | Quando revisar                                   |
| ------- | ------------------------------------------------ |
| MD-001  | Quando 2+ domínios exigirem escala independente. |
| MD-005  | Quando volume de eventos exigir broker externo.  |
| MD-010  | A cada trimestre, com dados de feedback.         |
| MD-023  | 12 meses após Go Live.                           |
| MD-024  | Ao ultrapassar 5M de linhas em produção.         |

## Parte 8 — Conflitos Identificados

Nenhum conflito ativo. Observações registradas em `DECISION-AUDIT-REPORT.md`.

## Parte 9 — Governança

Ver `ARCHITECTURE-GOVERNANCE-RUNBOOK.md`.

## Parte 10 — Fluxo Decisório

```text
Problema → Análise → Alternativas → Avaliação → ADR
       → Master Decisions → Arquitetura/Blueprint → Implementação
       → Quality Gates → Journal → Auditoria
```

## Parte 11 — Critérios de Qualidade

Uma decisão só é válida se estiver: justificada, documentada, rastreável, com impacto conhecido, alternativas avaliadas, trade-offs registrados e aprovada formalmente.

## Parte 12 — Templates

Ver `DECISION-TEMPLATES.md`.

## Parte 13 — Integração

Sincronização obrigatória com: Execution Blueprint, DoR, Quality Gates, Journal, ADRs, Roadmap, Arquitetura e Traceability Matrix. Toda decisão nova aparece nos sete documentos anteriores no mesmo ciclo.

## Parte 14 — Auditoria

Trimestral: decisões sem doc, conflitantes, não implementadas, não utilizadas, obsoletas, sem rastreabilidade. Registrada em `DECISION-AUDIT-REPORT.md`.

## Parte 15 — Versionamento

`vMAJOR.MINOR` por decisão. Estados: `Ativa`, `Revisão Pendente`, `Obsoleta`, `Revogada`, `Substituída-por MD-XXX`. Histórico completo mantido.

## Parte 16 — Métricas

Decisões registradas · % aprovadas · tempo médio de aprovação · % revisadas no trimestre · conflitos encontrados/resolvidos · obsoletas · cobertura documental (% com rastreabilidade completa).

## Parte 17 — Integração com IA (Claude/Lovable)

Antes de qualquer alteração, o agente deve ler: `MASTER-DECISIONS.md`, `DECISION-CATALOG.md`, ADR relevante, TO-BE, Execution Blueprint e Traceability Matrix. Validar consistência: nenhuma alteração pode contradizer decisão `Ativa`; se contradisser, abrir nova decisão + ADR. Após implementação, atualizar Catálogo e Journal no mesmo PR.

## Parte 18 — Validação Cruzada

Arquitetura ↔ Blueprint ↔ Backlog ↔ Journal ↔ Quality Gates ↔ Código ↔ ADRs ↔ Master Decisions. Divergências registradas na auditoria.

## Parte 19 — Plano de Evolução

Novas funcionalidades, integrações, mudanças arquiteturais, refatorações, migrações, novos domínios ou mudanças regulatórias exigem: nova decisão candidata → ADR → aprovação → atualização do Catálogo e da Traceability.

## Parte 20 — Visão Executiva

- Decisão crítica não documentada: **nenhuma**.
- Decisão conflitante ativa: **nenhuma**.
- Governança suficiente para anos: **sim**, condicionada ao cumprimento do runbook.
- Áreas com maior necessidade de controle futuro: Matching/IA, Observabilidade de negócio, Escalabilidade (particionamento).
