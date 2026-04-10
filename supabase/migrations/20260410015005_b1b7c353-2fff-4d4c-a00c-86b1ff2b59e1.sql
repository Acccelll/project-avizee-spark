-- Remover policies permissivas de app_configuracoes
DROP POLICY IF EXISTS "app_config_insert" ON public.app_configuracoes;
DROP POLICY IF EXISTS "app_config_update" ON public.app_configuracoes;

-- Recriar restritas a admin
CREATE POLICY "app_config_insert" ON public.app_configuracoes
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "app_config_update" ON public.app_configuracoes
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));