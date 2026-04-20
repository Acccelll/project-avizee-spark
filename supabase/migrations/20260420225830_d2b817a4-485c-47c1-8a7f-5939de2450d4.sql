
-- =============================================================
-- CONFIGURAÇÕES: governança + branding consolidado + Vault RPCs
-- =============================================================

-- 1) BRANDING em empresa_config -------------------------------
ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS cor_primaria text,
  ADD COLUMN IF NOT EXISTS cor_secundaria text;

-- Migra valores existentes de app_configuracoes -> empresa_config
DO $$
DECLARE
  v_primary text;
  v_secondary text;
  v_geral jsonb;
  v_id uuid;
BEGIN
  SELECT (valor #>> '{}') INTO v_primary FROM public.app_configuracoes WHERE chave = 'theme_primary_color';
  SELECT (valor #>> '{}') INTO v_secondary FROM public.app_configuracoes WHERE chave = 'theme_secondary_color';
  SELECT valor INTO v_geral FROM public.app_configuracoes WHERE chave = 'geral';

  IF v_primary IS NULL AND v_geral ? 'corPrimaria' THEN
    v_primary := v_geral ->> 'corPrimaria';
  END IF;
  IF v_secondary IS NULL AND v_geral ? 'corSecundaria' THEN
    v_secondary := v_geral ->> 'corSecundaria';
  END IF;

  SELECT id INTO v_id FROM public.empresa_config ORDER BY created_at LIMIT 1;
  IF v_id IS NOT NULL THEN
    UPDATE public.empresa_config
       SET cor_primaria   = COALESCE(cor_primaria, v_primary),
           cor_secundaria = COALESCE(cor_secundaria, v_secondary)
     WHERE id = v_id;
  END IF;
END $$;

-- Remove chaves antigas de tema do app_configuracoes (branding agora vive em empresa_config)
DELETE FROM public.app_configuracoes WHERE chave IN ('theme_primary_color','theme_secondary_color');

-- 2) GOVERNANÇA em app_configuracoes --------------------------
ALTER TABLE public.app_configuracoes
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS sensibilidade text NOT NULL DEFAULT 'interno',
  ADD COLUMN IF NOT EXISTS updated_by uuid;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'app_configuracoes_sensibilidade_chk'
  ) THEN
    ALTER TABLE public.app_configuracoes
      ADD CONSTRAINT app_configuracoes_sensibilidade_chk
      CHECK (sensibilidade IN ('publico','interno','sensivel'));
  END IF;
END $$;

-- Backfill por chave conhecida
UPDATE public.app_configuracoes SET categoria = 'email',      sensibilidade = 'sensivel' WHERE chave = 'email'        AND categoria IS NULL;
UPDATE public.app_configuracoes SET categoria = 'integracoes',sensibilidade = 'sensivel' WHERE chave = 'integracoes'  AND categoria IS NULL;
UPDATE public.app_configuracoes SET categoria = 'fiscal',     sensibilidade = 'interno'  WHERE chave = 'fiscal'       AND categoria IS NULL;
UPDATE public.app_configuracoes SET categoria = 'financeiro', sensibilidade = 'interno'  WHERE chave = 'financeiro'   AND categoria IS NULL;
UPDATE public.app_configuracoes SET categoria = 'usuarios',   sensibilidade = 'interno'  WHERE chave = 'usuarios'     AND categoria IS NULL;
UPDATE public.app_configuracoes SET categoria = 'dashboard',  sensibilidade = 'interno'  WHERE chave = 'dashboard_metas' AND categoria IS NULL;
UPDATE public.app_configuracoes SET categoria = 'frete',      sensibilidade = 'interno'  WHERE chave LIKE 'frete:%'   AND categoria IS NULL;
UPDATE public.app_configuracoes SET categoria = 'compras',    sensibilidade = 'interno'  WHERE chave LIKE 'compras.%' AND categoria IS NULL;
UPDATE public.app_configuracoes SET categoria = 'infra',      sensibilidade = 'interno'  WHERE chave = 'cep_empresa'  AND categoria IS NULL;
UPDATE public.app_configuracoes SET categoria = 'infra',      sensibilidade = 'interno'  WHERE chave = 'backup'       AND categoria IS NULL;
UPDATE public.app_configuracoes SET categoria = 'geral',      sensibilidade = 'interno'  WHERE chave = 'geral'        AND categoria IS NULL;

