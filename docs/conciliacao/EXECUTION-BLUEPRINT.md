# Execution Blueprint — Conciliação Financeira

> Etapa 9 — Blueprint executável. Consolida a arquitetura (Etapa 5) e o plano técnico (Etapa 6) em instruções operacionais suficientes para execução por equipe ou IA (Claude/Lovable), sem novas decisões arquiteturais.

Domínios: Importação, Parser, Normalização, Matching, Motor de Regras, Workflow, Conciliação, Baixa, Auditoria, Dashboard, Indicadores, Configurações.

## Parte 1 — Mapa por Domínio

| Domínio        | Objetivo                                   | Entradas                          | Saídas                              | Produtores                | Consumidores                     |
| -------------- | ------------------------------------------ | --------------------------------- | ----------------------------------- | ------------------------- | -------------------------------- |
| Importação     | Ingestão de extratos e faturas             | Arquivos OFX/CNAB/CSV             | Registros brutos + hash             | Uploader/Job              | Parser                           |
| Parser         | Estruturar arquivo em linhas tipadas       | Arquivo bruto                     | Movimentos tipados                  | Importação                | Normalização                     |
| Normalização   | Padronizar campos e enriquecer             | Movimentos tipados                | Movimentos canônicos                | Parser                    | Matching, Regras                 |
| Matching       | Sugerir/pontuar candidatos                 | Movimentos + lançamentos abertos  | Score + Top-N candidatos            | Normalização              | Workflow, Conciliação            |
| Motor Regras   | Aplicar regras por empresa                 | Movimentos + histórico            | Ações/anotações                     | Configurações             | Matching, Workflow               |
| Workflow       | Orquestrar estado de conciliação           | Sugestões + ações de usuário      | Transições + tarefas                | Matching/Regras           | Conciliação                      |
| Conciliação    | Vincular movimento(s) a lançamento(s)      | Pares aprovados                   | `conciliacao_pares` + evento        | Workflow                  | Baixa, Auditoria                 |
| Baixa          | Efetivar baixa atomicamente                | Conciliação aprovada              | `financeiro_baixas` + saldo         | Conciliação               | Auditoria, Dashboard             |
| Auditoria      | Trilha imutável hash-chain                 | Todas as transições               | Ledger íntegro                      | Todos                     | Governança, Suporte              |
| Dashboard      | Visão operacional                          | Ledger + agregações               | KPIs, listas, filtros               | Baixa/Conciliação         | Usuário final                    |
| Indicadores    | Métricas e SLA                             | Eventos + agregados               | Séries temporais                    | Outbox                    | Observabilidade                  |
| Configurações  | Regras, toggles, aliases                   | UI admin                          | `financeiro_regras`, flags          | Admin                     | Regras, Matching                 |

## Parte 2 — Blueprint por Domínio (resumo)

Detalhamento por domínio em `DOMAIN-IMPLEMENTATION-GUIDE.md`. Cada domínio segue o mesmo esqueleto: responsabilidades, arquivos existentes (reutilizar/adaptar/substituir/remover), novos elementos, dependências, critérios de aceite, testes, rollback, riscos.

## Parte 3 — Matriz de Responsabilidades

Ver `COMPONENT-RESPONSIBILITY-MATRIX.md`.

## Parte 4 — Sequência de Implementação

```text
Fundação (RLS/RBAC/logger/Outbox)
        │
        ▼
Configurações + Regras ──┐
        │                │
        ▼                ▼
   Importação ──► Parser ──► Normalização
                                │
                                ▼
                    Matching  ◄── Motor de Regras
                                │
                                ▼
                            Workflow
                                │
                                ▼
                          Conciliação
                                │
                                ▼
                              Baixa
                                │
                                ▼
                    Auditoria (transversal)
                                │
                                ▼
                Dashboard  ◄── Indicadores
```

Paralelismo permitido: Configurações ∥ Auditoria (transversal) ∥ Dashboard (mock inicial).
Bloqueadores: Fundação bloqueia todos; Normalização bloqueia Matching; Workflow bloqueia Baixa.

## Parte 5 — Fluxo Técnico

```text
Uploader → Importação → Parser → Normalizador → Rule Engine → Matching Engine
       → Decision Engine → Workflow → Persistence (RPC) → Audit (hash-chain)
       → Outbox → Indicadores → Dashboard
```

Transições: cada seta é uma chamada síncrona quando dentro da mesma unidade transacional (Persistence + Audit) e assíncrona via Outbox para consumidores externos (Indicadores, Dashboard, integrações).

## Parte 6 — Fluxo de Dados

Origem (banco/arquivo) → Transformação (parser/normalização) → Persistência (`financeiro_extrato_importacoes`, `financeiro_lancamentos`, `conciliacao_pares`, `financeiro_baixas`) → Eventos (Outbox) → Consultas (views/paginadas) → Resposta UI → Auditoria (`financeiro_auditoria` + ledger).

## Parte 7 — Eventos

