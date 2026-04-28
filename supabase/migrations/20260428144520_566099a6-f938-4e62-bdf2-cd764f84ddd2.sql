
-- ================================================================
-- ONDA 1 — Multi-tenant: empresas + user_empresas + cadastros
-- Modelo: 1 usuário = 1 empresa (fixo). Backfill em empresa default.
-- ================================================================

-- 1) Tabela empresas
CREATE TABLE IF NOT EXISTS public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT empresas_nome_uk UNIQUE (nome)
);

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- Admin gerencia empresas; demais authenticated apenas leem a própria
CREATE POLICY "empresas_select_authenticated"
  ON public.empresas FOR SELECT TO authenticated USING (true);

CREATE POLICY "empresas_admin_insert"
  ON public.empresas FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "empresas_admin_update"
  ON public.empresas FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "empresas_admin_delete"
  ON public.empresas FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Empresa default
INSERT INTO public.empresas (nome) VALUES ('AviZee — Empresa Padrão')
ON CONFLICT (nome) DO NOTHING;

-- 3) user_empresas (1:1, mas tabela permite migração futura para N:N)
CREATE TABLE IF NOT EXISTS public.user_empresas (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_empresas_self_select"
  ON public.user_empresas FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "user_empresas_admin_insert"
  ON public.user_empresas FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "user_empresas_admin_update"
  ON public.user_empresas FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "user_empresas_admin_delete"
  ON public.user_empresas FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4) Backfill: associar TODOS os usuários existentes à empresa default
INSERT INTO public.user_empresas (user_id, empresa_id)
SELECT u.id, (SELECT id FROM public.empresas WHERE nome = 'AviZee — Empresa Padrão' LIMIT 1)
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

-- 5) Helper SECURITY DEFINER para resolver empresa do usuário corrente
CREATE OR REPLACE FUNCTION public.current_empresa_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.user_empresas WHERE user_id = auth.uid();
$$;

-- 6) Trigger genérico de auto-fill empresa_id em INSERT
CREATE OR REPLACE FUNCTION public.set_empresa_id_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
BEGIN
  IF NEW.empresa_id IS NULL THEN
    v_empresa := public.current_empresa_id();
    IF v_empresa IS NULL THEN
      -- fallback: empresa default (cobre seeds, edge functions sem auth.uid)
      SELECT id INTO v_empresa FROM public.empresas WHERE nome = 'AviZee — Empresa Padrão' LIMIT 1;
    END IF;
    NEW.empresa_id := v_empresa;
  END IF;
  RETURN NEW;
END;
$$;

-- 7) Adicionar empresa_id em clientes/fornecedores/produtos (nullable + backfill + NOT NULL)
DO $$
DECLARE
  v_default uuid;
BEGIN
  SELECT id INTO v_default FROM public.empresas WHERE nome = 'AviZee — Empresa Padrão' LIMIT 1;

  -- clientes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes' AND column_name='empresa_id') THEN
    ALTER TABLE public.clientes ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
    UPDATE public.clientes SET empresa_id = v_default WHERE empresa_id IS NULL;
    ALTER TABLE public.clientes ALTER COLUMN empresa_id SET NOT NULL;
  END IF;

  -- fornecedores
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fornecedores' AND column_name='empresa_id') THEN
    ALTER TABLE public.fornecedores ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
    UPDATE public.fornecedores SET empresa_id = v_default WHERE empresa_id IS NULL;
    ALTER TABLE public.fornecedores ALTER COLUMN empresa_id SET NOT NULL;
  END IF;

  -- produtos
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='produtos' AND column_name='empresa_id') THEN
    ALTER TABLE public.produtos ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
    UPDATE public.produtos SET empresa_id = v_default WHERE empresa_id IS NULL;
    ALTER TABLE public.produtos ALTER COLUMN empresa_id SET NOT NULL;
  END IF;
END $$;

-- 8) Índices
CREATE INDEX IF NOT EXISTS idx_clientes_empresa_id ON public.clientes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_fornecedores_empresa_id ON public.fornecedores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_produtos_empresa_id ON public.produtos(empresa_id);

-- 9) Triggers BEFORE INSERT
DROP TRIGGER IF EXISTS trg_clientes_set_empresa ON public.clientes;
CREATE TRIGGER trg_clientes_set_empresa
  BEFORE INSERT ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_default();

DROP TRIGGER IF EXISTS trg_fornecedores_set_empresa ON public.fornecedores;
CREATE TRIGGER trg_fornecedores_set_empresa
  BEFORE INSERT ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_default();

DROP TRIGGER IF EXISTS trg_produtos_set_empresa ON public.produtos;
CREATE TRIGGER trg_produtos_set_empresa
  BEFORE INSERT ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_default();

-- 10) Reescrever RLS: USING(true) -> filtro por empresa (admin enxerga tudo)
-- clientes
DROP POLICY IF EXISTS clientes_select ON public.clientes;
DROP POLICY IF EXISTS clientes_insert ON public.clientes;
DROP POLICY IF EXISTS clientes_update ON public.clientes;
DROP POLICY IF EXISTS clientes_delete ON public.clientes;

CREATE POLICY clientes_select ON public.clientes FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY clientes_insert ON public.clientes FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY clientes_update ON public.clientes FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY clientes_delete ON public.clientes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- fornecedores
DROP POLICY IF EXISTS fornecedores_select ON public.fornecedores;
DROP POLICY IF EXISTS fornecedores_insert ON public.fornecedores;
DROP POLICY IF EXISTS fornecedores_update ON public.fornecedores;
DROP POLICY IF EXISTS fornecedores_delete ON public.fornecedores;

CREATE POLICY fornecedores_select ON public.fornecedores FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY fornecedores_insert ON public.fornecedores FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY fornecedores_update ON public.fornecedores FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY fornecedores_delete ON public.fornecedores FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- produtos
DROP POLICY IF EXISTS produtos_select ON public.produtos;
DROP POLICY IF EXISTS produtos_insert ON public.produtos;
DROP POLICY IF EXISTS produtos_update ON public.produtos;
DROP POLICY IF EXISTS produtos_delete ON public.produtos;

CREATE POLICY produtos_select ON public.produtos FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY produtos_insert ON public.produtos FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY produtos_update ON public.produtos FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY produtos_delete ON public.produtos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 11) Trigger de updated_at em empresas
DROP TRIGGER IF EXISTS trg_empresas_updated_at ON public.empresas;
CREATE TRIGGER trg_empresas_updated_at
  BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 12) Comments
COMMENT ON TABLE public.empresas IS 'Multi-tenant: tenants do sistema. Onda 1 cria 1 empresa default.';
COMMENT ON TABLE public.user_empresas IS 'Vínculo 1:1 user -> empresa (modelo fixo, expansível para N:N).';
COMMENT ON FUNCTION public.current_empresa_id IS 'Retorna empresa_id do auth.uid() corrente. SECURITY DEFINER para uso em RLS sem recursão.';
COMMENT ON COLUMN public.clientes.empresa_id IS 'Multi-tenant: filtro RLS via current_empresa_id().';
COMMENT ON COLUMN public.fornecedores.empresa_id IS 'Multi-tenant: filtro RLS via current_empresa_id().';
COMMENT ON COLUMN public.produtos.empresa_id IS 'Multi-tenant: filtro RLS via current_empresa_id().';
