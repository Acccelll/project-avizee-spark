GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_extrato_lotes TO authenticated;
GRANT ALL ON public.financeiro_extrato_lotes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_extrato_importacoes TO authenticated;
GRANT ALL ON public.financeiro_extrato_importacoes TO service_role;