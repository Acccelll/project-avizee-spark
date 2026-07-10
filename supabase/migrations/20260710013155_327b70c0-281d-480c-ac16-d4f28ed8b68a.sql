CREATE UNIQUE INDEX IF NOT EXISTS uq_fid_empresa_arquivo_hash
  ON public.financeiro_importacoes_docs (empresa_id, arquivo_hash)
  WHERE arquivo_hash IS NOT NULL;

ALTER TABLE public.financeiro_extrato_importacoes
  ADD COLUMN IF NOT EXISTS is_transferencia_interna boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS transferencia_par_id uuid
    REFERENCES public.financeiro_extrato_importacoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fei_pares_transferencia
  ON public.financeiro_extrato_importacoes (data, valor)
  WHERE status = 'pendente';