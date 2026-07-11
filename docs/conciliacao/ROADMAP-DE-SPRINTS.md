# ROADMAP DE SPRINTS — CONCILIAÇÃO

Cada sprint = 1 execução Lovable. Escopo pequeno, autocontido, validável, reversível.

Formato: **Objetivo · Escopo · Arquivos · Deps · Aceite · Riscos · Validação · Rollback**.

## Release R1 — Fundação

### S1.1 — RPC atômica de baixa
- Objetivo: eliminar baixa parcial em falha.
- Escopo: criar `sp_baixar_conciliacao` idempotente + testes.
- Arquivos: migration nova; `src/integrations/supabase/*` (regen); testes.
- Deps: —
- Aceite: falha simulada → rollback completo; chave de idempotência funciona.
- Riscos: RPC longa; PL/pgSQL mal testado.
- Validação: dataset canônico + teste de falha simulada.
- Rollback: manter `sp_baixar_v1`; alternar por config.

### S1.2 — Ledger imutável com hash-chain
- Objetivo: trilha append-only tamper-evident.
- Escopo: tabela `conciliacao_ledger` (INSERT-only, trigger anti-UPDATE/DELETE), função `sp_append_ledger`, job diário `verify_ledger_chain`.
- Arquivos: migration; edge function do job; testes.
- Deps: —
- Aceite: alterar 1 byte → detecção; cadeia verifica OK.
- Riscos: baixo.
- Validação: testes de tampering + verificação diária.
- Rollback: parar de gravar (flag); tabela preservada.

### S1.3 — Idempotência de arquivo (`hash_arquivo`)
- Objetivo: reimportar mesmo arquivo não duplica.
- Escopo: coluna + unicidade + validação no ImportService atual.
- Arquivos: migration; `financeiro_extrato_importacoes`; hook de importação.
- Deps: —
- Aceite: reimport = aviso, 0 novo registro.
- Rollback: remover checagem via flag.

### S1.4 — Idempotência de linha (`fitid`/`hash_linha`)
- Objetivo: linha duplicada é ignorada silenciosamente com log.
- Escopo: colunas + índices únicos parciais + normalização.
- Deps: S1.3.
- Aceite: reimport parcial → apenas novos entram.
- Rollback: drop de índice + flag.

### S1.5 — RLS + GRANT auditados
- Objetivo: fechar vetor de escalação/leitura cruzada.
- Escopo: revisar toda tabela do módulo; políticas por empresa; GRANT explícito por role.
- Deps: —
- Aceite: fuzz de RLS por role passa; testes de autorização 100%.
- Rollback: `ALTER POLICY` de volta ao anterior (backup do estado).

### S1.6 — SoD mínima
- Objetivo: importador ≠ aprovador.
- Escopo: papéis `conciliacao.importador|revisor|aprovador`; guard em RPC + UI.
- Deps: S1.5.
- Aceite: teste E2E de segregação passa.
- Rollback: flag off.

### S1.7 — Logger + fim do catch silencioso
- Objetivo: observabilidade base.
- Escopo: aplicar `logger.ts` em todo caminho crítico; substituir `console.*`; tipar erros.
- Deps: —
- Aceite: grep por `console.` e `catch {}` = 0.
- Rollback: trivial (revert PR).

## Release R2 — Núcleo Arquitetural

### S2.1 — Ports & domínio puro
- Objetivo: extrair core sem imports de Supabase/React.
- Escopo: `src/domain/conciliacao/*` (entidades, VOs, ports, eventos).
- Deps: R1.
- Aceite: `tsgo` no domínio isolado passa; cobertura ≥80%.
- Rollback: revert PR.

### S2.2 — Workflow Service
- Objetivo: máquina de estados formal.
- Escopo: `WorkflowService`, tabela `conciliacao_workflow_transicoes`.
- Deps: S2.1.
- Aceite: transições inválidas rejeitadas; histórico completo.
- Rollback: parar de registrar (flag) sem afetar dados legados.

### S2.3 — Outbox + Worker de Eventos
- Objetivo: entrega garantida de eventos.
- Escopo: `conciliacao_outbox`, worker edge `conciliacao-outbox-worker`, retry/backoff/DLQ.
- Deps: S2.1.
- Aceite: entrega 100% em teste de falha; idempotente.
- Rollback: desligar worker; tabela preservada.

### S2.4 — Catálogo de eventos v1
- Objetivo: definir contratos dos eventos de domínio.
- Escopo: `EVENTOS-CONCILIACAO.md`; TS types no domínio.
- Deps: S2.1.
- Aceite: todos os eventos documentados e tipados.
- Rollback: N/A (documentação).

## Release R3 — Ingestão

### S3.1 — Adapter OFX v2 multi-conta
- Objetivo: parser correto com múltiplas contas.
- Escopo: edge function `ofx-parser-v2`, testes com fixtures anonimizadas.
- Deps: R2.
- Aceite: fixtures reais parseadas byte-a-byte; multi-conta separada.
- Rollback: rotear para `ofx-parser-v1` via flag.

