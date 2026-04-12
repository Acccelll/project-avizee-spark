-- ============================================================
-- Apresentação Gerencial V1
-- Tables: apresentacao_templates, apresentacao_geracoes, apresentacao_comentarios
-- Views:  vw_apresentacao_* (shared with workbook analytics layer)
-- ============================================================

-- -------------------------------------------------------
-- 1. apresentacao_templates
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.apresentacao_templates (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text        NOT NULL,
  codigo        text        UNIQUE NOT NULL,
  versao        text        NOT NULL DEFAULT '1.0',
  ativo         boolean     DEFAULT true,
  descricao     text        NULL,
  config_json   jsonb       NULL,
  arquivo_path  text        NULL,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE public.apresentacao_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ap_templates_all_authenticated"
  ON public.apresentacao_templates FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_apresentacao_templates_updated_at
  BEFORE UPDATE ON public.apresentacao_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default template
INSERT INTO public.apresentacao_templates (nome, codigo, versao, descricao, ativo)
VALUES ('Fechamento Mensal Padrão', 'fechamento_mensal_v1', '1.0',
        'Template padrão para apresentação gerencial de fechamento mensal', true)
ON CONFLICT (codigo) DO NOTHING;

-- -------------------------------------------------------
-- 2. apresentacao_geracoes
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.apresentacao_geracoes (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id           uuid        NOT NULL REFERENCES public.apresentacao_templates(id),
  empresa_id            uuid        NULL,
  competencia_inicial   date        NULL,
  competencia_final     date        NULL,
  modo_geracao          text        CHECK (modo_geracao IN ('dinamico','fechado')),
  fechamento_id_inicial uuid        NULL,
  fechamento_id_final   uuid        NULL,
  status                text        CHECK (status IN ('pendente','gerando','concluido','erro')) DEFAULT 'pendente',
  arquivo_path          text        NULL,
  hash_geracao          text        NULL,
  parametros_json       jsonb       NULL,
  observacoes           text        NULL,
  gerado_por            uuid        NULL,
  gerado_em             timestamptz DEFAULT now(),
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

ALTER TABLE public.apresentacao_geracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ap_geracoes_all_authenticated"
  ON public.apresentacao_geracoes FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_apresentacao_geracoes_updated_at
  BEFORE UPDATE ON public.apresentacao_geracoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_ap_geracoes_template_id    ON public.apresentacao_geracoes(template_id);
CREATE INDEX IF NOT EXISTS idx_ap_geracoes_competencia     ON public.apresentacao_geracoes(competencia_inicial, competencia_final);
CREATE INDEX IF NOT EXISTS idx_ap_geracoes_status          ON public.apresentacao_geracoes(status);
CREATE INDEX IF NOT EXISTS idx_ap_geracoes_gerado_em       ON public.apresentacao_geracoes(gerado_em DESC);

-- -------------------------------------------------------
-- 3. apresentacao_comentarios
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.apresentacao_comentarios (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  geracao_id            uuid        NOT NULL REFERENCES public.apresentacao_geracoes(id) ON DELETE CASCADE,
  slide_codigo          text        NOT NULL,
  titulo                text        NULL,
  comentario_automatico text        NULL,
  comentario_editado    text        NULL,
  origem                text        NULL,
  ordem                 integer     NOT NULL DEFAULT 0,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

ALTER TABLE public.apresentacao_comentarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ap_comentarios_all_authenticated"
  ON public.apresentacao_comentarios FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_apresentacao_comentarios_updated_at
  BEFORE UPDATE ON public.apresentacao_comentarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_ap_comentarios_geracao_id   ON public.apresentacao_comentarios(geracao_id);
CREATE INDEX IF NOT EXISTS idx_ap_comentarios_slide_codigo ON public.apresentacao_comentarios(slide_codigo);

-- ============================================================
-- Analytics views — reutilizando a base do workbook
-- ============================================================

-- -------------------------------------------------------
-- vw_apresentacao_highlights_financeiros
-- Reuses workbook receita/despesa aggregation
-- -------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_apresentacao_highlights_financeiros AS
SELECT
  r.competencia,
  COALESCE(r.total_receita, 0)   AS total_receita,
  COALESCE(r.total_recebido, 0)  AS total_recebido,
  COALESCE(d.total_despesa, 0)   AS total_despesa,
  COALESCE(d.total_pago, 0)      AS total_pago,
  COALESCE(r.total_receita, 0) - COALESCE(d.total_despesa, 0) AS resultado_bruto
FROM (
  SELECT
    date_trunc('month', fl.data_vencimento::timestamp)::date AS competencia,
    SUM(fl.valor)                      AS total_receita,
    SUM(COALESCE(fl.valor_pago, 0))    AS total_recebido
  FROM financeiro_lancamentos fl
  WHERE fl.tipo = 'receber' AND fl.ativo = true
  GROUP BY 1
) r
FULL OUTER JOIN (
  SELECT
    date_trunc('month', fl.data_vencimento::timestamp)::date AS competencia,
    SUM(fl.valor)                      AS total_despesa,
    SUM(COALESCE(fl.valor_pago, 0))    AS total_pago
  FROM financeiro_lancamentos fl
  WHERE fl.tipo = 'pagar' AND fl.ativo = true
  GROUP BY 1
) d ON r.competencia = d.competencia;

-- -------------------------------------------------------
-- vw_apresentacao_faturamento
-- -------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_apresentacao_faturamento AS
SELECT
  date_trunc('month', nf.data_emissao::timestamp)::date AS competencia,
  COUNT(*)                                              AS quantidade_nfs,
  SUM(nf.valor_total)                                   AS total_faturado,
  SUM(COALESCE(nf.valor_total, 0))                      AS total_produtos,
  SUM(COALESCE(nf.desconto_valor, 0))                   AS total_desconto
FROM notas_fiscais nf
WHERE nf.status NOT IN ('cancelada','denegada')
  AND nf.tipo = 'saida'
GROUP BY 1;

-- -------------------------------------------------------
-- vw_apresentacao_despesas
-- -------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_apresentacao_despesas AS
SELECT
  date_trunc('month', fl.data_vencimento::timestamp)::date AS competencia,
  COALESCE(cc.descricao, 'Sem Classificação')              AS categoria,
  SUM(fl.valor)                                            AS total_despesa,
  SUM(COALESCE(fl.valor_pago, 0))                          AS total_pago,
  COUNT(*)                                                 AS quantidade
FROM financeiro_lancamentos fl
LEFT JOIN contas_contabeis cc ON cc.id = fl.conta_contabil_id
WHERE fl.tipo = 'pagar' AND fl.ativo = true
GROUP BY 1, 2;

-- -------------------------------------------------------
-- vw_apresentacao_rol_caixa
-- -------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_apresentacao_rol_caixa AS
SELECT
  cb.id             AS conta_bancaria_id,
  cb.descricao      AS conta_descricao,
  COALESCE(b.nome, '')         AS banco_nome,
  COALESCE(cb.agencia, '')     AS agencia,
  COALESCE(cb.conta, '')       AS conta,
  COALESCE(cb.saldo_atual, 0)  AS saldo_atual
FROM contas_bancarias cb
LEFT JOIN bancos b ON b.id = cb.banco_id
WHERE cb.ativo = true;

-- -------------------------------------------------------
-- vw_apresentacao_receita_vs_despesa
-- -------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_apresentacao_receita_vs_despesa AS
SELECT
  competencia,
  total_receita,
  total_recebido,
  total_despesa,
  total_pago,
  resultado_bruto,
  LAG(total_receita) OVER (ORDER BY competencia)  AS receita_mes_anterior,
  LAG(total_despesa) OVER (ORDER BY competencia)  AS despesa_mes_anterior
FROM public.vw_apresentacao_highlights_financeiros
ORDER BY competencia;

-- -------------------------------------------------------
-- vw_apresentacao_fopag
-- -------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_apresentacao_fopag AS
SELECT
  date_trunc('month', fp.competencia::timestamp)::date AS competencia,
  f.nome                                               AS funcionario_nome,
  fp.salario_base,
  fp.proventos,
  fp.descontos,
  fp.valor_liquido
FROM folha_pagamento fp
LEFT JOIN funcionarios f ON f.id = fp.funcionario_id;

-- -------------------------------------------------------
-- vw_apresentacao_fluxo_caixa
-- Reuses workbook fluxo_caixa logic via caixa_movimentos
-- -------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_apresentacao_fluxo_caixa AS
SELECT
  date_trunc('month', cm.created_at::timestamp)::date AS competencia,
  SUM(CASE WHEN cm.tipo = 'entrada' THEN cm.valor ELSE 0 END) AS total_entradas,
  SUM(CASE WHEN cm.tipo = 'saida'   THEN cm.valor ELSE 0 END) AS total_saidas,
  SUM(CASE WHEN cm.tipo = 'entrada' THEN cm.valor ELSE -cm.valor END) AS saldo_periodo
FROM caixa_movimentos cm
GROUP BY 1
ORDER BY 1;

-- -------------------------------------------------------
-- vw_apresentacao_lucro_produto_cliente
-- -------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_apresentacao_lucro_produto_cliente AS
SELECT
  date_trunc('month', oi.created_at::timestamp)::date AS competencia,
  p.id     AS produto_id,
  p.nome   AS produto_nome,
  p.sku    AS produto_sku,
  c.id     AS cliente_id,
  COALESCE(c.razao_social, c.nome_fantasia, 'Cliente') AS cliente_nome,
  SUM(oi.quantidade)                                  AS quantidade_vendida,
  SUM(oi.valor_total)                                 AS receita_bruta,
  SUM(oi.quantidade * COALESCE(p.preco_custo, 0))     AS custo_total,
  SUM(oi.valor_total)
    - SUM(oi.quantidade * COALESCE(p.preco_custo, 0)) AS margem_bruta
FROM ordens_venda_itens oi
JOIN ordens_venda ov ON ov.id = oi.ordem_venda_id
JOIN produtos p      ON p.id  = oi.produto_id
LEFT JOIN clientes c ON c.id = ov.cliente_id
WHERE ov.status NOT IN ('cancelado','rascunho')
GROUP BY 1, 2, 3, 4, 5, 6;

-- -------------------------------------------------------
-- vw_apresentacao_variacao_estoque
-- -------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_apresentacao_variacao_estoque AS
SELECT
  p.id                                     AS produto_id,
  p.nome                                   AS produto_nome,
  p.sku                                    AS produto_sku,
  COALESCE(g.nome, 'Sem Grupo')            AS grupo_nome,
  COALESCE(p.estoque_atual, 0)             AS quantidade_atual,
  COALESCE(p.preco_custo, 0)               AS custo_unitario,
  COALESCE(p.estoque_atual, 0) * COALESCE(p.preco_custo, 0) AS valor_total
FROM produtos p
LEFT JOIN grupos_produto g ON g.id = p.grupo_id
WHERE p.ativo = true;

-- -------------------------------------------------------
-- vw_apresentacao_venda_estado
-- -------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_apresentacao_venda_estado AS
SELECT
  date_trunc('month', ov.created_at::timestamp)::date AS competencia,
  COALESCE(c.estado, 'N/D')                            AS estado,
  COUNT(DISTINCT ov.id)                                AS quantidade_pedidos,
  SUM(ov.valor_total)                                  AS total_vendas,
  COUNT(DISTINCT ov.cliente_id)                        AS clientes_ativos
FROM ordens_venda ov
LEFT JOIN clientes c ON c.id = ov.cliente_id
WHERE ov.status NOT IN ('cancelado','rascunho')
GROUP BY 1, 2;

-- -------------------------------------------------------
-- vw_apresentacao_redes_sociais
-- social_analytics table does not exist in the current schema.
-- Stub returning no rows so the slide is treated as unavailable.
-- -------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_apresentacao_redes_sociais AS
SELECT
  NULL::date    AS competencia,
  NULL::text    AS plataforma,
  NULL::text    AS metrica,
  NULL::numeric AS valor
WHERE false;
