
-- Bypass temporário do trigger de proteção para normalizar dados legados
ALTER TABLE public.notas_fiscais DISABLE TRIGGER trg_nf_protege_edicao;

UPDATE public.notas_fiscais SET chave_acesso = NULL WHERE chave_acesso = '';

ALTER TABLE public.notas_fiscais ENABLE TRIGGER trg_nf_protege_edicao;

DROP INDEX IF EXISTS public.uq_notas_fiscais_chave_acesso;
DROP INDEX IF EXISTS public.uq_notas_fiscais_chave;

CREATE UNIQUE INDEX uq_notas_fiscais_chave_acesso
  ON public.notas_fiscais (chave_acesso)
  WHERE chave_acesso IS NOT NULL AND chave_acesso <> '';
