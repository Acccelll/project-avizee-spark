-- Fase 2 - Apresentacao Gerencial

ALTER TABLE public.apresentacao_geracoes
  ADD COLUMN IF NOT EXISTS slide_config_json jsonb NULL,
  ADD COLUMN IF NOT EXISTS status_editorial text NOT NULL DEFAULT 'rascunho' CHECK (status_editorial IN ('rascunho','revisao','aprovado','gerado')),
  ADD COLUMN IF NOT EXISTS aprovado_por uuid NULL,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS is_final boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_slides integer NULL,
  ADD COLUMN IF NOT EXISTS slides_json jsonb NULL,
  ADD COLUMN IF NOT EXISTS data_origem_json jsonb NULL;

ALTER TABLE public.apresentacao_comentarios
  ADD COLUMN IF NOT EXISTS comentario_status text NOT NULL DEFAULT 'automatico' CHECK (comentario_status IN ('automatico','editado','aprovado')),
  ADD COLUMN IF NOT EXISTS prioridade integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS tags_json jsonb NULL;

CREATE INDEX IF NOT EXISTS idx_apresentacao_geracoes_status_editorial ON public.apresentacao_geracoes(status_editorial);
CREATE INDEX IF NOT EXISTS idx_apresentacao_geracoes_is_final ON public.apresentacao_geracoes(is_final);

-- Views avançadas (reaproveitando base workbook e financeiro)
CREATE OR REPLACE VIEW public.vw_apresentacao_bridge_ebitda AS
SELECT competencia,
       SUM(CASE WHEN tipo = 'receber' THEN valor_total ELSE -valor_total END) AS valor_atual,
       SUM(CASE WHEN tipo = 'receber' THEN valor_total ELSE 0 END) AS impacto_positivo,
       SUM(CASE WHEN tipo = 'pagar' THEN valor_total ELSE 0 END) AS impacto_negativo
FROM public.vw_workbook_resultado_financeiro
GROUP BY competencia;

CREATE OR REPLACE VIEW public.vw_apresentacao_bridge_lucro_liquido AS
SELECT competencia,
       SUM(CASE WHEN tipo = 'receber' THEN valor_total ELSE -valor_total END) AS valor_atual,
       SUM(CASE WHEN tipo = 'receber' THEN valor_realizado ELSE 0 END) AS lucro_operacional,
       SUM(CASE WHEN tipo = 'pagar' THEN valor_realizado ELSE 0 END) AS despesas
FROM public.vw_workbook_resultado_financeiro
GROUP BY competencia;

CREATE OR REPLACE VIEW public.vw_apresentacao_dre_gerencial AS
SELECT to_char(fl.data_vencimento, 'YYYY-MM') AS competencia,
       COALESCE(mgc.linha_dre, 'Sem Linha') AS linha,
       SUM(CASE WHEN fl.tipo = 'receber' THEN fl.valor ELSE -fl.valor END) AS valor_atual
FROM public.financeiro_lancamentos fl
LEFT JOIN public.mapeamento_gerencial_contas mgc ON mgc.conta_contabil_id = fl.conta_contabil_id AND mgc.ativo = true
WHERE fl.ativo = true
GROUP BY 1, 2;

CREATE OR REPLACE VIEW public.vw_apresentacao_capital_giro AS
SELECT to_char(current_date, 'YYYY-MM') AS competencia,
       COALESCE((SELECT SUM(saldo_aberto) FROM public.vw_workbook_aging_cr), 0) AS contas_receber,
       COALESCE((SELECT SUM(saldo_aberto) FROM public.vw_workbook_aging_cp), 0) AS contas_pagar,
       COALESCE((SELECT SUM(saldo_aberto) FROM public.vw_workbook_aging_cr), 0) - COALESCE((SELECT SUM(saldo_aberto) FROM public.vw_workbook_aging_cp), 0) AS valor_atual;

CREATE OR REPLACE VIEW public.vw_apresentacao_balanco_gerencial AS
SELECT to_char(current_date, 'YYYY-MM') AS competencia,
       COALESCE((SELECT SUM(saldo_atual) FROM public.vw_workbook_bancos_saldo), 0) AS ativo_circulante,
       COALESCE((SELECT SUM(saldo_aberto) FROM public.vw_workbook_aging_cp), 0) AS passivo_circulante,
       COALESCE((SELECT SUM(saldo_atual) FROM public.vw_workbook_bancos_saldo), 0) - COALESCE((SELECT SUM(saldo_aberto) FROM public.vw_workbook_aging_cp), 0) AS valor_atual;

CREATE OR REPLACE VIEW public.vw_apresentacao_resultado_financeiro AS
SELECT competencia,
       SUM(CASE WHEN tipo = 'receber' THEN valor_total ELSE 0 END) AS receitas_financeiras,
       SUM(CASE WHEN tipo = 'pagar' THEN valor_total ELSE 0 END) AS despesas_financeiras,
       SUM(CASE WHEN tipo = 'receber' THEN valor_total ELSE -valor_total END) AS valor_atual
FROM public.vw_workbook_resultado_financeiro
GROUP BY competencia;

