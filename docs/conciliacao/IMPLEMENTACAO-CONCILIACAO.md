# IMPLEMENTAÇÃO CONCILIAÇÃO — PLANO MESTRE

Plano técnico de execução da arquitetura TO-BE. Nenhum código, migration ou componente é criado nesta etapa.

## Parte 1 — Estratégia Geral

**Escolha: Híbrida = Strangler Fig + Feature Toggle + Entrega Incremental.**
- Novo módulo (`conciliacao/v2`) convive com o atual atrás de flag `feature.conciliacao_v2` por empresa.
- Fundação (Fase 0) é aplicada in-place no módulo atual (correções P0 obrigatórias, ver ADR-011).
- Cada épico v2 entra atrás de flag; rollback = desligar flag.
- Big Bang rejeitado (risco financeiro); refactor puro rejeitado (não resolve dívidas arquiteturais).

## Parte 2 — Dependências Macro

```text
Fase 0 (Atomicidade + Ledger + RLS + SoD)
   ├─► Domínio Puro (Ports & Adapters)
   │      ├─► RulesEngine ─┐
   │      ├─► MatchingEngine (puro) ─┐
   │      ├─► DecisionService ◄──────┤
   │      ├─► WorkflowService        │
   │      └─► Outbox + Eventos ──────┼─► ReconciliationService ─► PostingService
   │                                 │           │
   │                                 │           ▼
   │                                 │       Auditoria (hash-chain)
   │                                 ▼
   │                          Fila Revisão UI
   ▼
Adapters (OFX/CNAB/PIX/OpenFinance) ─► Import ─► Normalizer ─► Rules ─► Matching
Métricas ◄─── Eventos ───► Notificações
Dashboard ◄─ Métricas + Views materializadas
Closing ◄─ Auditoria + Workflow
```

## Parte 3 — Épicos

| # | Épico | Objetivo | Escopo | Dependências | Critério de conclusão |
|---|---|---|---|---|---|
| E1 | Fundação (Fase 0) | Eliminar riscos P0 | RPC atômica de baixa, ledger imutável, hash idempotência, RLS+GRANT, SoD básico, logger estruturado | — | 0 baixas divergentes; 100% eventos críticos com trilha |
| E2 | Domínio Puro | Extrair core de negócio | Entidades, VOs, agregados, ports | E1 | Domínio compila sem imports de Supabase/React |
| E3 | Import + Adapters | Ingestão multi-formato | Adapter OFX v2 (multi-conta), staging, dedup por hash | E1, E2 | Reimportação idempotente comprovada |
| E4 | Normalização | Canonizar movimentos | Padronização, dedup linha, resolução de conta | E3 | Zero duplicidades em dataset canônico |
| E5 | Rules Engine v1 | Regras em dados versionados | CRUD regras, hierarquia, simulador | E2 | UI edita regras sem deploy; simulador OK |
| E6 | Matching Engine v1 | Motor puro multi-estratégia | 1x1, 1xN, Nx1, NxN(pod.), fuzzy, score | E2, E4 | Função pura testada; benchmark 100k < 120s |
| E7 | Decision Service | Roteamento por score | Thresholds parametrizáveis, CONFLITO, PENDENTE | E5, E6 | Rotas auto/sugestão/pendente/conflito validadas |
| E8 | Workflow Service | Máquina de estados | Transições validadas, histórico | E2 | Toda mutação registra transição |
| E9 | Reconciliation + Posting | Vínculo transacional + baixa | Orquestrador, RPC baixa única | E1, E7, E8 | 0 baixa parcial em falha simulada |
| E10 | Auditoria + Outbox | Trilha imutável + eventos | Ledger hash-chain, tabela outbox, worker | E1 | Verificação de cadeia OK; entrega 100% |
| E11 | UI Revisão v2 | Fila de revisão profissional | Filtros salvos, batch actions, timeline, comparador | E7, E9 | Revisor opera lote 100 itens < 5min |
| E12 | Dashboard + Indicadores | KPIs em (quase) real-time | MVs, refresh incremental | E10 | KPIs P0 disponíveis |
| E13 | Segurança + SoD Avançada | RBAC completo + N-olhos | Papéis conciliacao.*, aprovação, LGPD | E1 | Testes de autorização 100% |
| E14 | Performance + Escala | Particionamento, pgmq, batch | Índices, workers, batch RPC | E9, E10 | Metas Parte 23 do TO-BE |
| E15 | Extensibilidade | Novos canais | CNAB240/400, PIX, Open Finance, multi-moeda | E3 | Adapter novo em ≤5 dias-dev |
| E16 | Closing + Governança | Fechamento de período | Bloqueio DB, reabertura N-olhos | E9, E10, E13 | Reabertura sem trilha = 0 |
| E17 | Migração e Descontinuação | Retirar módulo antigo | Backfill, coexistência, corte por empresa | E9, E11 | 100% empresas em v2 |

