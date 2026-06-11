-- Simplifica a policy func_select em funcionarios:
-- a expressão "admin AND (empresa OR admin)" ≡ "admin".
-- Comportamento idêntico: admin cross-tenant por design (modelo operador).
DROP POLICY IF EXISTS func_select ON public.funcionarios;
CREATE POLICY func_select ON public.funcionarios
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

COMMENT ON POLICY func_select ON public.funcionarios IS
  'Admin-only, cross-tenant por design (modelo operador). Roles operacionais usam a view funcionarios_basico.';