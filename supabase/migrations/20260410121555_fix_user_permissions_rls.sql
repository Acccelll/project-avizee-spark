-- Restrict user_permissions SELECT to own rows or admin.
-- Previously USING (true) allowed any authenticated user to read every user's permissions.
DROP POLICY IF EXISTS "user_permissions_select" ON public.user_permissions;

CREATE POLICY "user_permissions_select" ON public.user_permissions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );
