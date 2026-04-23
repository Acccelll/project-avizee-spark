-- Documentação: single-tenant intencional.
-- Todas as políticas RLS dessas tabelas usam USING (true) para `authenticated`
-- por design. Antes de migrar para multi-tenant, ver mem://security/rls-single-tenant.

COMMENT ON TABLE public.financeiro_lancamentos IS 'RLS: single-tenant intencional. Ver mem://security/rls-single-tenant';
COMMENT ON TABLE public.financeiro_baixas      IS 'RLS: single-tenant intencional. Ver mem://security/rls-single-tenant';
COMMENT ON TABLE public.clientes               IS 'RLS: single-tenant intencional. Ver mem://security/rls-single-tenant';
COMMENT ON TABLE public.fornecedores           IS 'RLS: single-tenant intencional. Ver mem://security/rls-single-tenant';
COMMENT ON TABLE public.compras                IS 'RLS: single-tenant intencional. Ver mem://security/rls-single-tenant';
COMMENT ON TABLE public.compras_itens          IS 'RLS: single-tenant intencional. Ver mem://security/rls-single-tenant';
COMMENT ON TABLE public.notas_fiscais          IS 'RLS: single-tenant intencional. Ver mem://security/rls-single-tenant';
COMMENT ON TABLE public.notas_fiscais_itens    IS 'RLS: single-tenant intencional. Ver mem://security/rls-single-tenant';
COMMENT ON TABLE public.estoque_movimentos     IS 'RLS: single-tenant intencional. Ver mem://security/rls-single-tenant';
COMMENT ON TABLE public.conciliacao_bancaria   IS 'RLS: single-tenant intencional. Ver mem://security/rls-single-tenant';
