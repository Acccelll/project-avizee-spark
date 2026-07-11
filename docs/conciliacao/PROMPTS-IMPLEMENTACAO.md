# PROMPTS DE IMPLEMENTAÇÃO — SPRINTS (LOVABLE)

Um prompt autocontido por sprint. Cole diretamente no Lovable.

## Cabeçalho comum (implícito em todos os prompts)

> Você é o Lovable. Contexto: projeto AviZee (React 18 + Vite + Tailwind + Supabase/Lovable Cloud). Módulo: Conciliação Financeira. Preserve stack, padrões e memórias do projeto (RLS + GRANT, logger, useSupabaseCrud, DrawerV2, StatusBadge, PeriodFilter, QueryState, virtualização). Leia os documentos em `docs/conciliacao/` antes de agir. Nenhuma decisão arquitetural nova — siga TO-BE/ADR/BACKLOG. Toda tabela nova em public → CREATE → GRANT → RLS → POLICY. Toda RPC `SET search_path = public`. Nunca `console.*`; use `logger.ts`. Nunca `try/catch` silencioso. Toda escrita crítica atrás de feature flag `conciliacao_v2.*`.

---

## Sprint S1.1 — RPC atômica de baixa

**Objetivo**: eliminar baixa parcial em falha via `sp_baixar_conciliacao` idempotente.
**Arquivos**: nova migration; regen de `src/integrations/supabase/types.ts`; testes SQL/integração.
**Restrições**: aditivo; manter `sp_baixar_v1` até corte final.
**Regras**: chave idempotência `(empresa_id, conciliacao_id, hash_operacao)`; grava evento no ledger na mesma TX (S1.2 já existente ou stub).
**Aceite**:
- reexecução com mesma chave = no-op;
- falha simulada em qualquer step → rollback total;
- baixa parcial suportada (saldo residual).
**Checklist**: migration escrita · testes de idempotência · teste de falha simulada · logger · doc atualizada em `API-CONTRATOS-CONCILIACAO.md`.
**Validação**: dataset canônico; benchmark ≤ 500ms p95.
**Rollback**: config aponta para `sp_baixar_v1`.
**Documentação obrigatória**: `API-CONTRATOS-CONCILIACAO.md`, `EVENTOS-CONCILIACAO.md`, `HISTORICO-EXECUCAO.md`.

---

## Sprint S1.2 — Ledger imutável hash-chain

**Objetivo**: trilha append-only tamper-evident.
**Arquivos**: migration `conciliacao_ledger` + trigger anti-UPDATE/DELETE + `sp_append_ledger`; edge function `verify-ledger-chain` (cron diário).
**Regras**: hash = SHA-256(prev_hash || payload_canonico); nunca UPDATE/DELETE; GRANT `INSERT` só para service_role.
**Aceite**: alterar 1 byte → detecção; verify diário verde.
**Checklist**: CREATE→GRANT→RLS→POLICY · trigger imutabilidade · função de verify · testes de tampering · doc.
**Validação**: teste que tenta UPDATE (deve falhar); teste de verify.
**Rollback**: parar de gravar via flag; tabela preservada.
**Documentação**: `EVENTOS-CONCILIACAO.md`, `ARQUITETURA-CONCILIACAO.md` (seção Auditoria).

---

## Sprint S1.3 — Idempotência de arquivo (`hash_arquivo`)

**Objetivo**: reimportar arquivo idêntico não duplica.
**Arquivos**: migration adicionando `hash_arquivo TEXT` + índice único parcial em `financeiro_extrato_importacoes`; ajuste no hook de importação.
**Aceite**: reimport = aviso amigável, 0 novo registro.
**Rollback**: `DROP INDEX` + remover checagem.

---

## Sprint S1.4 — Idempotência de linha (`fitid`/`hash_linha`)

**Objetivo**: linha duplicada silenciosamente ignorada com log.
**Arquivos**: migration adicionando `fitid`, `hash_linha` na tabela de linhas do extrato + índices parciais únicos por `(banco, conta)`.
**Deps**: S1.3.
**Aceite**: reimport parcial → só novos entram; log estruturado.

---

## Sprint S1.5 — RLS + GRANT auditados

**Objetivo**: fechar leitura/escrita cruzada.
**Arquivos**: migração revisando políticas e grants de todas as tabelas do módulo.
**Aceite**: fuzz de RLS por role passa; testes de autorização 100%.
**Rollback**: script reverso salvo em `migrations/rollback/`.

---

## Sprint S1.6 — SoD mínima

**Objetivo**: importador ≠ aprovador.
**Arquivos**: seeds em `user_permissions` (papéis `conciliacao.importador|revisor|aprovador`); guards em RPC + `can()` na UI.
**Aceite**: usuário sem papel de aprovador não aprova.
**Rollback**: seeds reversos.

---

## Sprint S1.7 — Logger + fim do catch silencioso

**Objetivo**: observabilidade base.
**Arquivos**: refactor no módulo de conciliação (frontend + edges), substituindo `console.*` e `catch {}`.
**Aceite**: `rg "console\\." src/pages/financeiro/conciliacao` = 0; erros tipados.
**Rollback**: revert PR.

