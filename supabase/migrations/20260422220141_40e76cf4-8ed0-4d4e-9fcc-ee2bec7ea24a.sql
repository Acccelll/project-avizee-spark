
-- Função SECURITY DEFINER para o usuário autenticado registrar suas próprias
-- alterações (nome, cargo, senha) na tabela de auditoria, sem ampliar a
-- política RLS de INSERT (que continua restrita a admins para outros casos).
CREATE OR REPLACE FUNCTION public.log_self_update_audit(
  p_tipo_acao text,
  p_entidade text,
  p_entidade_id text,
  p_alteracao jsonb,
  p_motivo text DEFAULT 'alteração pelo próprio usuário'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Apenas tipos esperados de self-update.
  IF p_tipo_acao NOT IN ('self_profile_update', 'self_password_change') THEN
    RAISE EXCEPTION 'Tipo de ação inválido para self-update: %', p_tipo_acao;
  END IF;

  INSERT INTO public.permission_audit (
    user_id,
    target_user_id,
    tipo_acao,
    entidade,
    entidade_id,
    alteracao,
    motivo
  ) VALUES (
    v_user_id,
    v_user_id,
    p_tipo_acao,
    p_entidade,
    p_entidade_id,
    p_alteracao,
    p_motivo
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_self_update_audit(text, text, text, jsonb, text) TO authenticated;
