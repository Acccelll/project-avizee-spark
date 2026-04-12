-- Update apresentacao_geracoes with editorial and approval fields
ALTER TABLE public.apresentacao_geracoes
ADD COLUMN IF NOT EXISTS status_editorial text CHECK (status_editorial IN ('rascunho', 'revisao', 'aprovado', 'gerado')) DEFAULT 'rascunho',
ADD COLUMN IF NOT EXISTS aprovado_por uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
ADD COLUMN IF NOT EXISTS config_slides jsonb;

-- New Analytical Views for Fase 2

-- 1. DRE Gerencial
CREATE OR REPLACE VIEW public.vw_apresentacao_dre_gerencial AS
SELECT
  competencia,
  COALESCE(mg.linha_dre, 'Outros') as linha,
  SUM(CASE WHEN fl.tipo = 'receber' THEN fl.valor ELSE -fl.valor END) as valor,
  SUM(CASE WHEN fl.tipo = 'receber' THEN COALESCE(fl.valor_pago, 0) ELSE -COALESCE(fl.valor_pago, 0) END) as valor_realizado
FROM public.financeiro_lancamentos fl
LEFT JOIN public.mapeamento_gerencial_contas mg ON mg.conta_contabil_id = fl.conta_contabil_id
WHERE fl.ativo = true
GROUP BY 1, 2;

-- 2. Bridge EBITDA (Simplified Bridge)
CREATE OR REPLACE VIEW public.vw_apresentacao_bridge_ebitda AS
SELECT
  competencia,
  linha,
  valor
FROM (
  SELECT competencia, 'Receita Bruta' as linha, SUM(valor) as valor, 1 as ordem FROM public.vw_apresentacao_dre_gerencial WHERE linha IN ('Receita', 'Vendas') GROUP BY 1
  UNION ALL
  SELECT competencia, 'Impostos' as linha, SUM(valor) as valor, 2 as ordem FROM public.vw_apresentacao_dre_gerencial WHERE linha IN ('Tributos', 'Impostos') GROUP BY 1
  UNION ALL
  SELECT competencia, 'CMV' as linha, SUM(valor) as valor, 3 as ordem FROM public.vw_apresentacao_dre_gerencial WHERE linha IN ('Custo de Mercadoria', 'CMV') GROUP BY 1
  UNION ALL
  SELECT competencia, 'Despesas Fixas' as linha, SUM(valor) as valor, 4 as ordem FROM public.vw_apresentacao_dre_gerencial WHERE linha IN ('Despesas Operacionais', 'Despesas Fixas') GROUP BY 1
  UNION ALL
  SELECT competencia, 'EBITDA' as linha, SUM(valor) as valor, 5 as ordem FROM public.vw_apresentacao_dre_gerencial WHERE linha NOT IN ('Resultado Financeiro', 'Depreciação', 'Amortização') GROUP BY 1
) sub
ORDER BY competencia, ordem;

-- 3. Working Capital / Capital de Giro
CREATE OR REPLACE VIEW public.vw_apresentacao_capital_giro AS
SELECT
  CURRENT_DATE as data_base,
  'Contas a Receber' as categoria,
  SUM(saldo_restante) as valor
FROM public.financeiro_lancamentos WHERE tipo = 'receber' AND status != 'pago' AND ativo = true
UNION ALL
SELECT
  CURRENT_DATE as data_base,
  'Estoque' as categoria,
  SUM(COALESCE(p.estoque_atual, 0) * COALESCE(p.preco_custo, 0)) as valor
FROM public.produtos p WHERE ativo = true
UNION ALL
SELECT
  CURRENT_DATE as data_base,
  'Contas a Pagar' as categoria,
  -SUM(saldo_restante) as valor
FROM public.financeiro_lancamentos WHERE tipo = 'pagar' AND status != 'pago' AND ativo = true;

-- 4. Aging Consolidado
CREATE OR REPLACE VIEW public.vw_apresentacao_aging_consolidado AS
SELECT 'Receber' as tipo, faixa_aging, SUM(saldo_aberto) as valor FROM public.vw_workbook_aging_cr GROUP BY 1, 2
UNION ALL
SELECT 'Pagar' as tipo, faixa_aging, SUM(saldo_aberto) as valor FROM public.vw_workbook_aging_cp GROUP BY 1, 2;

