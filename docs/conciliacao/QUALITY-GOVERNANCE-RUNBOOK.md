# Quality Governance Runbook

Runbook operacional dos Quality Gates. Referência prática para o dia a dia.

## Responsabilidades

| Papel        | Responsabilidade principal                                   |
| ------------ | ------------------------------------------------------------ |
| CQO          | Governança geral e certificação final.                       |
| Arquiteto    | Aderência arquitetural e ADRs.                               |
| Tech Lead    | Execução dos Gates e do plano de correção.                   |
| QA           | Evidências de testes e regressão.                            |
| PO           | Aceite funcional.                                            |
| Dev          | Preparar evidências técnicas.                                |
| Claude / Lovable | Rodar auditoria automatizada usando o template.          |

## Frequência

- Feature: ao concluir.
- Sprint: ao encerrar.
- Epic: ao consolidar.
- Release: antes do deploy.
- Go Live: antes da ativação em produção.
- Pós-produção: 24h, 7d, 30d.

## Evidências Exigidas

Relatórios de testes, logs, métricas, prints, diagramas, checklists preenchidos, ADRs, runbooks.

## Exceções

Hotfix crítico: Tech Lead + Arquiteto autorizam; auditoria retroativa em 24h obrigatória.

## Escalonamento

1. Tech Lead resolve.
2. Se não resolver em SLA: Arquiteto.
3. Se persistir: CQO.
4. Casos críticos: comitê executivo.

## Integração com DoR

Toda Sprint entra pelo `DEFINITION-OF-READY.md` e sai pelos Quality Gates. Sem DoR aprovado, não há Sprint. Sem Gate aprovado, não há entrega.

## Integração com Execution Blueprint

Auditoria compara implementação × Blueprint × ADRs × TO-BE. Divergências vão para `READINESS-AUDIT.md` (atualização) e `CORRECTIVE-ACTION-PLAN.md`.

## Integração com Auditoria Final (Etapa 8)

Os Gates são o mecanismo contínuo que alimenta a Auditoria Final, garantindo que a `CERTIFICACAO-PRODUCAO.md` permaneça consistente.

## Passo a Passo Operacional

1. Ao concluir o item, Tech Lead abre a auditoria usando `QUALITY-AUDIT-TEMPLATE.md`.
2. Coleta evidências e preenche checklist e scorecard.
3. Convoca aprovadores conforme nível.
4. Se aprovado: registra parecer e libera avanço.
5. Se reprovado: aciona `CORRECTIVE-ACTION-PLAN.md`.
6. Publica resultado no Dashboard.

## Versionamento

Runbook e Gates versionados em `vMAJOR.MINOR`; revisão trimestral obrigatória ou a cada novo domínio/ADR.
