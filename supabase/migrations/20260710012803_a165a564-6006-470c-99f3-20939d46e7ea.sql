ALTER TABLE public.financeiro_extrato_importacoes
  ADD COLUMN IF NOT EXISTS natureza text,
  ADD COLUMN IF NOT EXISTS favorecido text,
  ADD COLUMN IF NOT EXISTS favorecido_documento text,
  ADD COLUMN IF NOT EXISTS forma_pagamento text,
  ADD COLUMN IF NOT EXISTS documento text,
  ADD COLUMN IF NOT EXISTS categoria_sugerida text,
  ADD COLUMN IF NOT EXISTS origem_padrao text;

CREATE INDEX IF NOT EXISTS idx_fei_favorecido_doc
  ON public.financeiro_extrato_importacoes (favorecido_documento)
  WHERE favorecido_documento IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fei_forma_pagamento
  ON public.financeiro_extrato_importacoes (forma_pagamento)
  WHERE forma_pagamento IS NOT NULL;