-- Rodada corretiva PR42 - Apresentacao Gerencial

-- 1) Seed/config do template compatível com resolver
UPDATE public.apresentacao_templates
SET config_json = jsonb_build_object(
  'slides', (
    SELECT jsonb_agg(jsonb_build_object('codigo', s.codigo, 'enabled', s.enabled, 'order', s.ordem) ORDER BY s.ordem)
    FROM (
      VALUES
        ('cover', true, 1),
        ('highlights_financeiros', true, 2),
        ('faturamento', true, 3),
        ('despesas', true, 4),
        ('rol_caixa', true, 5),
        ('receita_vs_despesa', true, 6),
        ('fopag', true, 7),
        ('fluxo_caixa', true, 8),
        ('lucro_produto_cliente', true, 9),
        ('variacao_estoque', true, 10),
        ('venda_estado', true, 11),
        ('redes_sociais', true, 12),
        ('closing', true, 13),
        ('bridge_ebitda', false, 21),
        ('bridge_lucro_liquido', false, 22),
        ('dre_gerencial', false, 23),
        ('capital_giro', false, 24),
        ('balanco_gerencial', false, 25),
        ('resultado_financeiro', false, 26),
        ('tributos', false, 27),
        ('aging_consolidado', false, 28),
        ('debt', false, 29),
        ('bancos_detalhado', false, 30),
        ('backorder', false, 31),
        ('top_clientes', false, 32),
        ('top_fornecedores', false, 33),
        ('inadimplencia', false, 34),
        ('performance_comercial_canal', false, 35)
    ) AS s(codigo, enabled, ordem)
  )
)
WHERE codigo = 'APRESENTACAO_GERENCIAL_V1' AND (config_json IS NULL OR jsonb_typeof(config_json->'slides') != 'array' OR jsonb_typeof((config_json->'slides')->0) = 'string');

-- 2) Views sem current_date fingindo histórico
CREATE OR REPLACE VIEW public.vw_apresentacao_highlights_financeiros AS
SELECT
  COALESCE(r.competencia, d.competencia) AS competencia,
  COALESCE(r.total_receita, 0) AS receita_atual,
  COALESCE(d.total_despesa, 0) AS despesa_atual,
  COALESCE(r.total_receita, 0) - COALESCE(d.total_despesa, 0) AS resultado,
  COALESCE(r.total_recebido, 0) AS recebido,
  COALESCE(d.total_pago, 0) AS pago,
  COALESCE(r.total_receita, 0) - COALESCE(d.total_despesa, 0) AS valor_atual
FROM public.vw_workbook_receita_mensal r
FULL OUTER JOIN public.vw_workbook_despesa_mensal d ON d.competencia = r.competencia;

CREATE OR REPLACE VIEW public.vw_apresentacao_rol_caixa AS
SELECT
  fcs.competencia,
  COALESCE(SUM(fcs.saldo), 0) AS valor_atual,
  COALESCE(MAX(r.total_receita), 0) AS rol,
  CASE WHEN COALESCE(MAX(r.total_receita), 0) = 0 THEN 0
       ELSE (COALESCE(SUM(fcs.saldo), 0) / NULLIF(MAX(r.total_receita), 0)) * 100
  END AS cobertura_pct
FROM public.fechamento_caixa_saldos fcs
LEFT JOIN public.vw_workbook_receita_mensal r ON r.competencia = fcs.competencia
GROUP BY fcs.competencia;

CREATE OR REPLACE VIEW public.vw_apresentacao_variacao_estoque AS
SELECT
  fes.competencia,
  SUM(COALESCE(fes.valor_custo, 0)) AS valor_atual,
  COUNT(*) AS quantidade_itens
FROM public.fechamento_estoque_saldos fes
GROUP BY fes.competencia;

CREATE OR REPLACE VIEW public.vw_apresentacao_redes_sociais AS
SELECT
  v.competencia,
  true AS indisponivel,
  'dados indisponíveis'::text AS motivo,
  0::numeric AS seguidores_novos,
  0::numeric AS valor_atual
FROM (SELECT DISTINCT competencia FROM public.vw_workbook_faturamento_mensal) v
;

CREATE OR REPLACE VIEW public.vw_apresentacao_capital_giro AS
SELECT
  COALESCE(cr.competencia, cp.competencia) AS competencia,
  COALESCE(cr.total_cr, 0) AS contas_receber,
  COALESCE(cp.total_cp, 0) AS contas_pagar,
  COALESCE(cr.total_cr, 0) - COALESCE(cp.total_cp, 0) AS valor_atual
