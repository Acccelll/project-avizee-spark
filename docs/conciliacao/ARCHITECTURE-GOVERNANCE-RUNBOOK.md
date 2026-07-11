# Architecture Governance Runbook

Runbook para criar, revisar, aprovar, comunicar e versionar decisões arquiteturais do módulo de Conciliação.

## Papéis

| Papel      | Responsabilidade                                          |
| ---------- | --------------------------------------------------------- |
| CTO        | Aprovação estratégica.                                    |
| Arquiteto  | Curadoria do Master Decisions e ADRs.                     |
| Tech Lead  | Proposição, análise de trade-offs, execução.              |
| QA / CQO   | Validação de aderência via Quality Gates.                 |
| PO         | Aceite de impacto funcional.                              |
| Devs       | Executores; leitura obrigatória antes de alterar.         |
| Claude/Lovable | Consulta obrigatória antes de qualquer alteração.     |

## Quando um ADR é obrigatório

- Nova capacidade estrutural, integração, padrão persistente, mudança de contrato de dados, alteração em RBAC/RLS, mudança em invariantes financeiras, mudança em performance/escala.

## Quando atualizar o Master Decisions

- Sempre que um ADR for aprovado, revisado, substituído ou revogado.
- Sempre que uma decisão do Journal impactar arquitetura.
- Sempre que a Auditoria identificar divergência.

## Fluxo Padrão

```text
Proposta (Tech Lead) → Análise + Alternativas → Decisão candidata
       → ADR → Aprovação (Arquiteto/CTO) → Master Decisions
       → Blueprint / Traceability / DoR / Gates atualizados
       → Comunicação (release notes + canal técnico)
       → Implementação → Journal → Auditoria
```

## Aprovação

- Decisão estrutural: Arquiteto + CTO.
- Decisão de segurança: Arquiteto + CQO.
- Decisão tática: Tech Lead + Arquiteto.
- Registro sem aprovação formal = inválido.

## Revisão

- Cadência definida por decisão (ver `DECISION-CATALOG.md`).
- Gatilhos automáticos: mudança regulatória, incidente crítico, novo domínio, migração, integração relevante.

## Versionamento

- `vMAJOR.MINOR` por decisão.
- Estados: `Ativa`, `Revisão Pendente`, `Obsoleta`, `Revogada`, `Substituída-por MD-XXX`.
- Histórico preservado; nunca deletar.

## Comunicação

- Release notes internos.
- Atualização do `CHANGE-HISTORY.md` (categoria AR).
- Anúncio em canal técnico do time.
- Atualização de runbooks dependentes.

## Integração

- **Execution Blueprint:** sincronizado a cada alteração.
- **DoR:** rejeita Sprint que contradiga decisão Ativa.
- **Quality Gates:** verificam aderência.
- **Implementation Journal:** referência recíproca em cada registro.
- **Traceability Matrix:** atualizada no mesmo PR.

## Consulta por IA (Claude/Lovable)

1. Ler `MASTER-DECISIONS.md` + `DECISION-CATALOG.md`.
2. Localizar decisões que tocam o domínio afetado.
3. Nunca contradizer decisão `Ativa`; se necessário, abrir proposta e ADR.
4. Após implementação, atualizar Catálogo e Journal no mesmo PR.

## Auditoria

Trimestral (Parte 14 do Master Decisions), com relatório em `DECISION-AUDIT-REPORT.md`.
