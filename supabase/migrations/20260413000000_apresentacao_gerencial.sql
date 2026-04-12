-- apresentacao_templates
CREATE TABLE IF NOT EXISTS public.apresentacao_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  codigo text UNIQUE NOT NULL,
  versao text NOT NULL DEFAULT '1.0',
  ativo boolean DEFAULT true,
  descricao text NULL,
  config_json jsonb NULL,
  arquivo_path text NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.apresentacao_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apresentacao_templates_select" ON public.apresentacao_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "apresentacao_templates_admin" ON public.apresentacao_templates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- apresentacao_geracoes
CREATE TABLE IF NOT EXISTS public.apresentacao_geracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.apresentacao_templates(id),
  empresa_id uuid NULL,
  competencia_inicial date NULL,
  competencia_final date NULL,
  modo_geracao text CHECK (modo_geracao IN ('dinamico','fechado')),
  fechamento_id_inicial uuid NULL,
  fechamento_id_final uuid NULL,
  status text CHECK (status IN ('pendente','gerando','concluido','erro')) DEFAULT 'pendente',
  arquivo_path text NULL,
  hash_geracao text NULL,
  parametros_json jsonb NULL,
  observacoes text NULL,
  gerado_por uuid NULL,
  gerado_em timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.apresentacao_geracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apresentacao_geracoes_select" ON public.apresentacao_geracoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "apresentacao_geracoes_insert" ON public.apresentacao_geracoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "apresentacao_geracoes_update" ON public.apresentacao_geracoes FOR UPDATE TO authenticated USING (true);

-- apresentacao_comentarios
CREATE TABLE IF NOT EXISTS public.apresentacao_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geracao_id uuid NOT NULL REFERENCES public.apresentacao_geracoes(id) ON DELETE CASCADE,
  slide_codigo text NOT NULL,
  titulo text NULL,
  comentario_automatico text NULL,
  comentario_editado text NULL,
  origem text NULL,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.apresentacao_comentarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apresentacao_comentarios_select" ON public.apresentacao_comentarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "apresentacao_comentarios_all" ON public.apresentacao_comentarios FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Default template
INSERT INTO public.apresentacao_templates (nome, codigo, versao, descricao)
VALUES ('Apresentação Gerencial Padrão V1', 'APRESENTACAO_PADRAO_V1', '1.0', 'Template padrão de fechamento mensal')
ON CONFLICT (codigo) DO NOTHING;

-- Views for Presentation (extending workbook views or creating new ones)

CREATE OR REPLACE VIEW public.vw_apresentacao_highlights_financeiros AS
SELECT
  competencia,
  total_receita,
  total_recebido,
  total_despesa,
  total_pago,
  (total_receita - total_despesa) as resultado_bruto,
  (total_recebido - total_pago) as resultado_caixa
FROM (
  SELECT
    COALESCE(r.competencia, d.competencia) as competencia,
    COALESCE(r.total_receita, 0) as total_receita,
    COALESCE(r.total_recebido, 0) as total_recebido,
    COALESCE(d.total_despesa, 0) as total_despesa,
    COALESCE(d.total_pago, 0) as total_pago
  FROM public.vw_workbook_receita_mensal r
  FULL OUTER JOIN public.vw_workbook_despesa_mensal d ON r.competencia = d.competencia
) sub;

CREATE OR REPLACE VIEW public.vw_apresentacao_faturamento AS
SELECT * FROM public.vw_workbook_faturamento_mensal;

CREATE OR REPLACE VIEW public.vw_apresentacao_despesas AS
SELECT * FROM public.vw_workbook_despesa_mensal;

CREATE OR REPLACE VIEW public.vw_apresentacao_rol_caixa AS
SELECT
  competencia,
  SUM(total_recebido) as entradas,
  SUM(total_pago) as saidas,
  SUM(total_recebido - total_pago) as fluxo_liquido
FROM public.vw_apresentacao_highlights_financeiros
GROUP BY competencia;

CREATE OR REPLACE VIEW public.vw_apresentacao_receita_vs_despesa AS
SELECT
  competencia,
  total_receita as receita,
  total_despesa as despesa
FROM public.vw_apresentacao_highlights_financeiros;

CREATE OR REPLACE VIEW public.vw_apresentacao_fopag AS
SELECT
  competencia,
  SUM(salario_base) as total_salario_base,
  SUM(proventos) as total_proventos,
  SUM(descontos) as total_descontos,
  SUM(valor_liquido) as total_liquido,
  COUNT(DISTINCT funcionario_id) as total_funcionarios
FROM public.folha_pagamento
GROUP BY competencia;

CREATE OR REPLACE VIEW public.vw_apresentacao_fluxo_caixa AS
SELECT
  to_char(created_at, 'YYYY-MM') as competencia,
  tipo,
  SUM(valor) as total_valor
FROM public.caixa_movimentos
GROUP BY 1, 2;

CREATE OR REPLACE VIEW public.vw_apresentacao_lucro_produto_cliente AS
SELECT
  to_char(o.data_orcamento, 'YYYY-MM') as competencia,
  p.nome as produto_nome,
  c.nome_razao_social as cliente_nome,
  SUM(oi.valor_total) as receita_total,
  SUM(oi.custo_unitario * oi.quantidade) as custo_total,
  SUM(oi.valor_total - (oi.custo_unitario * oi.quantidade)) as lucro_bruto
FROM public.orcamentos_itens oi
JOIN public.orcamentos o ON oi.orcamento_id = o.id
JOIN public.produtos p ON oi.produto_id = p.id
JOIN public.clientes c ON o.cliente_id = c.id
WHERE o.status = 'aprovado'
GROUP BY 1, 2, 3;

CREATE OR REPLACE VIEW public.vw_apresentacao_variacao_estoque AS
SELECT
  to_char(created_at, 'YYYY-MM') as competencia,
  SUM(CASE WHEN tipo IN ('entrada', 'ajuste_entrada') THEN quantidade * 1 ELSE quantidade * -1 END) as variacao_quantidade
FROM public.estoque_movimentos
GROUP BY 1;

CREATE OR REPLACE VIEW public.vw_apresentacao_venda_estado AS
SELECT
  to_char(o.data_orcamento, 'YYYY-MM') as competencia,
  c.uf,
  SUM(o.valor_total) as valor_total,
  COUNT(o.id) as quantidade_pedidos
FROM public.orcamentos o
JOIN public.clientes c ON o.cliente_id = c.id
WHERE o.status = 'aprovado'
GROUP BY 1, 2;

-- Redes Sociais views depend on social tables which might not be fully present/uniform across all installs,
-- so we create them as placeholders or based on what we saw in services.
-- Assuming social_metricas or similar exists.

CREATE OR REPLACE VIEW public.vw_apresentacao_redes_sociais AS
SELECT
  ''::text as plataforma,
  ''::text as competencia,
  0::numeric as seguidores,
  0::numeric as alcance,
  0::numeric as engajamento
WHERE false;
