-- Verifica registros sem vencimento antes do ajuste
SELECT COUNT(*) FROM financeiro_lancamentos WHERE data_vencimento IS NULL;

-- Preenche vencimento ausente com a data de criação
UPDATE public.financeiro_lancamentos
SET data_vencimento = created_at::date
WHERE data_vencimento IS NULL;

-- Garante integridade daqui em diante
ALTER TABLE public.financeiro_lancamentos
ALTER COLUMN data_vencimento SET NOT NULL;

ALTER TABLE public.financeiro_lancamentos
ALTER COLUMN data_vencimento SET DEFAULT CURRENT_DATE;
