---
name: Cron Health Heartbeat
description: cron_health table fed by touch_cron_health RPC via recordCronHealth helper; surfaced in admin SaudeSistemaSection card
type: feature
---

# Cron Health

Tabela `public.cron_health` (job_name PK, last_run_at, last_status, last_error, runs_count) com RLS admin-only para SELECT; escrita exclusiva por edge functions via `service_role`.

RPC `touch_cron_health(p_job, p_status, p_error)` (SECURITY DEFINER, search_path=public) — upsert por `job_name`, incrementa `runs_count`.

Helper compartilhado: `supabase/functions/_shared/cron-health.ts` exporta `recordCronHealth(admin, job, "ok"|"error", error?)`. Erros do próprio heartbeat são silenciados (best-effort).

Coberto: `webhooks-dispatcher`, `process-email-queue`, `process-distdfe-cron`, `process-nfe-retry-cron`. Adicionar `recordCronHealth` no final do handler ao introduzir cron novo.

UI: `useCronHealth` hook + card "Jobs agendados (heartbeat)" em `SaudeSistemaSection`. `CRON_EXPECTED_INTERVAL_SECONDS` mapa estático aciona alerta "atrasado" (`HealthBadge` down) quando `last_run_at` > 2× intervalo esperado.