CREATE OR REPLACE FUNCTION public.fn_audit_user_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_tipo text;
  v_payload jsonb;
  v_entidade_id text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_tipo := CASE WHEN COALESCE(NEW.allowed, true) THEN 'permission_grant' ELSE 'permission_revoke' END;
    v_payload := jsonb_build_object('antes', NULL, 'depois', to_jsonb(NEW));
    v_entidade_id := NEW.resource || ':' || NEW.action;
    INSERT INTO public.permission_audit (user_id, alteracao, tipo_acao, entidade, entidade_id, motivo)
    VALUES (NEW.user_id, v_payload, v_tipo, 'permission', v_entidade_id, NEW.motivo);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_tipo := CASE
      WHEN OLD.allowed IS DISTINCT FROM NEW.allowed AND NEW.allowed = false THEN 'permission_revoke'
      WHEN OLD.allowed IS DISTINCT FROM NEW.allowed AND NEW.allowed = true  THEN 'permission_grant'
      ELSE 'permission_update'
    END;
    v_payload := jsonb_build_object('antes', to_jsonb(OLD), 'depois', to_jsonb(NEW));
    v_entidade_id := NEW.resource || ':' || NEW.action;
    INSERT INTO public.permission_audit (user_id, alteracao, tipo_acao, entidade, entidade_id, motivo)
    VALUES (NEW.user_id, v_payload, v_tipo, 'permission', v_entidade_id, NEW.motivo);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_payload := jsonb_build_object('antes', to_jsonb(OLD), 'depois', NULL);
    v_entidade_id := OLD.resource || ':' || OLD.action;
    INSERT INTO public.permission_audit (user_id, alteracao, tipo_acao, entidade, entidade_id, motivo)
    VALUES (OLD.user_id, v_payload, 'permission_delete', 'permission', v_entidade_id, OLD.motivo);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;