| Evento                          | Origem       | Consumidores                | Impacto                     |
| ------------------------------- | ------------ | --------------------------- | --------------------------- |
| `import.received`               | Importação   | Parser                      | Inicia pipeline             |
| `movement.normalized`           | Normalização | Matching, Regras            | Habilita sugestões          |
| `matching.suggested`            | Matching     | Workflow                    | Cria tarefa/decisão         |
| `rule.applied`                  | Regras       | Matching, Auditoria         | Registro determinístico     |
| `conciliation.approved`         | Workflow     | Conciliação, Auditoria      | Vincula pares               |
| `settlement.executed`           | Baixa        | Auditoria, Dashboard        | Atualiza saldo              |
| `settlement.reversed`           | Baixa        | Auditoria, Dashboard        | Estorno auditável           |
| `ledger.appended`               | Auditoria    | Indicadores                 | Métricas                    |

Todos os eventos passam por Outbox com idempotência por `operation_id`.

## Parte 8 — Dependências Técnicas

Ver `TRACEABILITY-MATRIX.md` (linhas Domínio → Serviços → Hooks → Stores → Banco → APIs → Eventos → UI).

## Parte 9 — Plano de Arquivos

Definido por domínio em `DOMAIN-IMPLEMENTATION-GUIDE.md` (Arquivos existentes envolvidos / novos / modificados / removidos / dependências / motivo).

## Parte 10 — Rastreabilidade

Ver `TRACEABILITY-MATRIX.md`.

## Parte 11 — Estratégia de Testes

| Domínio       | Unit | Integração | E2E | Carga | Regressão | Perf | Segurança |
| ------------- | ---- | ---------- | --- | ----- | --------- | ---- | --------- |
| Importação    | ✅   | ✅         | ✅  | ✅    | ✅        | ✅   | ✅        |
| Parser        | ✅   | ✅         | –   | –     | ✅        | ✅   | –         |
| Normalização  | ✅   | ✅         | –   | –     | ✅        | ✅   | –         |
| Matching      | ✅   | ✅         | ✅  | ✅    | ✅        | ✅   | ✅        |
| Regras        | ✅   | ✅         | ✅  | –     | ✅        | –    | ✅        |
| Workflow      | ✅   | ✅         | ✅  | –     | ✅        | –    | ✅        |
| Conciliação   | ✅   | ✅         | ✅  | ✅    | ✅        | ✅   | ✅        |
| Baixa         | ✅   | ✅         | ✅  | ✅    | ✅        | ✅   | ✅        |
| Auditoria     | ✅   | ✅         | ✅  | –     | ✅        | –    | ✅        |
| Dashboard     | ✅   | ✅         | ✅  | ✅    | ✅        | ✅   | ✅        |

Critérios mínimos: cobertura das RPCs ≥ 80%; dataset canônico verde; testes de segurança RLS/SoD obrigatórios.

## Parte 12 — Critérios de Aceite

Ver `TECHNICAL-CHECKLIST.md` (aplicado por domínio).

## Parte 13 — Estratégia de Rollback

Por domínio: feature toggle desligada por empresa → congelar novos eventos → reverter migrations aditivas por script idempotente → validar via smoke test → preservar dados (append-only, sem drop). Riscos: dessincronização de saldo → mitigar com replay do outbox no snapshot pré-deploy.

## Parte 14 — Observabilidade

Logs estruturados (logger.ts) com `operation_id`, `empresa_id`, domínio, ação; tracing por correlação; métricas técnicas (latência, throughput) e de negócio (auto-match, SLA); alertas em `cron_health`, fila de Outbox e falhas de RPC.

## Parte 15 — Métricas (KPIs)

Tempo médio de processamento por lote, taxa de auto-match (%), conciliações manuais vs. automáticas, tempo médio por operador, falhas por 1k operações, exceções por domínio, saúde do worker de Outbox.

## Parte 16 — Riscos

| Risco                                | Impacto | Prob. | Mitigação                                | Contingência                |
| ------------------------------------ | ------- | ----- | ---------------------------------------- | --------------------------- |
| Regra mal versionada                 | Alto    | Média | Versionamento obrigatório + revisão      | Rollback de regra           |
| Fila de Outbox saturada              | Alto    | Baixa | Alerta + auto-scale worker               | Replay manual + throttling  |
| Divergência de saldo                 | Alto    | Baixa | Idempotência + testes de invariante      | Snapshot + reprocessamento  |
| Import com layout novo               | Médio   | Média | Registro do layout + testes de contrato  | Feature flag por banco      |
| Volumes > 10M                        | Médio   | Baixa | Particionamento planejado                | Batch off-hours             |

## Parte 17 — Checklist Técnico

Ver `TECHNICAL-CHECKLIST.md`.

## Parte 18 — Critérios de Prontidão

Um domínio está pronto quando: (1) blueprint aprovado; (2) dependências resolvidas; (3) migrations e RPCs revisadas; (4) testes definidos e mockáveis; (5) observabilidade prevista; (6) rollback documentado; (7) critérios de aceite mensuráveis; (8) responsáveis atribuídos.

## Parte 19 — Validação Cruzada

Blueprint × TO-BE / ADRs / Roadmap / Requisitos / GAP — sem inconsistências relevantes. Observações registradas: (a) painel de KPIs previsto no roadmap não é entregável desta etapa; (b) IA/ML explicitamente fora do escopo atual (ADR-08).

## Parte 20 — Visão Executiva

- Decisões arquiteturais pendentes: nenhuma.
- Ambiguidades: nenhuma bloqueante.
- Dependências indefinidas: nenhuma.
- Riscos remanescentes: observabilidade de negócio e volumes > 10M (roadmap).
- Pontos de atenção: idempotência ponta a ponta, versionamento de regras, integridade do ledger.
