-- ========== FINANCEIRO_LANCAMENTOS ==========
ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS empresa_id uuid;

UPDATE public.financeiro_lancamentos
SET empresa_id = (SELECT id FROM public.empresas ORDER BY created_at ASC LIMIT 1)
WHERE empresa_id IS NULL;

ALTER TABLE public.financeiro_lancamentos
  ALTER COLUMN empresa_id SET NOT NULL,
  ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();

CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_empresa_id
  ON public.financeiro_lancamentos(empresa_id);

DROP TRIGGER IF EXISTS trg_set_empresa_id_financeiro_lancamentos ON public.financeiro_lancamentos;
CREATE TRIGGER trg_set_empresa_id_financeiro_lancamentos
  BEFORE INSERT ON public.financeiro_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_default();

-- Drop policies antigas (manter apenas DELETE admin)
DROP POLICY IF EXISTS "Admin financeiro can select financeiro_lancamentos" ON public.financeiro_lancamentos;
DROP POLICY IF EXISTS fin_lanc_select_restricted ON public.financeiro_lancamentos;
DROP POLICY IF EXISTS fl_insert ON public.financeiro_lancamentos;
DROP POLICY IF EXISTS fl_update ON public.financeiro_lancamentos;

CREATE POLICY fl_select ON public.financeiro_lancamentos FOR SELECT TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role))
    AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(), 'admin'::app_role))
  );
CREATE POLICY fl_insert ON public.financeiro_lancamentos FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role))
    AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(), 'admin'::app_role))
  );
CREATE POLICY fl_update ON public.financeiro_lancamentos FOR UPDATE TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role))
    AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(), 'admin'::app_role))
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role))
    AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(), 'admin'::app_role))
  );

-- ========== FINANCEIRO_BAIXAS ==========
ALTER TABLE public.financeiro_baixas
  ADD COLUMN IF NOT EXISTS empresa_id uuid;

UPDATE public.financeiro_baixas
SET empresa_id = (SELECT id FROM public.empresas ORDER BY created_at ASC LIMIT 1)
WHERE empresa_id IS NULL;

ALTER TABLE public.financeiro_baixas
  ALTER COLUMN empresa_id SET NOT NULL,
  ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();

CREATE INDEX IF NOT EXISTS idx_financeiro_baixas_empresa_id
  ON public.financeiro_baixas(empresa_id);

DROP TRIGGER IF EXISTS trg_set_empresa_id_financeiro_baixas ON public.financeiro_baixas;
CREATE TRIGGER trg_set_empresa_id_financeiro_baixas
  BEFORE INSERT ON public.financeiro_baixas
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_default();

DROP POLICY IF EXISTS "Admin financeiro can select financeiro_baixas" ON public.financeiro_baixas;
DROP POLICY IF EXISTS fin_baixas_select_restricted ON public.financeiro_baixas;
DROP POLICY IF EXISTS fb_insert ON public.financeiro_baixas;
DROP POLICY IF EXISTS fb_update ON public.financeiro_baixas;

CREATE POLICY fb_select ON public.financeiro_baixas FOR SELECT TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role))
    AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(), 'admin'::app_role))
  );
CREATE POLICY fb_insert ON public.financeiro_baixas FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role))
    AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(), 'admin'::app_role))
  );
CREATE POLICY fb_update ON public.financeiro_baixas FOR UPDATE TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role))
    AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(), 'admin'::app_role))
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role))
    AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(), 'admin'::app_role))
  );

-- ========== NOTAS_FISCAIS ==========
ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS empresa_id uuid;

UPDATE public.notas_fiscais
SET empresa_id = (SELECT id FROM public.empresas ORDER BY created_at ASC LIMIT 1)
WHERE empresa_id IS NULL;

ALTER TABLE public.notas_fiscais
  ALTER COLUMN empresa_id SET NOT NULL,
  ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();

CREATE INDEX IF NOT EXISTS idx_notas_fiscais_empresa_id
  ON public.notas_fiscais(empresa_id);

DROP TRIGGER IF EXISTS trg_set_empresa_id_notas_fiscais ON public.notas_fiscais;
CREATE TRIGGER trg_set_empresa_id_notas_fiscais
  BEFORE INSERT ON public.notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_default();

DROP POLICY IF EXISTS nf_select ON public.notas_fiscais;
DROP POLICY IF EXISTS nf_insert ON public.notas_fiscais;
DROP POLICY IF EXISTS nf_update ON public.notas_fiscais;
DROP POLICY IF EXISTS "Conditional update notas_fiscais" ON public.notas_fiscais;

CREATE POLICY nf_select ON public.notas_fiscais FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY nf_insert ON public.notas_fiscais FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY nf_update ON public.notas_fiscais FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id() OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (
    (empresa_id = public.current_empresa_id() OR has_role(auth.uid(), 'admin'::app_role))
    AND (
      status <> ALL (ARRAY['autorizada'::text, 'cancelada_sefaz'::text, 'inutilizada'::text])
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'financeiro'::app_role)
    )
  );

-- ========== NOTAS_FISCAIS_ITENS (herda via FK) ==========
DROP POLICY IF EXISTS nfi_select ON public.notas_fiscais_itens;
DROP POLICY IF EXISTS nfi_insert ON public.notas_fiscais_itens;
DROP POLICY IF EXISTS nfi_update ON public.notas_fiscais_itens;

CREATE POLICY nfi_select ON public.notas_fiscais_itens FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.notas_fiscais nf
    WHERE nf.id = notas_fiscais_itens.nota_fiscal_id
      AND (nf.empresa_id = public.current_empresa_id() OR has_role(auth.uid(), 'admin'::app_role))
  ));
CREATE POLICY nfi_insert ON public.notas_fiscais_itens FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.notas_fiscais nf
    WHERE nf.id = notas_fiscais_itens.nota_fiscal_id
      AND (nf.empresa_id = public.current_empresa_id() OR has_role(auth.uid(), 'admin'::app_role))
  ));
CREATE POLICY nfi_update ON public.notas_fiscais_itens FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.notas_fiscais nf
    WHERE nf.id = notas_fiscais_itens.nota_fiscal_id
      AND (nf.empresa_id = public.current_empresa_id() OR has_role(auth.uid(), 'admin'::app_role))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.notas_fiscais nf
    WHERE nf.id = notas_fiscais_itens.nota_fiscal_id
      AND (nf.empresa_id = public.current_empresa_id() OR has_role(auth.uid(), 'admin'::app_role))
  ));

COMMENT ON COLUMN public.financeiro_lancamentos.empresa_id IS 'Multi-tenant Onda 4: tenant owner. Default via current_empresa_id().';
COMMENT ON COLUMN public.financeiro_baixas.empresa_id IS 'Multi-tenant Onda 4: tenant owner. Default via current_empresa_id().';
COMMENT ON COLUMN public.notas_fiscais.empresa_id IS 'Multi-tenant Onda 4: tenant owner. Default via current_empresa_id().';