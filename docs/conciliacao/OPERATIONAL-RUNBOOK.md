# Operational Runbook — Conciliação Financeira
> Etapa 14 — Partes 10, 11, 15, 16

## 1. Papéis
- **On-call SRE**: primeira resposta, contenção.
- **Tech Lead Financeiro**: decisão técnica de negócio.
- **DBA de plantão**: incidentes de banco.
- **Product Owner**: comunicação e priorização.

## 2. Dashboard Operacional (Parte 15)
Monitorar continuamente:
Tempo médio · Taxa de matching · Conciliações/hora · Falhas · Importações · Profundidade de fila · CPU banco · Memória · Latência APIs · Edge Functions · Eventos · Alertas ativos · Disponibilidade.

## 3. Health Checks
- `GET /functions/v1/health` por Edge crítica.
- `supabase--db_health` diário automatizado.
- Sonda UI: rota `/health` interna.

## 4. Runbooks (Parte 11)

### R1 — Importação Parada
1. Verificar `staging_importacoes` (status = `processando` > 15min).
2. Consultar logs Edge `importa-*`.
3. Reprocessar lote via RPC `reprocessar_importacao(lote_id)`.
4. Se persistir: mover para `erro`, abrir incidente.

### R2 — Matching Parado
1. Checar cron `matching-cron` (`edge_function_logs`).
2. Verificar advisory lock: `SELECT * FROM pg_locks WHERE locktype='advisory'`.
3. Rodar RPC `matching_run_batch(limit)` manualmente.

### R3 — Workflow Parado
1. Sweep: RPC `workflow_sweep_stale(interval '30 min')`.
2. Validar transições em `conciliacao_workflow_state`.

### R4 — Banco Lento
1. `supabase--slow_queries` últimos 15min.
2. Verificar `pg_stat_activity` para locks.
3. Se necessário, `pg_cancel_backend(pid)` do maior ofensor.

### R5 — Falha de Autenticação
1. Confirmar status Supabase Auth.
2. Validar `configure_auth` inalterado.
3. Forçar refresh de chaves se necessário.

### R6 — Erro Financeiro
1. **NÃO** editar dados manualmente.
2. Abrir incidente P0.
3. Snapshot da tabela envolvida.
4. Corrigir via RPC auditada.

### R7 — Rollback
1. Frontend: promover release anterior.
2. Edge: `supabase--deploy_edge_functions` versão N-1.
3. Migração: aplicar migration reversa registrada em CHANGE-HISTORY.

### R8 — Falha em APIs Externas
1. Confirmar timeout no logger.
2. Ativar fallback documentado.
3. Comunicar impacto.

### R9 — Problema de Auditoria
1. Validar triggers `audit_log_*`.
2. Confirmar `search_path=public`.
3. Se ausente, restaurar via migration.

### R10 — Problema de Performance
1. Coletar p50/p95/p99.
2. Identificar consulta em `slow_queries`.
3. Adicionar índice ou cache.

## 5. Gestão de Incidentes (Parte 16)
- **Classificação**: P0 (parada total/financeiro) · P1 (função crítica degradada) · P2 (secundário) · P3 (cosmético).
- **Escalonamento**: On-call → Tech Lead (30min P0/1h P1) → CTO (2h P0).
- **Comunicação**: canal `#incidentes-avizee` + email stakeholders para P0/P1.
- **Registro**: ticket + entrada em CHANGE-HISTORY.
- **Pós-mortem**: obrigatório para P0/P1 em até 5 dias úteis, blameless.
- **Lições aprendidas**: item em RISK-REGISTER e TECHNICAL-DEBT-REGISTER quando aplicável.

## 6. Manutenção
- Janela padrão: domingo 02:00–04:00 BRT.
- Comunicação prévia: 48h.
