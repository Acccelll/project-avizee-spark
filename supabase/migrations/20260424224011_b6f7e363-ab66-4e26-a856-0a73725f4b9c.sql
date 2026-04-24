-- Permite que clientes anônimos acessem orçamento via public_token
ALTER VIEW public.orcamentos_public_view SET (security_invoker = false);
ALTER VIEW public.orcamentos_itens_public_view SET (security_invoker = false);

GRANT SELECT ON public.orcamentos_public_view TO anon;
GRANT SELECT ON public.orcamentos_itens_public_view TO anon;