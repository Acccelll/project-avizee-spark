-- ============================================================
-- AVIZEE ERP — Schema Inventory Query
-- Rodar no Supabase Dashboard → SQL Editor
-- Salvar resultado como _baseline_YYYYMMDD.sql.reference
-- ============================================================

-- 1. Sequences com last_value atual
SELECT sequencename, last_value, increment_by, start_value
FROM pg_sequences WHERE schemaname = 'public'
ORDER BY sequencename;

-- 2. Tabelas com contagem de linhas (sanity check)
SELECT schemaname, tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC LIMIT 30;

-- 3. SECURITY DEFINER functions
SELECT proname, pg_get_function_identity_arguments(oid) AS args
FROM pg_proc WHERE prosecdef = true AND pronamespace = 'public'::regnamespace
ORDER BY proname;

-- 4. RLS policies por tabela
SELECT tablename, policyname, cmd, qual
FROM pg_policies WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 5. Triggers ativos
SELECT trigger_schema, trigger_name, event_object_table, event_manipulation, action_timing
FROM information_schema.triggers WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 6. Cron jobs (requer pg_cron)
SELECT jobname, schedule, command, active FROM cron.job ORDER BY jobname;

-- 7. Índices compostos (críticos para performance)
SELECT indexname, tablename, indexdef
FROM pg_indexes WHERE schemaname = 'public' AND indexdef LIKE '%,%'
ORDER BY tablename, indexname;