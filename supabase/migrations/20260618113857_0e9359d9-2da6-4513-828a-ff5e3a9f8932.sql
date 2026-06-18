
-- ============================================================
-- Fase 1.1 — Endurecer SELECT em tabelas fiscais e correlatas
-- Substitui USING(true) por verificação por papel.
-- INSERT/UPDATE/DELETE não são alterados.
-- ============================================================

-- ----- Fiscal: admin OR financeiro OR vendedor (read) ------

DROP POLICY IF EXISTS auth_select_eventos_fiscais ON public.eventos_fiscais;
CREATE POLICY ef_select_role ON public.eventos_fiscais
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'vendedor'::app_role)
  );
COMMENT ON TABLE public.eventos_fiscais IS
  'Single-tenant. Leitura restrita a admin/financeiro/vendedor (Fase 1.1).';

DROP POLICY IF EXISTS auth_select_nfe_dist ON public.nfe_distribuicao;
CREATE POLICY nfd_select_role ON public.nfe_distribuicao
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'vendedor'::app_role)
  );
COMMENT ON TABLE public.nfe_distribuicao IS
  'Single-tenant. Leitura restrita a admin/financeiro/vendedor (Fase 1.1).';

DROP POLICY IF EXISTS auth_select_nfe_dist_itens ON public.nfe_distribuicao_itens;
CREATE POLICY nfdi_select_role ON public.nfe_distribuicao_itens
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'vendedor'::app_role)
  );
COMMENT ON TABLE public.nfe_distribuicao_itens IS
  'Single-tenant. Leitura restrita a admin/financeiro/vendedor (Fase 1.1).';

DROP POLICY IF EXISTS nfa_select ON public.nota_fiscal_anexos;
CREATE POLICY nfa_select_role ON public.nota_fiscal_anexos
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'vendedor'::app_role)
  );
COMMENT ON TABLE public.nota_fiscal_anexos IS
  'Single-tenant. Leitura restrita a admin/financeiro/vendedor (Fase 1.1).';

DROP POLICY IF EXISTS nfe_select ON public.nota_fiscal_eventos;
CREATE POLICY nfev_select_role ON public.nota_fiscal_eventos
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'vendedor'::app_role)
  );
COMMENT ON TABLE public.nota_fiscal_eventos IS
  'Single-tenant. Leitura restrita a admin/financeiro/vendedor (Fase 1.1).';

DROP POLICY IF EXISTS auth_select_inutilizacoes ON public.inutilizacoes_numeracao;
CREATE POLICY inut_select_role ON public.inutilizacoes_numeracao
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'vendedor'::app_role)
  );
COMMENT ON TABLE public.inutilizacoes_numeracao IS
  'Single-tenant. Leitura restrita a admin/financeiro/vendedor (Fase 1.1).';

-- ----- Configuração fiscal (consultada na emissão) -----

DROP POLICY IF EXISTS mf_select ON public.matriz_fiscal;
CREATE POLICY mf_select_role ON public.matriz_fiscal
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'vendedor'::app_role)
  );
COMMENT ON TABLE public.matriz_fiscal IS
  'Single-tenant. Leitura restrita a admin/financeiro/vendedor (Fase 1.1). Escrita admin-only.';

DROP POLICY IF EXISTS natop_select ON public.naturezas_operacao;
CREATE POLICY natop_select_role ON public.naturezas_operacao
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'vendedor'::app_role)
  );
COMMENT ON TABLE public.naturezas_operacao IS
  'Single-tenant. Leitura restrita a admin/financeiro/vendedor (Fase 1.1). Escrita admin-only.';

-- ----- Cotações de compra: admin OR gestor_compras OR financeiro (read) -----

DROP POLICY IF EXISTS cco_select ON public.cotacoes_compra;
CREATE POLICY cco_select_role ON public.cotacoes_compra
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor_compras'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
  );
COMMENT ON TABLE public.cotacoes_compra IS
  'Single-tenant. Leitura restrita a admin/gestor_compras/financeiro (Fase 1.1).';

DROP POLICY IF EXISTS cci_select ON public.cotacoes_compra_itens;
CREATE POLICY cci_select_role ON public.cotacoes_compra_itens
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor_compras'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
  );
COMMENT ON TABLE public.cotacoes_compra_itens IS
  'Single-tenant. Leitura restrita a admin/gestor_compras/financeiro (Fase 1.1).';

DROP POLICY IF EXISTS ccp_select ON public.cotacoes_compra_propostas;
CREATE POLICY ccp_select_role ON public.cotacoes_compra_propostas
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor_compras'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
  );
COMMENT ON TABLE public.cotacoes_compra_propostas IS
  'Single-tenant. Leitura restrita a admin/gestor_compras/financeiro (Fase 1.1).';

-- ----- Lotes de baixa: admin OR financeiro (read) -----

DROP POLICY IF EXISTS baixa_lotes_select ON public.financeiro_baixa_lotes;
CREATE POLICY baixa_lotes_select_role ON public.financeiro_baixa_lotes
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
  );
COMMENT ON TABLE public.financeiro_baixa_lotes IS
  'Single-tenant. Leitura restrita a admin/financeiro (Fase 1.1).';
