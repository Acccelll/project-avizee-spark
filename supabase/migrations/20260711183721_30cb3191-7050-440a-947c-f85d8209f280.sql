-- Sprint 2 — Motor de Matching Conciliação v2
-- Rollback: DROP FUNCTION IF EXISTS public.conciliacao_sugerir_matches(uuid, int, numeric);

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_fin_lanc_matching
  ON public.financeiro_lancamentos (empresa_id, status, valor, data_vencimento)
  WHERE ativo = true;

CREATE INDEX IF NOT EXISTS idx_fin_lanc_documento_trgm
  ON public.financeiro_lancamentos USING gin (titulo gin_trgm_ops)
  WHERE ativo = true;

CREATE INDEX IF NOT EXISTS idx_conc_linhas_matching
  ON public.conciliacao_extrato_linhas (extrato_id, status, valor, data_movimento);

CREATE INDEX IF NOT EXISTS idx_conc_linhas_documento_trgm
  ON public.conciliacao_extrato_linhas USING gin (documento gin_trgm_ops);

-- RPC: conciliacao_sugerir_matches
CREATE OR REPLACE FUNCTION public.conciliacao_sugerir_matches(
  p_extrato_id uuid,
  p_tolerancia_dias int DEFAULT 3,
  p_min_score numeric DEFAULT 60
)
RETURNS TABLE (sugestoes_criadas int, linhas_processadas int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_uid uuid := auth.uid();
  v_sugestoes int := 0;
  v_linhas int := 0;
BEGIN
  SELECT empresa_id INTO v_empresa_id
  FROM public.conciliacao_extratos
  WHERE id = p_extrato_id;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Extrato % não encontrado', p_extrato_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_empresas
    WHERE user_id = v_uid AND empresa_id = v_empresa_id
  ) THEN
    RAISE EXCEPTION 'Sem acesso à empresa do extrato';
  END IF;

  -- Remove sugestões anteriores ainda não decididas para este extrato
  DELETE FROM public.conciliacao_matches m
  USING public.conciliacao_extrato_linhas l
  WHERE m.extrato_linha_id = l.id
    AND l.extrato_id = p_extrato_id
    AND m.status = 'sugerido';

  WITH linhas AS (
    SELECT id, empresa_id, valor, data_movimento, tipo_movimento, documento, descricao
    FROM public.conciliacao_extrato_linhas
    WHERE extrato_id = p_extrato_id
      AND status IN ('pendente', 'sugerido')
  ),
  candidatos AS (
    SELECT
      l.id AS linha_id,
      f.id AS lancamento_id,
      l.empresa_id,
      -- score: 60 (valor exato) + até 25 (proximidade data) + até 15 (similaridade documento)
      (60
        + GREATEST(0, 25 - (ABS(f.data_vencimento - l.data_movimento) * 5))
        + (COALESCE(similarity(COALESCE(f.titulo,''), COALESCE(l.documento,'')), 0) * 15)
      )::numeric(5,2) AS score
    FROM linhas l
    JOIN public.financeiro_lancamentos f
      ON f.empresa_id = l.empresa_id
     AND f.ativo = true
     AND f.status IN ('aberto', 'parcial')
     AND f.valor = ABS(l.valor)
     AND ((l.tipo_movimento = 'credito' AND f.tipo = 'receber')
       OR (l.tipo_movimento = 'debito'  AND f.tipo = 'pagar'))
     AND ABS(f.data_vencimento - l.data_movimento) <= p_tolerancia_dias
  ),
  ranked AS (
    SELECT c.*, ROW_NUMBER() OVER (PARTITION BY c.linha_id ORDER BY c.score DESC) AS rn
    FROM candidatos c
    WHERE c.score >= p_min_score
  ),
  inseridos AS (
    INSERT INTO public.conciliacao_matches
      (empresa_id, extrato_linha_id, lancamento_id, match_tipo, status, score, motivos, sugerido_por)
    SELECT
      r.empresa_id, r.linha_id, r.lancamento_id, '1:1', 'sugerido', r.score,
      jsonb_build_object('regra', 'deterministico_v1', 'tolerancia_dias', p_tolerancia_dias),
      v_uid
    FROM ranked r
    WHERE r.rn = 1
    RETURNING id
  )
  SELECT count(*) INTO v_sugestoes FROM inseridos;

  SELECT count(*) INTO v_linhas
  FROM public.conciliacao_extrato_linhas
  WHERE extrato_id = p_extrato_id;

  -- Atualiza status das linhas com sugestão
  UPDATE public.conciliacao_extrato_linhas l
  SET status = 'sugerido', updated_at = now()
  WHERE l.extrato_id = p_extrato_id
    AND l.status = 'pendente'
    AND EXISTS (
      SELECT 1 FROM public.conciliacao_matches m
      WHERE m.extrato_linha_id = l.id AND m.status = 'sugerido'
    );

  RETURN QUERY SELECT v_sugestoes, v_linhas;
END;
$$;

REVOKE ALL ON FUNCTION public.conciliacao_sugerir_matches(uuid, int, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.conciliacao_sugerir_matches(uuid, int, numeric) TO authenticated;