-- ============================================================
-- Apresentação Gerencial V2
-- Adds editorial workflow columns, enriches comentarios,
-- and creates analytical views for new V2 slides.
-- ============================================================

-- -------------------------------------------------------
-- 1. Columns for editorial workflow on apresentacao_geracoes
-- -------------------------------------------------------

ALTER TABLE public.apresentacao_geracoes
  ADD COLUMN IF NOT EXISTS status_editorial   text        DEFAULT 'rascunho'
    CHECK (status_editorial IN ('rascunho','revisao','aprovado','gerado')),
  ADD COLUMN IF NOT EXISTS aprovado_por        uuid        NULL,
  ADD COLUMN IF NOT EXISTS aprovado_em         timestamptz NULL,
  ADD COLUMN IF NOT EXISTS total_slides        integer     NULL,
  ADD COLUMN IF NOT EXISTS slides_config_json  jsonb       NULL;

COMMENT ON COLUMN public.apresentacao_geracoes.status_editorial IS
  'rascunho → revisao → aprovado → gerado';
COMMENT ON COLUMN public.apresentacao_geracoes.total_slides IS
  'Number of active slides generated in this run';
COMMENT ON COLUMN public.apresentacao_geracoes.slides_config_json IS
  'Snapshot of the resolved slide list at generation time';

-- -------------------------------------------------------
-- 2. Columns for rich comments on apresentacao_comentarios
-- -------------------------------------------------------

