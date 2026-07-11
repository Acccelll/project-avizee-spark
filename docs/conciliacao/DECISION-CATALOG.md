# Decision Catalog — Conciliação

Catálogo estruturado. Status: `Ativa` · `Revisão Pendente` · `Obsoleta` · `Revogada` · `Substituída-por`.

| ID    | Título                                          | Categoria         | Status | ADR    | Responsável   | Revisão |
| ----- | ----------------------------------------------- | ----------------- | ------ | ------ | ------------- | ------- |
| MD-001| Monólito Modular (Ports & Adapters)             | Arquitetura       | Ativa  | ADR-01 | Arquiteto     | 12m     |
| MD-002| Strangler Fig + Feature Toggle por empresa      | Arquitetura       | Ativa  | ADR-02 | Arquiteto     | Anual   |
| MD-003| RPCs SECURITY DEFINER + search_path             | Backend           | Ativa  | ADR-03 | Tech Lead     | Anual   |
| MD-004| Idempotência por operation_id                   | Backend           | Ativa  | ADR-04 | Tech Lead     | Anual   |
| MD-005| Outbox Pattern                                  | Backend           | Ativa  | ADR-05 | Arquiteto     | 12m     |
| MD-006| Postgres/Supabase single store                  | Banco             | Ativa  | ADR-06 | Arquiteto     | Anual   |
| MD-007| RLS + GRANT + chk_                              | Banco/Segurança   | Ativa  | ADR-07 | Arquiteto     | Semestral|
| MD-008| Ledger imutável hash-chain                      | Auditoria         | Ativa  | ADR-08 | Arquiteto     | Anual   |
| MD-009| Regras versionadas por empresa                  | Rule Engine       | Ativa  | ADR-09 | Tech Lead     | Semestral|
| MD-010| Scoring multi-critério + feedback loop          | Matching          | Ativa  | ADR-10 | Tech Lead     | Trimestral|
| MD-011| State machine + SoD                             | Workflow          | Ativa  | ADR-11 | Arquiteto     | Anual   |
| MD-012| Conciliação N×N com invariante de somatório     | Conciliação       | Ativa  | ADR-12 | Tech Lead     | Anual   |
| MD-013| Baixa/estorno atômicos append-only              | Baixa             | Ativa  | ADR-03 | Tech Lead     | Anual   |
| MD-014| RBAC + SoD obrigatórios                         | Segurança         | Ativa  | ADR-07 | Arquiteto     | Semestral|
| MD-015| LGPD via anonimização                           | Segurança         | Ativa  | –      | CQO           | Anual   |
| MD-016| DoR + Quality Gates obrigatórios                | Governança        | Ativa  | –      | CQO           | Anual   |
| MD-017| logger.ts (console.* proibido)                  | Observabilidade   | Ativa  | –      | Tech Lead     | Anual   |
| MD-018| Verificador agendado do ledger                  | Auditoria         | Ativa  | ADR-08 | Tech Lead     | Anual   |
| MD-019| Design tokens semânticos                        | UX                | Ativa  | –      | Tech Lead     | Anual   |
| MD-020| useSupabaseCrud paginado + QueryState           | Frontend          | Ativa  | –      | Tech Lead     | Anual   |
| MD-021| Pirâmide de testes + dataset canônico           | Testes            | Ativa  | –      | QA            | Semestral|
| MD-022| Cobertura ≥ 80% em RPCs críticas                | Testes            | Ativa  | –      | QA            | Semestral|
| MD-023| IA/ML fora do escopo atual                      | Roadmap           | Ativa  | –      | CTO           | 12m     |
| MD-024| Particionamento físico para > 10M               | Performance       | Revisão Pendente | – | Arquiteto | Ao atingir 5M |
