# ARQUITETURA CONCILIAÇÃO — DETALHAMENTO

Complemento técnico-conceitual do `CONCILIACAO-TO-BE.md`. Nenhuma implementação, nenhum SQL.

## 1. Camadas

- **Apresentação** (React): componentes puros, hooks tipados, sem regra de negócio; consomem Application Services.
- **Aplicação**: use cases, orquestração, transação, autorização (`can()`), tradução DTO ↔ domínio.
- **Domínio**: entidades, agregados (Extrato, Conciliação, Baixa), value objects (Money, Periodo, Tolerancia), invariantes, eventos.
- **Infraestrutura**: adapters (OFX/CNAB/PIX/API), repositórios (Supabase), storage, fila (pgmq), logger, notificação.

Regra de dependência: Apresentação → Aplicação → Domínio ← Infraestrutura. Domínio não conhece frameworks.

## 2. Domínios e Responsabilidades

| Domínio | Owns | Publica | Consome |
|---|---|---|---|
| Import | Arquivo, staging, hash | StatementImported | (nenhum) |
| Normalization | Movimento normalizado | MovementsNormalized | StatementImported |
| Rules | Regras + execuções | RuleExecuted | MovementsNormalized |
| Matching | Candidatos + score | CandidatesFound | RulesApplied |
| Decision | Roteamento | AutoMatched, SuggestionCreated | CandidatesFound |
| Reconciliation | Vínculo formal | ReconciliationApproved/Rejected/Reversed | Auto/Suggestion/UserAction |
| Posting | Baixa financeira | BaixaPosted | ReconciliationApproved |
| Workflow | Estado + transição | WorkflowTransitioned | (todos) |
| Audit | Ledger imutável | AuditRecordAppended | (todos) |
| Closing | Fechamento período | PeriodClosed/Reopened | (comando) |
| Config | Parâmetros | ConfigChanged | (comando) |

## 3. Serviços — Contratos Conceituais

- ImportService: `importar(arquivo, contexto) → resultado idempotente por hash`.
- NormalizerService: `normalizar(movimentosBrutos, config) → movimentosCanônicos`.
- RulesEngineService: `avaliar(movimento, escopo) → decisões[]`.
- MatchingEngineService (puro): `encontrar(movimento, universoTítulos, config) → candidatos[]`.
- DecisionService: `decidir(candidatos, thresholds) → auto | sugestao | pendente | conflito`.
- ReconciliationService: `aprovar(sugestao, ator) → conciliação` (transacional, idempotente por chave natural).
- PostingService: `baixar(conciliação) → baixa` (RPC única, atômica).
- WorkflowService: `transicionar(agregado, ação, ator) → novoEstado` (valida transição).
- AuditService: `registrar(evento) → registro append-only encadeado`.
- ClosingService: `fechar(período)` / `reabrir(período, aprovadores)`.
- NotificationService: `notificar(evento, canal, destinatários)`.
- MetricsService: `kpis(filtro) → indicadores`.

## 4. Fluxos

### 4.1 Import
Recebe arquivo → valida schema → calcula hash → checa reimportação (deduplicação por hash) → persiste raw em staging → publica `StatementImported`.

### 4.2 Normalização
Consome `StatementImported` → padroniza (moeda, sinal, data, descrição) → resolve conta bancária (chave natural: banco+agência+conta) → deduplica linha (fitid ou hash_linha) → marca suspeitos → publica `MovementsNormalized`.

### 4.3 Matching + Decisão
RulesEngine pré-processa (aliases/ignorados) → MatchingEngine gera candidatos multi-estratégia → DecisionService roteia por score → publica `AutoMatched` (transação segue direto) ou `SuggestionCreated` (fila).

### 4.4 Revisão + Conciliação
UI consome fila com SoD → usuário aprova/rejeita/divide → ReconciliationService cria vínculo transacional + chama PostingService (baixa RPC atômica) → publica `ReconciliationApproved` + `BaixaPosted`.

### 4.5 Estorno
Comando de estorno valida permissão → cria movimento inverso auditado → reabre workflow → publica `ReconciliationReversed`.

### 4.6 Fechamento
ClosingService verifica pendências críticas → trava período → publica `PeriodClosed`. Reabertura exige aprovadores distintos.

## 5. Estados Consolidados

Ver `CONCILIACAO-TO-BE.md` Parte 12. Cada transição: `(from, to, actor, motivo, timestamp, trace_id)`.

## 6. Dependências entre Contexts

- Import → Reconciliation: assíncrono, via eventos (baixo acoplamento).
- Reconciliation → Posting: síncrono, RPC transacional única.
- Rules ↔ Reconciliation: leitura pura (Rules não escreve no core).
- Workflow: transversal, invocado em cada mutação.
- Audit: subscriber passivo de todos.
- Config: fonte lida por todos, escrita apenas por si.
- Notification/Reports: consumidores; sem escrita no core.

## 7. Regras Transversais

Idempotência por chave natural em todo comando escritor. Toda escrita crítica passa por RPC transacional. Toda operação registra evento na mesma transação (outbox). Toda leitura respeita RLS multi-tenant. Toda exceção é tipada — nunca silenciada.

## 8. Testabilidade

- Domínio: testes unitários puros (matching, regras, score, workflow).
- Aplicação: testes de use case com adapters fake.
- Infraestrutura: testes de contrato (adapters OFX/CNAB/PIX).
- End-to-end: importação → baixa → auditoria com dados sintéticos.
- Testes de regressão financeira: dataset canônico com resultado esperado.

## 9. Extensibilidade

Novo banco/formato = novo Adapter respeitando o Port de Import. Nova estratégia de matching = plugin no pipeline com ordem/prioridade configurável. Novo canal de notificação = adapter. Novo relatório = subscriber de eventos + projeção materializada.

## 10. Governança

SoD por papel; aprovação N-olhos configurável; trilha imutável hash-encadeada; fechamento de período com bloqueio no banco; versionamento de regras; auditoria de acesso a dados sensíveis.
