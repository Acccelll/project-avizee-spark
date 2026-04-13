
-- apresentacao_templates
CREATE TABLE IF NOT EXISTS public.apresentacao_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  codigo text NOT NULL,
  versao text NOT NULL DEFAULT '1.0',
  descricao text,
  arquivo_path text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.apresentacao_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "at_select" ON public.apresentacao_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "at_insert" ON public.apresentacao_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "at_update" ON public.apresentacao_templates FOR UPDATE TO authenticated USING (true);

-- apresentacao_geracoes
CREATE TABLE IF NOT EXISTS public.apresentacao_geracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.apresentacao_templates(id),
  competencia_inicial text,
  competencia_final text,
  modo_geracao text NOT NULL DEFAULT 'dinamico',
  status text NOT NULL DEFAULT 'gerando',
  status_editorial text DEFAULT 'rascunho',
  slides_json jsonb,
  parametros_json jsonb,
  arquivo_path text,
  hash_geracao text,
  observacoes text,
  gerado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.apresentacao_geracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ag_select" ON public.apresentacao_geracoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "ag_insert" ON public.apresentacao_geracoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ag_update" ON public.apresentacao_geracoes FOR UPDATE TO authenticated USING (true);

-- apresentacao_comentarios
CREATE TABLE IF NOT EXISTS public.apresentacao_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geracao_id uuid NOT NULL REFERENCES public.apresentacao_geracoes(id) ON DELETE CASCADE,
  slide_codigo text NOT NULL,
  comentario_automatico text,
  comentario_manual text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.apresentacao_comentarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ac_select" ON public.apresentacao_comentarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "ac_insert" ON public.apresentacao_comentarios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ac_update" ON public.apresentacao_comentarios FOR UPDATE TO authenticated USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_apresentacao_templates_updated_at BEFORE UPDATE ON public.apresentacao_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_apresentacao_geracoes_updated_at BEFORE UPDATE ON public.apresentacao_geracoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_apresentacao_comentarios_updated_at BEFORE UPDATE ON public.apresentacao_comentarios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
