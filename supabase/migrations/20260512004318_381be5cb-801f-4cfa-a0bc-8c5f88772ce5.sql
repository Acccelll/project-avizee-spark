CREATE OR REPLACE FUNCTION public.kpis_financeiro(
  p_date_from date DEFAULT NULL,
  p_date_to   date DEFAULT NULL,
  p_tipos     text[] DEFAULT NULL,
  p_status    text[] DEFAULT NULL,
  p_bancos    uuid[] DEFAULT NULL,
  p_origens   text[] DEFAULT NULL,
  p_formas    text[] DEFAULT NULL,
  p_cartoes   uuid[] DEFAULT NULL,
  p_search    text   DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
WITH base AS (
  SELECT
    l.id,
    l.valor,
    l.data_vencimento,
    l.descricao,
    CASE
      WHEN l.status = 'aberto' AND l.data_vencimento < CURRENT_DATE THEN 'vencido'
      ELSE l.status
    END AS effective_status
  FROM public.financeiro_lancamentos l
  LEFT JOIN public.clientes        c  ON c.id  = l.cliente_id
  LEFT JOIN public.fornecedores    f  ON f.id  = l.fornecedor_id
  LEFT JOIN public.contas_bancarias cb ON cb.id = l.conta_bancaria_id
  LEFT JOIN public.bancos          b  ON b.id  = cb.banco_id
  WHERE l.ativo = true
    AND (p_date_from IS NULL OR l.data_vencimento >= p_date_from)
    AND (p_date_to   IS NULL OR l.data_vencimento <= p_date_to)
    AND (p_tipos   IS NULL OR cardinality(p_tipos)   = 0 OR l.tipo            = ANY(p_tipos))
    AND (p_bancos  IS NULL OR cardinality(p_bancos)  = 0 OR l.conta_bancaria_id = ANY(p_bancos))
    AND (p_origens IS NULL OR cardinality(p_origens) = 0 OR coalesce(l.origem_tipo,'manual') = ANY(p_origens))
    AND (p_formas  IS NULL OR cardinality(p_formas)  = 0 OR l.forma_pagamento = ANY(p_formas))
    AND (p_cartoes IS NULL OR cardinality(p_cartoes) = 0 OR l.cartao_id       = ANY(p_cartoes))
    AND (
      p_search IS NULL OR length(trim(p_search)) = 0
      OR l.descricao         ILIKE '%' || p_search || '%'
      OR l.forma_pagamento   ILIKE '%' || p_search || '%'
      OR c.nome_razao_social ILIKE '%' || p_search || '%'
      OR f.nome_razao_social ILIKE '%' || p_search || '%'
      OR cb.descricao        ILIKE '%' || p_search || '%'
      OR b.nome              ILIKE '%' || p_search || '%'
    )
),
filtered AS (
  SELECT *
  FROM base
  WHERE p_status IS NULL OR cardinality(p_status) = 0 OR effective_status = ANY(p_status)
)
SELECT jsonb_build_object(
  'totalCount', (SELECT count(*) FROM filtered),
  'a_vencer',     (SELECT count(*) FROM filtered WHERE effective_status = 'aberto'  AND data_vencimento >  CURRENT_DATE),
  'vence_hoje',   (SELECT count(*) FROM filtered WHERE effective_status = 'aberto'  AND data_vencimento =  CURRENT_DATE),
  'vencido',      (SELECT count(*) FROM filtered WHERE effective_status = 'vencido'),
  'pago',         (SELECT count(*) FROM filtered WHERE effective_status = 'pago'),
  'parcial',      (SELECT count(*) FROM filtered WHERE effective_status = 'parcial'),
  'total_a_vencer', (SELECT coalesce(sum(valor),0) FROM filtered WHERE effective_status = 'aberto'),
  'total_vencido',  (SELECT coalesce(sum(valor),0) FROM filtered WHERE effective_status = 'vencido'),
  'total_pago',     (SELECT coalesce(sum(valor),0) FROM filtered WHERE effective_status = 'pago'),
  'total_parcial',  (SELECT coalesce(sum(valor),0) FROM filtered WHERE effective_status = 'parcial')
);
$$;

GRANT EXECUTE ON FUNCTION public.kpis_financeiro(date,date,text[],text[],uuid[],text[],text[],uuid[],text)
  TO authenticated;

COMMENT ON FUNCTION public.kpis_financeiro IS
  'KPIs do modulo Financeiro. Busca cross-table (cliente/fornecedor/banco/forma) alinhada com listar_financeiro_lancamentos_ids para manter cards e listagem coerentes.';