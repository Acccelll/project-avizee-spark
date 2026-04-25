
CREATE TABLE IF NOT EXISTS public.budgets_mensais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia date NOT NULL,
  categoria text NOT NULL,
  centro_custo_id uuid NULL REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  valor numeric(15,2) NOT NULL DEFAULT 0,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_budgets_categoria CHECK (categoria IN ('receita','despesa','fopag','faturamento','cmv','despesa_operacional')),
  CONSTRAINT chk_budgets_competencia_dia1 CHECK (extract(day from competencia) = 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_budgets_mensais_unique
  ON public.budgets_mensais (competencia, categoria, COALESCE(centro_custo_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS idx_budgets_mensais_competencia ON public.budgets_mensais(competencia);
ALTER TABLE public.budgets_mensais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bm_select ON public.budgets_mensais;
CREATE POLICY bm_select ON public.budgets_mensais FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS bm_insert ON public.budgets_mensais;
CREATE POLICY bm_insert ON public.budgets_mensais FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'financeiro'::app_role));
DROP POLICY IF EXISTS bm_update ON public.budgets_mensais;
CREATE POLICY bm_update ON public.budgets_mensais FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'financeiro'::app_role));
DROP POLICY IF EXISTS bm_delete ON public.budgets_mensais;
CREATE POLICY bm_delete ON public.budgets_mensais FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'financeiro'::app_role));
DROP TRIGGER IF EXISTS trg_budgets_mensais_updated_at ON public.budgets_mensais;
CREATE TRIGGER trg_budgets_mensais_updated_at BEFORE UPDATE ON public.budgets_mensais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP VIEW IF EXISTS public.vw_workbook_dre_mensal;
CREATE VIEW public.vw_workbook_dre_mensal AS
WITH receita AS (
  SELECT to_char(date_trunc('month', data_emissao),'YYYY-MM') AS competencia,
         SUM(valor_total) AS receita_bruta,
         SUM(COALESCE(icms_valor,0)+COALESCE(pis_valor,0)+COALESCE(cofins_valor,0)+COALESCE(icms_st_valor,0)) AS deducoes
  FROM public.notas_fiscais WHERE tipo='saida' AND status='confirmada' GROUP BY 1
),
desp AS (
  SELECT to_char(date_trunc('month', data_vencimento),'YYYY-MM') AS competencia, SUM(valor) AS despesa_total
  FROM public.financeiro_lancamentos WHERE tipo='pagar' AND status IN ('aberto','parcial','pago') GROUP BY 1
),
fop AS (
  SELECT substring(competencia FROM 1 FOR 7) AS competencia, SUM(valor_liquido) AS fopag_total
  FROM public.folha_pagamento WHERE competencia ~ '^\d{4}-\d{2}' GROUP BY 1
)
SELECT COALESCE(r.competencia, d.competencia, f.competencia) AS competencia,
  COALESCE(r.receita_bruta,0) AS receita_bruta, COALESCE(r.deducoes,0) AS deducoes,
  COALESCE(r.receita_bruta,0) - COALESCE(r.deducoes,0) AS receita_liquida,
  COALESCE(f.fopag_total,0) AS fopag, COALESCE(d.despesa_total,0) AS despesa_operacional,
  (COALESCE(r.receita_bruta,0) - COALESCE(r.deducoes,0)) - COALESCE(d.despesa_total,0) - COALESCE(f.fopag_total,0) AS ebitda
FROM receita r
FULL OUTER JOIN desp d ON d.competencia = r.competencia
FULL OUTER JOIN fop f  ON f.competencia = COALESCE(r.competencia, d.competencia);

DROP VIEW IF EXISTS public.vw_workbook_caixa_evolutivo;
CREATE VIEW public.vw_workbook_caixa_evolutivo AS
WITH mov_mes AS (
  SELECT to_char(date_trunc('month', created_at),'YYYY-MM') AS competencia, conta_bancaria_id,
         SUM(CASE WHEN tipo='entrada' THEN valor ELSE -valor END) AS variacao
  FROM public.caixa_movimentos GROUP BY 1, 2
),
ultimo_saldo AS (
  SELECT DISTINCT ON (to_char(date_trunc('month', created_at),'YYYY-MM'), conta_bancaria_id)
    to_char(date_trunc('month', created_at),'YYYY-MM') AS competencia, conta_bancaria_id, saldo_atual
  FROM public.caixa_movimentos
  ORDER BY to_char(date_trunc('month', created_at),'YYYY-MM'), conta_bancaria_id, created_at DESC
)
SELECT m.competencia, m.conta_bancaria_id, cb.descricao AS conta_descricao,
  COALESCE(us.saldo_atual,0) - COALESCE(m.variacao,0) AS saldo_inicial,
  COALESCE(us.saldo_atual,0) AS saldo_final, COALESCE(m.variacao,0) AS variacao_mes