## Parte 4 — Decomposição em Features (amostra)

Formato: `nome · descrição · objetivo · pré-req · impacto · dependências`.

**E1 Fundação**
- F1.1 RPC `sp_baixar_conciliacao` · efetiva baixa atomicamente · eliminar baixa parcial · — · P0 financeiro · nenhuma.
- F1.2 Tabela `conciliacao_ledger` (append-only, hash-chain) · trilha imutável · auditoria · — · P0 governança · nenhuma.
- F1.3 Deduplicação de arquivo por `hash_arquivo` · idempotência de import · P0 · — · nenhuma.
- F1.4 Deduplicação de linha por `(banco, conta, fitid|hash_linha)` · P0 · — · F1.3.
- F1.5 Revisão de RLS + GRANT explícito · P0 segurança · — · nenhuma.
- F1.6 SoD mínima (importador ≠ aprovador) · P1 · F1.5.
- F1.7 Logger estruturado + remoção de `try/catch` silencioso · P1 obs · — · nenhuma.

**E5 Rules Engine v1**
- F5.1 Modelo de regra parametrizável · CRUD + vigência + versão.
- F5.2 Hierarquia de escopo (global→empresa→banco→conta→usuário).
- F5.3 Detecção de conflito em criação.
- F5.4 Simulador "e-se" antes de publicar.
- F5.5 Registro de execução (regra_id, versão, movimento_id, resultado).

**E6 Matching v1**
- F6.1 Filtro grosso (conta/período/sinal).
- F6.2 Estratégia chave natural (nsu/e2e_id).
- F6.3 Estratégia 1x1 exato.
- F6.4 Estratégias 1xN e Nx1.
- F6.5 Estratégia NxN com poda (N≤10, timeout).
- F6.6 Fuzzy descrição (só para sugestão).
- F6.7 Cálculo de score composto configurável.
- F6.8 Detecção CONFLITO por δ.

**E9 Reconciliation + Posting**
- F9.1 RPC `sp_conciliar` transacional idempotente.
- F9.2 RPC `sp_estornar` inverso auditado.
- F9.3 Baixa parcial com saldo residual.
- F9.4 Batch RPC para lote.

**E11 UI Revisão v2**
- F11.1 Painel de revisão com filtros salvos.
- F11.2 Batch actions com preview idempotente.
- F11.3 Timeline por agregado.
- F11.4 Comparador de candidatos em CONFLITO.
- F11.5 Atalhos de teclado.

**E12 Dashboard**
- F12.1 KPI % auto-conciliação.
- F12.2 Backlog por conta/idade.
- F12.3 SLA por período.
- F12.4 Distribuição de score.

**E17 Migração**
- F17.1 Feature flag `conciliacao_v2` por empresa.
- F17.2 Backfill `hash_linha` legado.
- F17.3 Reconstrução de trilha para conciliações passadas.
- F17.4 Roteamento condicional na UI.
- F17.5 Descontinuação do módulo antigo (após 100% adoção).

(demais épicos seguem o mesmo padrão — ver `BACKLOG-CONCILIACAO.md`).

## Parte 5 — Backlog Técnico (síntese)

Backlog completo em `BACKLOG-CONCILIACAO.md`. Priorização por (risco × valor / esforço). Todos P0 pertencem a E1 e a itens de segurança de E13 e E17 (rollback).

