
-- Tabela de convites para signup server-side
CREATE TABLE IF NOT EXISTS public.invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'vendedor',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invites_token ON public.invites(token) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invites_email ON public.invites(LOWER(email));

-- Trigger de validação (substitui CHECK constraint para permitir now())
CREATE OR REPLACE FUNCTION public.validate_invite_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.expires_at <= NEW.created_at THEN
    RAISE EXCEPTION 'expires_at must be after created_at';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_invite_dates ON public.invites;
CREATE TRIGGER trg_validate_invite_dates
  BEFORE INSERT OR UPDATE ON public.invites
  FOR EACH ROW EXECUTE FUNCTION public.validate_invite_dates();

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem visualizar/criar/revogar convites
CREATE POLICY "Admins can view invites"
  ON public.invites FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create invites"
  ON public.invites FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can revoke invites"
  ON public.invites FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete invites"
  ON public.invites FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
