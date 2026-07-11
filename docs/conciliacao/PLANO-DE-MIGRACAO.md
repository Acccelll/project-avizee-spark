# PLANO DE MIGRAÇÃO — CONCILIAÇÃO v1 → v2

Estratégia segura, sem interrupção operacional.

## Princípios

1. **Zero downtime**: v1 permanece operacional durante toda a migração.
2. **Aditividade**: mudanças de schema apenas por adição (colunas nullable, tabelas novas).
3. **Idempotência**: todo job de migração pode ser reexecutado sem efeito colateral.
4. **Auditabilidade**: cada registro migrado carrega origem e timestamp; ledger é fonte oficial.
5. **Reversibilidade**: feature flag por empresa permite voltar em segundos.

## Fases

### Fase M0 — Preparação
- Snapshot lógico de tabelas críticas (`financeiro_baixas`, `conciliacao_bancaria`, `financeiro_extrato_*`).
- Relatório baseline (contagens, somas, hashes) por empresa.
- Criar `feature_flags` e ativar `conciliacao_v2=false` para todos.
- Criar tabelas novas (ledger, outbox, sugestoes, workflow_transicoes, config, periodos) sem escrever ainda.

### Fase M1 — Backfill
- **B1** Calcular `hash_arquivo` retroativo para todas as importações passadas (job idempotente por importação).
- **B2** Calcular `hash_linha` retroativo para movimentos legados; deduplicar apenas relatando (sem apagar).
- **B3** Reconstruir `conciliacao_bancaria` faltante a partir de `financeiro_baixas` legadas (baixa sem conciliação → criar conciliação sintética com `origem_migracao='backfill'`).
- **B4** Gerar eventos sintéticos no ledger: `LegacyBaixaImported`, `LegacyReconciliationImported`, com hash-chain iniciando de zero por empresa.
- **B5** Popular `workflow_transicoes` com o estado final observado (`RECONCILED`/`POSTED`) e origem `backfill`.
- **B6** Relatório pós-backfill por empresa: divergências (baixas sem conciliação, movimentos órfãos, duplicidades detectadas), com ação recomendada.

### Fase M2 — Piloto
- Selecionar empresa piloto de baixo volume.
- Ativar `conciliacao_v2=true` só para ela.
- Novas importações passam pelo pipeline v2; dados históricos permanecem consultáveis.
- Monitorar por 7 dias: divergências, tempo, erros, feedback do revisor.
- Critério de sucesso: 0 divergência financeira; automação ≥ baseline; feedback positivo.

### Fase M3 — Expansão gradual
- Ativar em 3 empresas → 10 → 30 → 100%.
- A cada onda: relatório de consistência automatizado; qualquer alerta P0 pausa a expansão.
- Empresas ainda em v1 continuam funcionando normalmente.

### Fase M4 — Consolidação
- 100% em v2 por 30 dias sem incidente P0/P1.
- Freeze de escrita em rotas v1.
- Congelar rotas antigas (retornam 410 Gone) mantendo leitura.

### Fase M5 — Descontinuação
- Remover código v1 (rotas, hooks, componentes, RPCs `_v1`).
- Remover colunas obsoletas em migração aditiva reversa (drop apenas do que não tem consumidor).
- Documentar remoção no changelog.

## Preservação de Histórico

- Nenhum dado legado é apagado.
- Conciliações existentes ganham representação em `conciliacao_bancaria` completa + evento sintético no ledger.
- Trilha de auditoria histórica é acessível via UI de auditoria v2 com marca `origem: legado`.

## Rastreabilidade da Migração

Colunas em cada tabela migrada:
- `origem_migracao TEXT` (`backfill`, `piloto`, `producao`).
- `migrado_em TIMESTAMPTZ`.
- `job_id UUID` (chave do lote de backfill).

## Validação de Consistência

Job automático diário durante toda a migração:
- Σ baixas por empresa = Σ baixas ledger.
- Toda baixa tem conciliação ativa ou marcada como `origem=legado`.
- Cadeia hash do ledger íntegra por empresa.
- Contagem movimento normalizado × movimento importado.
- Qualquer divergência → alerta P0.

## Rollback

- Nível empresa: `feature_flags.conciliacao_v2=false`; instant.
- Nível global (RPC): alternar apontamento para `sp_conciliar_v1` via config; segundos.
- Nível schema: colunas aditivas ficam; nada precisa ser revertido.
- Ledger: nunca apagado; serve como fonte de reconstrução em pior caso.

## Riscos e Mitigações

| Risco | Mitigação | Contingência |
|---|---|---|
| Backfill produz duplicidade | Job idempotente + relatório prévio | Reverter lote via `job_id` |
| Divergência de soma pós-migração | Job de consistência diário | Pausar expansão; investigar por empresa |
| Empresa piloto insatisfeita | Feedback quinzenal | Flag off; ajustar |
| Ledger com cadeia quebrada | Verificação diária | Freeze do módulo; recomputar cadeia a partir do último ponto válido |
| Perda de acesso a histórico | UI v2 lê legado marcado | Rota de leitura v1 permanece em Fase M4 |

## Checklist por empresa

- [ ] Baseline gerado (contagens, somas, hashes).
- [ ] Backfill executado sem erro.
- [ ] Relatório de divergências revisado e aprovado.
- [ ] Flag v2 ativada.
- [ ] Monitorar 7 dias em piloto ou 3 dias em expansão.
- [ ] Consistência OK.
- [ ] Feedback do revisor positivo.
- [ ] Marcar empresa como migrada.
