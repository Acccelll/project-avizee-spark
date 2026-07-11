# ADRs — CONCILIAÇÃO FINANCEIRA

Registro das decisões arquiteturais da nova geração. Formato: Problema · Alternativas · Escolha · Justificativa · Trade-offs · Impactos · Riscos.

## ADR-001 — Postgres/Supabase como store transacional único

- **Problema**: Onde persistir movimentos, conciliações, baixas, eventos e trilha.
- **Alternativas**: (a) Postgres/Supabase; (b) Postgres + banco documental (Mongo); (c) Postgres + event store (EventStoreDB).
- **Escolha**: (a) — permanecer em Postgres/Supabase.
- **Justificativa**: transações ACID nativas, RLS multi-tenant já em uso, ecossistema do projeto, pgmq para fila, particionamento nativo. Elimina complexidade cross-store.
- **Trade-offs**: menos flexível para agregações analíticas massivas — mitigado por materialized views e read replicas futuras.
- **Impactos**: preserva stack; reduz risco de migração.
- **Riscos**: crescimento >10⁸ linhas exige particionamento agressivo (previsto no roadmap).

## ADR-002 — Clean Architecture leve (Ports & Adapters)

- **Problema**: Acoplamento atual entre UI, Supabase e regras de negócio.
- **Alternativas**: (a) Ports & Adapters; (b) MVC clássico; (c) Microserviços.
- **Escolha**: (a).
- **Justificativa**: isola domínio (testável, evolutivo) sem overhead de microserviços.
- **Trade-offs**: mais camadas/arquivos iniciais.
- **Impactos**: base para todos os demais ADRs.
- **Riscos**: adoção parcial gera pior dos dois mundos — mitigar com guidelines e revisão.

## ADR-003 — Regras em dados versionados, não em código

- **Problema**: Regras atuais estão hardcoded, exigem deploy.
- **Alternativas**: (a) Motor parametrizável em dados; (b) DSL própria; (c) Manter em código.
- **Escolha**: (a).
- **Justificativa**: usuários-chave (financeiro) editam sem deploy; auditável; versionável.
- **Trade-offs**: motor precisa ser robusto e testado; UI de regras não é trivial.
- **Impactos**: acelera adaptação; reduz backlog de dev.
- **Riscos**: regras conflitantes → mitigar com detecção em criação e simulador.

## ADR-004 — Matching como função pura

- **Problema**: Motor atual mistura leitura, decisão e escrita.
- **Alternativas**: (a) Função pura sem side-effects; (b) Serviço com escrita direta.
- **Escolha**: (a).
- **Justificativa**: testável, idempotente, paralelizável, reprocessável.
- **Trade-offs**: exige orquestração externa para persistir decisão.
- **Impactos**: base para dry-run/simulador e ML plugável.
- **Riscos**: baixo.

## ADR-005 — Baixa via RPC transacional única

- **Problema**: Baixa atual é multi-step, sem atomicidade.
- **Alternativas**: (a) RPC única; (b) Múltiplas queries com saga; (c) Trigger.
- **Escolha**: (a).
- **Justificativa**: garante atomicidade e idempotência (chave natural) sem complexidade de saga.
- **Trade-offs**: RPC longa em SQL; exige testes rigorosos.
- **Impactos**: elimina risco P0 de baixa parcial.
- **Riscos**: manutenção do PL/pgSQL — mitigar com testes de contrato.

## ADR-006 — Outbox pattern para eventos

- **Problema**: Como publicar eventos com garantia de entrega e sem broker externo.
- **Alternativas**: (a) Outbox no Postgres; (b) Broker externo (Kafka/RabbitMQ); (c) Chamada síncrona.
- **Escolha**: (a).
- **Justificativa**: mesma transação do agregado; consumidor lê tabela outbox; sem infra adicional.
- **Trade-offs**: throughput limitado pelo banco — suficiente por muitos anos.
- **Impactos**: eventos confiáveis; auditoria natural.
- **Riscos**: baixo.

## ADR-007 — Trilha imutável com hash-chain

- **Problema**: Como garantir integridade e tamper-evidence da auditoria.
- **Alternativas**: (a) Append-only + hash encadeado; (b) Simples INSERT; (c) Log externo assinado.
- **Escolha**: (a).
- **Justificativa**: detecção de adulteração; conformidade fiscal/LGPD; custo baixo.
- **Trade-offs**: verificação exige percorrer cadeia.
- **Impactos**: eleva postura de governança.
- **Riscos**: baixo.

## ADR-008 — Fila via pgmq

- **Problema**: Como processar import/matching pesado sem bloquear UI.
- **Alternativas**: (a) pgmq; (b) Redis+BullMQ; (c) SQS/RabbitMQ.
- **Escolha**: (a).
- **Justificativa**: nativo Postgres, transacional com dados, sem infra adicional, já usado em email.
- **Trade-offs**: throughput inferior a brokers dedicados — não é o gargalo esperado.
- **Impactos**: elimina picos síncronos; escalabilidade de workers.
- **Riscos**: baixo.

## ADR-009 — Fechamento de período com bloqueio no banco

- **Problema**: Como impedir alteração retroativa em período fechado.
- **Alternativas**: (a) Constraint + trigger + guard na aplicação; (b) Só na aplicação.
- **Escolha**: (a).
- **Justificativa**: defesa em profundidade; garantia mesmo em acesso direto ao DB.
- **Trade-offs**: reabertura exige RPC formal.
- **Impactos**: governança fiscal robusta.
- **Riscos**: baixo.

## ADR-010 — IA/ML como estratégia opcional

- **Problema**: Onde encaixar aprendizado sem criar dependência.
- **Alternativas**: (a) Plugin somado ao score determinístico com peso configurável; (b) Substituição do motor; (c) Não usar.
- **Escolha**: (a).
- **Justificativa**: liga/desliga por empresa; começa com peso 0; evolui sem risco.
- **Trade-offs**: mais complexidade quando ativado.
- **Impactos**: prepara para futuro sem bloquear presente.
- **Riscos**: expectativa de "IA mágica" — mitigar com comunicação clara.

## ADR-011 — Strangler Fig para migração

- **Problema**: Como substituir o módulo atual sem parar o negócio.
- **Alternativas**: (a) Strangler Fig com feature flag por empresa; (b) Big-bang; (c) Refactor incremental in-place.
- **Escolha**: (a).
- **Justificativa**: coexistência controlada; rollback trivial; validação por empresa.
- **Trade-offs**: manutenção dupla temporária.
- **Impactos**: risco de negócio minimizado.
- **Riscos**: prolongar a coexistência — definir data-limite de descontinuação.

## ADR-012 — Domain Events como fonte da timeline

- **Problema**: Como reconstruir histórico sem tabelas paralelas frágeis.
- **Alternativas**: (a) Domain events como fonte; (b) Snapshot em cada tabela; (c) Log de aplicação.
- **Escolha**: (a).
- **Justificativa**: timeline natural, extensível, base para métricas e ML.
- **Trade-offs**: consultas de linha do tempo dependem de projeções.
- **Impactos**: unifica auditoria, métrica e UX.
- **Riscos**: baixo.
