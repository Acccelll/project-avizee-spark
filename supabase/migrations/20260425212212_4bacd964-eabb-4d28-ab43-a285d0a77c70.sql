
-- 1. vw_apresentacao_highlights — 6 KPIs do mês
CREATE OR REPLACE VIEW public.vw_apresentacao_highlights AS
SELECT
  fat.competencia,
  COALESCE(fat.total_faturado, 0)::numeric AS faturamento,
  COALESCE(desp.total_despesa, 0)::numeric AS despesa,
  COALESCE(fat.total_faturado, 0)::numeric - COALESCE(desp.total_despesa, 0)::numeric AS resultado,
  COALESCE(caixa.saldo_final_total, 0)::numeric AS caixa_total,
  COALESCE(dre.receita_liquida, 0)::numeric AS rol,
  COALESCE(backorder.qtd_pendentes, 0)::bigint AS backorder_pedidos,
  COALESCE(backorder.valor_pendente, 0)::numeric AS backorder_valor
FROM public.vw_workbook_faturamento_mensal fat
LEFT JOIN public.vw_workbook_despesa_mensal desp USING (competencia)
LEFT JOIN public.vw_workbook_dre_mensal dre USING (competencia)
LEFT JOIN (
  SELECT competencia, SUM(saldo_final) AS saldo_final_total
  FROM public.vw_workbook_caixa_evolutivo
  GROUP BY competencia
) caixa USING (competencia)
LEFT JOIN (
  SELECT
    to_char(COALESCE(data_aprovacao, data_emissao), 'YYYY-MM') AS competencia,
    COUNT(*) FILTER (WHERE status_faturamento IN ('pendente', 'parcial')) AS qtd_pendentes,
    COALESCE(SUM(valor_total) FILTER (WHERE status_faturamento IN ('pendente', 'parcial')), 0) AS valor_pendente
  FROM public.ordens_venda
  WHERE ativo = true
  GROUP BY 1
) backorder USING (competencia);

-- 2. vw_apresentacao_confronto_trimestral
CREATE OR REPLACE VIEW public.vw_apresentacao_confronto_trimestral AS
WITH base AS (
  SELECT
    substring(competencia, 1, 4) AS ano,
    'Q' || ((substring(competencia, 6, 2)::int - 1) / 3 + 1) AS trimestre,
    COALESCE(fat.total_faturado, 0) AS receita,
    COALESCE(desp.total_despesa, 0) AS despesa
  FROM public.vw_workbook_faturamento_mensal fat
  LEFT JOIN public.vw_workbook_despesa_mensal desp USING (competencia)
)
SELECT
  ano,
  trimestre,
  SUM(receita)::numeric AS receita,
  SUM(despesa)::numeric AS despesa,
  (SUM(receita) - SUM(despesa))::numeric AS resultado
FROM base
GROUP BY ano, trimestre
ORDER BY ano, trimestre;

-- 3. vw_apresentacao_dre_waterfall
CREATE OR REPLACE VIEW public.vw_apresentacao_dre_waterfall AS
SELECT competencia, 1 AS ordem, 'Receita Bruta' AS rotulo, receita_bruta AS valor, 'positivo' AS tipo FROM public.vw_workbook_dre_mensal
UNION ALL SELECT competencia, 2, 'Deduções', -deducoes, 'negativo' FROM public.vw_workbook_dre_mensal
UNION ALL SELECT competencia, 3, 'Receita Líquida', receita_liquida, 'subtotal' FROM public.vw_workbook_dre_mensal
UNION ALL SELECT competencia, 4, 'FOPAG', -fopag, 'negativo' FROM public.vw_workbook_dre_mensal
UNION ALL SELECT competencia, 5, 'Despesa Operacional', -despesa_operacional, 'negativo' FROM public.vw_workbook_dre_mensal
UNION ALL SELECT competencia, 6, 'EBITDA', ebitda, 'total' FROM public.vw_workbook_dre_mensal
ORDER BY competencia, ordem;

