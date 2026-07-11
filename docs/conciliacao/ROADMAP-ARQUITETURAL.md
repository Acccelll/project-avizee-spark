# ROADMAP ARQUITETURAL — CONCILIAÇÃO

Sequência lógica das evoluções, com dependências entre blocos. Sem detalhes de implementação (tratados na próxima etapa).

## Fase 0 — Fundacional (bloqueante para tudo)

Objetivo: eliminar riscos financeiros P0 antes de qualquer redesenho.

Blocos:
- F0.1 Baixa transacional atômica (RPC única).
- F0.2 Trilha imutável (append-only + hash-chain).
- F0.3 RLS reforçada + GRANT explícito em todas as tabelas envolvidas.
- F0.4 SoD mínima (importador ≠ aprovador).
- F0.5 Idempotência de importação por `hash_arquivo` + linha por `fitid/hash_linha`.
- F0.6 Observabilidade base (logger estruturado, métricas P0, remoção de `try/catch` silencioso).
- F0.7 Quick wins P0/P1 do documento `QUICK-WINS.md`.

Dependências: nenhuma. Habilita todas as fases seguintes.

## Fase 1 — Núcleo TO-BE

Objetivo: instaurar a arquitetura conceitual.

Blocos:
- F1.1 Extração do domínio para camadas puras (Ports & Adapters).
- F1.2 RulesEngine v1 (dados versionados, hierarquia, simulador).
- F1.3 MatchingEngine v1 (função pura, multi-estratégia, score).
- F1.4 DecisionService + thresholds parametrizáveis.
- F1.5 WorkflowService (máquina de estados formal).
- F1.6 Outbox pattern + eventos de domínio.
- F1.7 ReconciliationService orquestrador + PostingService.

Dependências: exige Fase 0.

## Fase 2 — Escala

Objetivo: preparar para 10⁶–10⁷ lançamentos.

Blocos:
- F2.1 Particionamento por empresa + mês.
- F2.2 Fila pgmq para import/matching.
- F2.3 Batch RPC para baixa em lote.
- F2.4 Materialized views para dashboards.
- F2.5 Cache/invalidation por evento no front.
- F2.6 Índices otimizados + revisão de query plans.

Dependências: F1.6 (eventos) e F1.7 (Reconciliation atômica).

## Fase 3 — Extensibilidade

Objetivo: cobrir todos os canais de ingestão financeira.

Blocos:
- F3.1 Adapter CNAB240.
- F3.2 Adapter CNAB400.
- F3.3 Adapter PIX (webhook + polling).
- F3.4 Adapter Open Finance (OAuth + consent).
- F3.5 Adapters de gateways (Stripe/Paddle) via mesmo contrato.
- F3.6 Multi-moeda com moeda-base configurável.

Dependências: F1.1 (Ports estáveis).

## Fase 4 — Inteligência

Objetivo: ampliar automação com aprendizado.

Blocos:
- F4.1 Feature store derivada de eventos.
- F4.2 Score ML complementar (peso 0 default).
- F4.3 Sugestão de regras a partir de padrões.
- F4.4 Detecção de anomalias (valor/frequência).
- F4.5 Predição de inconsistências no fechamento.

Dependências: F1.6 (histórico de eventos) e F2.4 (views para dataset).

## Fase 5 — Governança Avançada

Objetivo: elevar postura corporativa.

Blocos:
- F5.1 Aprovação N-olhos para estornos e reaberturas.
- F5.2 Assistente conversacional sobre trilha.
- F5.3 Relatórios regulatórios/fiscais avançados.
- F5.4 Read replicas dedicadas para BI.
- F5.5 Exportação certificada (assinatura digital) da trilha.

Dependências: F0.2 (trilha imutável) e F1.5 (workflow formal).

## Grafo de Dependências (resumo)

```text
F0 ──► F1 ──► F2 ──► F4
              │       │
              ├──► F3 │
              │       │
              └──► F5 ◄──── F0.2
```

## Regra de rollout

- Cada bloco entra atrás de feature flag por empresa.
- Coexistência controlada via Strangler Fig (ADR-011).
- Métricas de sucesso definidas em `CONCILIACAO-TO-BE.md` (Parte 23) validam o avanço entre fases.
- Nenhuma fase avança se a anterior não atingir seus critérios de qualidade.
