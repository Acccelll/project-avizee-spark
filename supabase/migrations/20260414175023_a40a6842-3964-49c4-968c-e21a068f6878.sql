
-- =============================================
-- Cleanup duplicate RLS policies
-- =============================================

-- app_configuracoes: drop old duplicates, keep "Admin can *"
DROP POLICY IF EXISTS "app_config_insert" ON public.app_configuracoes;
DROP POLICY IF EXISTS "app_config_update" ON public.app_configuracoes;
DROP POLICY IF EXISTS "app_config_delete" ON public.app_configuracoes;

-- empresa_config: drop old duplicates, keep "Admin can *"
DROP POLICY IF EXISTS "empresa_config_insert" ON public.empresa_config;
DROP POLICY IF EXISTS "empresa_config_update" ON public.empresa_config;
DROP POLICY IF EXISTS "empresa_config_delete" ON public.empresa_config;

-- financeiro_lancamentos: drop old duplicates
DROP POLICY IF EXISTS "fl_delete" ON public.financeiro_lancamentos;
DROP POLICY IF EXISTS "fl_select" ON public.financeiro_lancamentos;

-- financeiro_baixas: drop old duplicates
DROP POLICY IF EXISTS "fb_delete" ON public.financeiro_baixas;
DROP POLICY IF EXISTS "fb_select" ON public.financeiro_baixas;

-- auditoria_logs: drop old duplicate delete + select
DROP POLICY IF EXISTS "audit_delete" ON public.auditoria_logs;
DROP POLICY IF EXISTS "audit_select" ON public.auditoria_logs;

-- folha_pagamento: drop old duplicate select
DROP POLICY IF EXISTS "folha_select" ON public.folha_pagamento;