-- 4. vw_apresentacao_lucro_top10 (top produto + top cliente para um mês)
-- Utiliza vendas_cliente_abc para clientes; produtos derivam de notas_fiscais_itens
CREATE OR REPLACE VIEW public.vw_apresentacao_lucro_top10 AS
WITH top_clientes AS (
  SELECT
    'cliente' AS dimensao,
    cliente_nome AS rotulo,
    faturamento AS valor,
    row_number() OVER (ORDER BY faturamento DESC) AS posicao
  FROM public.vw_workbook_vendas_cliente_abc
  LIMIT 10
),
top_produtos AS (
  SELECT
    'produto' AS dimensao,
    p.nome AS rotulo,
    SUM(nfi.quantidade * nfi.valor_unitario)::numeric AS valor,
    row_number() OVER (ORDER BY SUM(nfi.quantidade * nfi.valor_unitario) DESC) AS posicao
  FROM public.notas_fiscais_itens nfi
  JOIN public.produtos p ON p.id = nfi.produto_id
  JOIN public.notas_fiscais nf ON nf.id = nfi.nota_fiscal_id
  WHERE nf.status = 'autorizada'
  GROUP BY p.nome
  ORDER BY SUM(nfi.quantidade * nfi.valor_unitario) DESC
  LIMIT 10
)
SELECT * FROM top_clientes
UNION ALL
SELECT * FROM top_produtos
ORDER BY dimensao, posicao;

-- 5. vw_apresentacao_social_evolucao
CREATE OR REPLACE VIEW public.vw_apresentacao_social_evolucao AS
SELECT
  to_char(data_referencia, 'YYYY-MM') AS competencia,
  sc.plataforma,
  SUM(seguidores)::bigint AS seguidores,
  SUM(alcance)::bigint AS alcance,
  SUM(engajamento)::numeric AS engajamento
FROM public.social_metricas_snapshot sms
JOIN public.social_contas sc ON sc.id = sms.conta_id
GROUP BY 1, sc.plataforma
ORDER BY 1, sc.plataforma;

-- 6. vw_apresentacao_capital_giro
CREATE OR REPLACE VIEW public.vw_apresentacao_capital_giro AS
WITH cr AS (
  SELECT to_char(data_vencimento, 'YYYY-MM') AS competencia, SUM(saldo_aberto) AS cr_aberto
  FROM public.vw_workbook_aging_cr WHERE saldo_aberto > 0 GROUP BY 1
),
cp AS (
  SELECT to_char(data_vencimento, 'YYYY-MM') AS competencia, SUM(saldo_aberto) AS cp_aberto
  FROM public.vw_workbook_aging_cp WHERE saldo_aberto > 0 GROUP BY 1
)
SELECT
  COALESCE(cr.competencia, cp.competencia) AS competencia,
  COALESCE(cr.cr_aberto, 0)::numeric AS cr_aberto,
  COALESCE(cp.cp_aberto, 0)::numeric AS cp_aberto,
  (COALESCE(cr.cr_aberto, 0) - COALESCE(cp.cp_aberto, 0))::numeric AS capital_giro_liquido
FROM cr
FULL OUTER JOIN cp USING (competencia)
ORDER BY competencia;

-- Permissões (views herdam RLS das tabelas-base)
GRANT SELECT ON public.vw_apresentacao_highlights TO authenticated;
GRANT SELECT ON public.vw_apresentacao_confronto_trimestral TO authenticated;
GRANT SELECT ON public.vw_apresentacao_dre_waterfall TO authenticated;
GRANT SELECT ON public.vw_apresentacao_lucro_top10 TO authenticated;
GRANT SELECT ON public.vw_apresentacao_social_evolucao TO authenticated;
GRANT SELECT ON public.vw_apresentacao_capital_giro TO authenticated;