-- 5. Backorder (Carteira)
CREATE OR REPLACE VIEW public.vw_apresentacao_backorder AS
SELECT
  to_char(o.data_orcamento, 'YYYY-MM') as competencia,
  p.nome as produto,
  SUM(oi.quantidade) as qtd_pedida,
  SUM(oi.valor_total) as valor_total
FROM public.orcamentos o
JOIN public.orcamentos_itens oi ON o.id = oi.orcamento_id
JOIN public.produtos p ON oi.produto_id = p.id
WHERE o.status = 'aprovado' -- AND not yet fully invoiced (simplified here)
GROUP BY 1, 2;

-- 6. Top Clientes
CREATE OR REPLACE VIEW public.vw_apresentacao_top_clientes AS
SELECT
  c.nome_razao_social as cliente,
  SUM(fl.valor) as total_faturamento
FROM public.financeiro_lancamentos fl
JOIN public.clientes c ON fl.cliente_id = c.id
WHERE fl.tipo = 'receber' AND fl.ativo = true
GROUP BY 1
ORDER BY 2 DESC
LIMIT 10;

-- 7. Top Fornecedores
CREATE OR REPLACE VIEW public.vw_apresentacao_top_fornecedores AS
SELECT
  f.nome_razao_social as fornecedor,
  SUM(fl.valor) as total_compras
FROM public.financeiro_lancamentos fl
JOIN public.fornecedores f ON fl.fornecedor_id = f.id
WHERE fl.tipo = 'pagar' AND fl.ativo = true
GROUP BY 1
ORDER BY 2 DESC
LIMIT 10;

-- 8. Inadimplência
CREATE OR REPLACE VIEW public.vw_apresentacao_inadimplencia AS
SELECT
  faixa_aging,
  COUNT(id) as qtd_titulos,
  SUM(saldo_aberto) as valor_total
FROM public.vw_workbook_aging_cr
WHERE faixa_aging NOT IN ('pago', 'a_vencer')
GROUP BY 1;

-- 9. Resultado Financeiro
CREATE OR REPLACE VIEW public.vw_apresentacao_resultado_financeiro AS
SELECT
  competencia,
  SUM(CASE WHEN tipo = 'receber' THEN valor ELSE -valor END) as resultado_financeiro
FROM public.vw_workbook_resultado_financeiro
-- Filtering by accounts mapped to financial result would be better
GROUP BY 1;

-- 10. Tributos
CREATE OR REPLACE VIEW public.vw_apresentacao_tributos AS
SELECT
  competencia,
  conta_descricao as tributo,
  SUM(valor_bruto) as valor
FROM public.vw_workbook_despesa_mensal
-- Filtering by accounts mapped to taxes would be better
GROUP BY 1, 2;

-- 11. Debt (Endividamento)
CREATE OR REPLACE VIEW public.vw_apresentacao_debt AS
SELECT
  'Empréstimos/Financiamentos' as categoria,
  SUM(saldo_restante) as saldo_devedor
FROM public.financeiro_lancamentos fl
LEFT JOIN public.mapeamento_gerencial_contas mg ON mg.conta_contabil_id = fl.conta_contabil_id
WHERE fl.tipo = 'pagar' AND fl.ativo = true AND mg.grupo_debt IS NOT NULL
GROUP BY 1;

-- 12. Balanço Gerencial (Simplified)
CREATE OR REPLACE VIEW public.vw_apresentacao_balanco_gerencial AS
SELECT 'Ativo Circulante' as grupo, 'Disponibilidades' as conta, SUM(saldo_atual) as valor FROM public.vw_workbook_bancos_saldo
UNION ALL
SELECT 'Ativo Circulante' as grupo, 'Clientes' as conta, SUM(saldo_aberto) as valor FROM public.vw_workbook_aging_cr
UNION ALL
SELECT 'Ativo Circulante' as grupo, 'Estoques' as conta, SUM(valor_total) as valor FROM public.vw_workbook_estoque_posicao
UNION ALL
SELECT 'Passivo Circulante' as grupo, 'Fornecedores' as conta, -SUM(saldo_aberto) as valor FROM public.vw_workbook_aging_cp;
