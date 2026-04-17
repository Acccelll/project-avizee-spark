-- =========================================================================
-- ROUND 7 — Administração + Configurações
-- =========================================================================

-- 1) ROLE_PERMISSIONS (canônica por role)
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  resource text NOT NULL,
  action text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, resource, action)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rp_select ON public.role_permissions;
CREATE POLICY rp_select ON public.role_permissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS rp_insert ON public.role_permissions;
CREATE POLICY rp_insert ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS rp_update ON public.role_permissions;
CREATE POLICY rp_update ON public.role_permissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS rp_delete ON public.role_permissions;
CREATE POLICY rp_delete ON public.role_permissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) Função canônica: user_has_permission(user, resource, action)
-- Combina papel-base (role_permissions) + override individual (user_permissions)
CREATE OR REPLACE FUNCTION public.user_has_permission(
  _user_id uuid,
  _resource text,
  _action text
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH override AS (
    SELECT allowed FROM public.user_permissions
    WHERE user_id = _user_id AND resource = _resource AND action = _action
    LIMIT 1
  ),
  base AS (
    SELECT bool_or(rp.allowed) AS allowed
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id
      AND rp.resource = _resource
      AND rp.action = _action
  )
  SELECT COALESCE(
    (SELECT allowed FROM override),
    (SELECT allowed FROM base),
    false
  );
$$;

-- 3) SINGLETON empresa_config — garante uma única linha
DO $$
DECLARE _count int;
BEGIN
  SELECT COUNT(*) INTO _count FROM public.empresa_config;
  IF _count = 0 THEN
    INSERT INTO public.empresa_config DEFAULT VALUES;
  ELSIF _count > 1 THEN
    -- Mantém a mais antiga, descarta as demais
    DELETE FROM public.empresa_config
    WHERE id NOT IN (SELECT id FROM public.empresa_config ORDER BY created_at ASC LIMIT 1);
  END IF;
END $$;

-- Trigger garantindo singleton (impede novos INSERTs se já existir)
CREATE OR REPLACE FUNCTION public.enforce_empresa_config_singleton()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.empresa_config) >= 1 THEN
    RAISE EXCEPTION 'empresa_config é singleton: use UPDATE em vez de INSERT';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_empresa_config_singleton ON public.empresa_config;
CREATE TRIGGER trg_enforce_empresa_config_singleton
  BEFORE INSERT ON public.empresa_config
  FOR EACH ROW EXECUTE FUNCTION public.enforce_empresa_config_singleton();

-- 4) USER_PREFERENCES — migração de preferências de app_configuracoes
-- A tabela já existe; adicionamos índice e RLS rigoroso.
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_module
  ON public.user_preferences(user_id, module_key);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS up_select_own ON public.user_preferences;
CREATE POLICY up_select_own ON public.user_preferences FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS up_insert_own ON public.user_preferences;
CREATE POLICY up_insert_own ON public.user_preferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS up_update_own ON public.user_preferences;
CREATE POLICY up_update_own ON public.user_preferences FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS up_delete_own ON public.user_preferences;
CREATE POLICY up_delete_own ON public.user_preferences FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 5) Migração de dados: app_configuracoes (chaves user_pref:*) -> user_preferences
INSERT INTO public.user_preferences (user_id, module_key, columns_config, updated_at)
SELECT
  (split_part(chave, ':', 2))::uuid AS user_id,
  split_part(chave, ':', 3) AS module_key,
  COALESCE(valor, '{}'::jsonb) AS columns_config,
  updated_at
FROM public.app_configuracoes
WHERE chave LIKE 'user_pref:%'
  AND split_part(chave, ':', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
ON CONFLICT (user_id, module_key) DO UPDATE
  SET columns_config = EXCLUDED.columns_config,
      updated_at = EXCLUDED.updated_at;

-- Remove chaves migradas de app_configuracoes (passa a ser exclusivamente global)
DELETE FROM public.app_configuracoes WHERE chave LIKE 'user_pref:%';

-- 6) Constraint: app_configuracoes não aceita mais chaves user_pref:*
ALTER TABLE public.app_configuracoes DROP CONSTRAINT IF EXISTS chk_app_config_global_only;
ALTER TABLE public.app_configuracoes
  ADD CONSTRAINT chk_app_config_global_only CHECK (chave NOT LIKE 'user_pref:%');

-- 7) UNIQUE constraint em user_preferences (user_id, module_key) — necessário p/ upsert
DO $$ BEGIN
  ALTER TABLE public.user_preferences
    ADD CONSTRAINT user_preferences_user_module_unique UNIQUE (user_id, module_key);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;