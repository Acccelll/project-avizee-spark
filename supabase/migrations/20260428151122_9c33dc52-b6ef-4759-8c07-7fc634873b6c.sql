-- ========== ESTOQUE_MOVIMENTOS ==========
ALTER TABLE public.estoque_movimentos
  ADD COLUMN IF NOT EXISTS empresa_id uuid;

-- Backfill com empresa padrão
UPDATE public.estoque_movimentos em
SET empresa_id = (SELECT id FROM public.empresas ORDER BY created_at ASC LIMIT 1)
WHERE em.empresa_id IS NULL;

ALTER TABLE public.estoque_movimentos
  ALTER COLUMN empresa_id SET NOT NULL,
  ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();

CREATE INDEX IF NOT EXISTS idx_estoque_movimentos_empresa_id
  ON public.estoque_movimentos(empresa_id);

-- Trigger safety-net
CREATE OR REPLACE FUNCTION public.set_empresa_id_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.empresa_id IS NULL THEN
    NEW.empresa_id := public.current_empresa_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_empresa_id_estoque_movimentos ON public.estoque_movimentos;
CREATE TRIGGER trg_set_empresa_id_estoque_movimentos
  BEFORE INSERT ON public.estoque_movimentos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_default();

-- RLS
DROP POLICY IF EXISTS em_select ON public.estoque_movimentos;
DROP POLICY IF EXISTS em_insert ON public.estoque_movimentos;
DROP POLICY IF EXISTS em_update ON public.estoque_movimentos;
DROP POLICY IF EXISTS em_delete ON public.estoque_movimentos;

CREATE POLICY em_select ON public.estoque_movimentos FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY em_insert ON public.estoque_movimentos FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY em_update ON public.estoque_movimentos FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY em_delete ON public.estoque_movimentos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ========== CONCILIACAO_BANCARIA ==========
ALTER TABLE public.conciliacao_bancaria
  ADD COLUMN IF NOT EXISTS empresa_id uuid;

UPDATE public.conciliacao_bancaria cb
SET empresa_id = (SELECT id FROM public.empresas ORDER BY created_at ASC LIMIT 1)
WHERE cb.empresa_id IS NULL;

ALTER TABLE public.conciliacao_bancaria
  ALTER COLUMN empresa_id SET NOT NULL,
  ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();

CREATE INDEX IF NOT EXISTS idx_conciliacao_bancaria_empresa_id
  ON public.conciliacao_bancaria(empresa_id);

DROP TRIGGER IF EXISTS trg_set_empresa_id_conciliacao_bancaria ON public.conciliacao_bancaria;
CREATE TRIGGER trg_set_empresa_id_conciliacao_bancaria
  BEFORE INSERT ON public.conciliacao_bancaria
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_default();

DROP POLICY IF EXISTS conc_select ON public.conciliacao_bancaria;
DROP POLICY IF EXISTS conc_insert ON public.conciliacao_bancaria;
DROP POLICY IF EXISTS conc_update ON public.conciliacao_bancaria;
DROP POLICY IF EXISTS conc_delete ON public.conciliacao_bancaria;

CREATE POLICY conc_select ON public.conciliacao_bancaria FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY conc_insert ON public.conciliacao_bancaria FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY conc_update ON public.conciliacao_bancaria FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY conc_delete ON public.conciliacao_bancaria FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

COMMENT ON COLUMN public.estoque_movimentos.empresa_id IS 'Multi-tenant Onda 3: tenant owner. Default via current_empresa_id().';
COMMENT ON COLUMN public.conciliacao_bancaria.empresa_id IS 'Multi-tenant Onda 3: tenant owner. Default via current_empresa_id().';