## Parte 6 — Planejamento de Banco (sem SQL)

**Novas entidades conceituais**
- `conciliacao_ledger` (append-only, hash-chain, evento serializado).
- `conciliacao_outbox` (eventos pendentes de entrega, worker consome).
- `conciliacao_regras` + `conciliacao_regras_versoes` + `conciliacao_regras_execucoes`.
- `conciliacao_sugestoes` (candidatos com score, motivo, estratégia).
- `conciliacao_workflow_transicoes` (histórico de estados).
- `conciliacao_config` (thresholds, tolerâncias por escopo).
- `conciliacao_periodos` (janelas contábeis + estado).
- `conciliacao_indicadores_mv` (materialized views por KPI).

**Entidades alteradas**
- `financeiro_extrato_importacoes`: adicionar `hash_arquivo`, `conta_bancaria_id`, `status_importacao`.
- `financeiro_extrato_linhas` (ou equivalente): adicionar `hash_linha`, `fitid`, `status_workflow`, `motivo_ignorado`.
- `conciliacao_bancaria`: tornar obrigatória; adicionar `chave_natural`, `score`, `estrategia`, `versao_regras`.
- `financeiro_baixas`: adicionar `conciliacao_id` (FK obrigatória), `chave_idempotencia`.

**Relacionamentos-chave**: ver `MODELO-CONCEITUAL.md`.

**Índices**
- `(empresa_id, conta_bancaria_id, data)` em movimentos.
- `hash_linha` único parcial por `(banco, conta)`.
- `fitid` único parcial por `(banco, conta)`.
- Índice parcial em `status IN ('SUGGESTED','IN_REVIEW','CONFLITO','PENDENTE')`.
- Índice em `outbox.status='pending'` para worker.
- BRIN em `ledger.created_at` (append-only, tempo).

**Constraints**
- `chk_status_movimento`, `chk_status_conciliacao`, `chk_status_baixa`.
- Trigger `IMMUTABLE` em ledger/outbox impedindo UPDATE/DELETE.
- Trigger em `financeiro_baixas` impedindo escrita em período CLOSED.
- Unicidade `(banco, conta, hash_linha)`.

**Versionamento**: regras têm tabela de versões; ledger é o log oficial de eventos; migrações versionadas por timestamp.

**Auditoria**: toda tabela crítica com `created_by`, `updated_by`, e eventos correspondentes em `conciliacao_ledger`.

## Parte 7 — Planejamento de Backend

- **Domain layer** (`src/domain/conciliacao/`): entidades (Extrato, Movimento, Conciliacao, Baixa, Regra, Sugestao), VOs (Money, Periodo, Score, Tolerancia), invariantes, eventos.
- **Application layer** (`src/application/conciliacao/`): use cases (`importar-extrato`, `normalizar-lote`, `avaliar-regras`, `encontrar-candidatos`, `aprovar-sugestao`, `estornar-conciliacao`, `fechar-periodo`).
- **Ports** (interfaces): `ExtratoRepository`, `MovimentoRepository`, `RegraRepository`, `TituloRepository`, `EventPublisher`, `Clock`, `IdGenerator`.
- **Adapters** (`src/infra/conciliacao/`): `OfxAdapter`, `Cnab240Adapter`, `Cnab400Adapter`, `PixAdapter`, `OpenFinanceAdapter`, `SupabaseRepos`.
- **Edge functions**: `ofx-parser` (parse pesado), `cnab-parser`, `pix-webhook`, `openfinance-oauth`, `conciliacao-worker` (consome outbox), `matching-worker` (fila pgmq), `closing-worker`.
- **RPCs**: `sp_conciliar`, `sp_estornar`, `sp_baixar_conciliacao`, `sp_reabrir_periodo`, `sp_fechar_periodo`, `sp_append_ledger`.
- **Jobs / async**: pgmq queues `q_import`, `q_matching`, `q_outbox`, `q_notifications`; cron para refresh incremental de MVs; job de verificação de cadeia do ledger (diário).
- **Eventos**: publicados via outbox; entregues por worker idempotente.

