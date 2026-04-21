
-- UNIQUE constraint que estava no plano mas não foi criada
ALTER TABLE public.produto_identificadores_legacy
  ADD CONSTRAINT uq_pil_origem_codigo_descnorm
  UNIQUE (origem, codigo_legacy, descricao_normalizada);

CREATE INDEX IF NOT EXISTS idx_pil_codigo_legacy ON public.produto_identificadores_legacy(codigo_legacy);
CREATE INDEX IF NOT EXISTS idx_pil_descricao_normalizada ON public.produto_identificadores_legacy(descricao_normalizada);
CREATE INDEX IF NOT EXISTS idx_pil_produto_id ON public.produto_identificadores_legacy(produto_id);
