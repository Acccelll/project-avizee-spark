-- Remove índice único duplicado em notas_fiscais.chave_acesso.
-- ux_nf_chave_acesso e uq_notas_fiscais_chave_acesso possuem definição idêntica
-- (UNIQUE em chave_acesso WHERE chave_acesso IS NOT NULL). Mantemos apenas
-- uq_notas_fiscais_chave_acesso (nome canônico, segue convenção uq_*).
DROP INDEX IF EXISTS public.ux_nf_chave_acesso;