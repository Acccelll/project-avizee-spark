-- =========================================================================
-- IA / Auditoria: 3 detectores determinísticos de anomalias (admin only)
-- Todos com search_path = public e gate via public.has_role('admin').
-- =========================================================================

-- 1) Divergência de preço unitário em compras vs. mediana histórica do produto
CREATE OR REPLACE FUNCTION public.detectar_divergencia_preco_compra(
  p_limite_desvio numeric DEFAULT 0.30,
  p_janela integer DEFAULT 20
)
RETURNS TABLE (
  compra_item_id uuid,
  compra_id uuid,
  produto_id uuid,
  fornecedor_id uuid,
  data_compra date,
  valor_unitario numeric,
  mediana numeric,
  desvio_percentual numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: requer papel admin';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      ci.id           AS compra_item_id,
      ci.compra_id,
      ci.produto_id,
      c.fornecedor_id,
      c.data_compra,
      ci.valor_unitario::numeric AS valor_unitario,
      ROW_NUMBER() OVER (
        PARTITION BY ci.produto_id
        ORDER BY c.data_compra DESC NULLS LAST
      ) AS rn
    FROM public.compras_itens ci
    JOIN public.compras c ON c.id = ci.compra_id
    WHERE ci.produto_id IS NOT NULL
      AND ci.valor_unitario IS NOT NULL
      AND ci.valor_unitario > 0
  ),
  janelados AS (
    SELECT * FROM base WHERE rn <= p_janela
  ),
  medianas AS (
    SELECT
      produto_id,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY valor_unitario) AS mediana
    FROM janelados
    GROUP BY produto_id
    HAVING COUNT(*) >= 3   -- precisa de histórico mínimo para ser confiável
  )
  SELECT
    j.compra_item_id,
    j.compra_id,
    j.produto_id,
    j.fornecedor_id,
    j.data_compra,
    j.valor_unitario,
    m.mediana,
    ROUND(((j.valor_unitario - m.mediana) / NULLIF(m.mediana, 0))::numeric, 4) AS desvio_percentual
  FROM janelados j
  JOIN medianas m USING (produto_id)
  WHERE m.mediana > 0
    AND ABS((j.valor_unitario - m.mediana) / m.mediana) >= p_limite_desvio
  ORDER BY ABS((j.valor_unitario - m.mediana) / m.mediana) DESC
  LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.detectar_divergencia_preco_compra(numeric, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.detectar_divergencia_preco_compra(numeric, integer) TO authenticated;

-- 2) NF duplicada (por fornecedor+número+série, ou por chave_acesso)
CREATE OR REPLACE FUNCTION public.detectar_nf_duplicada()
RETURNS TABLE (
  motivo text,
  fornecedor_id uuid,
  numero text,
  serie text,
  chave_acesso text,
  quantidade integer,
  nota_ids uuid[],
  valor_total numeric,
  data_emissao_min date,
  data_emissao_max date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: requer papel admin';
  END IF;

  RETURN QUERY
  -- Grupos por fornecedor + numero + serie (apenas notas com fornecedor; ignora canceladas)
  SELECT
    'fornecedor_numero_serie'::text AS motivo,
    nf.fornecedor_id,
    nf.numero::text,
    COALESCE(nf.serie::text, '')::text,
    NULL::text AS chave_acesso,
    COUNT(*)::integer AS quantidade,
    ARRAY_AGG(nf.id ORDER BY nf.data_emissao) AS nota_ids,
    SUM(nf.valor_total)::numeric AS valor_total,
    MIN(nf.data_emissao) AS data_emissao_min,
    MAX(nf.data_emissao) AS data_emissao_max
  FROM public.notas_fiscais nf
  WHERE nf.fornecedor_id IS NOT NULL
    AND nf.numero IS NOT NULL
    AND COALESCE(nf.status, '') <> 'cancelada'
  GROUP BY nf.fornecedor_id, nf.numero, nf.serie
  HAVING COUNT(*) > 1

  UNION ALL

  -- Grupos por chave_acesso (44 chars)
  SELECT
    'chave_acesso'::text AS motivo,
    NULL::uuid AS fornecedor_id,
    NULL::text AS numero,
    NULL::text AS serie,
    nf.chave_acesso::text,
    COUNT(*)::integer AS quantidade,
    ARRAY_AGG(nf.id ORDER BY nf.data_emissao) AS nota_ids,
    SUM(nf.valor_total)::numeric AS valor_total,
    MIN(nf.data_emissao) AS data_emissao_min,
    MAX(nf.data_emissao) AS data_emissao_max
  FROM public.notas_fiscais nf
  WHERE nf.chave_acesso IS NOT NULL
    AND LENGTH(nf.chave_acesso) = 44
    AND COALESCE(nf.status, '') <> 'cancelada'
  GROUP BY nf.chave_acesso
  HAVING COUNT(*) > 1
  LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.detectar_nf_duplicada() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.detectar_nf_duplicada() TO authenticated;

-- 3) Gasto fora do padrão por conta contábil (últimos 90 dias, média + 2σ)
CREATE OR REPLACE FUNCTION public.detectar_gasto_fora_padrao(
  p_dias integer DEFAULT 90,
  p_z numeric DEFAULT 2.0
)
RETURNS TABLE (
  lancamento_id uuid,
  conta_contabil_id uuid,
  fornecedor_id uuid,
  descricao text,
  valor numeric,
  data_vencimento date,
  media numeric,
  desvio numeric,
  z_score numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: requer papel admin';
  END IF;

  RETURN QUERY
  WITH janela AS (
    SELECT
      fl.id,
      fl.conta_contabil_id,
      fl.fornecedor_id,
      fl.descricao,
      fl.valor::numeric AS valor,
      fl.data_vencimento
    FROM public.financeiro_lancamentos fl
    WHERE fl.conta_contabil_id IS NOT NULL
      AND COALESCE(fl.status, '') <> 'cancelado'
      AND fl.tipo = 'pagar'
      AND fl.data_vencimento >= (CURRENT_DATE - (p_dias || ' days')::interval)
  ),
  stats AS (
    SELECT
      conta_contabil_id,
      AVG(valor)    AS media,
      STDDEV_POP(valor) AS desvio,
      COUNT(*) AS qtd
    FROM janela
    GROUP BY conta_contabil_id
    HAVING COUNT(*) >= 5
  )
  SELECT
    j.id AS lancamento_id,
    j.conta_contabil_id,
    j.fornecedor_id,
    j.descricao,
    j.valor,
    j.data_vencimento,
    ROUND(s.media::numeric, 2) AS media,
    ROUND(COALESCE(s.desvio, 0)::numeric, 2) AS desvio,
    CASE
      WHEN COALESCE(s.desvio, 0) > 0
        THEN ROUND(((j.valor - s.media) / s.desvio)::numeric, 2)
      ELSE NULL
    END AS z_score
  FROM janela j
  JOIN stats s USING (conta_contabil_id)
  WHERE s.desvio IS NOT NULL
    AND s.desvio > 0
    AND j.valor > s.media + (p_z * s.desvio)
  ORDER BY ((j.valor - s.media) / NULLIF(s.desvio, 0)) DESC
  LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.detectar_gasto_fora_padrao(integer, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.detectar_gasto_fora_padrao(integer, numeric) TO authenticated;