## Parte 8 — Planejamento de Frontend

- **Rotas** (v2 atrás de flag): `/financeiro/conciliacao` (dashboard), `/financeiro/conciliacao/revisao`, `/financeiro/conciliacao/importar`, `/financeiro/conciliacao/regras`, `/financeiro/conciliacao/auditoria`, `/financeiro/conciliacao/configuracoes`, `/financeiro/conciliacao/fechamento`.
- **Módulos**: `dashboard`, `revisao`, `import`, `regras`, `auditoria`, `configuracoes`, `fechamento`.
- **Componentes-chave** (padrões canônicos existentes): DataTable virtualizado, DrawerV2, SummaryCard, StatusBadge, AdvancedFilterBar, FormModal, PeriodFilter, QueryState.
- **Componentes novos**: `CandidateCompare`, `MatchTimeline`, `RuleEditor`, `RuleSimulator`, `LedgerViewer`, `PeriodClosePanel`, `BatchActionBar`, `ScoreBadge`.
- **Hooks**: `useConciliacaoDashboard`, `useRevisaoQueue`, `useMatchingSuggestions`, `useRules`, `useRulesSimulator`, `useLedger`, `usePeriodo`, `useConciliacaoConfig`.
- **Stores/Context**: `ConciliacaoFilterContext` (filtros salvos), `RevisionSelectionContext` (batch), sem store global — react-query como fonte da verdade.
- **Providers**: `FeatureFlagProvider` (empresa → v1/v2).
- **Padrões**: paginação por cursor via `useSupabaseCrud`, logger, `can()` em toda ação crítica.

## Parte 9 — Fluxo de Dados

Idêntico à Parte 5 do TO-BE, com transições explícitas:
- Import → grava staging + evento outbox → worker chama Normalizer.
- Normalizer → grava movimentos canônicos + evento → worker aciona RulesEngine.
- RulesEngine → grava execuções + evento → aciona MatchingEngine.
- MatchingEngine (puro) → retorna candidatos → Decision persiste sugestões ou aciona ReconciliationService (auto).
- ReconciliationService → `sp_conciliar` (RPC atômica) → chama `sp_baixar_conciliacao` → publica eventos via outbox → AuditService encadeia hash.
- UI de Revisão consome sugestões + workflow; ações vão para `sp_conciliar`/`sp_estornar`.
- MetricsService recalcula MVs por evento; Dashboard consome MVs.
- ClosingService bloqueia período; reabertura via N-olhos.

## Parte 10 — Estratégia de Migração

- **Coexistência**: v1 e v2 lado a lado por feature flag por empresa.
- **Backfill**: job idempotente calcula `hash_linha` e `hash_arquivo` retroativos; reconstrói `conciliacao_bancaria` faltantes a partir de baixas históricas; gera eventos sintéticos no ledger com origem `backfill`.
- **Preservação**: nunca alterar dados legados destrutivamente; adicionar colunas nullable e preencher; validar contagem antes/depois.
- **Rota de corte**: ativar v2 por empresa piloto → 3 empresas → 10 → 100%.
- **Rastreabilidade**: cada registro migrado carrega `origem_migracao` + `migrado_em`.
- **Auditoria de migração**: relatório por empresa (movimentos migrados, hashes recalculados, divergências).

## Parte 11 — Compatibilidade

- Enquanto v1 estiver ativo em qualquer empresa: manter APIs e telas atuais funcionando.
- Novas RPCs escritas para conviver: aceitam chamadas de v1 e v2.
- Tabelas alteradas apenas por adição (colunas nullable, defaults seguros).
- Contratos v2 versionados (`/v2` em rotas internas).
- Descontinuação de v1 apenas após 100% das empresas em v2 por 30 dias sem incidente.

## Parte 12 — Estratégia de Testes