ALTER TABLE public.apresentacao_comentarios
  ADD COLUMN IF NOT EXISTS prioridade          smallint    DEFAULT 1
    CHECK (prioridade BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS comentario_status   text        DEFAULT 'automatico'
    CHECK (comentario_status IN ('automatico','editado','aprovado')),
  ADD COLUMN IF NOT EXISTS tags_json           jsonb       NULL;

COMMENT ON COLUMN public.apresentacao_comentarios.prioridade IS
  '1 = normal, 5 = critical. Used to surface the most important insight per slide.';
COMMENT ON COLUMN public.apresentacao_comentarios.comentario_status IS
  'automatico = system-generated; editado = manually changed; aprovado = signed-off';

-- -------------------------------------------------------
-- 3. V2 analytical views
-- All views respect the same competencia-based date range
-- convention used by V1 views.
-- -------------------------------------------------------

-- 3.1 Aging consolidado (CR + CP)
-- Shows open balances bucketed by days overdue.
CREATE OR REPLACE VIEW public.vw_apresentacao_aging_consolidado AS
SELECT
  fl.tipo,
  fl.data_vencimento,
  CASE
    WHEN fl.data_vencimento >= CURRENT_DATE                         THEN 'A vencer'
    WHEN fl.data_vencimento >= CURRENT_DATE - INTERVAL '30 days'   THEN '1-30 dias'
    WHEN fl.data_vencimento >= CURRENT_DATE - INTERVAL '60 days'   THEN '31-60 dias'
    WHEN fl.data_vencimento >= CURRENT_DATE - INTERVAL '90 days'   THEN '61-90 dias'
    ELSE '>90 dias'
  END                                                               AS faixa_aging,
  fl.status,
  SUM(fl.valor - COALESCE(fl.valor_pago, 0))                        AS saldo_aberto,
  COUNT(*)                                                          AS quantidade
FROM public.financeiro_lancamentos fl
WHERE fl.ativo = true
  AND fl.status NOT IN ('pago','cancelado')
GROUP BY 1, 2, 3, 4
ORDER BY fl.tipo, fl.data_vencimento;

-- 3.2 Top clientes por faturamento
CREATE OR REPLACE VIEW public.vw_apresentacao_top_clientes AS
SELECT
  date_trunc('month', ped.created_at::timestamp)::date AS competencia,
  c.id                                                  AS cliente_id,
  COALESCE(c.razao_social, c.nome_fantasia, 'Cliente')  AS cliente_nome,
  COALESCE(c.estado, 'N/D')                             AS estado,
  COUNT(DISTINCT ped.id)                                AS total_pedidos,
  SUM(ped.valor_total)                                  AS total_vendas,
  SUM(ped.valor_total) / NULLIF(COUNT(DISTINCT ped.id), 0) AS ticket_medio
FROM public.pedidos ped
LEFT JOIN public.clientes c ON c.id = ped.cliente_id
WHERE ped.status NOT IN ('cancelado', 'rascunho')
GROUP BY 1, 2, 3, 4
ORDER BY 1 DESC, total_vendas DESC;

-- 3.3 Top fornecedores por compras (via financeiro)
CREATE OR REPLACE VIEW public.vw_apresentacao_top_fornecedores AS
SELECT
  date_trunc('month', fl.data_vencimento::timestamp)::date AS competencia,
  f.id                                                      AS fornecedor_id,
  COALESCE(f.razao_social, f.nome_fantasia, 'Fornecedor')  AS fornecedor_nome,
  SUM(fl.valor)                                             AS total_compras,
  SUM(COALESCE(fl.valor_pago, 0))                           AS total_pago,
  COUNT(*)                                                  AS quantidade_titulos
FROM public.financeiro_lancamentos fl
LEFT JOIN public.fornecedores f ON f.id = fl.parceiro_id
WHERE fl.tipo = 'pagar'
  AND fl.ativo = true
  AND fl.parceiro_tipo = 'fornecedor'
GROUP BY 1, 2, 3
ORDER BY 1 DESC, total_compras DESC;

-- 3.4 Inadimplência (CR vencido e não pago)
CREATE OR REPLACE VIEW public.vw_apresentacao_inadimplencia AS
SELECT
  date_trunc('month', fl.data_vencimento::timestamp)::date AS competencia_vencimento,
  CASE
    WHEN CURRENT_DATE - fl.data_vencimento BETWEEN 1  AND 30  THEN '1-30 dias'
    WHEN CURRENT_DATE - fl.data_vencimento BETWEEN 31 AND 60  THEN '31-60 dias'
    WHEN CURRENT_DATE - fl.data_vencimento BETWEEN 61 AND 90  THEN '61-90 dias'
    ELSE '>90 dias'
  END                                                        AS faixa_atraso,
  COUNT(*)                                                   AS quantidade_titulos,
  SUM(fl.valor - COALESCE(fl.valor_pago, 0))                 AS saldo_inadimplente,
  COUNT(DISTINCT fl.parceiro_id)                             AS clientes_inadimplentes
FROM public.financeiro_lancamentos fl
WHERE fl.tipo = 'receber'
  AND fl.ativo = true
  AND fl.status NOT IN ('pago','cancelado')
  AND fl.data_vencimento < CURRENT_DATE
GROUP BY 1, 2;

-- 3.5 Backorder / pedidos pendentes de faturamento
CREATE OR REPLACE VIEW public.vw_apresentacao_backorder AS
SELECT
  date_trunc('month', ped.created_at::timestamp)::date AS competencia,
  ped.id                                               AS pedido_id,
  COALESCE(c.razao_social, c.nome_fantasia, 'Cliente') AS cliente_nome,
  ped.status,
  ped.valor_total,
  ped.created_at                                       AS data_pedido,
  (CURRENT_DATE - ped.created_at::date)               AS dias_em_aberto
FROM public.pedidos ped
LEFT JOIN public.clientes c ON c.id = ped.cliente_id
WHERE ped.status IN ('aprovado','confirmado','em_separacao','parcialmente_faturado')
ORDER BY ped.created_at ASC;

-- 3.6 DRE Gerencial
-- Requires mapeamento_gerencial_contas to be populated.
-- Returns empty when mapeamento is absent (graceful degradation).
CREATE OR REPLACE VIEW public.vw_apresentacao_dre_gerencial AS
SELECT
  date_trunc('month', fl.data_vencimento::timestamp)::date AS competencia,
  COALESCE(mgc.linha_dre, 'Sem Classificação')             AS linha_dre,
  COALESCE(mgc.linha_gerencial, 'Sem Classificação')       AS linha_gerencial,
  COALESCE(mgc.sinal_padrao, 1)                            AS sinal_padrao,
  SUM(fl.valor * COALESCE(mgc.sinal_padrao, 1))            AS valor_total
FROM public.financeiro_lancamentos fl
LEFT JOIN public.mapeamento_gerencial_contas mgc
       ON mgc.conta_contabil_id = fl.conta_contabil_id
      AND mgc.ativo = true
WHERE fl.ativo = true
GROUP BY 1, 2, 3, 4
ORDER BY 1, linha_dre;

-- 3.7 Resultado Financeiro (receitas/despesas financeiras)
CREATE OR REPLACE VIEW public.vw_apresentacao_resultado_financeiro AS
SELECT
  date_trunc('month', fl.data_vencimento::timestamp)::date AS competencia,
  COALESCE(mgc.grupo_resultado_financeiro, 'Sem Classificação') AS grupo,
  fl.tipo,
  SUM(fl.valor)                                            AS valor_total,
  SUM(COALESCE(fl.valor_pago, 0))                          AS valor_realizado
FROM public.financeiro_lancamentos fl
LEFT JOIN public.mapeamento_gerencial_contas mgc
       ON mgc.conta_contabil_id = fl.conta_contabil_id
      AND mgc.ativo = true
WHERE fl.ativo = true
  AND mgc.grupo_resultado_financeiro IS NOT NULL
GROUP BY 1, 2, 3
ORDER BY 1, grupo;

-- 3.8 Tributos
CREATE OR REPLACE VIEW public.vw_apresentacao_tributos AS
SELECT
  date_trunc('month', fl.data_vencimento::timestamp)::date AS competencia,
  COALESCE(mgc.grupo_tributo, 'Outros')                   AS grupo_tributo,
  SUM(fl.valor)                                            AS valor_total,
  SUM(COALESCE(fl.valor_pago, 0))                          AS valor_pago
FROM public.financeiro_lancamentos fl
LEFT JOIN public.mapeamento_gerencial_contas mgc
       ON mgc.conta_contabil_id = fl.conta_contabil_id
      AND mgc.ativo = true
WHERE fl.ativo = true
  AND mgc.grupo_tributo IS NOT NULL
GROUP BY 1, 2
ORDER BY 1, grupo_tributo;
