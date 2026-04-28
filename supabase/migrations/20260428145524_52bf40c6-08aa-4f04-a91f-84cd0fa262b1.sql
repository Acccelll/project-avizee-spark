
-- ===========================================================
-- ONDA 2 — Multi-tenant: Comercial (orcamentos, ordens_venda) + Compras
-- ===========================================================

DO $$
DECLARE
  v_default uuid;
BEGIN
  SELECT id INTO v_default FROM public.empresas WHERE nome = 'AviZee — Empresa Padrão' LIMIT 1;
  IF v_default IS NULL THEN
    RAISE EXCEPTION 'Empresa padrão não encontrada — Onda 1 deve ter sido aplicada antes';
  END IF;

  -- orcamentos
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orcamentos' AND column_name='empresa_id') THEN
    ALTER TABLE public.orcamentos ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
    UPDATE public.orcamentos SET empresa_id = v_default WHERE empresa_id IS NULL;
    ALTER TABLE public.orcamentos ALTER COLUMN empresa_id SET NOT NULL;
    ALTER TABLE public.orcamentos ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
  END IF;

  -- ordens_venda
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ordens_venda' AND column_name='empresa_id') THEN
    ALTER TABLE public.ordens_venda ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
    UPDATE public.ordens_venda SET empresa_id = v_default WHERE empresa_id IS NULL;
    ALTER TABLE public.ordens_venda ALTER COLUMN empresa_id SET NOT NULL;
    ALTER TABLE public.ordens_venda ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
  END IF;

  -- compras
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='compras' AND column_name='empresa_id') THEN
    ALTER TABLE public.compras ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
    UPDATE public.compras SET empresa_id = v_default WHERE empresa_id IS NULL;
    ALTER TABLE public.compras ALTER COLUMN empresa_id SET NOT NULL;
    ALTER TABLE public.compras ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
  END IF;

  -- pedidos_compra
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pedidos_compra' AND column_name='empresa_id') THEN
    ALTER TABLE public.pedidos_compra ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
    UPDATE public.pedidos_compra SET empresa_id = v_default WHERE empresa_id IS NULL;
    ALTER TABLE public.pedidos_compra ALTER COLUMN empresa_id SET NOT NULL;
    ALTER TABLE public.pedidos_compra ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
  END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_orcamentos_empresa_id ON public.orcamentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ordens_venda_empresa_id ON public.ordens_venda(empresa_id);
CREATE INDEX IF NOT EXISTS idx_compras_empresa_id ON public.compras(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_compra_empresa_id ON public.pedidos_compra(empresa_id);

-- Triggers safety-net
DROP TRIGGER IF EXISTS trg_orcamentos_set_empresa ON public.orcamentos;
CREATE TRIGGER trg_orcamentos_set_empresa BEFORE INSERT ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_default();

DROP TRIGGER IF EXISTS trg_ordens_venda_set_empresa ON public.ordens_venda;
CREATE TRIGGER trg_ordens_venda_set_empresa BEFORE INSERT ON public.ordens_venda
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_default();

DROP TRIGGER IF EXISTS trg_compras_set_empresa ON public.compras;
CREATE TRIGGER trg_compras_set_empresa BEFORE INSERT ON public.compras
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_default();

DROP TRIGGER IF EXISTS trg_pedidos_compra_set_empresa ON public.pedidos_compra;
CREATE TRIGGER trg_pedidos_compra_set_empresa BEFORE INSERT ON public.pedidos_compra
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_default();

-- ============== RLS PARENTS ==============

-- orcamentos
DROP POLICY IF EXISTS orcamentos_select ON public.orcamentos;
DROP POLICY IF EXISTS orcamentos_insert ON public.orcamentos;
DROP POLICY IF EXISTS orcamentos_update ON public.orcamentos;
DROP POLICY IF EXISTS orcamentos_delete ON public.orcamentos;

CREATE POLICY orcamentos_select ON public.orcamentos FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY orcamentos_insert ON public.orcamentos FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY orcamentos_update ON public.orcamentos FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY orcamentos_delete ON public.orcamentos FOR DELETE TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));

-- ordens_venda
DROP POLICY IF EXISTS ov_select ON public.ordens_venda;
DROP POLICY IF EXISTS ov_insert ON public.ordens_venda;
DROP POLICY IF EXISTS ov_update ON public.ordens_venda;
DROP POLICY IF EXISTS ov_delete ON public.ordens_venda;

CREATE POLICY ov_select ON public.ordens_venda FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY ov_insert ON public.ordens_venda FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY ov_update ON public.ordens_venda FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY ov_delete ON public.ordens_venda FOR DELETE TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));

-- compras
DROP POLICY IF EXISTS compras_select ON public.compras;
DROP POLICY IF EXISTS compras_insert ON public.compras;
DROP POLICY IF EXISTS compras_update ON public.compras;
DROP POLICY IF EXISTS compras_delete ON public.compras;

CREATE POLICY compras_select ON public.compras FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY compras_insert ON public.compras FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY compras_update ON public.compras FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY compras_delete ON public.compras FOR DELETE TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));