FROM mov_mes m
LEFT JOIN ultimo_saldo us ON us.competencia = m.competencia AND us.conta_bancaria_id = m.conta_bancaria_id
LEFT JOIN public.contas_bancarias cb ON cb.id = m.conta_bancaria_id;

DROP VIEW IF EXISTS public.vw_workbook_vendas_vendedor;
CREATE VIEW public.vw_workbook_vendas_vendedor AS
SELECT to_char(date_trunc('month', ov.data_emissao),'YYYY-MM') AS competencia,
  ov.vendedor_id, COALESCE(f.nome,'Sem vendedor') AS vendedor_nome,
  COUNT(*) AS qtd_pedidos, SUM(ov.valor_total) AS faturamento,
  CASE WHEN COUNT(*)>0 THEN SUM(ov.valor_total)/COUNT(*) ELSE 0 END AS ticket_medio
FROM public.ordens_venda ov LEFT JOIN public.funcionarios f ON f.id = ov.vendedor_id
WHERE ov.ativo = true GROUP BY 1, 2, 3;

DROP VIEW IF EXISTS public.vw_workbook_vendas_cliente_abc;
CREATE VIEW public.vw_workbook_vendas_cliente_abc AS
WITH base AS (
  SELECT nf.cliente_id, c.nome_razao_social AS cliente_nome,
    SUM(nf.valor_total) AS faturamento, COUNT(*) AS qtd_nfs
  FROM public.notas_fiscais nf LEFT JOIN public.clientes c ON c.id = nf.cliente_id
  WHERE nf.tipo='saida' AND nf.status='confirmada' GROUP BY 1, 2
),
ranked AS (
  SELECT *, SUM(faturamento) OVER () AS faturamento_total,
    SUM(faturamento) OVER (ORDER BY faturamento DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS faturamento_acum
  FROM base
)
SELECT cliente_id, cliente_nome, faturamento, qtd_nfs,
  CASE WHEN faturamento_total > 0 THEN faturamento/faturamento_total ELSE 0 END AS participacao,
  CASE WHEN faturamento_total > 0 THEN faturamento_acum/faturamento_total ELSE 0 END AS participacao_acum,
  CASE WHEN faturamento_total = 0 THEN 'C'
       WHEN faturamento_acum/faturamento_total <= 0.80 THEN 'A'
       WHEN faturamento_acum/faturamento_total <= 0.95 THEN 'B' ELSE 'C' END AS curva_abc
FROM ranked;

DROP VIEW IF EXISTS public.vw_workbook_vendas_regiao;
CREATE VIEW public.vw_workbook_vendas_regiao AS
SELECT to_char(date_trunc('month', nf.data_emissao),'YYYY-MM') AS competencia,
  COALESCE(c.uf,'??') AS uf, COUNT(*) AS qtd_nfs, SUM(nf.valor_total) AS faturamento
FROM public.notas_fiscais nf LEFT JOIN public.clientes c ON c.id = nf.cliente_id
WHERE nf.tipo='saida' AND nf.status='confirmada' GROUP BY 1, 2;

DROP VIEW IF EXISTS public.vw_workbook_orcamentos_funil;
CREATE VIEW public.vw_workbook_orcamentos_funil AS
SELECT to_char(date_trunc('month', data_orcamento),'YYYY-MM') AS competencia,
  COUNT(*) FILTER (WHERE status IN ('rascunho','enviado','em_negociacao')) AS abertos,
  COUNT(*) FILTER (WHERE status='aprovado') AS aprovados,
  COUNT(*) FILTER (WHERE status IN ('rejeitado','perdido','cancelado')) AS perdidos,
  COUNT(*) AS total,
  SUM(CASE WHEN status='aprovado' THEN valor_total ELSE 0 END) AS valor_aprovado,
  SUM(valor_total) AS valor_total
FROM public.orcamentos WHERE ativo = true GROUP BY 1;

DROP VIEW IF EXISTS public.vw_workbook_compras_fornecedor;
CREATE VIEW public.vw_workbook_compras_fornecedor AS
SELECT to_char(date_trunc('month', pc.data_pedido),'YYYY-MM') AS competencia,
  pc.fornecedor_id, f.nome_razao_social AS fornecedor_nome,
  COUNT(*) AS qtd_pedidos, SUM(pc.valor_total) AS gasto_total,
  AVG((pc.data_entrega_real - pc.data_pedido)::numeric) FILTER (WHERE pc.data_entrega_real IS NOT NULL) AS lead_time_medio_dias
FROM public.pedidos_compra pc LEFT JOIN public.fornecedores f ON f.id = pc.fornecedor_id
WHERE pc.ativo = true GROUP BY 1, 2, 3;

DROP VIEW IF EXISTS public.vw_workbook_estoque_giro;
CREATE VIEW public.vw_workbook_estoque_giro AS
WITH saidas_90d AS (
  SELECT produto_id, SUM(ABS(quantidade)) AS qtd_saida_90d
  FROM public.estoque_movimentos
  WHERE tipo IN ('saida','venda') AND created_at >= now() - interval '90 days'
  GROUP BY produto_id
)
SELECT p.id AS produto_id, p.sku AS codigo, p.nome, COALESCE(g.nome,'Sem grupo') AS grupo_nome,
  p.estoque_atual, COALESCE(s.qtd_saida_90d,0) AS saidas_90d,
  CASE WHEN COALESCE(s.qtd_saida_90d,0) > 0 THEN p.estoque_atual / (s.qtd_saida_90d/90.0) ELSE NULL END AS cobertura_dias,
  CASE WHEN p.estoque_atual > 0 THEN COALESCE(s.qtd_saida_90d,0) / p.estoque_atual ELSE 0 END AS giro_90d,
  p.estoque_atual * COALESCE(p.preco_custo,0) AS valor_estoque
FROM public.produtos p
LEFT JOIN public.grupos_produto g ON g.id = p.grupo_id
LEFT JOIN saidas_90d s ON s.produto_id = p.id
WHERE p.ativo = true;

DROP VIEW IF EXISTS public.vw_workbook_estoque_critico;
CREATE VIEW public.vw_workbook_estoque_critico AS
SELECT p.id AS produto_id, p.sku AS codigo, p.nome, COALESCE(g.nome,'Sem grupo') AS grupo_nome,
  p.estoque_atual, p.estoque_minimo, p.estoque_minimo - p.estoque_atual AS deficit,
  p.preco_custo, (p.estoque_minimo - p.estoque_atual) * COALESCE(p.preco_custo,0) AS valor_reposicao
FROM public.produtos p LEFT JOIN public.grupos_produto g ON g.id = p.grupo_id
WHERE p.ativo = true AND p.estoque_minimo > 0 AND p.estoque_atual <= p.estoque_minimo;

DROP VIEW IF EXISTS public.vw_workbook_logistica_resumo;
CREATE VIEW public.vw_workbook_logistica_resumo AS
SELECT to_char(date_trunc('month', COALESCE(data_postagem, created_at::date)),'YYYY-MM') AS competencia,
  COUNT(*) AS qtd_remessas,
  COUNT(*) FILTER (WHERE status_transporte = 'entregue' AND data_entrega_real IS NOT NULL AND previsao_entrega IS NOT NULL AND data_entrega_real::date <= previsao_entrega) AS entregues_no_prazo,
  COUNT(*) FILTER (WHERE status_transporte = 'entregue' AND data_entrega_real IS NOT NULL AND previsao_entrega IS NOT NULL AND data_entrega_real::date > previsao_entrega) AS entregues_atraso,
  COUNT(*) FILTER (WHERE tipo_remessa = 'devolucao') AS devolucoes,
  SUM(COALESCE(valor_frete,0)) AS frete_total
FROM public.remessas WHERE ativo = true GROUP BY 1;

DROP VIEW IF EXISTS public.vw_workbook_fiscal_resumo;
CREATE VIEW public.vw_workbook_fiscal_resumo AS
SELECT to_char(date_trunc('month', data_emissao),'YYYY-MM') AS competencia, tipo,
  COUNT(*) FILTER (WHERE status='confirmada') AS qtd_confirmadas,
  COUNT(*) FILTER (WHERE status='cancelada') AS qtd_canceladas,
  COUNT(*) FILTER (WHERE status='rascunho')   AS qtd_rascunho,
  SUM(CASE WHEN status='confirmada' THEN valor_total ELSE 0 END) AS valor_confirmado,
  SUM(CASE WHEN status='confirmada' THEN COALESCE(icms_valor,0) ELSE 0 END) AS icms,
  SUM(CASE WHEN status='confirmada' THEN COALESCE(pis_valor,0) ELSE 0 END)  AS pis,
  SUM(CASE WHEN status='confirmada' THEN COALESCE(cofins_valor,0) ELSE 0 END) AS cofins,
  SUM(CASE WHEN status='confirmada' THEN COALESCE(ipi_valor,0) ELSE 0 END)  AS ipi
FROM public.notas_fiscais GROUP BY 1, 2;
