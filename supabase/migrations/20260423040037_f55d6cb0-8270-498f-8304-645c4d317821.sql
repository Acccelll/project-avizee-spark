-- Documentar modo single-tenant das tabelas críticas
COMMENT ON TABLE public.financeiro_lancamentos IS 'RLS: single-tenant — todos os authenticated têm acesso total. Revisar antes de ativar multi-tenant.';
COMMENT ON TABLE public.clientes IS 'RLS: single-tenant — todos os authenticated têm acesso total. Revisar antes de ativar multi-tenant.';
COMMENT ON TABLE public.fornecedores IS 'RLS: single-tenant — todos os authenticated têm acesso total. Revisar antes de ativar multi-tenant.';
COMMENT ON TABLE public.compras IS 'RLS: single-tenant — todos os authenticated têm acesso total. Revisar antes de ativar multi-tenant.';
COMMENT ON TABLE public.compras_itens IS 'RLS: single-tenant — todos os authenticated têm acesso total. Revisar antes de ativar multi-tenant.';
COMMENT ON TABLE public.estoque_movimentos IS 'RLS: single-tenant — todos os authenticated têm acesso total. Revisar antes de ativar multi-tenant.';
COMMENT ON TABLE public.financeiro_baixas IS 'RLS: single-tenant — todos os authenticated têm acesso total. Revisar antes de ativar multi-tenant.';
COMMENT ON TABLE public.conciliacao_bancaria IS 'RLS: single-tenant — todos os authenticated têm acesso total. Revisar antes de ativar multi-tenant.';
COMMENT ON TABLE public.notas_fiscais IS 'RLS: single-tenant — todos os authenticated têm acesso total. Revisar antes de ativar multi-tenant.';
COMMENT ON TABLE public.notas_fiscais_itens IS 'RLS: single-tenant — todos os authenticated têm acesso total. Revisar antes de ativar multi-tenant.';

-- Hardening de app_configuracoes: SELECT restrito a admin
DROP POLICY IF EXISTS "app_config_select" ON public.app_configuracoes;

CREATE POLICY "Admins can select app_configuracoes"
  ON public.app_configuracoes
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

COMMENT ON TABLE public.app_configuracoes IS 'Configurações sensíveis da empresa. RLS exige role admin para qualquer operação.';