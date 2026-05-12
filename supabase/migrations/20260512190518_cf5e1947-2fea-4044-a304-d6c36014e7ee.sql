-- ========== C-01: Tightening de RLS em tabelas com USING(true) ==========

-- fechamentos_mensais.fm_select
DROP POLICY IF EXISTS fm_select ON public.fechamentos_mensais;
CREATE POLICY fm_select ON public.fechamentos_mensais
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'financeiro'::public.app_role)
  );
COMMENT ON POLICY fm_select ON public.fechamentos_mensais IS
  'Single-tenant: SELECT restrito a admin/financeiro (substitui USING(true) anterior).';

-- workbook_templates.wt_select
DROP POLICY IF EXISTS wt_select ON public.workbook_templates;
CREATE POLICY wt_select ON public.workbook_templates
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'financeiro'::public.app_role)
  );
COMMENT ON POLICY wt_select ON public.workbook_templates IS
  'Single-tenant: SELECT restrito a admin/financeiro (substitui USING(true) anterior).';

-- workbook_geracoes.wg_*
DROP POLICY IF EXISTS wg_select ON public.workbook_geracoes;
DROP POLICY IF EXISTS wg_insert ON public.workbook_geracoes;
DROP POLICY IF EXISTS wg_update ON public.workbook_geracoes;

CREATE POLICY wg_select ON public.workbook_geracoes
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'financeiro'::public.app_role)
  );
COMMENT ON POLICY wg_select ON public.workbook_geracoes IS
  'Single-tenant: SELECT restrito a admin/financeiro.';

CREATE POLICY wg_insert ON public.workbook_geracoes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'financeiro'::public.app_role)
  );
COMMENT ON POLICY wg_insert ON public.workbook_geracoes IS
  'Single-tenant: INSERT restrito a admin/financeiro.';

CREATE POLICY wg_update ON public.workbook_geracoes
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'financeiro'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'financeiro'::public.app_role)
  );
COMMENT ON POLICY wg_update ON public.workbook_geracoes IS
  'Single-tenant: UPDATE restrito a admin/financeiro.';

-- ========== I-02: notas_fiscais exige role além do tenant ==========

DROP POLICY IF EXISTS nf_select ON public.notas_fiscais;
CREATE POLICY nf_select ON public.notas_fiscais
  FOR SELECT TO authenticated
  USING (
    (
      empresa_id = public.current_empresa_id()
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'financeiro'::public.app_role)
        OR public.has_role(auth.uid(), 'vendedor'::public.app_role)
      )
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );
COMMENT ON POLICY nf_select ON public.notas_fiscais IS
  'Single-tenant + RBAC: SELECT exige empresa_id correto E papel admin/financeiro/vendedor; admin global tem bypass.';

DROP POLICY IF EXISTS nf_insert ON public.notas_fiscais;
CREATE POLICY nf_insert ON public.notas_fiscais
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      empresa_id = public.current_empresa_id()
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'financeiro'::public.app_role)
        OR public.has_role(auth.uid(), 'vendedor'::public.app_role)
      )
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );
COMMENT ON POLICY nf_insert ON public.notas_fiscais IS
  'Single-tenant + RBAC: INSERT exige empresa_id correto E papel admin/financeiro/vendedor; admin global tem bypass.';