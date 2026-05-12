-- Tier 3 wave 2: Cadastros comerciais, compras, logística, apresentação, social

-- ============== COMERCIAL/CLIENTES (admin OR vendedor) ==============
DROP POLICY IF EXISTS pe_insert ON public.precos_especiais;
DROP POLICY IF EXISTS pe_update ON public.precos_especiais;
DROP POLICY IF EXISTS pe_delete ON public.precos_especiais;
CREATE POLICY pe_insert_role ON public.precos_especiais FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'vendedor'));
CREATE POLICY pe_update_role ON public.precos_especiais FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'vendedor'));
CREATE POLICY pe_delete_role ON public.precos_especiais FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'vendedor'));

DROP POLICY IF EXISTS crc_insert ON public.cliente_registros_comunicacao;
DROP POLICY IF EXISTS crc_update ON public.cliente_registros_comunicacao;
DROP POLICY IF EXISTS crc_delete ON public.cliente_registros_comunicacao;
CREATE POLICY crc_insert_role ON public.cliente_registros_comunicacao FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'vendedor'));
CREATE POLICY crc_update_role ON public.cliente_registros_comunicacao FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'vendedor'));
CREATE POLICY crc_delete_role ON public.cliente_registros_comunicacao FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'vendedor'));

DROP POLICY IF EXISTS ct_insert ON public.cliente_transportadoras;
DROP POLICY IF EXISTS ct_update ON public.cliente_transportadoras;
DROP POLICY IF EXISTS ct_delete ON public.cliente_transportadoras;
CREATE POLICY ct_insert_role ON public.cliente_transportadoras FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'vendedor'));
CREATE POLICY ct_update_role ON public.cliente_transportadoras FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'vendedor'));
CREATE POLICY ct_delete_role ON public.cliente_transportadoras FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'vendedor'));

DROP POLICY IF EXISTS cee_insert ON public.clientes_enderecos_entrega;
DROP POLICY IF EXISTS cee_update ON public.clientes_enderecos_entrega;
DROP POLICY IF EXISTS cee_delete ON public.clientes_enderecos_entrega;
CREATE POLICY cee_insert_role ON public.clientes_enderecos_entrega FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'vendedor'));
CREATE POLICY cee_update_role ON public.clientes_enderecos_entrega FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'vendedor'));
CREATE POLICY cee_delete_role ON public.clientes_enderecos_entrega FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'vendedor'));

-- ============== COMPRAS (admin OR gestor_compras) ==============
DROP POLICY IF EXISTS cco_insert ON public.cotacoes_compra;
DROP POLICY IF EXISTS cco_update ON public.cotacoes_compra;
DROP POLICY IF EXISTS cco_delete ON public.cotacoes_compra;
CREATE POLICY cco_insert_role ON public.cotacoes_compra FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor_compras'));
CREATE POLICY cco_update_role ON public.cotacoes_compra FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor_compras'));
CREATE POLICY cco_delete_role ON public.cotacoes_compra FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor_compras'));

DROP POLICY IF EXISTS cci_insert ON public.cotacoes_compra_itens;
DROP POLICY IF EXISTS cci_update ON public.cotacoes_compra_itens;
DROP POLICY IF EXISTS cci_delete ON public.cotacoes_compra_itens;
CREATE POLICY cci_insert_role ON public.cotacoes_compra_itens FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor_compras'));
CREATE POLICY cci_update_role ON public.cotacoes_compra_itens FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor_compras'));
CREATE POLICY cci_delete_role ON public.cotacoes_compra_itens FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor_compras'));

DROP POLICY IF EXISTS ccp_insert ON public.cotacoes_compra_propostas;
DROP POLICY IF EXISTS ccp_update ON public.cotacoes_compra_propostas;
DROP POLICY IF EXISTS ccp_delete ON public.cotacoes_compra_propostas;
CREATE POLICY ccp_insert_role ON public.cotacoes_compra_propostas FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor_compras'));
CREATE POLICY ccp_update_role ON public.cotacoes_compra_propostas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor_compras'));
CREATE POLICY ccp_delete_role ON public.cotacoes_compra_propostas FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor_compras'));

DROP POLICY IF EXISTS pf_insert ON public.produtos_fornecedores;
DROP POLICY IF EXISTS pf_update ON public.produtos_fornecedores;
DROP POLICY IF EXISTS pf_delete ON public.produtos_fornecedores;
CREATE POLICY pf_insert_role ON public.produtos_fornecedores FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor_compras'));
CREATE POLICY pf_update_role ON public.produtos_fornecedores FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor_compras'));
CREATE POLICY pf_delete_role ON public.produtos_fornecedores FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor_compras'));

-- ============== ESTOQUE/LOGÍSTICA (admin OR estoquista) ==============
DROP POLICY IF EXISTS transportadoras_insert ON public.transportadoras;
DROP POLICY IF EXISTS transportadoras_update ON public.transportadoras;
DROP POLICY IF EXISTS transportadoras_delete ON public.transportadoras;
CREATE POLICY transp_insert_role ON public.transportadoras FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'estoquista') OR public.has_role(auth.uid(),'operador_logistico'));
CREATE POLICY transp_update_role ON public.transportadoras FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'estoquista') OR public.has_role(auth.uid(),'operador_logistico'));
CREATE POLICY transp_delete_role ON public.transportadoras FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'estoquista') OR public.has_role(auth.uid(),'operador_logistico'));

