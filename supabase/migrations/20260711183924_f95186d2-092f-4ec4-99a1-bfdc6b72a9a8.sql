-- Sprint 3 — Decisão de match (aprovar/rejeitar)
-- Rollback: DROP FUNCTION IF EXISTS public.conciliacao_decidir_match(uuid, text, text);

CREATE OR REPLACE FUNCTION public.conciliacao_decidir_match(
  p_match_id uuid,
  p_decisao text,
  p_motivo text DEFAULT NULL
)
RETURNS public.conciliacao_matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_match public.conciliacao_matches;
BEGIN
  IF p_decisao NOT IN ('aprovar', 'rejeitar') THEN
    RAISE EXCEPTION 'Decisão inválida: %', p_decisao;
  END IF;

  SELECT * INTO v_match FROM public.conciliacao_matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Match % não encontrado', p_match_id;
  END IF;
  IF v_match.status <> 'sugerido' THEN
    RAISE EXCEPTION 'Match não está em estado sugerido (atual: %)', v_match.status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_empresas
    WHERE user_id = v_uid AND empresa_id = v_match.empresa_id
  ) THEN
    RAISE EXCEPTION 'Sem acesso à empresa do match';
  END IF;

  IF p_decisao = 'aprovar' THEN
    UPDATE public.conciliacao_matches
    SET status = 'conciliado',
        aprovado_por = v_uid,
        aprovado_em = now(),
        observacao = COALESCE(p_motivo, observacao),
        updated_at = now()
    WHERE id = p_match_id
    RETURNING * INTO v_match;

    UPDATE public.conciliacao_extrato_linhas
    SET status = 'conciliado', updated_at = now()
    WHERE id = v_match.extrato_linha_id;

    -- Rejeita automaticamente outras sugestões concorrentes para a mesma linha
    UPDATE public.conciliacao_matches
    SET status = 'rejeitado',
        rejeitado_por = v_uid,
        rejeitado_em = now(),
        observacao = 'Auto-rejeitado: outra sugestão aprovada',
        updated_at = now()
    WHERE extrato_linha_id = v_match.extrato_linha_id
      AND id <> v_match.id
      AND status = 'sugerido';
  ELSE
    UPDATE public.conciliacao_matches
    SET status = 'rejeitado',
        rejeitado_por = v_uid,
        rejeitado_em = now(),
        observacao = p_motivo,
        updated_at = now()
    WHERE id = p_match_id
    RETURNING * INTO v_match;

    -- Se não há outras sugestões pendentes, volta linha para 'pendente'
    IF NOT EXISTS (
      SELECT 1 FROM public.conciliacao_matches
      WHERE extrato_linha_id = v_match.extrato_linha_id AND status = 'sugerido'
    ) THEN
      UPDATE public.conciliacao_extrato_linhas
      SET status = 'pendente', updated_at = now()
      WHERE id = v_match.extrato_linha_id;
    END IF;
  END IF;

  RETURN v_match;
END;
$$;

REVOKE ALL ON FUNCTION public.conciliacao_decidir_match(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.conciliacao_decidir_match(uuid, text, text) TO authenticated;