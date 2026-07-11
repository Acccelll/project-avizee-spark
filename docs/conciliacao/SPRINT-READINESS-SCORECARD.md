# Sprint Readiness Scorecard

Modelo objetivo para avaliar prontidão de Sprint. Nota mínima para liberação: **85/100**. Qualquer eliminatório em aberto zera a liberação, independentemente da nota.

## Pesos

| Critério        | Peso | Como avaliar                                                    |
| --------------- | ---- | --------------------------------------------------------------- |
| Arquitetura     | 20   | Aderência ao TO-BE + ADR referenciado.                          |
| Documentação    | 20   | Blueprint, rastreabilidade, ADR e runbook atualizados.          |
| Testes          | 15   | Plano completo, dataset canônico, regressão.                    |
| Dependências    | 15   | Todas resolvidas ou explicitamente sem bloqueio.                |
| Segurança       | 10   | RBAC/RLS/SoD + auditoria.                                       |
| Banco           | 10   | Migração + rollback + integridade.                              |
| Governança      | 10   | Rollback, aprovação formal, comunicação.                        |
| Frontend        | 5    | Telas/hooks/stores definidos + design tokens.                   |
| Backend         | 5    | Serviços/eventos/contratos definidos.                           |

Total: **100**.

## Escala por critério (0–10)

- 0–4: ausente ou inadequado
- 5–7: parcial, com pendências
- 8–10: completo, aprovado

Nota do critério = (escala × peso) / 10.

## Faixas de decisão

| Faixa      | Status                    | Ação                                            |
| ---------- | ------------------------- | ----------------------------------------------- |
| 95–100     | Excelente                 | Liberar imediatamente.                          |
| 85–94      | Pronto                    | Liberar com plano de melhoria contínua.         |
| 70–84      | Não pronto                | Reciclar itens em aberto.                       |
| < 70       | Reprovado                 | Reagendar; revisar Blueprint.                   |

## Eliminatórios (bloqueiam independente da nota)

- Arquitetura indefinida.
- Dependência não resolvida.
- Rollback ausente.
- Critérios de aceite ausentes.
- Conflito com ADR não resolvido.
- Impacto de banco desconhecido.

## Registro

Cada Sprint deve armazenar: nota por critério, nota final, eliminatórios verificados, aprovadores e data.
