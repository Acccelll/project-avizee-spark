# MODELO CONCEITUAL — CONCILIAÇÃO

Modelo conceitual de alto nível. Sem DDL, sem detalhes de implementação.

## Entidades

- **Empresa** — tenant raiz.
- **Filial** — subdivisão organizacional.
- **Banco** — instituição financeira.
- **ContaBancária** — conta de uma empresa/filial em um banco.
- **ExtratoImportação** — pacote de dados importado (arquivo/API).
- **MovimentoBancário** — linha normalizada do extrato.
- **TítuloFinanceiro** — AP/AR pendente de baixa.
- **Sugestão** — proposta de vínculo movimento↔título(s) com score.
- **Conciliação** — vínculo formal aprovado.
- **BaixaFinanceira** — efeito financeiro consolidado.
- **Estorno** — inverso auditado de baixa/conciliação.
- **Regra** — predicado parametrizável versionado.
- **ExecuçãoRegra** — registro de aplicação de uma regra em um movimento.
- **EventoDomínio** — fato imutável do sistema.
- **TrilhaAuditoria** — projeção append-only com hash-chain sobre eventos.
- **Workflow** — estado corrente + histórico por agregado.
- **Configuração** — parâmetros por (Empresa, Escopo).
- **Usuário**, **Papel**, **Permissão** — identidade e RBAC.
- **Notificação** — mensagem derivada de evento.
- **Indicador** — projeção materializada de KPI.
- **Período** — janela contábil (Aberto/Fechando/Fechado/Reaberto).

## Relacionamentos (alto nível)

```text
Empresa 1─N Filial 1─N ContaBancária N─1 Banco
ContaBancária 1─N ExtratoImportação 1─N MovimentoBancário
MovimentoBancário N─N TítuloFinanceiro (via Conciliação)
Conciliação 1─1 BaixaFinanceira
Conciliação 1─N Estorno (0..N)
MovimentoBancário 1─N Sugestão
Regra 1─N ExecuçãoRegra N─1 MovimentoBancário
EventoDomínio N─1 (Agregado polimórfico)
TrilhaAuditoria 1─1 EventoDomínio (hash encadeado)
Workflow 1─1 (Agregado)
Configuração N─1 Empresa
Usuário N─N Papel N─N Permissão
Indicador ← projeção de EventoDomínio
Período 1─N MovimentoBancário / Conciliação / Baixa
```

## Invariantes de Domínio

- Todo agregado tem `empresa_id` obrigatório.
- Movimento pertence a exatamente uma ContaBancária.
- Um Movimento não pode estar em duas Conciliações ativas simultaneamente.
- Baixa exige Conciliação ativa; Estorno exige Baixa existente.
- Reimportação de ExtratoImportação com mesmo `hash_arquivo` não cria novos Movimentos.
- Movimentos duplicados (mesmo `banco+conta+fitid` ou `banco+conta+hash_linha`) são ignorados silenciosamente com log.
- Período `CLOSED` bloqueia qualquer mutação em Movimentos/Conciliações/Baixas daquele período (salvo reabertura formal).
- Regra em `DRAFT` não é aplicada; apenas `PUBLISHED` e dentro da vigência.
- Score de matching ∈ [0, 1].
- Sugestão com múltiplos candidatos empatados (δ ≤ 0.05) é marcada como CONFLITO.

## Serviços de Domínio (conceituais)

Import, Normalizer, RulesEngine, MatchingEngine (puro), Decision, Reconciliation, Posting, Workflow, Audit, Closing, Config, Notification, Metrics, Adapter (I/O).

## Eventos de Domínio (fatos)

StatementImported, MovementsNormalized, RuleExecuted, CandidatesFound, AutoMatched, SuggestionCreated, ReconciliationApproved, ReconciliationRejected, BaixaPosted, ReconciliationReversed, PeriodClosed, PeriodReopened, AuditRecordAppended, WorkflowTransitioned, ConfigChanged.

## Fluxos Conceituais

1. Import → Normalização → Regras → Matching → Decisão → (Auto|Sugestão|Pendente|Conflito).
2. Revisão humana → Reconciliation → Posting → Auditoria → Indicadores.
3. Estorno reabre workflow com trilha completa.
4. Closing consolida período, bloqueia mutações.

## Papéis (RBAC)

- `conciliacao.importador` — importa e visualiza.
- `conciliacao.revisor` — aprova/rejeita/divide sugestões.
- `conciliacao.aprovador` — aprova estornos e reaberturas.
- `conciliacao.auditor` — leitura de trilha completa.
- `conciliacao.admin` — configura regras, tolerâncias, contas.

## Projeções e Views (conceituais)

- Backlog por conta/idade.
- % auto-conciliação por período.
- SLA (tempo entre importação e conciliação).
- Distribuição de score.
- Regras mais/menos aplicadas.
- Exceções por tipo e por revisor.
