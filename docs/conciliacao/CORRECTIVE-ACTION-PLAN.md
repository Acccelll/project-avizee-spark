# Corrective Action Plan — Reprovação de Quality Gate

Aplicado sempre que um Gate for reprovado ou aprovado com ressalvas críticas.

## Fluxo

```text
Reprovação → Triagem (Tech Lead + QA) → Classificação (P0/P1/P2/P3)
         → Plano de Correção → Execução → Revalidação → Nova aprovação
```

## Responsáveis

- **Tech Lead:** conduz o plano.
- **Arquiteto:** revalida aderência arquitetural.
- **QA:** revalida testes e evidências.
- **PO:** revalida aceite funcional.
- **CQO:** certifica encerramento.

## Prioridades

| Prioridade | Prazo máximo | Regra                                       |
| ---------- | ------------ | ------------------------------------------- |
| P0         | Imediato     | Bloqueia toda entrega até resolver.         |
| P1         | 24h          | Bloqueia release atual.                     |
| P2         | Próxima Sprint | Não bloqueia release, entra no backlog.   |
| P3         | Roadmap      | Melhoria contínua.                          |

## Estrutura do Plano

Para cada não conformidade:

1. Descrição objetiva.
2. Evidência da falha.
3. Causa raiz (5-Whys).
4. Ação corretiva.
5. Ação preventiva.
6. Responsável.
7. Prazo.
8. Critério de encerramento.
9. Evidência de correção.

## Critérios para Nova Auditoria

- Correções aplicadas com evidência.
- Testes revalidados (unit/integração/E2E/regressão conforme escopo).
- Documentação atualizada.
- Rollback revalidado quando aplicável.

## Solicitação de Revalidação

Preenchida pelo Tech Lead, contendo: item reprovado, plano executado, evidências, aprovadores propostos e data solicitada.

## Encerramento

Nova auditoria com `QUALITY-AUDIT-TEMPLATE.md`. Só encerra com parecer **Aprovado** e assinatura dos aprovadores.
