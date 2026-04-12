
-- Fix security definer views by setting security_invoker
ALTER VIEW public.vw_workbook_receita_mensal SET (security_invoker = true);
ALTER VIEW public.vw_workbook_despesa_mensal SET (security_invoker = true);
ALTER VIEW public.vw_workbook_faturamento_mensal SET (security_invoker = true);
ALTER VIEW public.vw_workbook_estoque_posicao SET (security_invoker = true);
ALTER VIEW public.vw_workbook_bancos_saldo SET (security_invoker = true);
ALTER VIEW public.vw_workbook_aging_cr SET (security_invoker = true);
ALTER VIEW public.vw_workbook_aging_cp SET (security_invoker = true);