### S3.2 — Staging + Import Service v2
- Objetivo: ingestão idempotente e assíncrona.
- Escopo: `ImportService` usando ports; fila pgmq `q_import`.
- Deps: S3.1, S1.3, S1.4.
- Aceite: reimport idempotente; publica `StatementImported`.
- Rollback: flag `import_v2` off.

### S3.3 — Normalizer Service
- Objetivo: canonizar movimentos.
- Escopo: `NormalizerService` puro; testes com dataset canônico.
- Deps: S3.2.
- Aceite: 0 duplicidade; padronização OK.
- Rollback: flag off.

## Release R4 — Automação

### S4.1 — Modelo de regras versionadas
- Objetivo: regras em dados.
- Escopo: `conciliacao_regras` + `conciliacao_regras_versoes` + `conciliacao_regras_execucoes`.
- Deps: R2.
- Aceite: CRUD versionado funciona.
- Rollback: drop de tabelas novas (aditivo).

### S4.2 — Rules Engine v1
- Objetivo: motor parametrizável.
- Escopo: `RulesEngineService` (hierarquia, conflito, aplicação).
- Deps: S4.1.
- Aceite: testes de hierarquia e conflito passam.
- Rollback: flag off.

### S4.3 — UI de regras + simulador
- Objetivo: editar regras sem deploy.
- Escopo: página `/financeiro/conciliacao/regras`, editor, simulador "e-se".
- Deps: S4.2.
- Aceite: PO cria/edita/simula regra sem intervenção dev.
- Rollback: rota escondida por flag.

### S4.4 — Matching Engine v1 (puro)
- Objetivo: função pura multi-estratégia.
- Escopo: `MatchingEngineService` com estratégias chave-natural, 1x1, 1xN, Nx1, NxN(pod), fuzzy; score composto.
- Deps: S2.1, S3.3.
- Aceite: benchmark 100k<120s; dataset canônico bate.
- Rollback: flag off (usa matcher antigo).

### S4.5 — Decision Service
- Objetivo: roteamento por score.
- Escopo: `DecisionService` + thresholds em `conciliacao_config`.
- Deps: S4.2, S4.4.
- Aceite: rotas auto/sugestão/pendente/conflito válidas.
- Rollback: flag off.

## Release R5 — Baixa Nova

### S5.1 — `sp_conciliar` idempotente
- Objetivo: vínculo transacional único.
- Escopo: RPC com chave de idempotência; grava ledger no mesmo TX.
- Deps: R1, R2, R4.
- Aceite: reexecução com mesma chave = no-op.
- Rollback: RPC anterior via flag.

### S5.2 — `sp_estornar` auditado
- Objetivo: reversão rastreada.
- Escopo: RPC inversa; ledger encadeia.
- Deps: S5.1.
- Aceite: workflow retorna ao anterior; ledger íntegro.
- Rollback: flag off.

### S5.3 — Baixa parcial + saldo residual
- Objetivo: cobrir cenário real.
- Escopo: lógica de saldo em `sp_baixar_conciliacao`.
- Deps: S1.1.
- Aceite: título com saldo remanescente permanece `PARCIAL`.
- Rollback: flag off.

### S5.4 — Batch RPC
- Objetivo: baixa em lote performática.
- Escopo: RPC `sp_conciliar_lote` transacional.
- Deps: S5.1.
- Aceite: 1k baixas < 5s.
- Rollback: UI cai para modo unitário via flag.

## Release R6 — UX v2

### S6.1 — Feature flag por empresa
- Objetivo: coexistência controlada.
- Escopo: `feature_flags` + provider React.
- Deps: R5.
- Aceite: alternar empresa v1↔v2 sem deploy.
- Rollback: flag global off.

### S6.2 — Roteamento condicional UI
- Objetivo: mostrar v1 ou v2 conforme flag.
- Escopo: `src/pages/financeiro/conciliacao/*`.
- Deps: S6.1.
- Aceite: empresa em v1 não vê v2 e vice-versa.
- Rollback: forçar v1 via config.

### S6.3 — Painel de revisão v2 (base)
- Objetivo: fila com filtros salvos.
- Escopo: página `/revisao`, DataTable virtualizado, filtros.
- Deps: S6.2, R4.
- Aceite: revisor lista/filtra 10k sugestões.
- Rollback: flag off.

### S6.4 — Batch actions + timeline
- Objetivo: produtividade.
- Escopo: seleção múltipla, preview idempotente; drawer com timeline.
- Deps: S6.3, S2.2.
- Aceite: 100 itens em <5min.
- Rollback: flag esconde ações em lote.

### S6.5 — Comparador de CONFLITO + atalhos
- Objetivo: resolver empates rapidamente.
- Escopo: componente de comparação lado a lado; atalhos teclado.
- Deps: S6.4.
- Aceite: CONFLITO resolvido em <30s.
- Rollback: rota alternativa (linear).

## Release R7 — Governança

### S7.1 — Papéis conciliacao.* completos
- Objetivo: RBAC completo.
- Escopo: seeds em `user_permissions`; guards.
- Deps: S1.6.
- Aceite: testes de autorização 100%.
- Rollback: reverter seeds.