CREATE OR REPLACE VIEW public.vw_apresentacao_tributos AS
SELECT to_char(data_emissao, 'YYYY-MM') AS competencia,
       SUM(COALESCE(icms_valor, 0) + COALESCE(ipi_valor, 0) + COALESCE(pis_valor, 0) + COALESCE(cofins_valor, 0)) AS valor_atual
FROM public.notas_fiscais
WHERE ativo = true AND tipo = 'saida' AND COALESCE(status, '') NOT IN ('cancelada', 'inutilizada')
GROUP BY 1;

CREATE OR REPLACE VIEW public.vw_apresentacao_aging_consolidado AS
SELECT to_char(current_date, 'YYYY-MM') AS competencia,
       COALESCE((SELECT SUM(saldo_aberto) FROM public.vw_workbook_aging_cr), 0) AS cr_aberto,
       COALESCE((SELECT SUM(saldo_aberto) FROM public.vw_workbook_aging_cp), 0) AS cp_aberto,
       COALESCE((SELECT SUM(saldo_aberto) FROM public.vw_workbook_aging_cr), 0) + COALESCE((SELECT SUM(saldo_aberto) FROM public.vw_workbook_aging_cp), 0) AS valor_atual;

CREATE OR REPLACE VIEW public.vw_apresentacao_debt AS
SELECT to_char(current_date, 'YYYY-MM') AS competencia,
       SUM(CASE WHEN tipo = 'pagar' THEN COALESCE(saldo_restante, valor - COALESCE(valor_pago,0)) ELSE 0 END) AS valor_atual
FROM public.financeiro_lancamentos
WHERE ativo = true;

CREATE OR REPLACE VIEW public.vw_apresentacao_bancos_detalhado AS
SELECT to_char(current_date, 'YYYY-MM') AS competencia,
       id AS conta_id,
       descricao,
       banco_nome,
       saldo_atual AS valor_atual
FROM public.vw_workbook_bancos_saldo;

CREATE OR REPLACE VIEW public.vw_apresentacao_backorder AS
SELECT to_char(current_date, 'YYYY-MM') AS competencia,
       COUNT(*) FILTER (WHERE COALESCE(status, '') NOT IN ('faturado', 'cancelado')) AS qtd_pedidos_pendentes,
       SUM(COALESCE(valor_total, 0)) FILTER (WHERE COALESCE(status, '') NOT IN ('faturado', 'cancelado')) AS valor_backorder,
       SUM(COALESCE(valor_total, 0)) FILTER (WHERE COALESCE(status, '') NOT IN ('faturado', 'cancelado')) AS valor_atual
FROM public.ordens_venda
WHERE ativo = true;

CREATE OR REPLACE VIEW public.vw_apresentacao_top_clientes AS
SELECT to_char(nf.data_emissao, 'YYYY-MM') AS competencia,
       c.nome_razao_social AS cliente_lider,
       SUM(COALESCE(nf.valor_total,0)) AS valor_lider,
       SUM(COALESCE(nf.valor_total,0)) AS valor_atual
FROM public.notas_fiscais nf
LEFT JOIN public.clientes c ON c.id = nf.cliente_id
WHERE nf.ativo = true AND nf.tipo = 'saida' AND COALESCE(nf.status, '') NOT IN ('cancelada', 'inutilizada')
GROUP BY 1,2;

CREATE OR REPLACE VIEW public.vw_apresentacao_top_fornecedores AS
SELECT to_char(pc.data_pedido, 'YYYY-MM') AS competencia,
       f.nome_razao_social AS fornecedor_lider,
       SUM(COALESCE(pc.valor_total,0)) AS valor_lider,
       SUM(COALESCE(pc.valor_total,0)) AS valor_atual
FROM public.pedidos_compra pc
LEFT JOIN public.fornecedores f ON f.id = pc.fornecedor_id
WHERE pc.ativo = true
GROUP BY 1,2;

CREATE OR REPLACE VIEW public.vw_apresentacao_inadimplencia AS
SELECT to_char(current_date, 'YYYY-MM') AS competencia,
       COALESCE(SUM(saldo_aberto),0) AS valor_inadimplente,
       CASE WHEN COALESCE(SUM(valor),0) = 0 THEN 0 ELSE (COALESCE(SUM(saldo_aberto),0) / NULLIF(SUM(valor),0)) * 100 END AS pct_inadimplencia,
       COALESCE(SUM(saldo_aberto),0) AS valor_atual
FROM public.vw_workbook_aging_cr;

CREATE OR REPLACE VIEW public.vw_apresentacao_performance_comercial_canal AS
SELECT to_char(data_emissao, 'YYYY-MM') AS competencia,
       COALESCE(tipo_operacao, 'N/I') AS canal,
       SUM(COALESCE(valor_total,0)) AS valor_atual
FROM public.notas_fiscais
WHERE ativo = true AND tipo = 'saida' AND COALESCE(status, '') NOT IN ('cancelada', 'inutilizada')
GROUP BY 1,2;

ALTER VIEW public.vw_apresentacao_bridge_ebitda SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_bridge_lucro_liquido SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_dre_gerencial SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_capital_giro SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_balanco_gerencial SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_resultado_financeiro SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_tributos SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_aging_consolidado SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_debt SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_bancos_detalhado SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_backorder SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_top_clientes SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_top_fornecedores SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_inadimplencia SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_performance_comercial_canal SET (security_invoker = true);
