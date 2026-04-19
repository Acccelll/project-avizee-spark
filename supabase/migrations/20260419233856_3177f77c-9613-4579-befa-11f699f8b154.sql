ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS ambiente_sefaz TEXT DEFAULT '2'
  CHECK (ambiente_sefaz IN ('1','2'));