Detalhes em `PLANO-DE-TESTES.md`. Resumo:
- Unitários no domínio (matching, regras, workflow, score) — cobertura ≥ 80%.
- Integração de RPCs (`sp_conciliar`, `sp_estornar`, `sp_baixar_conciliacao`) contra Postgres real de teste.
- Contrato de adapters (OFX/CNAB/PIX) com fixtures reais anonimizadas.
- E2E via Playwright: import → revisão → baixa → auditoria.
- Performance: benchmarks com 100k/500k/1M movimentos.
- Carga/estresse: workers em paralelo, fila cheia.
- Regressão financeira: dataset canônico com resultado esperado byte-a-byte.
- Segurança: fuzz de RLS, testes de autorização, verificação de tamper no ledger.

## Parte 13 — Observabilidade

- Logger estruturado (`logger.ts`) em todo caminho crítico com `trace_id`.
- Métricas técnicas e de negócio (Parte 14 do TO-BE).
- Tracing correlacionado UI→edge→RPC via header `x-trace-id`.
- Alertas: fila > X, erro > Y%, backlog > Z dias, cadeia do ledger inválida.
- Dashboards SRE (workers, filas, RPCs) e Controller (KPIs).
- Runbooks para os 10 alertas mais comuns.

## Parte 14 — Segurança

- Papéis `conciliacao.importador|revisor|aprovador|auditor|admin` em `user_permissions`.
- SoD configurável por empresa.
- RLS obrigatória em toda tabela criada/alterada, com GRANT explícito.
- Aprovação N-olhos para estorno e reabertura de período.
- Trilha de acesso a dados sensíveis (LGPD).
- Rollback: feature flag desliga v2; ledger nunca é apagado.

## Parte 15 — Performance

- Paginação por cursor em toda listagem.
- Cache react-query com invalidação por evento.
- Fila pgmq para import/matching pesados.
- Workers paralelos com `FOR UPDATE SKIP LOCKED`.
- Lazy loading de rotas do módulo (`React.lazy`).
- Virtualização de listas grandes (padrão do projeto).
- Índices e particionamento definidos na Parte 6.
- Batch RPC para baixa/estorno em lote.

## Parte 16 — Escalabilidade

- Adapter pattern habilita CNAB240/400, PIX, Open Finance, APIs bancárias, gateways.
- Multi-moeda com moeda-base configurável.
- Multi-empresa/multi-filial (`empresa_id`+`filial_id` em tudo).
- Webhooks com verificação de assinatura e idempotência por `event_id`.
- Regras extensíveis em dados; motor não precisa deploy.

## Parte 17 — Critérios de Aceite (por feature)

Cada feature só é aceita quando:
- Objetivo funcional verificado por teste automatizado.
- p95 dentro da meta definida no TO-BE (Parte 23).
- Cobertura mínima 80% no core, 60% no restante.
- Logs e métricas presentes.
- Trilha (ledger) com evento correspondente.
- Documentação atualizada.
- Sem regressão em suíte E2E.

## Parte 18 — Definition of Done

Uma entrega considera-se pronta somente com: código revisado, testes unitários/integração/E2E aprovados, benchmarks dentro da meta, RLS+GRANT auditados, logger/métricas ativos, cadeia do ledger verificada, feature flag configurada, documentação e runbook atualizados, zero regressões, aprovação do product owner financeiro.

## Parte 19 — Matriz de Riscos (por épico)

| Épico | Risco | Impacto | Prob. | Mitigação | Contingência |
|---|---|---|---|---|---|
| E1 | RPC atômica com bug | Alto | Média | Testes de contrato exaustivos, dry-run em staging | Feature flag desliga; rollback ledger não é necessário |
| E3 | Adapter OFX perde linhas | Alto | Baixa | Fixtures reais + hash de arquivo | Reimportação idempotente |
| E5 | Regra conflitante em produção | Médio | Média | Detecção em criação + simulador | Desativar regra por flag |
| E6 | NxN explode combinatória | Alto | Média | Poda + N≤10 + timeout | Cai para revisão manual |
| E9 | Baixa parcial em falha | Alto | Baixa | Transação única + testes de falha simulada | Estorno automático via ledger |
| E10 | Cadeia do ledger quebrar | Crítico | Baixa | Job de verificação diário | Alerta + freeze do módulo |
| E14 | Particionamento em produção | Médio | Média | Janela de manutenção + backup | Rollback de partição |
| E17 | Corte de empresa com dado sujo | Alto | Média | Relatório pré-corte + backfill validado | Retornar empresa para v1 via flag |

