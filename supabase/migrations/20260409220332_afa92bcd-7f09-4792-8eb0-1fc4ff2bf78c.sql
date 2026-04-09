
CREATE TABLE IF NOT EXISTS public.permission_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  target_user_id UUID,
  role_padrao TEXT,
  alteracao JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.permission_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permission_audit_select" ON public.permission_audit
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "permission_audit_insert" ON public.permission_audit
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
