ALTER TABLE public.produtos_fornecedores
  ADD COLUMN IF NOT EXISTS fator_conversao numeric NOT NULL DEFAULT 1;

ALTER TABLE public.produtos_fornecedores
  DROP CONSTRAINT IF EXISTS chk_produtos_fornecedores_fator_pos;

ALTER TABLE public.produtos_fornecedores
  ADD CONSTRAINT chk_produtos_fornecedores_fator_pos
  CHECK (fator_conversao > 0);

CREATE INDEX IF NOT EXISTS idx_produtos_fornecedores_lookup_xml
  ON public.produtos_fornecedores (fornecedor_id, referencia_fornecedor);

COMMENT ON COLUMN public.produtos_fornecedores.fator_conversao IS
  'Quantas unidades internas (produtos.unidade_medida) equivalem a 1 unidade do fornecedor (unidade_fornecedor). Convencao: qtd_interna = qCom * fator_conversao. Default 1 quando unidades coincidem.';