-- =====================================================================
-- Migration: Restrição de RLS em tabelas sensíveis
-- 1) app_configuracoes e empresa_config: INSERT/UPDATE somente admin
-- 2) DELETE restrito a admin em tabelas financeiras/fiscais
-- 3) auditoria_logs: DELETE bloqueado para todos
-- =====================================================================

-- ── 1. app_configuracoes: restringir INSERT e UPDATE para admin ──

DROP POLICY IF EXISTS "app_config_insert" ON public.app_configuracoes;
DROP POLICY IF EXISTS "app_config_update" ON public.app_configuracoes;

CREATE POLICY "app_config_insert" ON public.app_configuracoes
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "app_config_update" ON public.app_configuracoes
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- ── 2. empresa_config: restringir INSERT e UPDATE para admin ──

DROP POLICY IF EXISTS "empresa_config_insert" ON public.empresa_config;
DROP POLICY IF EXISTS "empresa_config_update" ON public.empresa_config;

CREATE POLICY "empresa_config_insert" ON public.empresa_config
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "empresa_config_update" ON public.empresa_config
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- ── 3. DELETE restrito a admin em tabelas financeiras/fiscais ──

-- financeiro_lancamentos
DROP POLICY IF EXISTS "fl_delete" ON public.financeiro_lancamentos;
CREATE POLICY "fl_delete" ON public.financeiro_lancamentos
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- financeiro_baixas
DROP POLICY IF EXISTS "fb_delete" ON public.financeiro_baixas;
CREATE POLICY "fb_delete" ON public.financeiro_baixas
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- notas_fiscais
DROP POLICY IF EXISTS "nf_delete" ON public.notas_fiscais;
CREATE POLICY "nf_delete" ON public.notas_fiscais
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- notas_fiscais_itens
DROP POLICY IF EXISTS "nfi_delete" ON public.notas_fiscais_itens;
CREATE POLICY "nfi_delete" ON public.notas_fiscais_itens
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- app_configuracoes
DROP POLICY IF EXISTS "app_config_delete" ON public.app_configuracoes;
CREATE POLICY "app_config_delete" ON public.app_configuracoes
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- empresa_config
DROP POLICY IF EXISTS "empresa_config_delete" ON public.empresa_config;
CREATE POLICY "empresa_config_delete" ON public.empresa_config
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- ── 4. auditoria_logs: bloquear DELETE para todos ──

DROP POLICY IF EXISTS "audit_delete" ON public.auditoria_logs;
CREATE POLICY "audit_delete" ON public.auditoria_logs
  FOR DELETE TO authenticated
  USING (false);