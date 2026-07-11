# CONCILIAÇÃO FINANCEIRA — ARQUITETURA TO-BE ENTERPRISE

> Blueprint oficial da próxima geração do módulo de Conciliação Financeira do ERP AviZee. Este documento **não implementa código**, **não altera arquivos**, **não cria migrations**. É a referência conceitual que guiará todas as etapas seguintes.

---

## Parte 1 — Princípios Arquiteturais

| # | Princípio | Justificativa |
|---|-----------|---------------|
| P1 | Single Responsibility | Cada camada e cada serviço têm uma única razão para mudar. Elimina "God services" (useConciliacao, OFXMatchingPane). |
| P2 | Separation of Concerns | Importação, normalização, matching, decisão, baixa e auditoria são camadas independentes. |
| P3 | Domain-Driven Design (leve) | Linguagem ubíqua financeira; bounded contexts explícitos. |
| P4 | Event-Driven onde agrega valor | Eventos de domínio permitem observabilidade, integrações e auditoria naturais, sem broker externo. |
| P5 | Clean Architecture (Ports & Adapters) | Núcleo desacoplado de Supabase/React/OFX; adapters plugáveis. |
| P6 | SOLID | Base para extensibilidade — novos bancos, algoritmos e regras sem tocar no core. |
| P7 | Composition over Inheritance | Regras compostas por predicados; matching combinado em pipeline. |
| P8 | Configuração > Código | Regras, tolerâncias e prioridades vivem em dados versionados. |
| P9 | Fail-safe | Falha degrada para revisão manual, nunca para baixa incorreta. |
| P10 | Auditabilidade total | Todo evento gera registro imutável. |
| P11 | Idempotência | Reimportação/reprocessamento não duplica; chaves naturais (fitid, hash_linha). |
| P12 | Observabilidade nativa | Logs estruturados, métricas e traces no caminho crítico. |
| P13 | Reversibilidade | Toda ação de negócio tem operação inversa auditada. |
| P14 | Segregação de Deveres (SoD) | Importador ≠ Revisor ≠ Aprovador (parametrizável). |
| P15 | Multi-tenant por design | empresa_id em toda entidade; RLS por padrão. |

