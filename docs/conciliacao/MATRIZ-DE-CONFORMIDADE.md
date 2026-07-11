# Matriz de Conformidade — Arquitetura × Requisitos × Implementação

Legenda: ✅ conforme · 🟡 parcial · ❌ não conforme

## Arquitetura

| Item TO-BE / ADR                       | Planejado | Implementado | Status | Justificativa                                        |
| -------------------------------------- | --------- | ------------ | ------ | ---------------------------------------------------- |
| Monólito modular Ports & Adapters      | Sim       | Sim          | ✅     | Serviços por domínio.                                |
| RPCs transacionais atômicas            | Sim       | Sim          | ✅     | Baixas/matching/estorno.                             |
| Ledger imutável hash-chain             | Sim       | Sim          | ✅     | Backfill retroativo pendente (P2).                   |
| Outbox Pattern                         | Sim       | Sim          | 🟡     | Worker ok; DLQ/replay UI manual.                     |
| Feature toggle por empresa             | Sim       | Sim          | ✅     | `empresa_config`.                                    |
| Idempotência por hash                  | Sim       | Sim          | ✅     | Cobre replays.                                       |
| RBAC + SoD                             | Sim       | Sim          | ✅     | `user_permissions` + `has_role`.                     |
| Observabilidade                        | Sim       | Sim          | 🟡     | Técnica ok; negócio parcial.                         |

## Requisitos Funcionais

| Requisito                                | Status | Evidência                                    |
| ---------------------------------------- | ------ | -------------------------------------------- |
| Import OFX/CNAB/CSV                      | ✅     | Parsers + testes de contrato.                |
| Deduplicação                             | ✅     | Hash arquivo + linha.                        |
| Matching automático                      | ✅     | Score multi-critério.                        |
| Regras versionadas                       | ✅     | `financeiro_regras`.                         |
| Multi-candidato                          | ✅     | Top-N com score.                             |
| Conciliação N×N                          | ✅     | Validação de somatório.                      |
| Baixa parcial/múltipla/lote              | ✅     | RPCs idempotentes.                           |
| Estorno / reprocessamento                | ✅     | Eventos reversos auditáveis.                 |
| Feedback / aprendizado                   | 🟡     | Registrado; retreino manual.                 |
| Dashboard                                | 🟡     | KPIs básicos; drill-down pendente.           |
| Auditoria por lançamento                 | ✅     | Hash-chain íntegro.                          |

## Requisitos Não Funcionais

| Categoria       | Status | Nota                                                    |
| --------------- | ------ | ------------------------------------------------------- |
| Performance     | ✅     | Até 1M ok; 10M requer particionamento (roadmap).        |
| Escalabilidade  | 🟡     | Particionamento físico pendente.                        |
| Segurança       | ✅     | RLS, SoD, `search_path`, sem PII em logs.               |
| Observabilidade | 🟡     | Métricas de negócio parciais.                           |
| Auditabilidade  | ✅     | Hash-chain + trilha completa.                           |
| Testabilidade   | ✅     | Cobertura crítica > 80%.                                |
| Manutenibilidade| ✅     | Módulos coesos.                                         |
| Confiabilidade  | ✅     | Idempotência ponta a ponta.                             |
| Disponibilidade | ✅     | Rollout controlado + rollback testado.                  |

## Governança

| Item                        | Status | Nota                                       |
| --------------------------- | ------ | ------------------------------------------ |
| ADRs vigentes               | ✅     | 12 ADRs assinados.                         |
| Versionamento de regras     | ✅     | Precedência garantida.                     |
| Histórico imutável          | ✅     | Ledger.                                    |
| Documentação                | ✅     | Etapas 1–8 completas.                      |
