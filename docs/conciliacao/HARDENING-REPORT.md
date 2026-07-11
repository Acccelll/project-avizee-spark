# Hardening Report — Conciliação Financeira
> Etapa 14 — Partes 7, 8, 9

## 1. Segurança (Parte 7)
| Item | Estado | Observação |
|---|---|---|
| RLS habilitado em todas as tabelas do domínio | ✅ | `conciliacao_*`, `staging_*` |
| GRANT explícito por role | ✅ | Migrations padronizadas |
| RBAC via `user_permissions` + `has_role` | ✅ | `can(resource, action)` no UI |
| Segredos em Vault | ✅ | Sem secrets no código |
| Secrets Edge | 🟡 | `CRON_SECRET` ausente |
| Tokens/Sessões | ✅ | Supabase Auth + rotação |
| MFA TOTP | ✅ Opcional | Recomendar obrigatório para financeiro |
| Auditoria | ✅ | `audit_log` + triggers `search_path=public` |
| LGPD | ✅ | RPCs de anonimização |
| Proteção contra fraude/manipulação | ✅ | Constraints `chk_`, imutabilidade de matches confirmados |
| CORS Edge | ✅ | `ALLOWED_ORIGIN` |
| Rate limit | 🟡 | A definir por Edge crítica |
| HIBP | 🔴 | Habilitar |

## 2. Performance (Parte 8)
- Índices validados: `idx_conciliacao_status_data`, `idx_matches_lote`, `idx_staging_hash`.
- Paginação obrigatória via `useSupabaseCrud` (memória).
- Batch de matching: lotes de 1.000; commit por lote.
- Filas `pgmq` para eventos assíncronos.
- Cache TanStack Query com `staleTime` por consulta.
- Consultas críticas revisadas via `slow_queries`.
- Recomendação: agendar `VACUUM ANALYZE` semanal via cron.

## 3. Observabilidade (Parte 9)
| Camada | Ferramenta | Estado |
|---|---|---|
| Logs app | `src/lib/logger.ts` | ✅ |
| Logs Edge | Supabase Edge logs | ✅ |
| Tracing | request_id propagado | ✅ |
| Métricas DB | `db_health`, `slow_queries` | ✅ |
| KPIs conciliação | Dashboard | 🟡 Parcial |
| Alertas | Manuais | 🟡 |
| Health checks | `/health` por Edge | ✅ |
| SLIs | Definidos abaixo | ✅ |
| SLOs | Definidos abaixo | ✅ |
| SLAs | Interno (não contratual) | ✅ |

### SLIs / SLOs
- Disponibilidade UI: SLO 99.5%/mês.
- Latência p95 conciliação: SLO < 1.2s.
- Taxa de matching automático: SLI reportado; SLO ≥ 85%.
- Erro em Edge Functions: SLO < 1%.

## 4. Resiliência / Continuidade
- Retries idempotentes em Edge (`process-nfe-retry-cron` padrão).
- Circuit breaker no client via TanStack Query retry policy.
- Filas com DLQ lógica (registros `parcial` + `erro`).
- Backups PITR ativos; teste trimestral.

## 5. Conclusão do Hardening
Solução tecnicamente endurecida. Pendências residuais **não bloqueiam** Go Live, mas devem ser tratadas no plano de 30 dias.