DROP POLICY IF EXISTS ge_insert ON public.grupos_economicos;
DROP POLICY IF EXISTS ge_update ON public.grupos_economicos;
DROP POLICY IF EXISTS ge_delete ON public.grupos_economicos;
CREATE POLICY ge_insert_admin ON public.grupos_economicos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY ge_update_admin ON public.grupos_economicos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY ge_delete_admin ON public.grupos_economicos FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS gp_insert ON public.grupos_produto;
DROP POLICY IF EXISTS gp_update ON public.grupos_produto;
CREATE POLICY gp_insert_role ON public.grupos_produto FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'estoquista'));
CREATE POLICY gp_update_role ON public.grupos_produto FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'estoquista'));

DROP POLICY IF EXISTS unidades_medida_insert ON public.unidades_medida;
DROP POLICY IF EXISTS unidades_medida_update ON public.unidades_medida;
CREATE POLICY um_insert_admin ON public.unidades_medida FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY um_update_admin ON public.unidades_medida FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS pc_insert ON public.produto_composicoes;
DROP POLICY IF EXISTS pc_update ON public.produto_composicoes;
DROP POLICY IF EXISTS pc_delete ON public.produto_composicoes;
CREATE POLICY pc_insert_role ON public.produto_composicoes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'estoquista'));
CREATE POLICY pc_update_role ON public.produto_composicoes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'estoquista'));
CREATE POLICY pc_delete_role ON public.produto_composicoes FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'estoquista'));

DROP POLICY IF EXISTS ri_insert ON public.remessa_itens;
DROP POLICY IF EXISTS ri_update ON public.remessa_itens;
DROP POLICY IF EXISTS ri_delete ON public.remessa_itens;
CREATE POLICY ri_insert_role ON public.remessa_itens FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'estoquista') OR public.has_role(auth.uid(),'operador_logistico'));
CREATE POLICY ri_update_role ON public.remessa_itens FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'estoquista') OR public.has_role(auth.uid(),'operador_logistico'));
CREATE POLICY ri_delete_role ON public.remessa_itens FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'estoquista') OR public.has_role(auth.uid(),'operador_logistico'));

DROP POLICY IF EXISTS frete_sim_insert ON public.frete_simulacoes;
DROP POLICY IF EXISTS frete_sim_update ON public.frete_simulacoes;
DROP POLICY IF EXISTS frete_sim_delete ON public.frete_simulacoes;
CREATE POLICY frete_sim_insert_role ON public.frete_simulacoes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'vendedor') OR public.has_role(auth.uid(),'estoquista') OR public.has_role(auth.uid(),'operador_logistico'));
CREATE POLICY frete_sim_update_role ON public.frete_simulacoes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'vendedor') OR public.has_role(auth.uid(),'estoquista') OR public.has_role(auth.uid(),'operador_logistico'));
CREATE POLICY frete_sim_delete_role ON public.frete_simulacoes FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'vendedor') OR public.has_role(auth.uid(),'estoquista') OR public.has_role(auth.uid(),'operador_logistico'));

DROP POLICY IF EXISTS frete_opc_insert ON public.frete_simulacoes_opcoes;
DROP POLICY IF EXISTS frete_opc_update ON public.frete_simulacoes_opcoes;
DROP POLICY IF EXISTS frete_opc_delete ON public.frete_simulacoes_opcoes;
CREATE POLICY frete_opc_insert_role ON public.frete_simulacoes_opcoes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'vendedor') OR public.has_role(auth.uid(),'estoquista') OR public.has_role(auth.uid(),'operador_logistico'));
CREATE POLICY frete_opc_update_role ON public.frete_simulacoes_opcoes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'vendedor') OR public.has_role(auth.uid(),'estoquista') OR public.has_role(auth.uid(),'operador_logistico'));
CREATE POLICY frete_opc_delete_role ON public.frete_simulacoes_opcoes FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'vendedor') OR public.has_role(auth.uid(),'estoquista') OR public.has_role(auth.uid(),'operador_logistico'));

-- ============== APRESENTAÇÃO (admin OR financeiro) ==============
DROP POLICY IF EXISTS at_insert ON public.apresentacao_templates;
DROP POLICY IF EXISTS at_update ON public.apresentacao_templates;
CREATE POLICY at_insert_role ON public.apresentacao_templates FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY at_update_role ON public.apresentacao_templates FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));

DROP POLICY IF EXISTS ag_insert ON public.apresentacao_geracoes;
DROP POLICY IF EXISTS ag_update ON public.apresentacao_geracoes;
CREATE POLICY ag_insert_role ON public.apresentacao_geracoes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY ag_update_role ON public.apresentacao_geracoes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));

-- apresentacao_comentarios mantém aberto: qualquer authenticated pode comentar (mas restringe UPDATE ao autor via outra policy futura, fora deste escopo)

-- ============== SOCIAL (admin only) ==============
DROP POLICY IF EXISTS sm_insert ON public.social_metricas_snapshot;
CREATE POLICY sm_insert_admin ON public.social_metricas_snapshot FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS sp_insert ON public.social_posts;
CREATE POLICY sp_insert_admin ON public.social_posts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
