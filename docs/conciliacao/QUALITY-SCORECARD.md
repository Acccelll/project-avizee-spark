# Quality Scorecard

Pontuação total: **100**. Nota mínima por nível na tabela ao final. Eliminatórios zeram a aprovação.

## Pesos

| Critério        | Peso |
| --------------- | ---- |
| Arquitetura     | 20   |
| Funcional       | 20   |
| Segurança       | 15   |
| Performance     | 15   |
| Testes          | 15   |
| Documentação    | 10   |
| Observabilidade | 5    |
| Governança      | 10   |

Total: **110** — normalizar para 100 dividindo por 1.10 (ou usar pontuação relativa por critério).

## Avaliação por critério (0–10)

- 0–4 ausente/inadequado · 5–7 parcial · 8–10 completo.
Nota do critério = (escala × peso) / 10.

## Notas mínimas

| Nível     | Mínimo |
| --------- | ------ |
| Feature   | 80     |
| Sprint    | 85     |
| Epic      | 88     |
| Release   | 90     |
| Go Live   | 92     |
| Produção  | 92     |

## Faixas

| Score      | Recomendação                |
| ---------- | --------------------------- |
| 95–100     | Aprovado (excelente)        |
| 85–94      | Aprovado (com ressalvas)    |
| 70–84      | Reprovado, reciclar         |
| < 70       | Reprovado, reagendar        |

## Eliminatórios

Falha financeira · falha arquitetural · teste crítico reprovado · performance abaixo do mínimo · segurança comprometida · documentação inexistente · rollback não validado · inconsistência de auditoria · rastreabilidade quebrada.

## Registro

Armazenar: nota por critério, nota final, eliminatórios verificados, evidências, aprovadores e data.
