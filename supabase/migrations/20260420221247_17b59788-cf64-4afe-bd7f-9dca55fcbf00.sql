-- Função genérica para registrar mudanças em config em auditoria_logs
CREATE OR REPLACE FUNCTION public.fn_audit_config_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_acao  text;
  v_id    text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_acao := 'CONFIG_INSERT';
    v_id   := COALESCE(NEW.id::text, NULL);
    INSERT INTO public.auditoria_logs (usuario_id, tabela, acao, registro_id, dados_anteriores, dados_novos)
    VALUES (v_actor, TG_TABLE_NAME, v_acao, v_id, NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_acao := 'CONFIG_UPDATE';
    v_id   := COALESCE(NEW.id::text, NULL);
    INSERT INTO public.auditoria_logs (usuario_id, tabela, acao, registro_id, dados_anteriores, dados_novos)
    VALUES (v_actor, TG_TABLE_NAME, v_acao, v_id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_acao := 'CONFIG_DELETE';
    v_id   := COALESCE(OLD.id::text, NULL);
    INSERT INTO public.auditoria_logs (usuario_id, tabela, acao, registro_id, dados_anteriores, dados_novos)
    VALUES (v_actor, TG_TABLE_NAME, v_acao, v_id, to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_app_configuracoes ON public.app_configuracoes;
CREATE TRIGGER trg_audit_app_configuracoes
AFTER INSERT OR UPDATE OR DELETE ON public.app_configuracoes
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_config_changes();

DROP TRIGGER IF EXISTS trg_audit_empresa_config ON public.empresa_config;
CREATE TRIGGER trg_audit_empresa_config
AFTER INSERT OR UPDATE OR DELETE ON public.empresa_config
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_config_changes();

-- Auditoria de user_roles → permission_audit
CREATE OR REPLACE FUNCTION public.fn_audit_user_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.permission_audit (user_id, target_user_id, alteracao, tipo_acao, entidade, entidade_id)
    VALUES (v_actor, NEW.user_id, jsonb_build_object('antes', NULL, 'depois', to_jsonb(NEW)), 'role_grant', 'role', NEW.role::text);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.permission_audit (user_id, target_user_id, alteracao, tipo_acao, entidade, entidade_id)
    VALUES (v_actor, NEW.user_id, jsonb_build_object('antes', to_jsonb(OLD), 'depois', to_jsonb(NEW)), 'role_update', 'role', NEW.role::text);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.permission_audit (user_id, target_user_id, alteracao, tipo_acao, entidade, entidade_id)
    VALUES (v_actor, OLD.user_id, jsonb_build_object('antes', to_jsonb(OLD), 'depois', NULL), 'role_revoke', 'role', OLD.role::text);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_user_roles ON public.user_roles;
CREATE TRIGGER trg_audit_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_user_roles();

-- profiles.ativo (replica banned_until para queries simples)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.ativo IS 'Réplica de auth.users.banned_until para consultas client-side. Sincronizado pela edge function admin-users em toggle-status.';