-- Apresentação Gerencial V1

CREATE TABLE IF NOT EXISTS public.apresentacao_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  codigo text UNIQUE NOT NULL,
  versao text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  descricao text NULL,
  config_json jsonb NULL,
  arquivo_path text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.apresentacao_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apresentacao_templates_select" ON public.apresentacao_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "apresentacao_templates_insert" ON public.apresentacao_templates FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "apresentacao_templates_update" ON public.apresentacao_templates FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.apresentacao_geracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.apresentacao_templates(id),
  empresa_id uuid NULL,
  competencia_inicial date NULL,
  competencia_final date NULL,
  modo_geracao text CHECK (modo_geracao IN ('dinamico','fechado')),
  fechamento_id_inicial uuid NULL,
  fechamento_id_final uuid NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','gerando','concluido','erro')),
  arquivo_path text NULL,
  hash_geracao text NULL,
  parametros_json jsonb NULL,
  observacoes text NULL,
  gerado_por uuid NULL,
  gerado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.apresentacao_geracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apresentacao_geracoes_select" ON public.apresentacao_geracoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "apresentacao_geracoes_insert" ON public.apresentacao_geracoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "apresentacao_geracoes_update" ON public.apresentacao_geracoes FOR UPDATE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.apresentacao_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geracao_id uuid NOT NULL REFERENCES public.apresentacao_geracoes(id) ON DELETE CASCADE,
  slide_codigo text NOT NULL,
  titulo text NULL,
  comentario_automatico text NULL,
  comentario_editado text NULL,
  origem text NULL,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.apresentacao_comentarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apresentacao_comentarios_select" ON public.apresentacao_comentarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "apresentacao_comentarios_insert" ON public.apresentacao_comentarios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "apresentacao_comentarios_update" ON public.apresentacao_comentarios FOR UPDATE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_apresentacao_geracoes_template_id ON public.apresentacao_geracoes(template_id);
CREATE INDEX IF NOT EXISTS idx_apresentacao_geracoes_periodo ON public.apresentacao_geracoes(competencia_inicial, competencia_final);
CREATE INDEX IF NOT EXISTS idx_apresentacao_comentarios_geracao_slide ON public.apresentacao_comentarios(geracao_id, slide_codigo);

INSERT INTO public.apresentacao_templates (nome, codigo, versao, descricao, config_json)
VALUES (
  'Apresentação Gerencial V1',
  'APRESENTACAO_GERENCIAL_V1',
  '1.0',
  'Template padrão de fechamento mensal',
  jsonb_build_object('slides', ARRAY['cover','highlights_financeiros','faturamento','despesas','rol_caixa','receita_vs_despesa','fopag','fluxo_caixa','lucro_produto_cliente','variacao_estoque','venda_estado','redes_sociais'])
)
ON CONFLICT (codigo) DO NOTHING;

-- Camada analítica: reaproveita views do workbook sempre que possível.

CREATE OR REPLACE VIEW public.vw_apresentacao_highlights_financeiros AS
SELECT
  d.competencia,
  COALESCE(r.total_receita, 0) AS receita_atual,
  COALESCE(d.total_despesa, 0) AS despesa_atual,
  COALESCE(r.total_receita, 0) - COALESCE(d.total_despesa, 0) AS resultado,
  COALESCE(r.total_recebido, 0) AS recebido,
  COALESCE(d.total_pago, 0) AS pago,
  (COALESCE(r.total_receita, 0) - COALESCE(d.total_despesa, 0)) AS valor_atual
FROM public.vw_workbook_despesa_mensal d
LEFT JOIN public.vw_workbook_receita_mensal r ON r.competencia = d.competencia;

CREATE OR REPLACE VIEW public.vw_apresentacao_faturamento AS
SELECT
  competencia,
  total_faturado AS valor_atual,
  quantidade_nfs,
  total_faturado
FROM public.vw_workbook_faturamento_mensal;

CREATE OR REPLACE VIEW public.vw_apresentacao_despesas AS
SELECT
  competencia,
  total_despesa AS valor_atual,
  total_pago,
  quantidade
FROM public.vw_workbook_despesa_mensal;

CREATE OR REPLACE VIEW public.vw_apresentacao_rol_caixa AS
SELECT
  to_char(current_date, 'YYYY-MM') AS competencia,
  COALESCE((SELECT SUM(saldo_atual) FROM public.vw_workbook_bancos_saldo), 0) AS valor_atual,
  COALESCE((SELECT SUM(total_receita) FROM public.vw_workbook_receita_mensal WHERE competencia = to_char(current_date, 'YYYY-MM')), 0) AS rol,
  CASE
    WHEN COALESCE((SELECT SUM(total_receita) FROM public.vw_workbook_receita_mensal WHERE competencia = to_char(current_date, 'YYYY-MM')), 0) = 0 THEN 0
    ELSE (COALESCE((SELECT SUM(saldo_atual) FROM public.vw_workbook_bancos_saldo), 0)
      / NULLIF((SELECT SUM(total_receita) FROM public.vw_workbook_receita_mensal WHERE competencia = to_char(current_date, 'YYYY-MM')), 0)) * 100
  END AS cobertura_pct;

