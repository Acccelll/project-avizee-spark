# ROADMAP DE IMPLEMENTAÇÃO — ONDAS

Sequência lógica em ondas com dependências explícitas. Sem datas.

## Onda 1 — Fundação (bloqueante)

Escopo: E1 completo.
Entregáveis: RPC atômica de baixa, ledger imutável, dedup por hash, RLS+GRANT, SoD mínima, logger estruturado, job de verificação de cadeia.
Dependência: nenhuma.
Critério para avançar: 0 baixas divergentes em ambiente controlado; ledger íntegro; RLS auditado.

## Onda 2 — Núcleo Arquitetural

Escopo: E2 (domínio puro), E8 (workflow), E10 (outbox + auditoria).
Entregáveis: entidades/VOs/ports, máquina de estados formal, tabela outbox + worker.
Dependência: Onda 1.
Critério: domínio compila isolado; eventos entregues 100%; transições registradas.

## Onda 3 — Ingestão Correta

Escopo: E3 (import + OFX v2 multi-conta), E4 (normalização).
Entregáveis: adapter OFX v2, staging, normalizador canônico, dedup por linha.
Dependência: Onda 2 (para publicar eventos).
Critério: reimportação idempotente; 0 duplicidade em dataset canônico.

## Onda 4 — Automação

Escopo: E5 (rules engine v1), E6 (matching v1), E7 (decision).
Entregáveis: motor de regras versionado, matching multi-estratégia puro, roteamento por score.
Dependência: Ondas 2 e 3.
Paralelizável parcialmente com Onda 5 (UI usa mocks até estabilizar).
Critério: benchmark de matching 100k < 120s; regras editáveis pelo negócio.

## Onda 5 — Conciliação e Baixa Nova

Escopo: E9 (`sp_conciliar`, `sp_estornar`, baixa parcial, batch).
Entregáveis: baixa transacional atômica ativa por empresa piloto.
Dependência: Ondas 1, 2, 4.
Critério: 0 baixa parcial em teste de falha simulada; estorno auditado.

## Onda 6 — UX Profissional

Escopo: E11 (UI Revisão v2), E17-F1/F4 (feature flag, roteamento).
Entregáveis: painel de revisão, batch actions, timeline, comparador, atalhos; roteamento v1↔v2 por empresa.
Dependência: Onda 5.
Critério: revisor opera lote 100 em <5min; empresa piloto rodando end-to-end em v2.

## Onda 7 — Governança

Escopo: E13 (RBAC completo, N-olhos, LGPD), E16 (fechamento com bloqueio DB).
Entregáveis: papéis conciliacao.*, aprovação múltipla, mascaramento, `sp_fechar_periodo`/`sp_reabrir_periodo`.
Dependência: Ondas 5 e 6.
Critério: reabertura sem trilha = 0; testes de autorização 100%.

## Onda 8 — Visibilidade

Escopo: E12 (dashboard, KPIs, MVs).
Entregáveis: KPIs P0, materialized views incrementais, distribuição de score.
Dependência: Onda 4 (eventos) e Onda 7 (dados governados).
Paralelizável com Onda 9.
Critério: KPIs P0 disponíveis com refresh < 5 min.

## Onda 9 — Escala e Performance

Escopo: E14 (índices, particionamento, pgmq de matching).
Entregáveis: partição por empresa+mês, workers paralelos, batch RPC otimizado.
Dependência: Ondas 5 e 6.
Critério: metas p95 do TO-BE (Parte 23) atingidas em ambiente de carga.

## Onda 10 — Extensibilidade

Escopo: E15 (CNAB240, PIX, CNAB400, Open Finance, multi-moeda).
Entregáveis: novos adapters, multi-moeda funcional.
Dependência: Ondas 3 e 4 (ports estáveis).
Critério: novo adapter em ≤ 5 dias-dev; PIX real recebido em piloto.

## Onda 11 — Migração Total + Descontinuação

Escopo: E17-F2/F3/F5 (backfill, reconstrução de trilha, remoção do módulo antigo).
Entregáveis: 100% empresas em v2; ambiente sem código legado.
Dependência: Todas as ondas anteriores.
Critério: 30 dias sem incidente em 100% das empresas; código v1 removido.

## Grafo de Ondas

```text
O1 ─► O2 ─► O3 ─► O4 ─► O5 ─► O6 ─► O7 ─┬─► O8
                                        └─► O9 ─► O11
                              O4 ─► O10 ─────────► O11
                                                   ▲
                                       O7 ─────────┘
```

## Paralelismo permitido

- Após Onda 4 concluir: iniciar UX (Onda 6) com mocks enquanto Onda 5 fecha RPCs.
- Após Onda 6: Ondas 7, 8 e 9 podem correr em paralelo (equipes distintas).
- Onda 10 corre em paralelo à 7/8/9, condicionada apenas a ports estáveis (fim da Onda 4).
- Onda 11 aguarda todas.

## Bloqueadores absolutos

- Nada da Onda 5+ entra em produção antes da Onda 1 completa.
- Descontinuação do módulo antigo (Onda 11 final) só após 100% + 30 dias sem incidente.