-- pedidos_compra
DROP POLICY IF EXISTS pco_select ON public.pedidos_compra;
DROP POLICY IF EXISTS pco_insert ON public.pedidos_compra;
DROP POLICY IF EXISTS pco_update ON public.pedidos_compra;
DROP POLICY IF EXISTS pco_delete ON public.pedidos_compra;

CREATE POLICY pco_select ON public.pedidos_compra FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY pco_insert ON public.pedidos_compra FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY pco_update ON public.pedidos_compra FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY pco_delete ON public.pedidos_compra FOR DELETE TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));

-- ============== RLS CHILDREN (herdam via EXISTS no parent) ==============

-- orcamentos_itens
DROP POLICY IF EXISTS oi_select ON public.orcamentos_itens;
DROP POLICY IF EXISTS oi_insert ON public.orcamentos_itens;
DROP POLICY IF EXISTS oi_update ON public.orcamentos_itens;
DROP POLICY IF EXISTS oi_delete ON public.orcamentos_itens;

CREATE POLICY oi_select ON public.orcamentos_itens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orcamentos o WHERE o.id = orcamentos_itens.orcamento_id
    AND (o.empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))));
CREATE POLICY oi_insert ON public.orcamentos_itens FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orcamentos o WHERE o.id = orcamentos_itens.orcamento_id
    AND (o.empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))));
CREATE POLICY oi_update ON public.orcamentos_itens FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orcamentos o WHERE o.id = orcamentos_itens.orcamento_id
    AND (o.empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))));
CREATE POLICY oi_delete ON public.orcamentos_itens FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orcamentos o WHERE o.id = orcamentos_itens.orcamento_id
    AND (o.empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))));

-- ordens_venda_itens
DROP POLICY IF EXISTS ovi_select ON public.ordens_venda_itens;
DROP POLICY IF EXISTS ovi_insert ON public.ordens_venda_itens;
DROP POLICY IF EXISTS ovi_update ON public.ordens_venda_itens;
DROP POLICY IF EXISTS ovi_delete ON public.ordens_venda_itens;

CREATE POLICY ovi_select ON public.ordens_venda_itens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ordens_venda o WHERE o.id = ordens_venda_itens.ordem_venda_id
    AND (o.empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))));
CREATE POLICY ovi_insert ON public.ordens_venda_itens FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.ordens_venda o WHERE o.id = ordens_venda_itens.ordem_venda_id
    AND (o.empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))));
CREATE POLICY ovi_update ON public.ordens_venda_itens FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ordens_venda o WHERE o.id = ordens_venda_itens.ordem_venda_id
    AND (o.empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))));
CREATE POLICY ovi_delete ON public.ordens_venda_itens FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ordens_venda o WHERE o.id = ordens_venda_itens.ordem_venda_id
    AND (o.empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))));

-- compras_itens
DROP POLICY IF EXISTS ci_select ON public.compras_itens;
DROP POLICY IF EXISTS ci_insert ON public.compras_itens;
DROP POLICY IF EXISTS ci_update ON public.compras_itens;
DROP POLICY IF EXISTS ci_delete ON public.compras_itens;

CREATE POLICY ci_select ON public.compras_itens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.compras c WHERE c.id = compras_itens.compra_id
    AND (c.empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))));
CREATE POLICY ci_insert ON public.compras_itens FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.compras c WHERE c.id = compras_itens.compra_id
    AND (c.empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))));
CREATE POLICY ci_update ON public.compras_itens FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.compras c WHERE c.id = compras_itens.compra_id
    AND (c.empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))));
CREATE POLICY ci_delete ON public.compras_itens FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.compras c WHERE c.id = compras_itens.compra_id
    AND (c.empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))));

-- pedidos_compra_itens
DROP POLICY IF EXISTS pci_select ON public.pedidos_compra_itens;
DROP POLICY IF EXISTS pci_insert ON public.pedidos_compra_itens;
DROP POLICY IF EXISTS pci_update ON public.pedidos_compra_itens;
DROP POLICY IF EXISTS pci_delete ON public.pedidos_compra_itens;

CREATE POLICY pci_select ON public.pedidos_compra_itens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pedidos_compra p WHERE p.id = pedidos_compra_itens.pedido_compra_id
    AND (p.empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))));
CREATE POLICY pci_insert ON public.pedidos_compra_itens FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.pedidos_compra p WHERE p.id = pedidos_compra_itens.pedido_compra_id
    AND (p.empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))));
CREATE POLICY pci_update ON public.pedidos_compra_itens FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pedidos_compra p WHERE p.id = pedidos_compra_itens.pedido_compra_id
    AND (p.empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))));
CREATE POLICY pci_delete ON public.pedidos_compra_itens FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pedidos_compra p WHERE p.id = pedidos_compra_itens.pedido_compra_id
    AND (p.empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))));

-- Comentários
COMMENT ON COLUMN public.orcamentos.empresa_id IS 'Multi-tenant: filtro RLS via current_empresa_id().';
COMMENT ON COLUMN public.ordens_venda.empresa_id IS 'Multi-tenant: filtro RLS via current_empresa_id().';
COMMENT ON COLUMN public.compras.empresa_id IS 'Multi-tenant: filtro RLS via current_empresa_id().';
COMMENT ON COLUMN public.pedidos_compra.empresa_id IS 'Multi-tenant: filtro RLS via current_empresa_id().';