-- 3) TRIGGER de auditoria centralizada -----------------------
CREATE OR REPLACE FUNCTION public.fn_app_configuracoes_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_diff jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_by := COALESCE(v_user, NEW.updated_by);
    NEW.updated_at := now();
    -- Para chaves sensíveis registramos apenas o evento, sem o valor.
    IF NEW.sensibilidade = 'sensivel' THEN
      v_diff := jsonb_build_object('event','secret:rotated','chave',NEW.chave);
    ELSE
      v_diff := jsonb_build_object('antes', OLD.valor, 'depois', NEW.valor);
    END IF;
    INSERT INTO public.auditoria_logs (usuario_id, acao, tabela, registro_id, dados_anteriores, dados_novos)
    VALUES (
      v_user,
      'config:update',
      'app_configuracoes',
      NEW.id::text,
      jsonb_build_object('chave', OLD.chave, 'categoria', OLD.categoria, 'sensibilidade', OLD.sensibilidade),
      jsonb_build_object('chave', NEW.chave, 'categoria', NEW.categoria, 'sensibilidade', NEW.sensibilidade, 'diff', v_diff)
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.updated_by := COALESCE(v_user, NEW.updated_by);
    INSERT INTO public.auditoria_logs (usuario_id, acao, tabela, registro_id, dados_novos)
    VALUES (
      v_user,
      'config:create',
      'app_configuracoes',
      NEW.id::text,
      jsonb_build_object('chave', NEW.chave, 'categoria', NEW.categoria, 'sensibilidade', NEW.sensibilidade)
    );
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_app_configuracoes_audit ON public.app_configuracoes;
CREATE TRIGGER trg_app_configuracoes_audit
  BEFORE INSERT OR UPDATE ON public.app_configuracoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_app_configuracoes_audit();

-- 4) Auditoria de empresa_config -----------------------------
CREATE OR REPLACE FUNCTION public.fn_empresa_config_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  INSERT INTO public.auditoria_logs (usuario_id, acao, tabela, registro_id, dados_anteriores, dados_novos)
  VALUES (
    v_user,
    CASE TG_OP WHEN 'INSERT' THEN 'empresa_config:create' ELSE 'empresa_config:update' END,
    'empresa_config',
    COALESCE(NEW.id, OLD.id)::text,
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_empresa_config_audit ON public.empresa_config;
CREATE TRIGGER trg_empresa_config_audit
  AFTER INSERT OR UPDATE ON public.empresa_config
  FOR EACH ROW EXECUTE FUNCTION public.fn_empresa_config_audit();

-- 5) RPCs Vault para segredos (SMTP / gateway / SEFAZ) -------
-- Requer extensão supabase_vault (pré-instalada no Lovable Cloud).
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- Helper genérico (interno) — não exposto via API
CREATE OR REPLACE FUNCTION public._set_vault_secret(p_name text, p_secret text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE v_id uuid;
BEGIN
  -- Se já existir uma secret com este name, atualiza; senão cria.
  SELECT id INTO v_id FROM vault.secrets WHERE name = p_name LIMIT 1;
  IF v_id IS NULL THEN
    SELECT vault.create_secret(p_secret, p_name) INTO v_id;
  ELSE
    PERFORM vault.update_secret(v_id, p_secret);
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public._set_vault_secret(text,text) FROM PUBLIC;

-- SMTP --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_secret_smtp_password(p_password text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  v_id := public._set_vault_secret('smtp_password', p_password);
  -- Atualiza referência em app_configuracoes['email']
  INSERT INTO public.app_configuracoes (chave, valor, categoria, sensibilidade)
  VALUES ('email', jsonb_build_object('smtp_senha_secret_id', v_id), 'email', 'sensivel')
  ON CONFLICT (chave) DO UPDATE
    SET valor = COALESCE(app_configuracoes.valor, '{}'::jsonb) || jsonb_build_object('smtp_senha_secret_id', v_id),
        sensibilidade = 'sensivel';
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_secret_smtp_password(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_secret_smtp_password(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_secret_smtp_password()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE v_id uuid; v_secret text;
BEGIN
  -- Restrito: somente service_role pode invocar (edge functions com service key)
  IF current_setting('request.jwt.claim.role', true) <> 'service_role' THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  SELECT (valor->>'smtp_senha_secret_id')::uuid INTO v_id FROM public.app_configuracoes WHERE chave = 'email';
  IF v_id IS NULL THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE id = v_id;
  RETURN v_secret;
END;
$$;
REVOKE ALL ON FUNCTION public.get_secret_smtp_password() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_secret_smtp_password() TO service_role;

-- Gateway -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_secret_gateway_key(p_secret text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  v_id := public._set_vault_secret('gateway_secret_key', p_secret);
  INSERT INTO public.app_configuracoes (chave, valor, categoria, sensibilidade)
  VALUES ('integracoes', jsonb_build_object('gateway_secret_id', v_id), 'integracoes', 'sensivel')
  ON CONFLICT (chave) DO UPDATE
    SET valor = COALESCE(app_configuracoes.valor, '{}'::jsonb) || jsonb_build_object('gateway_secret_id', v_id),
        sensibilidade = 'sensivel';
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_secret_gateway_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_secret_gateway_key(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_secret_gateway_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE v_id uuid; v_secret text;
BEGIN
  IF current_setting('request.jwt.claim.role', true) <> 'service_role' THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  SELECT (valor->>'gateway_secret_id')::uuid INTO v_id FROM public.app_configuracoes WHERE chave = 'integracoes';
  IF v_id IS NULL THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE id = v_id;
  RETURN v_secret;
END;
$$;
REVOKE ALL ON FUNCTION public.get_secret_gateway_key() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_secret_gateway_key() TO service_role;

-- SEFAZ -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_secret_sefaz_password(p_password text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  v_id := public._set_vault_secret('sefaz_cert_password', p_password);
  INSERT INTO public.app_configuracoes (chave, valor, categoria, sensibilidade)
  VALUES ('integracoes', jsonb_build_object('sefaz_senha_secret_id', v_id), 'integracoes', 'sensivel')
  ON CONFLICT (chave) DO UPDATE
    SET valor = COALESCE(app_configuracoes.valor, '{}'::jsonb) || jsonb_build_object('sefaz_senha_secret_id', v_id),
        sensibilidade = 'sensivel';
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_secret_sefaz_password(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_secret_sefaz_password(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_secret_sefaz_password()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE v_id uuid; v_secret text;
BEGIN
  IF current_setting('request.jwt.claim.role', true) <> 'service_role' THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  SELECT (valor->>'sefaz_senha_secret_id')::uuid INTO v_id FROM public.app_configuracoes WHERE chave = 'integracoes';
  IF v_id IS NULL THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE id = v_id;
  RETURN v_secret;
END;
$$;
REVOKE ALL ON FUNCTION public.get_secret_sefaz_password() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_secret_sefaz_password() TO service_role;