CREATE OR REPLACE VIEW public.vw_apresentacao_receita_vs_despesa AS
SELECT
  COALESCE(r.competencia, d.competencia) AS competencia,
  COALESCE(r.total_receita, 0) AS receita_atual,
  COALESCE(d.total_despesa, 0) AS despesa_atual,
  COALESCE(r.total_receita, 0) - COALESCE(d.total_despesa, 0) AS valor_atual
FROM public.vw_workbook_receita_mensal r
FULL OUTER JOIN public.vw_workbook_despesa_mensal d ON d.competencia = r.competencia;

CREATE OR REPLACE VIEW public.vw_apresentacao_fopag AS
SELECT
  to_char(fp.competencia::date, 'YYYY-MM') AS competencia,
  COUNT(*) AS funcionarios,
  SUM(COALESCE(fp.valor_liquido, 0)) AS valor_atual,
  SUM(COALESCE(fp.salario_base, 0)) AS salario_base,
  SUM(COALESCE(fp.proventos, 0)) AS proventos,
  SUM(COALESCE(fp.descontos, 0)) AS descontos
FROM public.folha_pagamento fp
GROUP BY 1;

CREATE OR REPLACE VIEW public.vw_apresentacao_fluxo_caixa AS
SELECT
  to_char(created_at, 'YYYY-MM') AS competencia,
  SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END) AS entradas,
  SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END) AS saidas,
  SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE -valor END) AS fluxo_liquido,
  SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE -valor END) AS valor_atual
FROM public.caixa_movimentos
GROUP BY 1;

CREATE OR REPLACE VIEW public.vw_apresentacao_lucro_produto_cliente AS
SELECT
  to_char(nf.data_emissao, 'YYYY-MM') AS competencia,
  COALESCE(MAX(c.nome_razao_social), 'Sem cliente') AS maior_cliente,
  COALESCE(MAX(p.nome), 'Sem produto') AS maior_produto,
  SUM(COALESCE(nfi.valor_total, 0)) AS valor_atual
FROM public.notas_fiscais nf
LEFT JOIN public.notas_fiscais_itens nfi ON nfi.nota_fiscal_id = nf.id
LEFT JOIN public.produtos p ON p.id = nfi.produto_id
LEFT JOIN public.clientes c ON c.id = nf.cliente_id
WHERE nf.tipo = 'saida' AND nf.ativo = true AND COALESCE(nf.status, '') NOT IN ('cancelada', 'inutilizada')
GROUP BY 1;

CREATE OR REPLACE VIEW public.vw_apresentacao_variacao_estoque AS
SELECT
  to_char(current_date, 'YYYY-MM') AS competencia,
  SUM(COALESCE(valor_total, 0)) AS valor_atual,
  COUNT(*) AS quantidade_itens
FROM public.vw_workbook_estoque_posicao;

CREATE OR REPLACE VIEW public.vw_apresentacao_venda_estado AS
SELECT
  to_char(nf.data_emissao, 'YYYY-MM') AS competencia,
  COALESCE(c.uf, 'N/I') AS estado_lider,
  SUM(COALESCE(nf.valor_total, 0)) AS valor_lider,
  SUM(COALESCE(nf.valor_total, 0)) AS valor_atual
FROM public.notas_fiscais nf
LEFT JOIN public.clientes c ON c.id = nf.cliente_id
WHERE nf.tipo = 'saida' AND nf.ativo = true AND COALESCE(nf.status, '') NOT IN ('cancelada', 'inutilizada')
GROUP BY 1, 2;

CREATE OR REPLACE VIEW public.vw_apresentacao_redes_sociais AS
SELECT
  to_char(current_date, 'YYYY-MM') AS competencia,
  true AS indisponivel,
  'dados indisponíveis'::text AS motivo,
  0::numeric AS seguidores_novos,
  0::numeric AS valor_atual;

ALTER VIEW public.vw_apresentacao_highlights_financeiros SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_faturamento SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_despesas SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_rol_caixa SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_receita_vs_despesa SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_fopag SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_fluxo_caixa SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_lucro_produto_cliente SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_variacao_estoque SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_venda_estado SET (security_invoker = true);
ALTER VIEW public.vw_apresentacao_redes_sociais SET (security_invoker = true);
