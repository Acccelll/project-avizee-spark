-- Fase 1+2: Onboarding consistente
-- (1) Adiciona coluna `status` em profiles para distinguir pendente/ativo/inativo.
-- (2) Atualiza handle_new_user para ler `nome` (campo enviado pelo Signup) com fallback para full_name e email.
-- (3) Marca todo novo usuário como 'pendente' — admin precisa ativar antes de o usuário receber roles.
--     Profiles existentes ficam como 'ativo' por padrão para não quebrar quem já está no sistema.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('pendente', 'ativo', 'inativo'));

COMMENT ON COLUMN public.profiles.status IS
  'Estado do onboarding: pendente (recém-cadastrado, aguardando ativação por admin), ativo (uso normal), inativo (desativado).';

CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status) WHERE status <> 'ativo';

-- Atualiza trigger: lê metadata 'nome' (enviado pelo Signup atual) com fallback,
-- e marca novos usuários como 'pendente' para forçar fluxo de aprovação.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, status)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'nome'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      NEW.email
    ),
    NEW.email,
    'pendente'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;