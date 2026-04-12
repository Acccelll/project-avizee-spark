
-- Workbook templates
CREATE TABLE IF NOT EXISTS public.workbook_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  codigo text NOT NULL,
  versao text NOT NULL DEFAULT '1.0',
  arquivo_path text NOT NULL DEFAULT '',
  estrutura_json jsonb,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workbook_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wt_select" ON public.workbook_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "wt_insert" ON public.workbook_templates FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "wt_update" ON public.workbook_templates FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Workbook geracoes
CREATE TABLE IF NOT EXISTS public.workbook_geracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.workbook_templates(id),
  empresa_id uuid,
  competencia_inicial text,
  competencia_final text,
  modo_geracao text DEFAULT 'dinamico',
  fechamento_id_inicial uuid,
  fechamento_id_final uuid,
  status text NOT NULL DEFAULT 'pendente',
  arquivo_path text,
  hash_geracao text,
  parametros_json jsonb,
  observacoes text,
  gerado_por uuid,
  gerado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workbook_geracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wg_select" ON public.workbook_geracoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "wg_insert" ON public.workbook_geracoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wg_update" ON public.workbook_geracoes FOR UPDATE TO authenticated USING (true);

-- Fechamentos mensais
CREATE TABLE IF NOT EXISTS public.fechamentos_mensais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid,
  competencia text NOT NULL,
  status text NOT NULL DEFAULT 'aberto',
  fechado_em timestamptz,
  fechado_por uuid,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fechamentos_mensais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fm_select" ON public.fechamentos_mensais FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_insert" ON public.fechamentos_mensais FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "fm_update" ON public.fechamentos_mensais FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed default template
INSERT INTO public.workbook_templates (nome, codigo, versao, arquivo_path)
VALUES ('Workbook Gerencial Padrão', 'WB_GERENCIAL_V1', '1.0', 'templates/workbook_gerencial_v1.xlsx');
