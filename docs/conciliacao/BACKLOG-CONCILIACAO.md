# BACKLOG — CONCILIAÇÃO

Backlog completo. Prioridade P0 (crítico/bloqueante) → P3 (nice-to-have). Esforço em T-shirt (S/M/L/XL). Risco (B/M/A).

## E1 — Fundação (Fase 0)

| ID | Descrição | Valor | Risco | Esforço | Prio |
|---|---|---|---|---|---|
| E1-F1 | RPC atômica de baixa (`sp_baixar_conciliacao`) | Elimina baixa parcial | A | L | P0 |
| E1-F2 | Ledger imutável hash-chain | Auditoria e tamper-evidence | M | L | P0 |
| E1-F3 | Idempotência de arquivo por `hash_arquivo` | Elimina reimportação duplicada | B | M | P0 |
| E1-F4 | Idempotência de linha por `fitid/hash_linha` | Elimina linha duplicada | M | M | P0 |
| E1-F5 | Revisão RLS + GRANT explícito | Fecha vetor de escalação | A | M | P0 |
| E1-F6 | SoD mínima (importador ≠ aprovador) | Segregação | M | S | P1 |
| E1-F7 | Logger estruturado + fim do catch silencioso | Observabilidade | B | M | P1 |
| E1-F8 | Job de verificação da cadeia do ledger | Detecta tampering | M | S | P1 |

## E2 — Domínio Puro

| ID | Descrição | Valor | Risco | Esforço | Prio |
|---|---|---|---|---|---|
| E2-F1 | Entidades e VOs (Money, Periodo, Score) | Base testável | B | M | P0 |
| E2-F2 | Ports (interfaces) para repositórios e eventos | Desacoplamento | B | S | P0 |
| E2-F3 | Invariantes centralizadas | Segurança de domínio | B | M | P1 |

## E3 — Import + Adapters (OFX v2)

| ID | Descrição | Valor | Risco | Esforço | Prio |
|---|---|---|---|---|---|
| E3-F1 | OFX v2 multi-conta | Suporte a arquivos reais | M | L | P0 |
| E3-F2 | Staging + hash | Pré-req de dedup | B | M | P0 |
| E3-F3 | UI de progresso de importação | UX | B | M | P2 |

## E4 — Normalização

| ID | Descrição | Valor | Risco | Esforço | Prio |
|---|---|---|---|---|---|
| E4-F1 | Padronização de valor/data/sinal | Consistência | B | M | P0 |
| E4-F2 | Resolução de conta bancária | Roteamento correto | M | M | P0 |
| E4-F3 | Dedup por chave natural | Integridade | M | M | P0 |

## E5 — Rules Engine v1

| ID | Descrição | Valor | Risco | Esforço | Prio |
|---|---|---|---|---|---|
| E5-F1 | Modelo de regra versionada | Configuração > código | M | L | P1 |
| E5-F2 | Hierarquia de escopo | Flexibilidade | M | M | P1 |
| E5-F3 | Detecção de conflito | Governança | M | S | P1 |
| E5-F4 | Simulador "e-se" | Segurança operacional | M | M | P2 |
| E5-F5 | Registro de execução | Auditoria | B | S | P1 |

## E6 — Matching Engine v1

| ID | Descrição | Valor | Risco | Esforço | Prio |
|---|---|---|---|---|---|
| E6-F1 | Filtro grosso | Performance | B | S | P0 |
| E6-F2 | 1x1 exato | Base de automação | B | M | P0 |
| E6-F3 | 1xN / Nx1 | Cenários reais | M | L | P1 |
| E6-F4 | NxN com poda | Casos complexos | A | L | P2 |
| E6-F5 | Fuzzy descrição | Sugestão adicional | M | M | P2 |
| E6-F6 | Score configurável | Ajuste fino | M | M | P1 |
| E6-F7 | Detecção de CONFLITO | Segurança | B | S | P1 |

## E7 — Decision Service

| ID | Descrição | Valor | Risco | Esforço | Prio |
|---|---|---|---|---|---|
| E7-F1 | Thresholds parametrizáveis | Ajuste por empresa | M | S | P1 |
| E7-F2 | Rotas auto/sugestão/pendente/conflito | Fluxo correto | M | M | P0 |

## E8 — Workflow Service

| ID | Descrição | Valor | Risco | Esforço | Prio |
|---|---|---|---|---|---|
| E8-F1 | Máquina de estados formal | Governança | M | M | P0 |
| E8-F2 | Histórico de transições | Trilha | B | S | P0 |

## E9 — Reconciliation + Posting