---

## Sprint S2.1 — Ports & domínio puro

**Objetivo**: extrair core sem imports de infra.
**Arquivos**: criar `src/domain/conciliacao/{entities,vos,ports,events}`; nenhuma dependência de `@/integrations/supabase/*`.
**Aceite**: `tsgo` no domínio isolado; testes unitários ≥80% no core.
**Rollback**: manter `src/pages/financeiro/conciliacao/*` intacto (nada consome domínio ainda).

---

## Sprint S2.2 — Workflow Service

**Objetivo**: máquina de estados formal.
**Arquivos**: `WorkflowService` no domínio; tabela `conciliacao_workflow_transicoes`; RPC `sp_transicionar`.
**Aceite**: transição inválida → erro tipado; histórico por agregado.
**Rollback**: flag off.

---

## Sprint S2.3 — Outbox + Worker

**Objetivo**: entrega garantida de eventos.
**Arquivos**: tabela `conciliacao_outbox`; edge `conciliacao-outbox-worker` (cron); retry/backoff/DLQ.
**Aceite**: crash no worker → nova execução entrega; consumidores idempotentes.
**Rollback**: desligar cron.

---

## Sprint S2.4 — Catálogo de eventos v1

**Objetivo**: contratos oficiais dos eventos.
**Arquivos**: `docs/conciliacao/EVENTOS-CONCILIACAO.md`; tipos TS em `src/domain/conciliacao/events`.
**Aceite**: todos os eventos listados no TO-BE (Parte 11) documentados e tipados.
**Rollback**: N/A.

---

## Sprint S3.1 — Adapter OFX v2 multi-conta

**Objetivo**: parser correto multi-conta.
**Arquivos**: edge `ofx-parser-v2`; fixtures anonimizadas em `tests/fixtures/ofx/`.
**Aceite**: fixtures reais parseadas byte-a-byte.
**Rollback**: rotear para v1 via flag.

---

## Sprint S3.2 — Import Service v2

**Objetivo**: ingestão idempotente assíncrona.
**Arquivos**: `ImportService` usando ports; fila `q_import` (pgmq).
**Deps**: S3.1, S1.3, S1.4.
**Aceite**: reimport idempotente; publica `StatementImported`.
**Rollback**: `import_v2` off.

---

## Sprint S3.3 — Normalizer Service

**Objetivo**: canonizar movimentos.
**Arquivos**: `NormalizerService` puro; testes dataset canônico.
**Aceite**: 0 duplicidade; padronização OK.
**Rollback**: flag off.

---

## Sprint S4.1 — Modelo de regras versionadas

**Arquivos**: `conciliacao_regras`, `conciliacao_regras_versoes`, `conciliacao_regras_execucoes` (CREATE→GRANT→RLS→POLICY); tipos TS.
**Aceite**: CRUD versionado, execução registrada.
**Rollback**: DROP (aditivo).

---

## Sprint S4.2 — Rules Engine v1

**Arquivos**: `RulesEngineService` no domínio (hierarquia, conflito, aplicação); testes.
**Aceite**: hierarquia global→empresa→banco→conta→usuário OK.
**Rollback**: flag off.

---

## Sprint S4.3 — UI de regras + simulador

**Arquivos**: página `/financeiro/conciliacao/regras`; editor, simulador "e-se".
**Aceite**: PO cria/edita/simula sem dev.
**Rollback**: rota atrás de flag.

---

## Sprint S4.4 — Matching Engine v1 (puro)

**Arquivos**: `MatchingEngineService` (chave-natural, 1x1, 1xN, Nx1, NxN pod., fuzzy, score).
**Aceite**: 100k<120s; dataset canônico bate.
**Rollback**: flag off (matcher antigo).

---

## Sprint S4.5 — Decision Service

**Arquivos**: `DecisionService`; `conciliacao_config` (thresholds).
**Aceite**: rotas auto/sugestão/pendente/conflito válidas.
**Rollback**: flag off.

---

## Sprint S5.1 — `sp_conciliar` idempotente

**Arquivos**: RPC + tipos + testes; grava outbox+ledger na mesma TX.
**Aceite**: reexecução com mesma chave = no-op.
**Rollback**: RPC v1 via flag.

---

## Sprint S5.2 — `sp_estornar` auditado

**Arquivos**: RPC + testes.
**Aceite**: workflow retorna ao anterior; ledger encadeia.
**Rollback**: flag off.

---

## Sprint S5.3 — Baixa parcial + saldo residual

**Arquivos**: ajuste em `sp_baixar_conciliacao`; testes.
**Aceite**: título fica `PARCIAL` com saldo correto.
**Rollback**: flag off.

---

## Sprint S5.4 — Batch RPC

**Arquivos**: `sp_conciliar_lote`; UI usa quando >N.
**Aceite**: 1k<5s.
**Rollback**: UI unitária via flag.

---

## Sprint S6.1 — Feature flag por empresa

