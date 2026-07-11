# Technical Debt Register

Registro centralizado de dívida técnica do módulo de Conciliação. Atualizado a cada Sprint e revisado trimestralmente.

## Categorias

Arquitetural · Backend · Frontend · Banco · Testes · Segurança · Performance · Observabilidade · UX · Documentação · Melhoria.

## Prioridades

| Prio | SLA para tratamento           |
| ---- | ----------------------------- |
| P0   | Imediato (bloqueia entrega)   |
| P1   | Release atual                 |
| P2   | Próximo trimestre             |
| P3   | Roadmap                       |

## Estrutura por Item

```text
- ID: TD-XXXX
- Título:
- Categoria:
- Descrição:
- Motivo (por que foi aceito):
- Impacto (Baixo/Médio/Alto/Crítico):
- Prioridade (P0–P3):
- Estimativa (T-shirt: XS/S/M/L/XL):
- Plano futuro:
- Dependências:
- Responsável:
- Status (Aberto/Em andamento/Concluído/Cancelado):
- Registrado em:
- Concluído em:
- Referências (Sprint, ADR, PR):
```

## Itens Iniciais (baseados na Auditoria da Etapa 8)

- **TD-0001** · Backfill histórico do hash-chain · Auditoria · Médio · P2 · Plano: script idempotente + verificação · Status: Aberto.
- **TD-0002** · UI de replay de Outbox / DLQ · Observabilidade · Médio · P2 · Plano: página admin + filtros · Status: Aberto.
- **TD-0003** · Refatorar tela de conciliação manual (> 400 linhas) · Frontend · Médio · P2 · Plano: decompor em sub-hooks · Status: Aberto.
- **TD-0004** · Views materializadas para dashboard · Performance · Médio · P2 · Plano: refresh incremental · Status: Aberto.
- **TD-0005** · Retreino automático a partir de `financeiro_matching_feedback` · Backend · Baixo · P3 · Status: Aberto.
- **TD-0006** · Helper `handleDomainError` compartilhado · Backend · Baixo · P3 · Status: Aberto.
- **TD-0007** · Migrar tipos de score para `zod` compartilhado com edge functions · Backend · Baixo · P3 · Status: Aberto.

## Fluxo

Novo item → Sprint Journal → registro aqui → priorização no roadmap → execução → encerramento com evidência.
