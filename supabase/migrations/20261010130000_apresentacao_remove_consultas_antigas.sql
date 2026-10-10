-- Apresentação de fechamento: o modelo novo lê só apresentacao_fechamento_dados
-- (sobre o Workbook de Fechamento). As consultas do deck antigo de 28 slides
-- deixam de ser usadas e saem do banco. As tabelas (gerações, comentários,
-- templates, telemetria) ficam: guardam o histórico.
DROP VIEW IF EXISTS public.vw_apresentacao_aging_consolidado;
DROP VIEW IF EXISTS public.vw_apresentacao_backorder;
DROP VIEW IF EXISTS public.vw_apresentacao_balanco_gerencial;
DROP VIEW IF EXISTS public.vw_apresentacao_bancos_detalhado;
DROP VIEW IF EXISTS public.vw_apresentacao_bridge_ebitda;
DROP VIEW IF EXISTS public.vw_apresentacao_bridge_lucro_liquido;
DROP VIEW IF EXISTS public.vw_apresentacao_capital_giro;
DROP VIEW IF EXISTS public.vw_apresentacao_confronto_trimestral;
DROP VIEW IF EXISTS public.vw_apresentacao_debt;
DROP VIEW IF EXISTS public.vw_apresentacao_despesas;
DROP VIEW IF EXISTS public.vw_apresentacao_dre_gerencial;
DROP VIEW IF EXISTS public.vw_apresentacao_dre_waterfall;
DROP VIEW IF EXISTS public.vw_apresentacao_faturamento;
DROP VIEW IF EXISTS public.vw_apresentacao_fluxo_caixa;
DROP VIEW IF EXISTS public.vw_apresentacao_fopag;
DROP VIEW IF EXISTS public.vw_apresentacao_highlights;
DROP VIEW IF EXISTS public.vw_apresentacao_highlights_financeiros;
DROP VIEW IF EXISTS public.vw_apresentacao_inadimplencia;
DROP VIEW IF EXISTS public.vw_apresentacao_lucro_produto_cliente;
DROP VIEW IF EXISTS public.vw_apresentacao_lucro_top10;
DROP VIEW IF EXISTS public.vw_apresentacao_performance_comercial_canal;
DROP VIEW IF EXISTS public.vw_apresentacao_receita_vs_despesa;
DROP VIEW IF EXISTS public.vw_apresentacao_redes_sociais;
DROP VIEW IF EXISTS public.vw_apresentacao_resultado_financeiro;
DROP VIEW IF EXISTS public.vw_apresentacao_rol_caixa;
DROP VIEW IF EXISTS public.vw_apresentacao_slide_uso;
DROP VIEW IF EXISTS public.vw_apresentacao_social_evolucao;
DROP VIEW IF EXISTS public.vw_apresentacao_top_clientes;
DROP VIEW IF EXISTS public.vw_apresentacao_top_fornecedores;
DROP VIEW IF EXISTS public.vw_apresentacao_tributos;
DROP VIEW IF EXISTS public.vw_apresentacao_variacao_estoque;
DROP VIEW IF EXISTS public.vw_apresentacao_venda_estado;