## Parte 20 — Roadmap Executivo (ondas)

- Onda 1 — Fundação (E1).
- Onda 2 — Core (E2, E8, E10).
- Onda 3 — Automação (E3, E4, E5, E6, E7).
- Onda 4 — Conciliação + Baixa (E9).
- Onda 5 — UX de Revisão (E11).
- Onda 6 — Governança (E13, E16).
- Onda 7 — Indicadores (E12).
- Onda 8 — Performance/Escala (E14).
- Onda 9 — Extensibilidade (E15).
- Onda 10 — Migração + Descontinuação (E17).

## Parte 21 — Cronograma Lógico

Sequência ideal (sem datas):
- Serial obrigatório: Onda 1 → 2 → 4 → 5 → 10.
- Paralelo possível: Onda 3 com Onda 5 (UI de revisão pode desenvolver contra mocks); Onda 6 com Onda 7; Onda 8 com Onda 9.
- Bloqueios: Onda 4 exige 2 e 3; Onda 5 exige 4; Onda 10 exige 5, 6 e 7.

## Parte 22 — Plano de Rollback

- Nível 1 (feature flag): desligar `conciliacao_v2` por empresa — reversão em segundos.
- Nível 2 (RPC): manter versão anterior da RPC como `sp_conciliar_v1`; alternar via flag do backend.
- Nível 3 (schema): toda alteração é aditiva; rollback é `DROP` de colunas novas sem afetar legado.
- Nível 4 (dados): ledger é imutável e retém histórico completo; nunca há perda.
- Validação pós-rollback: relatório de consistência (baixas ↔ conciliações ↔ ledger) automatizado.

## Parte 23 — Checklists

Detalhados em `CHECKLIST-IMPLEMENTACAO.md`.

## Parte 24 — Plano de Documentação

Manter atualizados durante toda a implementação: `ARQUITETURA-CONCILIACAO.md`, `ADR-CONCILIACAO.md`, `MODELO-CONCEITUAL.md`, `ROADMAP-ARQUITETURAL.md`, `IMPLEMENTACAO-CONCILIACAO.md`, `BACKLOG-CONCILIACAO.md`, `PLANO-DE-MIGRACAO.md`, `PLANO-DE-TESTES.md`, `CHECKLIST-IMPLEMENTACAO.md`, `RUNBOOKS-CONCILIACAO.md` (novo, operacional), `API-CONTRATOS-CONCILIACAO.md` (novo, RPCs/edge), `EVENTOS-CONCILIACAO.md` (novo, catálogo de eventos), `REGRAS-CONCILIACAO.md` (novo, catálogo de regras e simulações), `TROUBLESHOOTING.md` (novo).

## Parte 25 — Visão Final

**Capacidades**: import multi-formato/idempotente, matching multi-estratégia com score, regras editáveis pelo negócio, decisão automática com fallback seguro, revisão em lote com timeline, baixa atômica com estorno auditado, trilha imutável, dashboards em tempo (quase) real, fechamento de período governado.
**Limitações eliminadas**: baixa parcial em falha, duplicidade de importação, regras engessadas, ausência de trilha, RLS permissivo, fila sem SLA, falta de SoD.
**Riscos eliminados**: divergência financeira silenciosa, tampering, perda de rastreabilidade, retrabalho massivo.
**Ganhos operacionais**: automação ≥ 85%, revisão focada, aprovações rápidas, encerramento confiável.
**Ganhos financeiros**: menos perdas por erro, previsibilidade de caixa, auditoria fiscal robusta.
**Ganhos de manutenção**: novos bancos em ≤5 dias-dev, regras sem deploy, testes automatizados.
**Ganhos de escalabilidade**: apto a 10⁷ lançamentos sem redesenho.
**Ganhos de governança**: SoD, N-olhos, ledger hash-encadeado, LGPD nativa — nível ERP corporativo.
