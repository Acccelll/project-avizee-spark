
-- Fase 6: RPC transacional save_user_profile (update + audit numa transação)
-- Garante que o registro de auditoria e o update do perfil acontecem juntos:
-- se a auditoria falhar, o update do profile é revertido.
CREATE OR REPLACE FUNCTION public.save_user_profile(
  p_nome text,
  p_cargo text
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_previous public.profiles%ROWTYPE;
  v_updated public.profiles%ROWTYPE;
  v_nome text := btrim(coalesce(p_nome, ''));
  v_cargo text := btrim(coalesce(p_cargo, ''));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = '42501';
  END IF;
  IF char_length(v_nome) < 2 THEN
    RAISE EXCEPTION 'Nome deve ter pelo menos 2 caracteres' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_nome) > 80 THEN
    RAISE EXCEPTION 'Nome deve ter no máximo 80 caracteres' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_cargo) > 80 THEN
    RAISE EXCEPTION 'Cargo deve ter no máximo 80 caracteres' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_previous FROM public.profiles WHERE id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.profiles
     SET nome = v_nome,
         cargo = v_cargo,
         updated_at = now()
   WHERE id = v_user_id
   RETURNING * INTO v_updated;

  -- Auditoria atômica — se falhar, o UPDATE acima é revertido junto.
  PERFORM public.log_self_update_audit(
    'self_profile_update',
    'profiles',
    v_user_id::text,
    jsonb_build_object(
      'antes', jsonb_build_object('nome', v_previous.nome, 'cargo', v_previous.cargo),
      'depois', jsonb_build_object('nome', v_updated.nome, 'cargo', v_updated.cargo)
    ),
    'alteração pelo próprio usuário'
  );

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.save_user_profile(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_user_profile(text, text) TO authenticated;

-- Fase 9: sincronização automática de profiles.email com auth.users.email.
-- Trigger AFTER UPDATE em auth.users mantém profiles.email coerente sem
-- depender de chamadas manuais após mudança de e-mail.
CREATE OR REPLACE FUNCTION public.sync_profile_email_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles
       SET email = NEW.email,
           updated_at = now()
     WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_email_from_auth ON auth.users;
CREATE TRIGGER trg_sync_profile_email_from_auth
AFTER UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email_from_auth();

-- Backfill defensivo: alinha registros existentes que possam ter divergido.
UPDATE public.profiles p
   SET email = u.email,
       updated_at = now()
  FROM auth.users u
 WHERE u.id = p.id
   AND coalesce(p.email, '') IS DISTINCT FROM coalesce(u.email, '');
