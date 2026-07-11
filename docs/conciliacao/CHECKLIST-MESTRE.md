# CHECKLIST MESTRE — EXECUÇÃO

Consolidado para acompanhar toda a implementação. Um item só é marcado quando 100% verificável.

## Por Sprint (obrigatório)

- [ ] Prompt correspondente executado sem desvio arquitetural
- [ ] Migration escrita seguindo CREATE→GRANT→RLS→POLICY
- [ ] RPC com `SECURITY DEFINER` + `SET search_path = public`
- [ ] Feature flag configurada
- [ ] Testes unitários novos (cobertura ≥80% no core alterado)
- [ ] Testes de integração relevantes
- [ ] Testes E2E (quando UI/fluxo)
- [ ] Benchmark (quando aplicável) dentro da meta
- [ ] Dataset canônico OK
- [ ] Ledger recebendo eventos
- [ ] Outbox entregando 100%
- [ ] Logger + métricas ativos
- [ ] Zero `console.*` e zero `catch {}`
- [ ] Cadeia hash do ledger verificada
- [ ] Documentos vivos atualizados
- [ ] Nova ADR aberta (se decisão arquitetural)
- [ ] Entrada em `HISTORICO-EXECUCAO.md`
- [ ] Rollback testado em staging

## Por Release (antes de piloto)

- [ ] Todas as sprints da release em DONE
- [ ] Testes CI verdes
- [ ] Benchmarks OK
- [ ] Dataset canônico OK
- [ ] Consistência diária OK
- [ ] Runbooks atualizados
- [ ] Aprovação do PO financeiro
- [ ] Comunicação à operação enviada
- [ ] Rollback validado (flag + RPC anterior)

## Por Wave de Rollout

- [ ] Empresa(s) elegível(is) identificada(s)
- [ ] Relatório baseline gerado
- [ ] Flag ativada
- [ ] Monitoramento 7 dias sem P0/P1
- [ ] Consistência OK
- [ ] Feedback do revisor positivo
- [ ] Autorização para próxima wave

## Governança contínua

- [ ] Ledger verify diário verde
- [ ] KPIs P0 dentro do esperado
- [ ] Backlog atualizado semanalmente
- [ ] ADRs revisadas ao fim de cada release
- [ ] Documentos vivos sem drift (revisão quinzenal)

## Final do Projeto

- [ ] 100% releases concluídas
- [ ] 100% empresas em v2
- [ ] Código v1 removido
- [ ] Métricas do TO-BE (Parte 23) sustentadas 30 dias
- [ ] Zero P0/P1 abertos
- [ ] Todos os documentos oficializados
- [ ] Aprovação executiva final
