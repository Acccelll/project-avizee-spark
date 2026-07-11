CREATE OR REPLACE FUNCTION public.conciliacao_auto_aprovar(p_extrato_id uuid)
RETURNS TABLE(matches_aprovados integer, baixas_aplicadas integer, falhas integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_extrato public.conciliacao_extratos;
  v_regra public.conciliacao_regras_auto;
  v_match record;
  v_result public.conciliacao_matches;
  v_aprovados integer := 0;
  v_baixas integer := 0;
  v_falhas integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO v_extrato
  FROM public.conciliacao_extratos
  WHERE id = p_extrato_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Extrato não encontrado';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'financeiro'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para autoaprovar conciliações';
  END IF;

  IF NOT (v_extrato.empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Empresa do extrato fora do contexto atual';
  END IF;

  SELECT * INTO v_regra
  FROM public.conciliacao_regras_auto
  WHERE empresa_id = v_extrato.empresa_id
    AND ativo = true
  ORDER BY score_minimo DESC, updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhuma regra de autoaprovação ativa para a empresa';
  END IF;

  FOR v_match IN
    SELECT m.id
    FROM public.conciliacao_matches m
    JOIN public.conciliacao_extrato_linhas l ON l.id = m.extrato_linha_id
    JOIN public.financeiro_lancamentos fl ON fl.id = m.lancamento_id
    WHERE l.extrato_id = p_extrato_id
      AND m.empresa_id = v_extrato.empresa_id
      AND m.status = 'sugerido'
      AND m.match_tipo = '1:1'
      AND m.baixa_id IS NULL
      AND m.score >= v_regra.score_minimo
      AND abs(abs(coalesce(l.valor, 0)) - coalesce(fl.valor_total, 0)) <= v_regra.tolerancia_valor
      AND abs((l.data_movimento - fl.data_vencimento)) <= v_regra.tolerancia_dias
    ORDER BY m.score DESC, m.created_at ASC
  LOOP
    BEGIN
      SELECT * INTO v_result
      FROM public.conciliacao_decidir_match(
        v_match.id,
        'aprovar',
        'auto:regra#' || v_regra.id::text
      );

      v_aprovados := v_aprovados + 1;
      IF v_result.baixa_id IS NOT NULL THEN
        v_baixas := v_baixas + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_falhas := v_falhas + 1;
    END;
  END LOOP;

  matches_aprovados := v_aprovados;
  baixas_aplicadas := v_baixas;
  falhas := v_falhas;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.conciliacao_auto_aprovar(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.conciliacao_auto_aprovar(uuid) TO authenticated;