| ID | Descrição | Valor | Risco | Esforço | Prio |
|---|---|---|---|---|---|
| E9-F1 | `sp_conciliar` idempotente | Integridade | A | L | P0 |
| E9-F2 | `sp_estornar` auditado | Reversibilidade | M | M | P0 |
| E9-F3 | Baixa parcial + saldo residual | Casos reais | M | M | P1 |
| E9-F4 | Batch RPC | Performance | M | M | P1 |

## E10 — Auditoria + Outbox

| ID | Descrição | Valor | Risco | Esforço | Prio |
|---|---|---|---|---|---|
| E10-F1 | Outbox + worker | Entrega garantida | M | M | P0 |
| E10-F2 | Ledger append-only | Trilha | M | M | P0 |
| E10-F3 | Verificação de cadeia | Tamper-evidence | B | S | P1 |

## E11 — UI Revisão v2

| ID | Descrição | Valor | Risco | Esforço | Prio |
|---|---|---|---|---|---|
| E11-F1 | Painel com filtros salvos | Produtividade | B | L | P1 |
| E11-F2 | Batch actions | Volume | M | L | P1 |
| E11-F3 | Timeline por agregado | UX + auditoria | B | M | P1 |
| E11-F4 | Comparador de candidatos | Resolver CONFLITO | M | M | P2 |
| E11-F5 | Atalhos de teclado | Alto volume | B | S | P2 |

## E12 — Dashboard + Indicadores

| ID | Descrição | Valor | Risco | Esforço | Prio |
|---|---|---|---|---|---|
| E12-F1 | KPIs P0 (auto %, backlog, SLA) | Visibilidade | B | M | P1 |
| E12-F2 | MVs incrementais | Performance | M | M | P2 |
| E12-F3 | Distribuição de score | Ajuste de regras | B | S | P2 |

## E13 — Segurança + SoD Avançada

| ID | Descrição | Valor | Risco | Esforço | Prio |
|---|---|---|---|---|---|
| E13-F1 | Papéis conciliacao.* completos | RBAC | M | M | P0 |
| E13-F2 | Aprovação N-olhos | Governança | M | M | P1 |
| E13-F3 | Mascaramento LGPD | Compliance | M | M | P1 |

## E14 — Performance + Escala

| ID | Descrição | Valor | Risco | Esforço | Prio |
|---|---|---|---|---|---|
| E14-F1 | Índices críticos | p95 | B | S | P1 |
| E14-F2 | Particionamento | 10⁷ linhas | A | XL | P2 |
| E14-F3 | Fila pgmq de matching | Escala | M | L | P1 |

## E15 — Extensibilidade

| ID | Descrição | Valor | Risco | Esforço | Prio |
|---|---|---|---|---|---|
| E15-F1 | Adapter CNAB240 | Novo canal | M | L | P2 |
| E15-F2 | Adapter CNAB400 | Novo canal | M | L | P3 |
| E15-F3 | Adapter PIX webhook | Real-time | M | L | P2 |
| E15-F4 | Adapter Open Finance | Enterprise | A | XL | P3 |
| E15-F5 | Multi-moeda | Internacionalização | M | L | P3 |

## E16 — Closing + Governança

| ID | Descrição | Valor | Risco | Esforço | Prio |
|---|---|---|---|---|---|
| E16-F1 | Fechamento com bloqueio DB | Governança fiscal | M | M | P1 |
| E16-F2 | Reabertura N-olhos | Controle | M | M | P1 |
| E16-F3 | Snapshot fiscal | Compliance | M | M | P2 |

## E17 — Migração e Descontinuação

| ID | Descrição | Valor | Risco | Esforço | Prio |
|---|---|---|---|---|---|
| E17-F1 | Feature flag por empresa | Rollout seguro | B | S | P0 |
| E17-F2 | Backfill hash_linha | Compatibilidade | M | L | P0 |
| E17-F3 | Reconstrução de trilha legada | Rastreabilidade | M | L | P1 |
| E17-F4 | Roteamento condicional UI | Coexistência | B | M | P0 |
| E17-F5 | Descontinuação do módulo antigo | Simplificação | M | M | P2 |

## Ordem sugerida de execução

1. Todos os P0 de E1, E2, E17-F1/F4 (pré-req da coexistência).
2. E3, E4 (dados corretos entrando).
3. E8, E10 (base de estado + eventos).
4. E5, E6, E7 (motor completo).
5. E9 (baixa nova ativa por empresa piloto).
6. E11 (UX profissional).
7. E13, E16 (governança).
8. E12 (visibilidade).
9. E14 (escala).
10. E15 (extensibilidade).
11. E17-F5 (descontinuar antigo).
