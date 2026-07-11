# MATRIZ DE DEPENDÊNCIAS — EXECUÇÃO

## Legenda

- **Deps**: sprints anteriores necessárias.
- **Arquivos**: áreas do repo tocadas.
- **Serviços**: serviços/domínios envolvidos.
- **DB**: mudanças de schema/dados.
- **FE**: frontend.
- **BE**: backend/edges/RPCs.
- **Testes**: categorias obrigatórias.

## Matriz

| Sprint | Deps | Arquivos | Serviços | DB | FE | BE | Testes |
|---|---|---|---|---|---|---|---|
| S1.1 | — | migration; `types.ts` | Posting | RPC `sp_baixar_conciliacao` | — | RPC | unit+integr |
| S1.2 | — | migration; edge `verify-ledger-chain` | Audit | tabela `conciliacao_ledger`+trigger | — | RPC/cron | unit+integr+segurança |
| S1.3 | — | migration; hook import | Import | col `hash_arquivo`+índice | ajuste import | — | integr |
| S1.4 | S1.3 | migration; normalizer atual | Import/Norm | cols `fitid`/`hash_linha`+índices | — | — | integr |
| S1.5 | — | migration policies/grants | Todos | políticas + GRANT | — | — | segurança |
| S1.6 | S1.5 | seeds; guards | RBAC | seeds `user_permissions` | can() | RPC guard | segurança+E2E |
| S1.7 | — | refactor módulo | Cross | — | logger | logger | unit |
| S2.1 | R1 | `src/domain/conciliacao/**` | Todos | — | — | domínio | unit ≥80% |
| S2.2 | S2.1 | domínio + migration | Workflow | tabela `workflow_transicoes`; RPC `sp_transicionar` | — | RPC | unit+integr |
| S2.3 | S2.1 | migration; edge worker | Outbox | tabela `outbox` | — | worker | integr+carga |
| S2.4 | S2.1 | docs + types | Todos | — | — | — | N/A |
| S3.1 | R2 | edge `ofx-parser-v2`; fixtures | Import | — | — | edge | integr contrato |
| S3.2 | S3.1,S1.3,S1.4 | `ImportService`; pgmq `q_import` | Import | fila | — | edge+RPC | integr+E2E |
| S3.3 | S3.2 | `NormalizerService` | Normalization | — | — | domínio | unit+integr |
| S4.1 | R2 | migration | Rules | 3 tabelas de regras | — | — | integr |
| S4.2 | S4.1 | `RulesEngineService` | Rules | — | — | domínio | unit+integr |
| S4.3 | S4.2 | pages/regras | Rules UI | — | páginas+editor+simulador | — | E2E |
| S4.4 | S2.1,S3.3 | `MatchingEngineService` | Matching | — | — | domínio | unit+perf+canônico |
| S4.5 | S4.2,S4.4 | `DecisionService`; migration `config` | Decision | tabela `config` | — | domínio | unit+integr |
| S5.1 | R1,R2,R4 | RPC `sp_conciliar` | Reconciliation | RPC | — | RPC | integr+canônico |
| S5.2 | S5.1 | RPC `sp_estornar` | Reconciliation | RPC | — | RPC | integr |
| S5.3 | S1.1 | RPC ajuste | Posting | RPC | — | RPC | integr |
| S5.4 | S5.1 | RPC `sp_conciliar_lote` | Reconciliation | RPC | — | RPC | perf+integr |
| S6.1 | R5 | migration `feature_flags`; provider | Cross | tabela | provider+hook | — | integr |
| S6.2 | S6.1 | páginas condicionais | UI | — | roteamento | — | E2E |
| S6.3 | S6.2,R4 | página revisão | UI | — | página+DataTable | — | E2E |
| S6.4 | S6.3,S2.2 | batch+drawer | UI | — | componentes | — | E2E |
| S6.5 | S6.4 | comparador+atalhos | UI | — | componentes | — | E2E |
| S7.1 | S1.6 | seeds + docs | RBAC | seeds | can() | guards | segurança+E2E |
| S7.2 | S5.2 | RPCs N-olhos | Governance | RPCs | UI aprovação | RPC | segurança+E2E |
| S7.3 | S7.1 | RPCs mascaradas | LGPD | RPCs | UI usa | — | segurança |
| S7.4 | S5.1 | migration+RPCs período | Closing | tabela+trigger+RPCs | UI fechamento | RPC | integr+segurança |
| S8.1 | R4,S2.3 | MVs+cron | Metrics | MVs | — | cron | integr+perf |
| S8.2 | S8.1 | página dashboard | UI | — | página | — | E2E+perf |
| S8.3 | S8.1 | painel score | UI | — | painel | — | E2E |
| S9.1 | R5 | migration índices | DB | índices CONCURRENTLY | — | — | perf |
| S9.2 | S9.1 | migration partição | DB | partições | — | — | perf+carga |
| S9.3 | R4 | fila+worker | Scale | fila | — | worker | carga |
| S10.1 | R3,R4 | edge CNAB240 | Import | — | — | edge | contrato |
| S10.2 | R3,R4 | edge CNAB400 | Import | — | — | edge | contrato |
| S10.3 | R3,R4 | edge PIX webhook | Import | idempotência event_id | — | edge | segurança+integr |
| S10.4 | R3,R4 | edge Open Finance | Import | tokens (Vault) | UI consent | edge | integr+seg |
| S10.5 | R3,R4 | domínio+migration moeda | Domain | cols moeda/taxa | UI seletor | — | unit+integr |
| S11.1 | R1..R10 | edge backfill | Migration | jobs+cols origem | — | edge | integr+consistência |
| S11.2 | S11.1 | edge sintetização | Audit | eventos ledger | — | edge | integr+consistência |
| S11.3 | S11.2 | script/checklist | Rollout | flag por empresa | — | — | smoke+monitor |
| S11.4 | S11.3 | remoção v1 | Cleanup | drop col obsoletas | remove rotas v1 | remove RPCs v1 | regressão |

## Grafo de blocos

```text
R1(S1.1..S1.7) ─► R2(S2.1..S2.4) ─┬─► R3(S3.1..S3.3) ─┐
                                  └─► R4(S4.1..S4.5) ─┴─► R5(S5.1..S5.4)
                                                                    │
R5 ─► R6(S6.1..S6.5) ─┬─► R7(S7.1..S7.4) ─┐
                      └─► R8(S8.1..S8.3) ─┤
                      └─► R9(S9.1..S9.3) ─┤
R3+R4 ─► R10(S10.1..S10.5) ────────────── │
                                          └─► R11(S11.1..S11.4)
```

## Paralelização recomendada

- Após S2.4: R3 e R4 podem correr em paralelo (arquivos disjuntos: `ImportService`+`Normalizer` vs `RulesEngine`+`MatchingEngine`+`Decision`).
- Após S6.5: R7, R8 e R9 podem correr em paralelo (Governance, Visibility, Scale — domínios diferentes).
- R10 corre em paralelo a R7/R8/R9 assim que R3 e R4 estabilizarem ports (adapters não conflitam com governança/UI/dashboard).

## Bloqueios rígidos

- S5.* dependem obrigatoriamente de R1 (fundação) + R2 (domínio) + R4 (decisão).
- Nada em produção sem R1 completo.
- S11.4 (remoção v1) só após 100% empresas + 30 dias sem P0/P1.