### S7.2 — Aprovação N-olhos
- Objetivo: dupla aprovação em estorno/reabertura.
- Escopo: `sp_estornar_com_aprovacao`, `sp_reabrir_periodo`.
- Deps: S5.2.
- Aceite: 1 aprovador falha; N aprovam.
- Rollback: flag reduz para 1 aprovador.

### S7.3 — Mascaramento LGPD
- Objetivo: dados pessoais protegidos por role.
- Escopo: RPC de leitura mascarada; UI usa por padrão.
- Deps: S7.1.
- Aceite: role sem permissão nunca vê CPF completo.
- Rollback: flag off (mascaramento sempre ativo, seguro por padrão).

### S7.4 — Fechamento com bloqueio DB
- Objetivo: governança fiscal.
- Escopo: `conciliacao_periodos`, trigger `IMMUTABLE` em período CLOSED.
- Deps: S5.1.
- Aceite: escrita retroativa bloqueada no banco.
- Rollback: reabrir via `sp_reabrir_periodo` com N-olhos.

## Release R8 — Visibilidade

### S8.1 — KPIs P0
- Objetivo: % auto, backlog, SLA.
- Escopo: materialized views + refresh incremental por evento.
- Deps: R4, S2.3.
- Aceite: refresh<5min; valores conferem com fonte.
- Rollback: MV drop; UI cai em contagem direta.

### S8.2 — Dashboard v2
- Objetivo: página de KPIs.
- Escopo: página `/conciliacao` com cards e gráficos.
- Deps: S8.1.
- Aceite: carrega em <2s.
- Rollback: rota escondida.

### S8.3 — Distribuição de score
- Objetivo: ajuste fino de regras/thresholds.
- Escopo: painel derivado de MV.
- Deps: S8.1.
- Aceite: histograma correto por período.
- Rollback: rota escondida.

## Release R9 — Escala

### S9.1 — Índices críticos
- Objetivo: p95 dentro da meta.
- Escopo: migração com índices `CONCURRENTLY`.
- Deps: R5.
- Aceite: query plans OK; sem lock em prod.
- Rollback: `DROP INDEX CONCURRENTLY`.

### S9.2 — Particionamento por empresa+mês
- Objetivo: 10⁷ linhas.
- Escopo: partição declarativa das tabelas quentes.
- Deps: S9.1.
- Aceite: benchmark de escala OK.
- Rollback: reagrupamento em janela de manutenção.

### S9.3 — pgmq matching + workers paralelos
- Objetivo: throughput.
- Escopo: fila `q_matching`, worker edge, `SKIP LOCKED`.
- Deps: R4.
- Aceite: 1M mensagens processadas sem deadlock.
- Rollback: flag desliga fila, cai em síncrono.

## Release R10 — Extensibilidade

### S10.1 — Adapter CNAB240
- Objetivo: novo canal.
- Escopo: `Cnab240Adapter` + fixtures.
- Deps: R3, R4.
- Aceite: fixtures reais parseadas.
- Rollback: registro do adapter off.

### S10.2 — Adapter CNAB400
- Igual pattern.

### S10.3 — Adapter PIX (webhook + polling)
- Escopo: endpoint webhook com assinatura; idempotência por `event_id`.
- Aceite: PIX real recebido em piloto.
- Rollback: endpoint 404.

### S10.4 — Adapter Open Finance
- Escopo: OAuth + consent + polling; multi-instituição.
- Rollback: flag off.

### S10.5 — Multi-moeda
- Escopo: `moeda` + `taxa_conversao`; matching em moeda-base.
- Aceite: cenário USD→BRL fecha.
- Rollback: flag off.

## Release R11 — Migração/Corte

### S11.1 — Backfill `hash_arquivo`/`hash_linha`
- Objetivo: legado idempotente.
- Escopo: job idempotente por lote.
- Aceite: relatório de divergência aprovado.
- Rollback: reverter lote por `job_id`.

### S11.2 — Reconstrução de trilha legada
- Escopo: gerar eventos sintéticos no ledger para conciliações históricas.
- Aceite: cadeia hash válida por empresa.
- Rollback: marcar eventos sintéticos como inválidos (não apagar).

### S11.3 — Rollout gradual (piloto → 100%)
- Escopo: script/checklist de ativação por empresa.
- Aceite: 100% empresas + 30 dias sem P0/P1.
- Rollback: flag off por empresa.

### S11.4 — Descontinuação do módulo antigo
- Escopo: remover código v1 (rotas/hooks/RPCs `_v1`).
- Aceite: build limpo; nenhum consumidor de v1.
- Rollback: revert PR (v1 vive somente enquanto flags apontarem).

## Grafo simplificado

```text
R1 ─► R2 ─► R3 ─► R4 ─► R5 ─► R6 ─► R7 ─┬─► R8
                                        └─► R9 ─► R11
              R4 ─► R10 ────────────────────────► R11
                                       R7 ───────┘
```
