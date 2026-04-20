-- Colunas de governança em user_permissions
ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS granted_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS motivo text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.user_permissions.granted_by   IS 'Usuário que concedeu/aplicou esta linha de override.';
COMMENT ON COLUMN public.user_permissions.granted_at   IS 'Quando a permissão foi concedida (distinto de created_at pois pode ser preservada em re-aplicações).';
COMMENT ON COLUMN public.user_permissions.motivo       IS 'Justificativa textual para o override (concessão ou revogação).';
COMMENT ON COLUMN public.user_permissions.expires_at   IS 'Expiração opcional do override. useCan ignora overrides expirados.';
COMMENT ON COLUMN public.user_permissions.updated_by   IS 'Último usuário que alterou esta linha.';

-- Backfill granted_at = created_at para linhas existentes (idempotente)
UPDATE public.user_permissions
SET granted_at = created_at
WHERE granted_at IS DISTINCT FROM created_at AND created_at IS NOT NULL;

-- Trigger function para auditoria
CREATE OR REPLACE FUNCTION public.fn_audit_user_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_tipo text;
  v_payload jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_tipo := CASE WHEN COALESCE(NEW.allowed, true) THEN 'permission_grant' ELSE 'permission_revoke' END;
    v_payload := jsonb_build_object('antes', NULL, 'depois', to_jsonb(NEW));
    INSERT INTO public.permission_audit (user_id, alteracao, tipo_acao, entidade, entidade_id, motivo)
    VALUES (NEW.user_id, v_payload, v_tipo, 'permission', NEW.permission, NEW.motivo);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_tipo := CASE
      WHEN OLD.allowed IS DISTINCT FROM NEW.allowed AND NEW.allowed = false THEN 'permission_revoke'
      WHEN OLD.allowed IS DISTINCT FROM NEW.allowed AND NEW.allowed = true  THEN 'permission_grant'
      ELSE 'permission_update'
    END;
    v_payload := jsonb_build_object('antes', to_jsonb(OLD), 'depois', to_jsonb(NEW));
    INSERT INTO public.permission_audit (user_id, alteracao, tipo_acao, entidade, entidade_id, motivo)
    VALUES (NEW.user_id, v_payload, v_tipo, 'permission', NEW.permission, NEW.motivo);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_payload := jsonb_build_object('antes', to_jsonb(OLD), 'depois', NULL);
    INSERT INTO public.permission_audit (user_id, alteracao, tipo_acao, entidade, entidade_id, motivo)
    VALUES (OLD.user_id, v_payload, 'permission_delete', 'permission', OLD.permission, OLD.motivo);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_permissions_audit ON public.user_permissions;
CREATE TRIGGER trg_user_permissions_audit
AFTER INSERT OR UPDATE OR DELETE ON public.user_permissions
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_user_permissions();