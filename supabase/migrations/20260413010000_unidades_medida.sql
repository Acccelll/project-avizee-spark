-- ===================================================================
-- Migration: Criar tabela de Unidades de Medida
-- ===================================================================

CREATE TABLE IF NOT EXISTS public.unidades_medida (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      TEXT NOT NULL,
  descricao   TEXT NOT NULL,
  sigla       TEXT,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  observacoes TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Código único por unidade
CREATE UNIQUE INDEX IF NOT EXISTS unidades_medida_codigo_unique
  ON public.unidades_medida (codigo)
  WHERE codigo IS NOT NULL;

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_unidades_medida_updated_at ON public.unidades_medida;
CREATE TRIGGER trg_unidades_medida_updated_at
  BEFORE UPDATE ON public.unidades_medida
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Dados iniciais (unidades comuns)
INSERT INTO public.unidades_medida (codigo, descricao, sigla, ativo) VALUES
  ('UN',  'Unidade',        'UN',  TRUE),
  ('KG',  'Quilograma',     'KG',  TRUE),
  ('G',   'Grama',          'g',   TRUE),
  ('MT',  'Metro',          'MT',  TRUE),
  ('M2',  'Metro Quadrado', 'm²',  TRUE),
  ('M3',  'Metro Cúbico',   'm³',  TRUE),
  ('CX',  'Caixa',          'CX',  TRUE),
  ('PC',  'Peça',           'PC',  TRUE),
  ('LT',  'Litro',          'LT',  TRUE),
  ('ML',  'Mililitro',      'mL',  TRUE),
  ('PR',  'Par',            'PR',  TRUE),
  ('JG',  'Jogo',           'JG',  TRUE),
  ('KIT', 'Kit',            'KIT', TRUE),
  ('SC',  'Saco',           'SC',  TRUE),
  ('RL',  'Rolo',           'RL',  TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- RLS
ALTER TABLE public.unidades_medida ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unidades_medida_select" ON public.unidades_medida;
CREATE POLICY "unidades_medida_select"
  ON public.unidades_medida FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "unidades_medida_all_authenticated" ON public.unidades_medida;
CREATE POLICY "unidades_medida_all_authenticated"
  ON public.unidades_medida FOR ALL
  USING (auth.role() = 'authenticated');
