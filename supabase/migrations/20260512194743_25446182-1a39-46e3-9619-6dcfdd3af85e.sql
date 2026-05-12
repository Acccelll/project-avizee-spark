-- Tier 3: Endurecimento de políticas RLS de escrita (USING(true) -> filtro por role)
-- Mantém SELECT aberto para authenticated; restringe INSERT/UPDATE/DELETE.

-- ============== FISCAL (admin OR financeiro OR vendedor) ==============
DROP POLICY IF EXISTS auth_insert_eventos_fiscais ON public.eventos_fiscais;
DROP POLICY IF EXISTS auth_update_eventos_fiscais ON public.eventos_fiscais;
CREATE POLICY ef_insert_role ON public.eventos_fiscais FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'vendedor'));
CREATE POLICY ef_update_role ON public.eventos_fiscais FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'vendedor'));

DROP POLICY IF EXISTS auth_insert_inutilizacoes ON public.inutilizacoes_numeracao;
DROP POLICY IF EXISTS auth_update_inutilizacoes ON public.inutilizacoes_numeracao;
CREATE POLICY inut_insert_role ON public.inutilizacoes_numeracao FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'vendedor'));
CREATE POLICY inut_update_role ON public.inutilizacoes_numeracao FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'vendedor'));

DROP POLICY IF EXISTS auth_insert_nfe_dist ON public.nfe_distribuicao;
DROP POLICY IF EXISTS auth_update_nfe_dist ON public.nfe_distribuicao;
CREATE POLICY nfd_insert_role ON public.nfe_distribuicao FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'vendedor'));
CREATE POLICY nfd_update_role ON public.nfe_distribuicao FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'vendedor'));

DROP POLICY IF EXISTS auth_insert_nfe_dist_itens ON public.nfe_distribuicao_itens;
CREATE POLICY nfdi_insert_role ON public.nfe_distribuicao_itens FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'vendedor'));

DROP POLICY IF EXISTS nfa_insert ON public.nota_fiscal_anexos;
DROP POLICY IF EXISTS nfa_delete ON public.nota_fiscal_anexos;
CREATE POLICY nfa_insert_role ON public.nota_fiscal_anexos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'vendedor'));
CREATE POLICY nfa_delete_role ON public.nota_fiscal_anexos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'vendedor'));

DROP POLICY IF EXISTS nfe_insert ON public.nota_fiscal_eventos;
CREATE POLICY nfev_insert_role ON public.nota_fiscal_eventos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'vendedor'));

-- ============== STAGING / MIGRAÇÃO (admin only) ==============
DROP POLICY IF EXISTS stg_cad_insert ON public.stg_cadastros;
DROP POLICY IF EXISTS stg_cad_update ON public.stg_cadastros;
DROP POLICY IF EXISTS stg_cad_delete ON public.stg_cadastros;
CREATE POLICY stg_cad_insert_admin ON public.stg_cadastros FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY stg_cad_update_admin ON public.stg_cadastros FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY stg_cad_delete_admin ON public.stg_cadastros FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS scx_insert ON public.stg_compras_xml;
DROP POLICY IF EXISTS scx_update ON public.stg_compras_xml;
CREATE POLICY scx_insert_admin ON public.stg_compras_xml FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY scx_update_admin ON public.stg_compras_xml FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS sei_insert ON public.stg_estoque_inicial;
DROP POLICY IF EXISTS sei_update ON public.stg_estoque_inicial;
CREATE POLICY sei_insert_admin ON public.stg_estoque_inicial FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY sei_update_admin ON public.stg_estoque_inicial FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS sf_insert ON public.stg_faturamento;
DROP POLICY IF EXISTS sf_update ON public.stg_faturamento;
CREATE POLICY sf_insert_admin ON public.stg_faturamento FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY sf_update_admin ON public.stg_faturamento FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS sfa_insert ON public.stg_financeiro_aberto;
DROP POLICY IF EXISTS sfa_update ON public.stg_financeiro_aberto;
CREATE POLICY sfa_insert_admin ON public.stg_financeiro_aberto FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY sfa_update_admin ON public.stg_financeiro_aberto FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS il_insert ON public.importacao_lotes;
DROP POLICY IF EXISTS il_update ON public.importacao_lotes;
CREATE POLICY il_insert_admin ON public.importacao_lotes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY il_update_admin ON public.importacao_lotes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS ilog_insert ON public.importacao_logs;
CREATE POLICY ilog_insert_admin ON public.importacao_logs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS cpm_insert ON public.cadastros_pendencias_migracao;
CREATE POLICY cpm_insert_admin ON public.cadastros_pendencias_migracao FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============== FINANCEIRO CORE (admin OR financeiro) ==============
DROP POLICY IF EXISTS bancos_insert ON public.bancos;
DROP POLICY IF EXISTS bancos_update ON public.bancos;
CREATE POLICY bancos_insert_role ON public.bancos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY bancos_update_role ON public.bancos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));

DROP POLICY IF EXISTS fp_insert ON public.formas_pagamento;
DROP POLICY IF EXISTS fp_update ON public.formas_pagamento;
CREATE POLICY fp_insert_role ON public.formas_pagamento FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY fp_update_role ON public.formas_pagamento FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));

DROP POLICY IF EXISTS cc_insert ON public.contas_contabeis;
DROP POLICY IF EXISTS cc_update ON public.contas_contabeis;
CREATE POLICY cc_insert_role ON public.contas_contabeis FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY cc_update_role ON public.contas_contabeis FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));

DROP POLICY IF EXISTS baixa_lotes_insert ON public.financeiro_baixa_lotes;
CREATE POLICY baixa_lotes_insert_role ON public.financeiro_baixa_lotes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));
