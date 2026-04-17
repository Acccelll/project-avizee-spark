-- Recreate unidades_medida table (was defined in legacy migration but missing from current schema)
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

CREATE UNIQUE INDEX IF NOT EXISTS unidades_medida_codigo_unique
  ON public.unidades_medida (codigo);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_unidades_medida_updated_at ON public.unidades_medida;
CREATE TRIGGER trg_unidades_medida_updated_at
  BEFORE UPDATE ON public.unidades_medida
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
  ('RL',  'Rolo',           'RL',  TRUE),
  ('DZ',  'Dúzia',          'DZ',  TRUE),
  ('PÇ',  'Peça (PÇ)',      'PÇ',  TRUE)
ON CONFLICT (codigo) DO NOTHING;

ALTER TABLE public.unidades_medida ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unidades_medida_select" ON public.unidades_medida;
CREATE POLICY "unidades_medida_select"
  ON public.unidades_medida FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "unidades_medida_insert" ON public.unidades_medida;
CREATE POLICY "unidades_medida_insert"
  ON public.unidades_medida FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "unidades_medida_update" ON public.unidades_medida;
CREATE POLICY "unidades_medida_update"
  ON public.unidades_medida FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "unidades_medida_delete" ON public.unidades_medida;
CREATE POLICY "unidades_medida_delete"
  ON public.unidades_medida FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));