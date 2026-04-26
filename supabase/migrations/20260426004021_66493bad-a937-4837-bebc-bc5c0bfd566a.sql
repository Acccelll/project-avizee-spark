-- Tabela de preferências do usuário para Apresentação Gerencial
CREATE TABLE public.apresentacao_preferencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  ultimo_template_id UUID NULL,
  ultimo_modo_geracao TEXT NULL,
  ultimos_slides_codigos TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ultima_competencia_inicial TEXT NULL,
  ultima_competencia_final TEXT NULL,
  exigir_revisao_padrao BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.apresentacao_preferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own apresentacao prefs select"
  ON public.apresentacao_preferencias FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own apresentacao prefs insert"
  ON public.apresentacao_preferencias FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own apresentacao prefs update"
  ON public.apresentacao_preferencias FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own apresentacao prefs delete"
  ON public.apresentacao_preferencias FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_apresentacao_preferencias_updated_at
  BEFORE UPDATE ON public.apresentacao_preferencias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de telemetria de seleção de slides
CREATE TABLE public.apresentacao_slide_telemetria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slide_codigo TEXT NOT NULL,
  user_id UUID NULL,
  geracao_id UUID NULL REFERENCES public.apresentacao_geracoes(id) ON DELETE SET NULL,
  acao TEXT NOT NULL CHECK (acao IN ('selecionado', 'desselecionado', 'gerado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_apresentacao_slide_telemetria_codigo ON public.apresentacao_slide_telemetria(slide_codigo);
CREATE INDEX idx_apresentacao_slide_telemetria_created ON public.apresentacao_slide_telemetria(created_at DESC);

ALTER TABLE public.apresentacao_slide_telemetria ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado pode inserir telemetria do próprio uso
CREATE POLICY "Authenticated users can insert telemetry"
  ON public.apresentacao_slide_telemetria FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Usuários com permissão de visualizar apresentação podem ler agregados
CREATE POLICY "Authenticated users can read telemetry"
  ON public.apresentacao_slide_telemetria FOR SELECT
  TO authenticated
  USING (true);

-- View agregada para facilitar consumo
CREATE OR REPLACE VIEW public.vw_apresentacao_slide_uso AS
SELECT
  slide_codigo,
  COUNT(*) FILTER (WHERE acao = 'selecionado') AS total_selecionado,
  COUNT(*) FILTER (WHERE acao = 'desselecionado') AS total_desselecionado,
  COUNT(*) FILTER (WHERE acao = 'gerado') AS total_gerado,
  MAX(created_at) AS ultimo_uso_em
FROM public.apresentacao_slide_telemetria
GROUP BY slide_codigo;