# CHECKLIST DE IMPLEMENTAÇÃO — CONCILIAÇÃO

Checklist operacional consolidado. Um bloco por épico. Marcar somente quando o item estiver 100% concluído e verificável.

## Template por Épico

Cada épico deve percorrer, em ordem:
- [ ] Análise concluída (leitura de AS-IS, GAPS, TO-BE relacionados)
- [ ] Arquitetura validada (revisão contra ADRs e MODELO-CONCEITUAL)
- [ ] Migração de schema planejada (aditiva, sem breaking)
- [ ] RLS + GRANT desenhados
- [ ] Testes unitários escritos
- [ ] Testes de integração escritos
- [ ] Testes E2E (quando UI/fluxo)
- [ ] Benchmark de performance (quando aplicável)
- [ ] Implementação realizada
- [ ] Code review aprovado
- [ ] Logger e métricas instrumentados
- [ ] Ledger recebendo eventos
- [ ] Runbook criado/atualizado
- [ ] Documentação atualizada
- [ ] Feature flag configurada
- [ ] Rollback validado em staging
- [ ] Homologação aprovada
- [ ] Deploy em piloto
- [ ] Monitoramento de 7 dias sem P0/P1
- [ ] Pronto para expansão

---

## E1 — Fundação
- [ ] `sp_baixar_conciliacao` atômica implementada e testada
- [ ] Ledger criado com hash-chain
- [ ] Job de verificação de cadeia rodando
- [ ] `hash_arquivo` populado em novas importações
- [ ] `hash_linha`/`fitid` únicos por (banco, conta)
- [ ] RLS revisada em todas as tabelas do módulo
- [ ] GRANT explícito por tabela pública
- [ ] SoD importador ≠ aprovador validada
- [ ] Logger estruturado em todos os caminhos críticos
- [ ] Todos os `try/catch` silenciosos removidos

## E2 — Domínio Puro
- [ ] Entidades e VOs criados sem imports de infra
- [ ] Ports (interfaces) definidos
- [ ] Invariantes centralizadas e testadas
- [ ] Cobertura ≥ 80% no domínio

## E3 — Import + Adapters
- [ ] Adapter OFX v2 multi-conta OK contra fixtures reais
- [ ] Staging + hash operacionais
- [ ] Reimportação idempotente verificada
- [ ] UI de progresso disponível

## E4 — Normalização
- [ ] Padronização (valor/data/sinal) coberta por testes
- [ ] Resolução de conta 100% dos casos do dataset canônico
- [ ] Dedup por chave natural sem falso-positivo

## E5 — Rules Engine v1
- [ ] Modelo de regra versionado
- [ ] Hierarquia global→empresa→banco→conta→usuário
- [ ] Detecção de conflito na criação
- [ ] Simulador "e-se" disponível
- [ ] Execução registrada com (regra_id, versão, movimento_id)

## E6 — Matching Engine v1
- [ ] Filtro grosso implementado
- [ ] Estratégias 1x1, 1xN, Nx1, NxN, fuzzy
- [ ] Score composto configurável
- [ ] Detecção CONFLITO por δ
- [ ] Função pura (sem side effects)
- [ ] Benchmark 100k < 120s

## E7 — Decision Service
- [ ] Thresholds parametrizáveis por empresa
- [ ] Rotas auto/sugestão/pendente/conflito validadas
- [ ] Fallback PENDENTE com sugestão avulsa

## E8 — Workflow Service
- [ ] Máquina de estados formal
- [ ] Transições inválidas rejeitadas
- [ ] Histórico completo por agregado

## E9 — Reconciliation + Posting
- [ ] `sp_conciliar` idempotente por chave natural
- [ ] `sp_estornar` auditado
- [ ] Baixa parcial + saldo residual
- [ ] Batch RPC
- [ ] 0 baixa parcial em teste de falha simulada

## E10 — Auditoria + Outbox
- [ ] Outbox implementado com worker idempotente
- [ ] Ledger append-only enforced
- [ ] Cadeia hash verificável e verificada diariamente

## E11 — UI Revisão v2
- [ ] Painel com filtros salvos
- [ ] Batch actions com preview idempotente
- [ ] Timeline por agregado
- [ ] Comparador de candidatos
- [ ] Atalhos de teclado
- [ ] Revisor operando lote 100 em < 5min

## E12 — Dashboard + Indicadores
- [ ] KPIs P0 disponíveis
- [ ] MVs incrementais
- [ ] Distribuição de score

## E13 — Segurança + SoD Avançada
- [ ] Papéis conciliacao.* completos
- [ ] Aprovação N-olhos operante
- [ ] Mascaramento LGPD ativo
- [ ] Testes de autorização 100%

## E14 — Performance + Escala
- [ ] Índices críticos aplicados
- [ ] Particionamento por empresa+mês
- [ ] Fila pgmq de matching
- [ ] Metas p95 do TO-BE (Parte 23) atingidas

## E15 — Extensibilidade
- [ ] Adapter CNAB240
- [ ] Adapter CNAB400
- [ ] Adapter PIX webhook
- [ ] Adapter Open Finance
- [ ] Multi-moeda funcional
- [ ] Novo adapter em ≤ 5 dias-dev (medido)

## E16 — Closing + Governança
- [ ] `sp_fechar_periodo` bloqueia mutação retroativa
- [ ] `sp_reabrir_periodo` exige N-olhos
- [ ] Snapshot fiscal disponível

## E17 — Migração
- [ ] Feature flag `conciliacao_v2` por empresa
- [ ] Backfill de `hash_linha`/`hash_arquivo` idempotente
- [ ] Reconstrução de trilha legada
- [ ] Roteamento condicional na UI
- [ ] Consistência diária validada
- [ ] 100% empresas em v2 por 30 dias sem P0/P1
- [ ] Código v1 removido

---

## Checklist de Release por Onda

- [ ] Todos os épicos da onda em DONE
- [ ] Testes verdes em CI
- [ ] Benchmarks OK
- [ ] Dataset canônico OK
- [ ] Consistência diária OK
- [ ] Runbooks atualizados
- [ ] Rollback validado
- [ ] Aprovação do Product Owner financeiro
- [ ] Comunicação à operação enviada
- [ ] Flag ativada em piloto
- [ ] Monitoramento 7 dias sem P0/P1
- [ ] Expansão autorizada

## Checklist Final do Projeto

- [ ] 100% dos épicos concluídos
- [ ] 100% das empresas em v2
- [ ] Código v1 removido
- [ ] Todos os documentos oficializados
- [ ] Runbooks completos
- [ ] Cobertura de testes ≥ metas
- [ ] Metas de performance sustentadas por 30 dias
- [ ] Zero P0/P1 abertos
- [ ] Aprovação executiva final
