# Component Responsibility Matrix — Conciliação

| Elemento                     | Tipo       | Responsabilidade                                        | Depende de                      | Utilizado por                    |
| ---------------------------- | ---------- | ------------------------------------------------------- | ------------------------------- | -------------------------------- |
| ConciliacaoImportarPage      | Page       | Upload e status de importação                            | useImportacaoUpload             | Router                           |
| ConciliacaoWorkbench         | Page       | Sugestões, ações de conciliação, drill-down             | useMatchingSugestoes, ações     | Router                           |
| ConciliacaoDashboardPage     | Page       | KPIs e listas operacionais                              | useDashboardConciliacao         | Router                           |
| ConfigRegrasPage             | Page       | CRUD versionado de regras                                | useRegrasVigentes               | Router (admin)                   |
| ConfigAliasesPage            | Page       | CRUD de aliases de contraparte                           | useAliases                      | Router (admin)                   |
| BaixaLotePage                | Page       | Baixa em lote com validação                              | useBaixaExecucao                | Router                           |
| useImportacaoUpload          | Hook       | Orquestrar upload + dedupe                               | importService                   | ConciliacaoImportarPage          |
| useMatchingSugestoes         | Hook       | Buscar Top-N sugestões                                   | matchingService                 | Workbench                        |
| useConciliacaoAcoes          | Hook       | Aprovar/rejeitar/split                                   | conciliacaoService              | Workbench                        |
| useBaixaExecucao             | Hook       | Executar baixa/estorno                                   | baixaService                    | BaixaLotePage, Workbench         |
| useAuditoriaTrilha           | Hook       | Ler ledger por lançamento                                | auditService                    | Drawer de auditoria              |
| useDashboardConciliacao      | Hook       | KPIs e séries                                            | dashboardService                | Dashboard                        |
| importService                | Service    | Ingerir/dedupe/persistir                                 | RPC, Storage                    | Hooks                            |
| matchingService              | Service    | Scoring + Top-N + feedback                               | ruleService, DB                 | Hooks                            |
| ruleService                  | Service    | Aplicar regras vigentes                                  | DB                              | matchingService, workflowService |
| workflowService              | Service    | Estados/transições                                       | RBAC                            | conciliacaoService               |
| conciliacaoService           | Service    | Vincular pares                                           | RPC, workflowService            | baixaService                     |
| baixaService                 | Service    | Baixa/estorno transacional                               | RPC                             | Hooks                            |
| auditService                 | Service    | Append + verificação de hash-chain                       | RPC                             | Hooks                            |
| dashboardService             | Service    | Agregações e leituras                                    | DB/views                        | Hooks                            |
| importacaoStore              | Store      | Estado UI da importação                                  | –                               | Page                             |
| matchingStore                | Store      | Estado UI do workbench                                   | –                               | Page                             |
| conciliacaoStore             | Store      | Seleções e filtros                                       | –                               | Page                             |
| baixaStore                   | Store      | Fila local de baixa                                      | –                               | Page                             |
| dashboardStore               | Store      | Filtros/período                                          | –                               | Page                             |
| financeiro_extrato_importacoes | Tabela   | Registros brutos + hash                                  | –                               | importService                    |
| financeiro_lancamentos       | Tabela     | Lançamentos financeiros                                  | –                               | matching/baixa                   |
| conciliacao_pares            | Tabela     | Vínculos                                                 | –                               | conciliacao/baixa                |
| financeiro_baixas            | Tabela     | Baixas efetivadas                                        | –                               | baixa/dashboard                  |
| financeiro_regras            | Tabela     | Regras versionadas                                       | –                               | ruleService                      |
| financeiro_aliases           | Tabela     | Aliases de contraparte                                   | –                               | normalização                     |
| financeiro_auditoria         | Tabela     | Trilha + hash-chain                                      | –                               | auditService                     |
| financeiro_matching_feedback | Tabela     | Feedback de sugestões                                    | –                               | matchingService                  |
| outbox                       | Tabela     | Eventos assíncronos                                      | –                               | Worker                           |
| import.received              | Evento     | Início do pipeline                                       | Importação                      | Parser                           |
| conciliation.approved        | Evento     | Vínculo confirmado                                       | Workflow                        | Auditoria, Dashboard             |
| settlement.executed          | Evento     | Baixa efetivada                                          | Baixa                           | Auditoria, Dashboard             |
| settlement.reversed          | Evento     | Estorno                                                  | Baixa                           | Auditoria, Dashboard             |
