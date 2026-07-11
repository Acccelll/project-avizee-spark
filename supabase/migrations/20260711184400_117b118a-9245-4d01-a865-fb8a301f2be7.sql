-- Sprint 4 — Matching agrupado e baixa automática
-- Rollback controlado: restaurar constraints antigas e funções das Sprints 2/3, se necessário.

-- Corrige escala do score e amplia tipos de matching.
ALTER TABLE public.conciliacao_matches
  DROP CONSTRAINT IF EXISTS chk_conciliacao_matches_tipo,
  DROP CONSTRAINT IF EXISTS chk_conciliacao_matches_score;

ALTER TABLE public.conciliacao_matches
  ADD CONSTRAINT chk_conciliacao_matches_tipo
    CHECK (match_tipo IN ('manual', 'exato', 'regra', 'heuristico', 'ia', '1:1', 'N:1', '1:N')),
  ADD CONSTRAINT chk_conciliacao_matches_score
    CHECK (score >= 0 AND score <= 100);

-- operation_id precisa agrupar várias linhas; remove unicidade herdada da fundação.
ALTER TABLE public.conciliacao_matches
  DROP CONSTRAINT IF EXISTS ux_conciliacao_matches_operation;
DROP INDEX IF EXISTS ux_conciliacao_matches_operation;