**Arquivos**: `feature_flags` + `FeatureFlagProvider` + hook `useFeatureFlag`.
**Aceite**: alternar sem deploy.
**Rollback**: flag global off (todas v1).

---

## Sprint S6.2 — Roteamento condicional UI

**Arquivos**: `src/pages/financeiro/conciliacao/index.tsx` decide v1|v2 por flag.
**Aceite**: empresa em v1 não vê v2.
**Rollback**: força v1.

---

## Sprint S6.3 — Painel de revisão v2 (base)

**Arquivos**: página `/revisao`; DataTable virtualizado; filtros salvos.
**Aceite**: 10k sugestões navegáveis.
**Rollback**: flag off.

---

## Sprint S6.4 — Batch actions + timeline

**Arquivos**: `BatchActionBar`; `DrawerV2` com `MatchTimeline`.
**Aceite**: 100 itens<5min.
**Rollback**: flag esconde batch.

---

## Sprint S6.5 — Comparador CONFLITO + atalhos

**Arquivos**: `CandidateCompare`; hook de atalhos.
**Aceite**: CONFLITO em <30s.
**Rollback**: caminho linear.

---

## Sprint S7.1 — Papéis conciliacao.* completos

**Arquivos**: seeds; guards; docs em `mem://auth/papeis-de-usuario`.
**Aceite**: autorização 100%.
**Rollback**: reverter seeds.

---

## Sprint S7.2 — Aprovação N-olhos

**Arquivos**: `sp_estornar_com_aprovacao`, `sp_reabrir_periodo`.
**Aceite**: 1 aprovador falha; N aprovam.
**Rollback**: N=1 via flag.

---

## Sprint S7.3 — Mascaramento LGPD

**Arquivos**: RPCs de leitura mascarada; UI usa por padrão.
**Aceite**: role sem permissão nunca vê PII.
**Rollback**: mascaramento sempre ativo (falha segura).

---

## Sprint S7.4 — Fechamento com bloqueio DB

**Arquivos**: `conciliacao_periodos`; trigger IMMUTABLE em CLOSED; `sp_fechar_periodo` e `sp_reabrir_periodo`.
**Aceite**: escrita retroativa bloqueada.
**Rollback**: reabrir via N-olhos.

---

## Sprint S8.1 — KPIs P0 (MVs)

**Arquivos**: materialized views + refresh incremental por evento.
**Aceite**: refresh<5min; valores conferem.
**Rollback**: DROP MV.

---

## Sprint S8.2 — Dashboard v2

**Arquivos**: página `/conciliacao` com cards/gráficos.
**Aceite**: <2s de carregamento.
**Rollback**: rota escondida.

---

## Sprint S8.3 — Distribuição de score

**Arquivos**: painel derivado de MV.
**Aceite**: histograma correto.
**Rollback**: rota escondida.

---

## Sprint S9.1 — Índices críticos

**Arquivos**: migration `CONCURRENTLY`.
**Aceite**: plans OK; sem lock em prod.
**Rollback**: `DROP INDEX CONCURRENTLY`.

---

## Sprint S9.2 — Particionamento

**Arquivos**: partição declarativa das tabelas quentes.
**Aceite**: benchmark de escala OK.
**Rollback**: em janela; ledger preservado.

---

## Sprint S9.3 — pgmq matching + workers

**Arquivos**: fila `q_matching`; worker edge; `SKIP LOCKED`.
**Aceite**: 1M sem deadlock.
**Rollback**: flag cai em síncrono.

---

## Sprints R10 — Adapters/Multi-moeda

Cada adapter (CNAB240, CNAB400, PIX, Open Finance, Multi-moeda) segue o mesmo template: edge function + fixtures + testes + registro no adapter registry. Flag por adapter para rollback.

---

## Sprints R11 — Migração e Corte

**S11.1 Backfill**: job idempotente por lote com `job_id`; relatório de divergência.
**S11.2 Reconstrução de trilha**: eventos sintéticos no ledger com `origem='backfill'`.
**S11.3 Rollout gradual**: checklist por empresa; ativar flag; monitorar 7 dias; expandir.
**S11.4 Descontinuação**: remover código v1; build limpo.

---

## Regras aplicáveis a TODOS os prompts

1. Nada de decisão arquitetural — se algo estiver ambíguo, consultar `ADR-CONCILIACAO.md`; se ainda ambíguo, parar e abrir ADR nova.
2. Toda tabela nova: CREATE → GRANT → RLS → POLICY na mesma migration.
3. Toda RPC: `SECURITY DEFINER` + `SET search_path = public`.
4. Toda escrita crítica atrás de feature flag `conciliacao_v2.*`.
5. Toda mutação publica evento no `conciliacao_outbox` na mesma TX.
6. Toda leitura respeita RLS e paginação por cursor (`useSupabaseCrud`).
7. Nunca `console.*`, nunca `catch {}`.
8. Atualizar documentação viva ao final da sprint.
9. Registrar entrada em `HISTORICO-EXECUCAO.md`.
10. Feature flag desliga; nada é destrutivo antes de R11.
