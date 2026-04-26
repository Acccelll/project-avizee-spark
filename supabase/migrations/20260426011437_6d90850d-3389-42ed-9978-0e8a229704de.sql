
-- Inclui dados importados nas views do workbook/apresentação gerencial.
-- Notas fiscais com status 'importada' (carga histórica) eram invisíveis em
-- DRE, Vendas Regiao/Cliente/Fiscal. Orçamentos com status 'historico' não
-- entravam no funil. Esta migração atualiza as views para considerar essas
-- linhas como confirmadas/finalizadas para fins gerenciais.

-- ========== DRE Mensal ==========
CREATE OR REPLACE VIEW public.vw_workbook_dre_mensal AS
WITH receita AS (
  SELECT to_char(date_trunc('month', notas_fiscais.data_emissao::timestamptz), 'YYYY-MM') AS competencia,
    sum(notas_fiscais.valor_total) AS receita_bruta,
    sum(COALESCE(notas_fiscais.icms_valor,0) + COALESCE(notas_fiscais.pis_valor,0)
        + COALESCE(notas_fiscais.cofins_valor,0) + COALESCE(notas_fiscais.icms_st_valor,0)) AS deducoes
  FROM notas_fiscais
  WHERE notas_fiscais.tipo = 'saida'
    AND notas_fiscais.status IN ('confirmada','importada')
  GROUP BY 1
), desp AS (
  SELECT to_char(date_trunc('month', financeiro_lancamentos.data_vencimento::timestamptz), 'YYYY-MM') AS competencia,
    sum(financeiro_lancamentos.valor) AS despesa_total
  FROM financeiro_lancamentos
  WHERE financeiro_lancamentos.tipo = 'pagar'
    AND financeiro_lancamentos.status IN ('aberto','parcial','pago')
  GROUP BY 1
), fop AS (
  SELECT SUBSTRING(folha_pagamento.competencia FROM 1 FOR 7) AS competencia,
    sum(folha_pagamento.valor_liquido) AS fopag_total
  FROM folha_pagamento
  WHERE folha_pagamento.competencia ~ '^\d{4}-\d{2}'
  GROUP BY 1
)
SELECT COALESCE(r.competencia, d.competencia, f.competencia) AS competencia,
  COALESCE(r.receita_bruta,0) AS receita_bruta,
  COALESCE(r.deducoes,0) AS deducoes,
  (COALESCE(r.receita_bruta,0) - COALESCE(r.deducoes,0)) AS receita_liquida,
  COALESCE(f.fopag_total,0) AS fopag,
  COALESCE(d.despesa_total,0) AS despesa_operacional,
  ((COALESCE(r.receita_bruta,0) - COALESCE(r.deducoes,0)) - COALESCE(d.despesa_total,0) - COALESCE(f.fopag_total,0)) AS ebitda
FROM receita r
FULL JOIN desp d ON d.competencia = r.competencia
FULL JOIN fop  f ON f.competencia = COALESCE(r.competencia, d.competencia);

-- ========== Fiscal Resumo ==========
CREATE OR REPLACE VIEW public.vw_workbook_fiscal_resumo AS
SELECT to_char(date_trunc('month', data_emissao::timestamptz), 'YYYY-MM') AS competencia,
  tipo,
  count(*) FILTER (WHERE status IN ('confirmada','importada')) AS qtd_confirmadas,
  count(*) FILTER (WHERE status = 'cancelada') AS qtd_canceladas,
  count(*) FILTER (WHERE status = 'rascunho') AS qtd_rascunho,
  sum(CASE WHEN status IN ('confirmada','importada') THEN valor_total ELSE 0 END) AS valor_confirmado,
  sum(CASE WHEN status IN ('confirmada','importada') THEN COALESCE(icms_valor,0) ELSE 0 END) AS icms,
  sum(CASE WHEN status IN ('confirmada','importada') THEN COALESCE(pis_valor,0) ELSE 0 END) AS pis,
  sum(CASE WHEN status IN ('confirmada','importada') THEN COALESCE(cofins_valor,0) ELSE 0 END) AS cofins,
  sum(CASE WHEN status IN ('confirmada','importada') THEN COALESCE(ipi_valor,0) ELSE 0 END) AS ipi
FROM notas_fiscais
GROUP BY 1, tipo;

-- ========== Vendas por Cliente (ABC) ==========
CREATE OR REPLACE VIEW public.vw_workbook_vendas_cliente_abc AS
WITH base AS (
  SELECT nf.cliente_id, c.nome_razao_social AS cliente_nome,
    sum(nf.valor_total) AS faturamento, count(*) AS qtd_nfs
  FROM notas_fiscais nf
  LEFT JOIN clientes c ON c.id = nf.cliente_id
  WHERE nf.tipo = 'saida' AND nf.status IN ('confirmada','importada')
  GROUP BY nf.cliente_id, c.nome_razao_social
), ranked AS (
  SELECT base.*,
    sum(base.faturamento) OVER () AS faturamento_total,
    sum(base.faturamento) OVER (ORDER BY base.faturamento DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS faturamento_acum
  FROM base
)
SELECT cliente_id, cliente_nome, faturamento, qtd_nfs,
  CASE WHEN faturamento_total > 0 THEN faturamento / faturamento_total ELSE 0 END AS participacao,
  CASE WHEN faturamento_total > 0 THEN faturamento_acum / faturamento_total ELSE 0 END AS participacao_acum,
  CASE
    WHEN faturamento_total = 0 THEN 'C'
    WHEN faturamento_acum / faturamento_total <= 0.80 THEN 'A'
    WHEN faturamento_acum / faturamento_total <= 0.95 THEN 'B'
    ELSE 'C'
  END AS curva_abc
FROM ranked;

-- ========== Vendas por Região ==========
CREATE OR REPLACE VIEW public.vw_workbook_vendas_regiao AS
SELECT to_char(date_trunc('month', nf.data_emissao::timestamptz), 'YYYY-MM') AS competencia,
  COALESCE(c.uf, '??') AS uf,
  count(*) AS qtd_nfs,
  sum(nf.valor_total) AS faturamento
FROM notas_fiscais nf
LEFT JOIN clientes c ON c.id = nf.cliente_id
WHERE nf.tipo = 'saida' AND nf.status IN ('confirmada','importada')
GROUP BY 1, COALESCE(c.uf, '??');

-- ========== Funil de Orçamentos ==========
-- Inclui status 'historico' como aprovados (orçamentos importados que viraram pedidos/NFs)
-- e 'pendente' como aberto.
CREATE OR REPLACE VIEW public.vw_workbook_orcamentos_funil AS
SELECT to_char(date_trunc('month', data_orcamento::timestamptz), 'YYYY-MM') AS competencia,
  count(*) FILTER (WHERE status IN ('rascunho','enviado','em_negociacao','pendente')) AS abertos,
  count(*) FILTER (WHERE status IN ('aprovado','historico')) AS aprovados,
  count(*) FILTER (WHERE status IN ('rejeitado','perdido','cancelado')) AS perdidos,
  count(*) AS total,
  sum(CASE WHEN status IN ('aprovado','historico') THEN valor_total ELSE 0 END) AS valor_aprovado,
  sum(valor_total) AS valor_total
FROM orcamentos
WHERE ativo = true
GROUP BY 1;