## Parte 2 — Arquitetura Macro

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    CAMADA DE APRESENTAÇÃO (React)                       │
│  Dashboard · Painel de Revisão · Timeline · Side Panels · Batch Actions │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│               CAMADA DE APLICAÇÃO (Use Cases / Orquestração)            │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│                          CAMADA DE DOMÍNIO                              │
│  Entidades · Agregados · VO · Domain Events · Invariantes               │
│  Extrato → Normalização → Regras → Matching → Decisão/Score             │
│  Fila Revisão → Conciliação → Baixa/Estorno → Auditoria → Workflow      │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ (Ports)
┌──────────────────────────────▼──────────────────────────────────────────┐
│                     CAMADA DE INFRAESTRUTURA                            │
│  Adapters OFX · CNAB · PIX · Open Finance · APIs Bancárias              │
│  Postgres/Supabase · Storage · pgmq · Logger · Auth                     │
└─────────────────────────────────────────────────────────────────────────┘
```

## Parte 3 — Domínios

Extratos · Importação · Normalização · Matching · Regras · Decisão · Conciliação · Baixa · Estorno · Workflow · Auditoria · Indicadores · Configurações · Notificações · Logs. Cada domínio com responsabilidade única (ver tabela abaixo).

| Domínio | Responsabilidade |
|---|---|
| Extratos | Modelo bruto e normalizado do extrato bancário. |
| Importação | Ingestão, deduplicação, staging. |
| Normalização | Padronizar valor/data/sinal/descrição/conta. |
| Regras | Predicados parametrizáveis (aliases, tolerâncias, ignorados). |
| Matching | Gerar candidatos financeiro↔bancário. |
| Decisão | Score, thresholds, roteamento (auto/sugestão/revisão). |
| Conciliação | Vínculo formal movimento↔título(s). |
| Baixa | Efeito financeiro em AR/AP. |
| Estorno | Operação inversa auditada. |
| Workflow | Máquina de estados. |
| Auditoria | Trilha append-only com hash-chain. |
| Indicadores | KPIs e SLA. |
| Configurações | Contas, bancos, tolerâncias. |
| Notificações | Alertas de exceção/SLA. |
| Logs | Observabilidade transversal. |

## Parte 4 — Bounded Contexts

Import Context, Reconciliation Context (core), Financial Entries Context, Rules Context, Workflow Context, Audit Context, Reports Context, Notification Context, Config Context. Dependências: Import→Reconciliation (via eventos); Reconciliation→Financial Entries (command transacional); Rules e Workflow são invocados pelo Reconciliation; Audit é subscriber passivo; Config é lido por todos.

## Parte 5 — Fluxo Completo TO-BE

1. Import: valida, hash, checa reimportação, staging → evento StatementImported.
2. Normalizer: padroniza, deduplica (fitid/hash_linha), marca suspeitos → MovementsNormalized.
3. RulesEngine (pré-matching): aliases, ignorados, enriquecimento → RulesApplied.
4. MatchingEngine: 1x1, 1xN, Nx1, NxN (subset-sum com poda), fuzzy → CandidatesFound.
5. DecisionEngine: score ≥ auto → AutoMatched; ≥ review → SuggestionCreated; sem candidato → Pendente; empate → Conflito.
6. Fila de Revisão (SoD: revisor ≠ importador) → aprova/rejeita/divide.
7. ReconciliationService (transacional): cria vínculo imutável, chama Baixa (RPC única), atualiza workflow → BaixaPosted.
8. AuditService: ledger append-only com hash-chain.
9. Indicadores: KPIs quase real-time.
10. ClosingService: fecha período, exige aprovação para reabrir.

## Parte 6 — Engine de Matching

Pipeline em estágios com short-circuit: filtro grosso (mesma conta, período, sinal) → estratégias em ordem: chave natural (nsu/e2e_id) → 1x1 exato → 1xN → Nx1 → NxN (limitado N≤10) → fuzzy. Score 0–1 composto: chave natural 0.40, valor exato 0.25, decaimento por data 0.15, similaridade descrição 0.10, regra explícita 0.10 (pesos configuráveis). Tolerâncias parametrizáveis (valor abs/%, data ±N dias, similaridade). Prioridades: regra manual > chave natural > 1x1 exato > composto > fuzzy. Empate dentro de δ=0.05 → CONFLITO. Fallback: PENDENTE + sugestão de "criar título avulso". Engine é função pura: idempotente, sem efeitos colaterais.

## Parte 7 — Engine de Regras

Regra = (escopo, condição, ação, prioridade, versão, vigência, autor). Ações: classificar, ignorar, sugerir_conta, aplicar_tolerância, redirecionar_revisor, alertar. Hierarquia Global → Empresa → Banco → Conta → Usuário (mais específica sobrepõe). Detecção de conflito em tempo de criação. Simulador "e-se" antes de publicar. Toda edição gera nova versão; execução registra (regra_id, versão, movimento_id, resultado).

## Parte 8 — Workflow

Estados: IMPORTED → NORMALIZED → CLASSIFIED → (SUGGESTED | AUTO_MATCHED | IGNORED) → IN_REVIEW → RECONCILED → POSTED → AUDITED → CLOSED, com transições REVERSED e REJECTED. Cada transição registra (from, to, actor, motivo, timestamp).

## Parte 9 — Modelo Conceitual de Dados

Entidades: Empresa, ContaBancária, ExtratoImportação, MovimentoBancário, TítuloFinanceiro, Conciliação, BaixaFinanceira, Regra, ExecuçãoRegra, Sugestão, Score, EventoDomínio, TrilhaAuditoria, Workflow, Configuração, Usuário, Papel, Indicador, Notificação. Relações principais: Empresa 1—N Conta; Conta 1—N Extrato; Extrato 1—N Movimento; Movimento N—N Título via Conciliação; Conciliação 1—1 Baixa; Regra N—N Movimento via ExecuçãoRegra; EventoDomínio referencia qualquer agregado por (tipo, id). Invariantes: um movimento em uma única conciliação ativa; baixa exige conciliação; reimportação por hash não duplica; período fechado é imutável.

## Parte 10 — Serviços

ImportService, NormalizerService, RulesEngineService, MatchingEngineService (puro), DecisionService, ReconciliationService, PostingService (Baixa), WorkflowService, AuditService, HistoryService, MetricsService, NotificationService, ConfigService, ClosingService, AdapterService (I/O). Cada um expõe contrato tipado com implementação substituível.

## Parte 11 — Eventos

StatementImported, MovementsNormalized, RuleExecuted, CandidatesFound, AutoMatched, SuggestionCreated, ReconciliationApproved, ReconciliationRejected, BaixaPosted, ReconciliationReversed, PeriodClosed, PeriodReopened, AuditRecordAppended, WorkflowTransitioned. Entrega via outbox pattern (gravado na mesma transação, entregue por consumidor idempotente).

## Parte 12 — Estados

Arquivo: RECEIVED → VALIDATED → PARSED → STORED → SUPERSEDED | REJECTED_FILE. Movimento: IMPORTED → NORMALIZED → CLASSIFIED → (SUGGESTED | AUTO_MATCHED | IGNORED) → RECONCILED → POSTED → AUDITED → CLOSED | REVERSED. Conciliação: DRAFT → PENDING_APPROVAL → APPROVED → POSTED → AUDITED → CLOSED | REVERSED. Baixa: PENDING → POSTED → REVERSED. Regra: DRAFT → PUBLISHED → DEPRECATED. Período: OPEN → CLOSING → CLOSED → REOPENED.

## Parte 13 — Tratamento de Exceções

Múltiplos candidatos → revisão marcada CONFLITO; sem candidatos → PENDENTE com sugestão avulsa; divergência de valor dentro/fora da tolerância; duplicidade de arquivo por hash; duplicidade de linha por (banco, conta, fitid|hash_linha); baixa parcial com saldo residual; estorno como operação inversa auditada; rollback via RPC atômica; conflito de lock com retry exponencial → revisão; arquivo corrompido → REJECTED_FILE; timeout API → retry idempotente por request_id; RLS negada → erro tipado FORBIDDEN; fechamento de período bloqueado por constraint.

## Parte 14 — Observabilidade

Logs estruturados via logger.ts (nunca console.*), com trace_id, empresa_id, usuario_id, agregado, evento, duração. Métricas técnicas (p95 import/matching/baixa, erro, profundidade de fila) e de negócio (% auto, tempo até conciliação, backlog, SLA). Traces do clique ao RPC. Eventos como fonte da timeline. Alertas por fila/erro/backlog. Dashboards SRE e Controller.

## Parte 15 — Segurança

RBAC via user_permissions com papéis conciliacao.importador/.revisor/.aprovador/.auditor/.admin. SoD parametrizável. RLS obrigatória em toda tabela; GRANT explícito por tabela pública. Aprovação N-olhos para reabertura, estorno e edição retroativa. Eventos e trilha INSERT-only com trigger anti-UPDATE/DELETE. Hash-chain tamper-evident. LGPD: mascaramento de contraparte PF; anonimização por RPC. Credenciais bancárias no Vault. Auditoria de acesso.

## Parte 16 — Performance

Índices (empresa_id, conta_id, data), (hash_linha), (fitid), parcial em status pendente. Particionamento por empresa_id + mês. Paginação por cursor. Virtualização (react-virtual). Cache react-query + invalidação por evento. Fila pgmq para import/matching pesado. Batch RPC para baixa em lote. Concorrência via SELECT FOR UPDATE SKIP LOCKED e advisory locks. Materialized views incrementais para dashboards. Read replicas futuras. Metas: import 100k < 60s; matching 100k < 120s; baixa lote 1k < 5s.

## Parte 17 — Escalabilidade

Adapter pattern para novos bancos/gateways. Suporte a OFX, CNAB240/400, PIX (webhook+polling), Open Finance (OAuth+consent), APIs proprietárias, gateways (Stripe/Paddle). Multi-moeda com moeda-base configurável. Multi-empresa/multi-filial via empresa_id + filial_id em tudo. Webhooks com assinatura e idempotência por event_id. Regras extensíveis sem deploy.

## Parte 18 — UX Conceitual

Dashboard de KPIs; Painel de Revisão com filtros salvos e ações em lote; side panel com timeline por agregado; comparador de candidatos em CONFLITO; batch actions com preview idempotente; timeline por movimento e conciliação; atalhos de teclado; QueryState para empty/loading/error; mobile-first para aprovação.

## Parte 19 — Evolução Futura (IA/ML)

Feature store derivada de eventos; modelo de score complementar plugável (peso default 0); sugestão de regras por padrão; detecção de anomalias; predição de inconsistências; assistente conversacional. Estratégia opcional — nunca dependência.

## Parte 20 — ADRs (resumo — detalhes em ADR-CONCILIACAO.md)

ADR-001 Postgres/Supabase como store; ADR-002 Clean Architecture leve; ADR-003 Regras em dados versionados; ADR-004 Matching como função pura; ADR-005 Baixa via RPC transacional única; ADR-006 Outbox pattern; ADR-007 Trilha imutável com hash-chain; ADR-008 Fila pgmq (sem broker externo); ADR-009 Fechamento bloqueado no banco; ADR-010 IA/ML opcional.

## Parte 21 — Roadmap (resumo — detalhes em ROADMAP-ARQUITETURAL.md)

Fase 0 Fundacional (atomicidade, ledger, SoD, RLS, observabilidade); Fase 1 Núcleo TO-BE (ports & adapters, RulesEngine, MatchingEngine puro, Decision, Workflow, outbox); Fase 2 Escala (partition, MVs, pgmq, batch RPC); Fase 3 Extensibilidade (CNAB, PIX, Open Finance, multi-moeda); Fase 4 Inteligência; Fase 5 Governança avançada.

## Parte 22 — Riscos

Regressão em baixas → strangler fig + feature flag + testes de contrato. Baixa duplicada → Fase 0 obrigatória. Legado sem hash_linha → backfill idempotente. Curva de UI → rollout gradual. Over-engineering → monólito modular com pgmq. RLS em nova tabela → checklist CREATE→GRANT→RLS→POLICY. Perda de trilha na migração → snapshot prévio. NxN explosivo → poda + teto + timeout.

## Parte 23 — Critérios de Qualidade

% auto-conciliação ≥ 75% em 6m e ≥ 85% em 12m; tempo médio até conciliação ≤ 2 dias úteis; p95 import 100k ≤ 60s; p95 matching 100k ≤ 120s; p95 baixa ≤ 500ms; cobertura de auditoria 100%; rastreabilidade 100%; MTTR ≤ 1 dia útil; novo adapter ≤ 5 dias-dev; reabertura sem trilha = 0; baixas divergentes em produção = 0; cobertura de testes do core ≥ 80%.

## Parte 24 — Visão Executiva

O módulo atual acumula dívida crítica (baixas não transacionais, try/catch silencioso, ausência de trilha imutável, RLS permissivo, regras codificadas, matching sem score, sem SoD, sem observabilidade) — cada uma é risco financeiro real. A nova arquitetura elimina baixas parciais/inconsistentes, duplicidade de importação, regras engessadas, falta de trilha, fila sem SLA. Ganhos operacionais: menos retrabalho, maior automação, revisão focada, encerramento confiável. Ganhos de performance: pipeline assíncrono e pgmq preparam para 10⁷ lançamentos. Ganhos de governança: trilha imutável, SoD, N-olhos, fechamento com bloqueio, LGPD nativa. Posicionamento: o módulo passa a conversar conceitualmente de igual para igual com SAP S/4HANA, TOTVS RM, Oracle NetSuite e Dynamics 365, preservando a simplicidade do stack (React + Supabase).
