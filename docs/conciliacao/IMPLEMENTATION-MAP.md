# Implementation Map — Conciliação

Mapa consolidado de módulos, componentes, serviços e interações.

## Camadas

```text
UI (Pages/Components)
   │  hooks (useConciliacao*, useMatching*, useImportacao*)
   ▼
Application Services (importService, matchingService, ruleService, workflowService, conciliacaoService, baixaService, auditService, dashboardService)
   │  ports/adapters
   ▼
Domain (regras puras: scoring, normalização, invariantes)
   │
   ▼
Infra (Supabase RPC, Storage, Outbox worker, Edge Functions, Logger)
   │
   ▼
Banco (tabelas: financeiro_extrato_importacoes, financeiro_lancamentos, conciliacao_pares, conciliacao_bancaria, financeiro_baixas, financeiro_regras, financeiro_aliases, financeiro_auditoria, financeiro_matching_feedback, outbox)
```

## Módulos e Interações

| Módulo         | Depende de                          | Utilizado por                         |
| -------------- | ----------------------------------- | ------------------------------------- |
| Importação     | Storage, Parser                     | Normalização                          |
| Parser         | Infra de arquivo                    | Normalização                          |
| Normalização   | Aliases, Configurações              | Matching, Regras                      |
| Matching       | Normalização, Regras, Feedback      | Workflow                              |
| Regras         | Configurações, Matching             | Workflow, Auditoria                   |
| Workflow       | Matching, Regras, RBAC              | Conciliação                           |
| Conciliação    | Workflow, RPC                       | Baixa, Auditoria                      |
| Baixa          | Conciliação, RPC                    | Auditoria, Dashboard                  |
| Auditoria      | Todos (via Outbox)                  | Governança                            |
| Dashboard      | Auditoria, Baixa, Conciliação       | Usuário                               |
| Indicadores    | Outbox                              | Dashboard, Alertas                    |
| Configurações  | RBAC                                | Regras, Matching, Importação          |
```

## Diagrama de Alto Nível

```text
[UI] ──► [Hooks] ──► [Services] ──► [RPC/Edge] ──► [DB]
                                    │
                                    ▼
                                 [Outbox] ──► [Worker] ──► [Indicadores/Dashboard]
                                    │
                                    ▼
                                [Auditoria/Ledger]
```
