
-- 1. Origem em cartao_faturas
ALTER TABLE public.cartao_faturas
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual';

ALTER TABLE public.cartao_faturas
  DROP CONSTRAINT IF EXISTS chk_cartao_faturas_origem;
ALTER TABLE public.cartao_faturas
  ADD CONSTRAINT chk_cartao_faturas_origem
  CHECK (origem IN ('manual','pdf_c6','pdf_inter','pdf_recargapay','pdf_generico'));

-- Único por (cartao_id, competencia)
CREATE UNIQUE INDEX IF NOT EXISTS ux_cartao_faturas_cartao_competencia
  ON public.cartao_faturas (cartao_id, competencia);

-- 2. Hash único por fatura + hash
CREATE UNIQUE INDEX IF NOT EXISTS ux_cartao_fatura_lanc_hash
  ON public.cartao_fatura_lancamentos (cartao_fatura_id, hash)
  WHERE hash IS NOT NULL;

-- 3. RPC de importação idempotente
CREATE OR REPLACE FUNCTION public.cartao_importar_fatura(
  p_empresa_id uuid,
  p_cartao_id uuid,
  p_competencia text,
  p_data_vencimento date,
  p_data_fechamento date,
  p_valor_total numeric,
  p_origem text,
  p_linhas jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fatura_id uuid;
  v_inseridas int := 0;
  v_duplicadas int := 0;
  v_linha jsonb;
  v_hash text;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro')) THEN
    RAISE EXCEPTION 'permissao_negada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.cartoes_credito
    WHERE id = p_cartao_id AND empresa_id = p_empresa_id
  ) THEN
    RAISE EXCEPTION 'cartao_nao_encontrado';
  END IF;

  INSERT INTO public.cartao_faturas (
    empresa_id, cartao_id, competencia, data_fechamento, data_vencimento,
    valor_total, status, origem
  ) VALUES (
    p_empresa_id, p_cartao_id, p_competencia, p_data_fechamento, p_data_vencimento,
    p_valor_total, 'aberta', p_origem
  )
  ON CONFLICT (cartao_id, competencia) DO UPDATE
    SET data_vencimento = EXCLUDED.data_vencimento,
        data_fechamento = EXCLUDED.data_fechamento,
        valor_total = EXCLUDED.valor_total,
        origem = EXCLUDED.origem,
        updated_at = now()
  RETURNING id INTO v_fatura_id;

  FOR v_linha IN SELECT * FROM jsonb_array_elements(p_linhas)
  LOOP
    v_hash := encode(
      digest(
        coalesce(v_linha->>'data_compra','') || '|' ||
        coalesce(v_linha->>'valor','') || '|' ||
        coalesce(v_linha->>'descricao','') || '|' ||
        coalesce(v_linha->>'parcela_atual','') || '/' || coalesce(v_linha->>'parcela_total',''),
        'sha256'
      ),
      'hex'
    );

    BEGIN
      INSERT INTO public.cartao_fatura_lancamentos (
        empresa_id, cartao_fatura_id, data_compra, descricao, estabelecimento,
        valor, parcela_atual, parcela_total, hash, status
      ) VALUES (
        p_empresa_id, v_fatura_id,
        (v_linha->>'data_compra')::date,
        v_linha->>'descricao',
        v_linha->>'estabelecimento',
        (v_linha->>'valor')::numeric,
        NULLIF(v_linha->>'parcela_atual','')::int,
        NULLIF(v_linha->>'parcela_total','')::int,
        v_hash,
        'pendente'
      );
      v_inseridas := v_inseridas + 1;
    EXCEPTION WHEN unique_violation THEN
      v_duplicadas := v_duplicadas + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'fatura_id', v_fatura_id,
    'inseridas', v_inseridas,
    'duplicadas', v_duplicadas
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cartao_importar_fatura(uuid,uuid,text,date,date,numeric,text,jsonb) TO authenticated;

-- 4. RPC de KPIs do dashboard de cartão
CREATE OR REPLACE FUNCTION public.cartao_dashboard_kpis(
  p_periodo_inicio date DEFAULT NULL,
  p_periodo_fim date DEFAULT NULL,
  p_cartao_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid := public.current_empresa_id();
  v_total int;
  v_conciliadas int;
  v_pendentes int;
  v_valor_total numeric;
  v_ticket_medio numeric;
  v_por_cartao jsonb;
BEGIN
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'empresa_nao_definida';
  END IF;

  WITH base AS (
    SELECT l.*, f.cartao_id, c.nome AS cartao_nome, c.ultimos4
    FROM public.cartao_fatura_lancamentos l
    JOIN public.cartao_faturas f ON f.id = l.cartao_fatura_id
    JOIN public.cartoes_credito c ON c.id = f.cartao_id
    WHERE l.empresa_id = v_empresa
      AND (p_periodo_inicio IS NULL OR l.data_compra >= p_periodo_inicio)
      AND (p_periodo_fim IS NULL OR l.data_compra <= p_periodo_fim)
      AND (p_cartao_id IS NULL OR f.cartao_id = p_cartao_id)
  )
  SELECT
    count(*)::int,
    count(*) FILTER (WHERE status = 'conciliado')::int,
    count(*) FILTER (WHERE status = 'pendente')::int,
    coalesce(sum(valor), 0),
    coalesce(avg(valor), 0)
  INTO v_total, v_conciliadas, v_pendentes, v_valor_total, v_ticket_medio
  FROM base;

  SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_por_cartao
  FROM (
    SELECT c.id AS cartao_id,
           c.nome AS cartao_nome,
           c.ultimos4,
           count(l.*)::int AS total,
           count(l.*) FILTER (WHERE l.status = 'conciliado')::int AS conciliadas,
           coalesce(sum(l.valor), 0) AS valor_total
    FROM public.cartoes_credito c
    LEFT JOIN public.cartao_faturas f ON f.cartao_id = c.id
    LEFT JOIN public.cartao_fatura_lancamentos l ON l.cartao_fatura_id = f.id
      AND (p_periodo_inicio IS NULL OR l.data_compra >= p_periodo_inicio)
      AND (p_periodo_fim IS NULL OR l.data_compra <= p_periodo_fim)
    WHERE c.empresa_id = v_empresa
      AND (p_cartao_id IS NULL OR c.id = p_cartao_id)
    GROUP BY c.id, c.nome, c.ultimos4
    ORDER BY valor_total DESC
  ) t;

  RETURN jsonb_build_object(
    'total', v_total,
    'conciliadas', v_conciliadas,
    'pendentes', v_pendentes,
    'valor_total', v_valor_total,
    'ticket_medio', v_ticket_medio,
    'por_cartao', v_por_cartao
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cartao_dashboard_kpis(date,date,uuid) TO authenticated;