FROM (
  SELECT to_char(data_vencimento::date, 'YYYY-MM') AS competencia, SUM(saldo_aberto) AS total_cr
  FROM public.vw_workbook_aging_cr
  GROUP BY 1
) cr
FULL OUTER JOIN (
  SELECT to_char(data_vencimento::date, 'YYYY-MM') AS competencia, SUM(saldo_aberto) AS total_cp
  FROM public.vw_workbook_aging_cp
  GROUP BY 1
) cp ON cp.competencia = cr.competencia;

CREATE OR REPLACE VIEW public.vw_apresentacao_balanco_gerencial AS
SELECT
  x.competencia,
  x.ativo_circulante,
  x.passivo_circulante,
  x.ativo_circulante - x.passivo_circulante AS valor_atual
FROM (
  SELECT
    fcs.competencia,
    SUM(COALESCE(fcs.saldo, 0)) AS ativo_circulante,
    COALESCE((
      SELECT SUM(saldo_total)
      FROM public.fechamento_financeiro_saldos ffs
      WHERE ffs.competencia = fcs.competencia AND ffs.tipo = 'pagar'
    ), 0) AS passivo_circulante
  FROM public.fechamento_caixa_saldos fcs
  GROUP BY fcs.competencia
) x;

CREATE OR REPLACE VIEW public.vw_apresentacao_aging_consolidado AS
SELECT
  competencia,
  SUM(CASE WHEN tipo = 'receber' THEN saldo_total ELSE 0 END) AS cr_aberto,
  SUM(CASE WHEN tipo = 'pagar' THEN saldo_total ELSE 0 END) AS cp_aberto,
  SUM(COALESCE(saldo_total, 0)) AS valor_atual
FROM public.fechamento_financeiro_saldos
GROUP BY competencia;

CREATE OR REPLACE VIEW public.vw_apresentacao_debt AS
SELECT
  to_char(fl.data_vencimento::date, 'YYYY-MM') AS competencia,
  SUM(CASE WHEN fl.tipo = 'pagar' THEN COALESCE(fl.saldo_restante, fl.valor - COALESCE(fl.valor_pago, 0)) ELSE 0 END) AS valor_atual
FROM public.financeiro_lancamentos fl
WHERE fl.ativo = true
GROUP BY 1;

CREATE OR REPLACE VIEW public.vw_apresentacao_bancos_detalhado AS
SELECT
  fcs.competencia,
  fcs.conta_bancaria_id AS conta_id,
  COALESCE(cb.descricao, 'Sem conta') AS descricao,
  COALESCE(b.nome, 'Sem banco') AS banco_nome,
  COALESCE(fcs.saldo, 0) AS valor_atual
FROM public.fechamento_caixa_saldos fcs
LEFT JOIN public.contas_bancarias cb ON cb.id = fcs.conta_bancaria_id
LEFT JOIN public.bancos b ON b.id = cb.banco_id;

CREATE OR REPLACE VIEW public.vw_apresentacao_inadimplencia AS
SELECT
  to_char(fl.data_vencimento::date, 'YYYY-MM') AS competencia,
  SUM(COALESCE(fl.saldo_restante, fl.valor - COALESCE(fl.valor_pago, 0))) AS valor_inadimplente,
  CASE WHEN SUM(COALESCE(fl.valor, 0)) = 0 THEN 0
       ELSE (SUM(COALESCE(fl.saldo_restante, fl.valor - COALESCE(fl.valor_pago, 0))) / NULLIF(SUM(fl.valor), 0)) * 100
  END AS pct_inadimplencia,
  SUM(COALESCE(fl.saldo_restante, fl.valor - COALESCE(fl.valor_pago, 0))) AS valor_atual
FROM public.financeiro_lancamentos fl
WHERE fl.tipo = 'receber' AND fl.ativo = true AND COALESCE(fl.status, 'aberto') != 'pago'
GROUP BY 1;

CREATE OR REPLACE VIEW public.vw_apresentacao_backorder AS
SELECT
  to_char(ov.data_pedido::date, 'YYYY-MM') AS competencia,
  COUNT(*) FILTER (WHERE COALESCE(ov.status, '') NOT IN ('faturado', 'cancelado')) AS qtd_pedidos_pendentes,
  SUM(COALESCE(ov.valor_total, 0)) FILTER (WHERE COALESCE(ov.status, '') NOT IN ('faturado', 'cancelado')) AS valor_backorder,
  SUM(COALESCE(ov.valor_total, 0)) FILTER (WHERE COALESCE(ov.status, '') NOT IN ('faturado', 'cancelado')) AS valor_atual
FROM public.ordens_venda ov
WHERE ov.ativo = true
GROUP BY 1;

ALTER VIEW public.vw_apresentacao_highlights_financeiros SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_rol_caixa SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_variacao_estoque SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_redes_sociais SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_capital_giro SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_balanco_gerencial SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_aging_consolidado SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_debt SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_bancos_detalhado SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_inadimplencia SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_backorder SET (security_invoker = true);
