# Implementation Governance Runbook

Runbook operacional para manter o Implementation Journal atualizado e integrado à governança do projeto.

## Papéis

| Papel        | Responsabilidade                                              |
| ------------ | ------------------------------------------------------------- |
| Tech Lead    | Garantir que cada Sprint/Feature tenha registro completo.     |
| Dev          | Preencher o registro no ato da conclusão.                     |
| QA           | Anexar evidências de testes e regressão.                      |
| Arquiteto    | Validar aderência arquitetural e ADRs.                        |
| PO           | Aprovar aceite funcional.                                     |
| CQO          | Certificar Quality Gate; auditar Journal trimestralmente.     |
| Claude/Lovable| Executar automação do Journal ao final da Sprint.            |

## Cadência

- **Diária:** atualizações incrementais em Sprint em andamento.
- **Fim de Feature:** aplicar `FEATURE-IMPLEMENTATION-TEMPLATE.md`.
- **Fim de Sprint:** aplicar `SPRINT-JOURNAL-TEMPLATE.md` + Scorecard + parecer do Gate.
- **Fim de Release:** consolidar em `releases/vX.Y.Z/`.
- **Trimestral:** auditoria do Journal (Parte 20 do `IMPLEMENTATION-JOURNAL.md`).

## Integração

- **Execution Blueprint:** cada registro cita o item do Blueprint executado.
- **Definition of Ready:** registro só é criado após DoR aprovado.
- **Quality Gates:** parecer + score anexados obrigatoriamente.
- **ADRs:** decisões técnicas viram ADR e voltam como link no registro.
- **Traceability Matrix:** atualizada em conjunto com o registro.
- **Backlog / Roadmap:** ID do item obrigatório.
- **Auditoria Final:** o Journal é a fonte primária de evidências.

## Exceções

- Hotfix crítico: registro pode ocorrer em até 24h após a correção, com aprovação do Tech Lead + Arquiteto e ADR retroativo quando houver decisão arquitetural.

## Escalonamento

1. Tech Lead resolve pendências de registro.
2. Persistindo, Arquiteto/CQO intervêm.
3. Se afetar auditoria, item vira P1 e bloqueia próxima Release.

## Automação (Claude / Lovable)

1. Detectar Sprint concluída.
2. Coletar diffs, testes, migrations, ADRs alterados, scorecards.
3. Preencher template com dados objetivos; nunca inferir sem evidência.
4. Abrir PR de registro para revisão humana.
5. Rodar checklist de auditoria (Parte 20) e reportar divergências.

## Consulta

- Índice em `docs/conciliacao/journal/README.md` (criado no primeiro registro).
- Busca por ID (FT/HF/RF/BF/IM/SE/PF/DO/AR/RQ/TD/RK).
- Referência cruzada via `TRACEABILITY-MATRIX.md`.

## Versionamento

- Runbook e templates versionados em `vMAJOR.MINOR`.
- Revisão obrigatória a cada nova arquitetura, ADR, domínio ou integração.
- Alterações registradas no `CHANGE-HISTORY.md` (categoria DO).
