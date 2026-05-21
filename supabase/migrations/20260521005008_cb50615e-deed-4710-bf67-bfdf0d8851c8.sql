CREATE OR REPLACE FUNCTION public.kpis_financeiro(
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_tipos text[] DEFAULT NULL::text[],
  p_status text[] DEFAULT NULL::text[],
  p_bancos uuid[] DEFAULT NULL::uuid[],
  p_origens text[] DEFAULT NULL::text[],
  p_formas text[] DEFAULT NULL::text[],
  p_cartoes uuid[] DEFAULT NULL::uuid[],
  p_search text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
WITH params AS (
  SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS hoje_brt
),
base AS (
  SELECT
    l.id,
    l.valor,
    l.data_vencimento,
    l.descricao,
    CASE
      WHEN l.status = 'aberto' AND l.data_vencimento < (SELECT hoje_brt FROM params) THEN 'vencido'
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
    AND (p_tipos     IS NULL OR l.tipo = ANY(p_tipos))
    AND (p_bancos    IS NULL OR l.conta_bancaria_id = ANY(p_bancos))
    AND (p_origens   IS NULL OR coalesce(l.origem_tipo,'manual') = ANY(p_origens))
    AND (p_formas    IS NULL OR l.forma_pagamento = ANY(p_formas))
    AND (p_cartoes   IS NULL OR l.cartao_id = ANY(p_cartoes))
    AND (
      p_search IS NULL OR p_search = '' OR
      l.descricao ILIKE '%'||p_search||'%' OR
      c.nome_razao_social ILIKE '%'||p_search||'%' OR
      f.nome_razao_social ILIKE '%'||p_search||'%' OR
      cb.descricao ILIKE '%'||p_search||'%' OR
      b.nome ILIKE '%'||p_search||'%'
    )
),
filtered AS (
  SELECT * FROM base
  WHERE (p_status IS NULL OR effective_status = ANY(p_status))
)
SELECT jsonb_build_object(
  'a_vencer',     (SELECT count(*) FROM filtered WHERE effective_status = 'aberto' AND data_vencimento > (SELECT hoje_brt FROM params)),
  'vence_hoje',   (SELECT count(*) FROM filtered WHERE effective_status = 'aberto' AND data_vencimento = (SELECT hoje_brt FROM params)),
  'vencido',      (SELECT count(*) FROM filtered WHERE effective_status = 'vencido'),
  'pago',         (SELECT count(*) FROM filtered WHERE effective_status = 'pago'),
  'parcial',      (SELECT count(*) FROM filtered WHERE effective_status = 'parcial'),
  'total_a_vencer', (SELECT coalesce(sum(valor),0) FROM filtered WHERE effective_status = 'aberto'),
  'total_vencido',  (SELECT coalesce(sum(valor),0) FROM filtered WHERE effective_status = 'vencido'),
  'total_pago',     (SELECT coalesce(sum(valor),0) FROM filtered WHERE effective_status = 'pago'),
  'total_parcial',  (SELECT coalesce(sum(valor),0) FROM filtered WHERE effective_status = 'parcial')
);
$function$;