CREATE INDEX IF NOT EXISTS idx_conciliacao_matches_operation
  ON public.conciliacao_matches (operation_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS ux_conciliacao_match_baixa_aplicada
  ON public.conciliacao_matches (baixa_id)
  WHERE baixa_id IS NOT NULL AND status = 'aplicado';

-- Recria a sugestão 1:1 preservando a escala 0-100.
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

  DELETE FROM public.conciliacao_matches m
  USING public.conciliacao_extrato_linhas l
  WHERE m.extrato_linha_id = l.id
    AND l.extrato_id = p_extrato_id
    AND m.status = 'sugerido';

  WITH linhas AS (
    SELECT id, empresa_id, valor, data_movimento, tipo_movimento, documento, descricao
    FROM public.conciliacao_extrato_linhas
    WHERE extrato_id = p_extrato_id
      AND status IN ('pendente', 'sugerida')
  ),
  candidatos AS (
    SELECT
      l.id AS linha_id,
      f.id AS lancamento_id,
      l.empresa_id,
      LEAST(100,
        60
        + GREATEST(0, 25 - (ABS(f.data_vencimento - l.data_movimento) * 5))
        + (COALESCE(similarity(COALESCE(f.titulo,''), COALESCE(l.documento,'')), 0) * 15)
      )::numeric(5,2) AS score
    FROM linhas l
    JOIN public.financeiro_lancamentos f
      ON f.empresa_id = l.empresa_id
     AND f.ativo = true
     AND f.status IN ('aberto', 'parcial')
     AND COALESCE(f.saldo_restante, f.valor) = ABS(l.valor)
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
      jsonb_build_array(jsonb_build_object('regra', 'deterministico_v2', 'tolerancia_dias', p_tolerancia_dias)),
      v_uid
    FROM ranked r
    WHERE r.rn = 1
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO v_sugestoes FROM inseridos;

  SELECT count(*) INTO v_linhas
  FROM public.conciliacao_extrato_linhas
  WHERE extrato_id = p_extrato_id;

  UPDATE public.conciliacao_extrato_linhas l
  SET status = 'sugerida', updated_at = now()
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

CREATE OR REPLACE FUNCTION public.conciliacao_sugerir_matches_agrupados(
  p_extrato_id uuid,
  p_tolerancia_dias int DEFAULT 3,
  p_min_score numeric DEFAULT 75
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

  DELETE FROM public.conciliacao_matches m
  USING public.conciliacao_extrato_linhas l
  WHERE m.extrato_linha_id = l.id
    AND l.extrato_id = p_extrato_id
    AND m.status = 'sugerido'
    AND m.match_tipo IN ('N:1', '1:N');

  WITH linhas_base AS (
    SELECT id, empresa_id, valor, ABS(valor) AS valor_abs, data_movimento, tipo_movimento
    FROM public.conciliacao_extrato_linhas
    WHERE extrato_id = p_extrato_id
      AND status IN ('pendente', 'sugerida')
  ),
  pares_linhas AS (
    SELECT
      l1.id AS linha_a_id,
      l2.id AS linha_b_id,
      l1.empresa_id,
      l1.tipo_movimento,
      (l1.valor_abs + l2.valor_abs)::numeric(14,2) AS soma_valor,
      GREATEST(l1.data_movimento, l2.data_movimento) AS data_ref
    FROM linhas_base l1
    JOIN linhas_base l2
      ON l2.empresa_id = l1.empresa_id
     AND l2.tipo_movimento = l1.tipo_movimento
     AND l2.id > l1.id
     AND ABS(l2.data_movimento - l1.data_movimento) <= p_tolerancia_dias
  ),
  candidatos_n1 AS (
    SELECT
      gen_random_uuid() AS op_id,
      p.empresa_id,
      p.linha_a_id,
      p.linha_b_id,
      f.id AS lancamento_id,
      LEAST(100, 75 + GREATEST(0, 25 - (ABS(f.data_vencimento - p.data_ref) * 5)))::numeric(5,2) AS score
    FROM pares_linhas p
    JOIN public.financeiro_lancamentos f
      ON f.empresa_id = p.empresa_id
     AND f.ativo = true
     AND f.status IN ('aberto', 'parcial')
     AND COALESCE(f.saldo_restante, f.valor) = p.soma_valor
     AND ((p.tipo_movimento = 'credito' AND f.tipo = 'receber')
       OR (p.tipo_movimento = 'debito' AND f.tipo = 'pagar'))
     AND ABS(f.data_vencimento - p.data_ref) <= p_tolerancia_dias
    WHERE NOT EXISTS (
      SELECT 1 FROM public.conciliacao_matches m
      WHERE m.status IN ('sugerido', 'aprovado', 'aplicado')
        AND (m.extrato_linha_id IN (p.linha_a_id, p.linha_b_id) OR m.lancamento_id = f.id)
    )
    LIMIT 100
  ),
  ins_n1_a AS (
    INSERT INTO public.conciliacao_matches
      (empresa_id, extrato_linha_id, lancamento_id, operation_id, match_tipo, status, score, motivos, sugerido_por)
    SELECT empresa_id, linha_a_id, lancamento_id, op_id, 'N:1', 'sugerido', score,
           jsonb_build_array(jsonb_build_object('regra', 'agrupado_n1_v1', 'tolerancia_dias', p_tolerancia_dias)), v_uid
    FROM candidatos_n1
    WHERE score >= p_min_score
    ON CONFLICT DO NOTHING
    RETURNING id
  ),
  ins_n1_b AS (
    INSERT INTO public.conciliacao_matches
      (empresa_id, extrato_linha_id, lancamento_id, operation_id, match_tipo, status, score, motivos, sugerido_por)
    SELECT empresa_id, linha_b_id, lancamento_id, op_id, 'N:1', 'sugerido', score,
           jsonb_build_array(jsonb_build_object('regra', 'agrupado_n1_v1', 'tolerancia_dias', p_tolerancia_dias)), v_uid
    FROM candidatos_n1
    WHERE score >= p_min_score
    ON CONFLICT DO NOTHING
    RETURNING id
  ),
  lanc_base AS (
    SELECT id, empresa_id, COALESCE(saldo_restante, valor) AS valor_aberto, data_vencimento, tipo
    FROM public.financeiro_lancamentos
    WHERE empresa_id = v_empresa_id
      AND ativo = true
      AND status IN ('aberto', 'parcial')
      AND COALESCE(saldo_restante, valor) > 0
  ),
  pares_lanc AS (
    SELECT
      f1.id AS lanc_a_id,
      f2.id AS lanc_b_id,
      f1.empresa_id,
      f1.tipo,
      (f1.valor_aberto + f2.valor_aberto)::numeric(14,2) AS soma_valor,
      GREATEST(f1.data_vencimento, f2.data_vencimento) AS data_ref
    FROM lanc_base f1
    JOIN lanc_base f2
      ON f2.empresa_id = f1.empresa_id
     AND f2.tipo = f1.tipo
     AND f2.id > f1.id
     AND ABS(f2.data_vencimento - f1.data_vencimento) <= p_tolerancia_dias
  ),
  candidatos_1n AS (
    SELECT
      gen_random_uuid() AS op_id,
      p.empresa_id,
      l.id AS linha_id,
      p.lanc_a_id,
      p.lanc_b_id,
      LEAST(100, 75 + GREATEST(0, 25 - (ABS(p.data_ref - l.data_movimento) * 5)))::numeric(5,2) AS score
    FROM pares_lanc p
    JOIN linhas_base l
      ON l.empresa_id = p.empresa_id
     AND l.valor_abs = p.soma_valor
     AND ((l.tipo_movimento = 'credito' AND p.tipo = 'receber')
       OR (l.tipo_movimento = 'debito' AND p.tipo = 'pagar'))
     AND ABS(p.data_ref - l.data_movimento) <= p_tolerancia_dias
    WHERE NOT EXISTS (
      SELECT 1 FROM public.conciliacao_matches m
      WHERE m.status IN ('sugerido', 'aprovado', 'aplicado')
        AND (m.extrato_linha_id = l.id OR m.lancamento_id IN (p.lanc_a_id, p.lanc_b_id))
    )
    LIMIT 100
  ),
  ins_1n_a AS (
    INSERT INTO public.conciliacao_matches
      (empresa_id, extrato_linha_id, lancamento_id, operation_id, match_tipo, status, score, motivos, sugerido_por)
    SELECT empresa_id, linha_id, lanc_a_id, op_id, '1:N', 'sugerido', score,
           jsonb_build_array(jsonb_build_object('regra', 'agrupado_1n_v1', 'tolerancia_dias', p_tolerancia_dias)), v_uid
    FROM candidatos_1n
    WHERE score >= p_min_score
    ON CONFLICT DO NOTHING
    RETURNING id
  ),
  ins_1n_b AS (
    INSERT INTO public.conciliacao_matches
      (empresa_id, extrato_linha_id, lancamento_id, operation_id, match_tipo, status, score, motivos, sugerido_por)
    SELECT empresa_id, linha_id, lanc_b_id, op_id, '1:N', 'sugerido', score,
           jsonb_build_array(jsonb_build_object('regra', 'agrupado_1n_v1', 'tolerancia_dias', p_tolerancia_dias)), v_uid
    FROM candidatos_1n
    WHERE score >= p_min_score
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT
    (SELECT count(*) FROM ins_n1_a) + (SELECT count(*) FROM ins_n1_b) +
    (SELECT count(*) FROM ins_1n_a) + (SELECT count(*) FROM ins_1n_b)
  INTO v_sugestoes;

  SELECT count(*) INTO v_linhas
  FROM public.conciliacao_extrato_linhas
  WHERE extrato_id = p_extrato_id;

  UPDATE public.conciliacao_extrato_linhas l
  SET status = 'sugerida', updated_at = now()
  WHERE l.extrato_id = p_extrato_id
    AND l.status = 'pendente'
    AND EXISTS (
      SELECT 1 FROM public.conciliacao_matches m
      WHERE m.extrato_linha_id = l.id AND m.status = 'sugerido'
    );

  RETURN QUERY SELECT v_sugestoes, v_linhas;
END;
$$;

REVOKE ALL ON FUNCTION public.conciliacao_sugerir_matches_agrupados(uuid, int, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.conciliacao_sugerir_matches_agrupados(uuid, int, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.conciliacao_aplicar_baixa(p_match_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.conciliacao_matches;
  v_linha public.conciliacao_extrato_linhas;
  v_lanc public.financeiro_lancamentos;
  v_baixa_id uuid;
  v_valor numeric;
BEGIN
  SELECT * INTO v_match
  FROM public.conciliacao_matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Match % não encontrado', p_match_id;
  END IF;

  IF v_match.baixa_id IS NOT NULL THEN
    RETURN v_match.baixa_id;
  END IF;

  SELECT * INTO v_linha
  FROM public.conciliacao_extrato_linhas
  WHERE id = v_match.extrato_linha_id
  FOR UPDATE;

  SELECT * INTO v_lanc
  FROM public.financeiro_lancamentos
  WHERE id = v_match.lancamento_id
  FOR UPDATE;

  IF v_linha.id IS NULL OR v_lanc.id IS NULL THEN
    RAISE EXCEPTION 'Dados do match incompletos';
  END IF;

  IF v_lanc.status NOT IN ('aberto', 'parcial') THEN
    RAISE EXCEPTION 'Lançamento % não aceita baixa no status %', v_lanc.id, v_lanc.status;
  END IF;

  v_valor := LEAST(ABS(v_linha.valor), COALESCE(v_lanc.saldo_restante, v_lanc.valor));
  IF v_valor <= 0 THEN
    RAISE EXCEPTION 'Valor de baixa inválido para o match %', p_match_id;
  END IF;

  INSERT INTO public.financeiro_baixas
    (empresa_id, lancamento_id, data_baixa, valor_pago, forma_pagamento, conta_bancaria_id,
     observacoes, valor_movimento_bancario, conciliacao_status, conciliacao_data,
     conciliacao_usuario, conciliacao_extrato_referencia)
  VALUES
    (v_match.empresa_id, v_match.lancamento_id, v_linha.data_movimento, v_valor, 'conciliacao_bancaria',
     v_linha.conta_bancaria_id, 'Baixa automática por conciliação v2', ABS(v_linha.valor),
     'conciliado', now(), auth.uid(), v_linha.id::text)
  RETURNING id INTO v_baixa_id;

  UPDATE public.financeiro_lancamentos
  SET valor_pago = COALESCE(valor_pago, 0) + v_valor,
      saldo_restante = GREATEST(COALESCE(saldo_restante, valor) - v_valor, 0),
      status = CASE
        WHEN GREATEST(COALESCE(saldo_restante, valor) - v_valor, 0) <= 0.009 THEN 'pago'
        ELSE 'parcial'
      END,
      data_pagamento = CASE
        WHEN GREATEST(COALESCE(saldo_restante, valor) - v_valor, 0) <= 0.009 THEN v_linha.data_movimento
        ELSE data_pagamento
      END,
      conta_bancaria_id = COALESCE(conta_bancaria_id, v_linha.conta_bancaria_id),
      updated_at = now()
  WHERE id = v_match.lancamento_id;

  UPDATE public.conciliacao_matches
  SET baixa_id = v_baixa_id, updated_at = now()
  WHERE id = p_match_id;

  RETURN v_baixa_id;
END;
$$;

REVOKE ALL ON FUNCTION public.conciliacao_aplicar_baixa(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.conciliacao_aplicar_baixa(uuid) TO authenticated;

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
  v_operacao uuid;
  v_match_ids uuid[];
  v_current_id uuid;
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

  v_operacao := v_match.operation_id;

  SELECT array_agg(id ORDER BY created_at, id) INTO v_match_ids
  FROM public.conciliacao_matches
  WHERE operation_id = v_operacao
    AND empresa_id = v_match.empresa_id
    AND status = 'sugerido';

  IF p_decisao = 'aprovar' THEN
    UPDATE public.conciliacao_matches
    SET status = 'aprovado',
        aprovado_por = v_uid,
        aprovado_em = now(),
        observacao = COALESCE(p_motivo, observacao),
        updated_at = now()
    WHERE id = ANY(v_match_ids);

    FOREACH v_current_id IN ARRAY v_match_ids LOOP
      PERFORM public.conciliacao_aplicar_baixa(v_current_id);
    END LOOP;

    UPDATE public.conciliacao_matches
    SET status = 'aplicado', updated_at = now()
    WHERE id = ANY(v_match_ids);

    UPDATE public.conciliacao_extrato_linhas
    SET status = 'conciliada', updated_at = now()
    WHERE id IN (
      SELECT DISTINCT extrato_linha_id
      FROM public.conciliacao_matches
      WHERE id = ANY(v_match_ids)
    );

    UPDATE public.conciliacao_matches m
    SET status = 'rejeitado',
        rejeitado_por = v_uid,
        rejeitado_em = now(),
        observacao = 'Auto-rejeitado: sugestão concorrente aprovada',
        updated_at = now()
    WHERE m.status = 'sugerido'
      AND m.empresa_id = v_match.empresa_id
      AND m.id <> ALL(v_match_ids)
      AND (
        m.extrato_linha_id IN (SELECT extrato_linha_id FROM public.conciliacao_matches WHERE id = ANY(v_match_ids))
        OR m.lancamento_id IN (SELECT lancamento_id FROM public.conciliacao_matches WHERE id = ANY(v_match_ids))
      );
  ELSE
    UPDATE public.conciliacao_matches
    SET status = 'rejeitado',
        rejeitado_por = v_uid,
        rejeitado_em = now(),
        observacao = p_motivo,
        updated_at = now()
    WHERE id = ANY(v_match_ids);

    UPDATE public.conciliacao_extrato_linhas l
    SET status = 'pendente', updated_at = now()
    WHERE l.id IN (
      SELECT DISTINCT extrato_linha_id
      FROM public.conciliacao_matches
      WHERE id = ANY(v_match_ids)
    )
      AND NOT EXISTS (
        SELECT 1 FROM public.conciliacao_matches m
        WHERE m.extrato_linha_id = l.id AND m.status = 'sugerido'
      );
  END IF;

  SELECT * INTO v_match FROM public.conciliacao_matches WHERE id = p_match_id;
  RETURN v_match;
END;
$$;

REVOKE ALL ON FUNCTION public.conciliacao_decidir_match(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.conciliacao_decidir_match(uuid, text, text) TO authenticated;