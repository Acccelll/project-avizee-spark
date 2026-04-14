
-- salvar_orcamento
CREATE OR REPLACE FUNCTION public.salvar_orcamento(p_id UUID, p_payload JSONB, p_itens JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  IF p_id IS NOT NULL THEN
    UPDATE orcamentos SET numero=COALESCE(p_payload->>'numero',numero),cliente_id=(p_payload->>'cliente_id')::uuid,status=COALESCE(p_payload->>'status',status),data_orcamento=p_payload->>'data_orcamento',validade=p_payload->>'validade',observacoes=p_payload->>'observacoes',observacoes_internas=p_payload->>'observacoes_internas',desconto=COALESCE((p_payload->>'desconto')::numeric,0),imposto_st=COALESCE((p_payload->>'imposto_st')::numeric,0),imposto_ipi=COALESCE((p_payload->>'imposto_ipi')::numeric,0),frete_valor=COALESCE((p_payload->>'frete_valor')::numeric,0),outras_despesas=COALESCE((p_payload->>'outras_despesas')::numeric,0),valor_total=COALESCE((p_payload->>'valor_total')::numeric,0),quantidade_total=COALESCE((p_payload->>'quantidade_total')::numeric,0),peso_total=COALESCE((p_payload->>'peso_total')::numeric,0),pagamento=p_payload->>'pagamento',prazo_pagamento=p_payload->>'prazo_pagamento',prazo_entrega=p_payload->>'prazo_entrega',frete_tipo=p_payload->>'frete_tipo',modalidade=p_payload->>'modalidade',cliente_snapshot=CASE WHEN p_payload ? 'cliente_snapshot' THEN p_payload->'cliente_snapshot' ELSE cliente_snapshot END,updated_at=now() WHERE id=p_id;
    DELETE FROM orcamentos_itens WHERE orcamento_id=p_id;
    v_id:=p_id;
  ELSE
    INSERT INTO orcamentos(numero,cliente_id,status,data_orcamento,validade,observacoes,observacoes_internas,desconto,imposto_st,imposto_ipi,frete_valor,outras_despesas,valor_total,quantidade_total,peso_total,pagamento,prazo_pagamento,prazo_entrega,frete_tipo,modalidade,cliente_snapshot)
    VALUES(p_payload->>'numero',(p_payload->>'cliente_id')::uuid,COALESCE(p_payload->>'status','rascunho'),p_payload->>'data_orcamento',p_payload->>'validade',p_payload->>'observacoes',p_payload->>'observacoes_internas',COALESCE((p_payload->>'desconto')::numeric,0),COALESCE((p_payload->>'imposto_st')::numeric,0),COALESCE((p_payload->>'imposto_ipi')::numeric,0),COALESCE((p_payload->>'frete_valor')::numeric,0),COALESCE((p_payload->>'outras_despesas')::numeric,0),COALESCE((p_payload->>'valor_total')::numeric,0),COALESCE((p_payload->>'quantidade_total')::numeric,0),COALESCE((p_payload->>'peso_total')::numeric,0),p_payload->>'pagamento',p_payload->>'prazo_pagamento',p_payload->>'prazo_entrega',p_payload->>'frete_tipo',p_payload->>'modalidade',CASE WHEN p_payload ? 'cliente_snapshot' THEN p_payload->'cliente_snapshot' ELSE NULL END)
    RETURNING id INTO v_id;
  END IF;
  IF p_itens IS NOT NULL AND jsonb_typeof(p_itens)='array' AND jsonb_array_length(p_itens)>0 THEN
    INSERT INTO orcamentos_itens(orcamento_id,produto_id,codigo_snapshot,descricao_snapshot,variacao,quantidade,unidade,valor_unitario,valor_total,peso_unitario,peso_total)
    SELECT v_id,(i->>'produto_id')::uuid,i->>'codigo_snapshot',i->>'descricao_snapshot',NULLIF(i->>'variacao',''),COALESCE((i->>'quantidade')::numeric,0),i->>'unidade',COALESCE((i->>'valor_unitario')::numeric,0),COALESCE((i->>'valor_total')::numeric,0),COALESCE((i->>'peso_unitario')::numeric,0),COALESCE((i->>'peso_total')::numeric,0)
    FROM jsonb_array_elements(p_itens) AS i WHERE i->>'produto_id' IS NOT NULL AND i->>'produto_id'!='';
  END IF;
  RETURN v_id;
END;$$;

-- RLS escrita
DROP POLICY IF EXISTS "Authenticated can insert app_configuracoes" ON app_configuracoes;
DROP POLICY IF EXISTS "Admin can insert app_configuracoes" ON app_configuracoes;
CREATE POLICY "Admin can insert app_configuracoes" ON app_configuracoes FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Authenticated can update app_configuracoes" ON app_configuracoes;
DROP POLICY IF EXISTS "Admin can update app_configuracoes" ON app_configuracoes;
CREATE POLICY "Admin can update app_configuracoes" ON app_configuracoes FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Authenticated can insert empresa_config" ON empresa_config;
DROP POLICY IF EXISTS "Admin can insert empresa_config" ON empresa_config;
CREATE POLICY "Admin can insert empresa_config" ON empresa_config FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Authenticated can update empresa_config" ON empresa_config;
DROP POLICY IF EXISTS "Admin can update empresa_config" ON empresa_config;
CREATE POLICY "Admin can update empresa_config" ON empresa_config FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Authenticated can delete financeiro_lancamentos" ON financeiro_lancamentos;
DROP POLICY IF EXISTS "Admin can delete financeiro_lancamentos" ON financeiro_lancamentos;
CREATE POLICY "Admin can delete financeiro_lancamentos" ON financeiro_lancamentos FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Authenticated can delete financeiro_baixas" ON financeiro_baixas;
DROP POLICY IF EXISTS "Admin can delete financeiro_baixas" ON financeiro_baixas;
CREATE POLICY "Admin can delete financeiro_baixas" ON financeiro_baixas FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Authenticated can delete notas_fiscais" ON notas_fiscais;
DROP POLICY IF EXISTS "Admin can delete notas_fiscais" ON notas_fiscais;
CREATE POLICY "Admin can delete notas_fiscais" ON notas_fiscais FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Authenticated can delete notas_fiscais_itens" ON notas_fiscais_itens;
DROP POLICY IF EXISTS "Admin can delete notas_fiscais_itens" ON notas_fiscais_itens;
CREATE POLICY "Admin can delete notas_fiscais_itens" ON notas_fiscais_itens FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Authenticated can delete auditoria_logs" ON auditoria_logs;
DROP POLICY IF EXISTS "Block delete auditoria_logs" ON auditoria_logs;
CREATE POLICY "Block delete auditoria_logs" ON auditoria_logs FOR DELETE TO authenticated USING (false);
DROP POLICY IF EXISTS "Authenticated can update notas_fiscais" ON notas_fiscais;
DROP POLICY IF EXISTS "Conditional update notas_fiscais" ON notas_fiscais;
CREATE POLICY "Conditional update notas_fiscais" ON notas_fiscais FOR UPDATE TO authenticated USING (status NOT IN ('autorizada','cancelada_sefaz','inutilizada') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'financeiro'));

-- RLS leitura
DROP POLICY IF EXISTS "Authenticated can select financeiro_lancamentos" ON financeiro_lancamentos;
DROP POLICY IF EXISTS "Admin financeiro can select financeiro_lancamentos" ON financeiro_lancamentos;
CREATE POLICY "Admin financeiro can select financeiro_lancamentos" ON financeiro_lancamentos FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'financeiro'));
DROP POLICY IF EXISTS "Authenticated can select financeiro_baixas" ON financeiro_baixas;
DROP POLICY IF EXISTS "Admin financeiro can select financeiro_baixas" ON financeiro_baixas;
CREATE POLICY "Admin financeiro can select financeiro_baixas" ON financeiro_baixas FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'financeiro'));
DROP POLICY IF EXISTS "Authenticated can select folha_pagamento" ON folha_pagamento;
DROP POLICY IF EXISTS "Admin financeiro can select folha_pagamento" ON folha_pagamento;
CREATE POLICY "Admin financeiro can select folha_pagamento" ON folha_pagamento FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'financeiro'));
DROP POLICY IF EXISTS "Authenticated can select auditoria_logs" ON auditoria_logs;
DROP POLICY IF EXISTS "Admin can select auditoria_logs" ON auditoria_logs;
CREATE POLICY "Admin can select auditoria_logs" ON auditoria_logs FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Authenticated can select importacao_lotes" ON importacao_lotes;
DROP POLICY IF EXISTS "Admin can select importacao_lotes" ON importacao_lotes;
CREATE POLICY "Admin can select importacao_lotes" ON importacao_lotes FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Authenticated can select importacao_logs" ON importacao_logs;
DROP POLICY IF EXISTS "Admin can select importacao_logs" ON importacao_logs;
CREATE POLICY "Admin can select importacao_logs" ON importacao_logs FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente_id ON orcamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_vendedor_id ON orcamentos(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_status ON orcamentos(status);
CREATE INDEX IF NOT EXISTS idx_orcamentos_itens_orcamento_id ON orcamentos_itens(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_itens_produto_id ON orcamentos_itens(produto_id);
CREATE INDEX IF NOT EXISTS idx_ordens_venda_cliente_id ON ordens_venda(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ordens_venda_status ON ordens_venda(status);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_fornecedor_id ON notas_fiscais(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_cliente_id ON notas_fiscais(cliente_id);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_status ON notas_fiscais(status);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_data_emissao ON notas_fiscais(data_emissao);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_itens_nota_fiscal_id ON notas_fiscais_itens(nota_fiscal_id);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_itens_produto_id ON notas_fiscais_itens(produto_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_cliente_id ON financeiro_lancamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_fornecedor_id ON financeiro_lancamentos(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_status ON financeiro_lancamentos(status);
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_data_vencimento ON financeiro_lancamentos(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_tipo ON financeiro_lancamentos(tipo);
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_conta_bancaria_id ON financeiro_lancamentos(conta_bancaria_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_baixas_lancamento_id ON financeiro_baixas(lancamento_id);
CREATE INDEX IF NOT EXISTS idx_estoque_movimentos_produto_id ON estoque_movimentos(produto_id);
CREATE INDEX IF NOT EXISTS idx_estoque_movimentos_created_at ON estoque_movimentos(created_at);
CREATE INDEX IF NOT EXISTS idx_pedidos_compra_fornecedor_id ON pedidos_compra(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_compra_status ON pedidos_compra(status);
CREATE INDEX IF NOT EXISTS idx_clientes_cpf_cnpj ON clientes(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_fornecedores_cpf_cnpj ON fornecedores(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_produtos_grupo_id ON produtos(grupo_id);
CREATE INDEX IF NOT EXISTS idx_remessas_cliente_id ON remessas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_remessas_status_transporte ON remessas(status_transporte);
CREATE INDEX IF NOT EXISTS idx_remessas_nota_fiscal_id ON remessas(nota_fiscal_id);
CREATE INDEX IF NOT EXISTS idx_apresentacao_geracoes_template_id ON apresentacao_geracoes(template_id);
CREATE INDEX IF NOT EXISTS idx_apresentacao_geracoes_status ON apresentacao_geracoes(status);
CREATE INDEX IF NOT EXISTS idx_apresentacao_comentarios_geracao_id ON apresentacao_comentarios(geracao_id);
CREATE INDEX IF NOT EXISTS idx_email_send_log_template ON email_send_log(template_name);
CREATE INDEX IF NOT EXISTS idx_email_send_log_status ON email_send_log(status);

-- CHECK constraints
DO $$ BEGIN ALTER TABLE orcamentos ADD CONSTRAINT chk_orcamentos_status CHECK (status IN ('rascunho','pendente','enviado','aprovado','rejeitado','expirado','cancelado','convertido')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE ordens_venda ADD CONSTRAINT chk_ordens_venda_status CHECK (status IN ('pendente','aprovada','em_producao','faturada','entregue','cancelada')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE notas_fiscais ADD CONSTRAINT chk_notas_fiscais_status CHECK (status IN ('rascunho','validada','assinada','enviada','autorizada','rejeitada','cancelada','cancelada_sefaz','inutilizada','denegada')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE financeiro_lancamentos ADD CONSTRAINT chk_financeiro_lancamentos_status CHECK (status IN ('aberto','parcial','pago','cancelado','vencido')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE financeiro_lancamentos ADD CONSTRAINT chk_financeiro_lancamentos_tipo CHECK (tipo IN ('pagar','receber')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE pedidos_compra ADD CONSTRAINT chk_pedidos_compra_status CHECK (status IN ('rascunho','pendente','aprovado','enviado','parcial','recebido','cancelado')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE cotacoes_compra ADD CONSTRAINT chk_cotacoes_compra_status CHECK (status IN ('rascunho','aberta','em_cotacao','cotada','fechada','cancelada')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trigger estoque
DROP TRIGGER IF EXISTS trg_estoque_movimentos_sync ON estoque_movimentos;
CREATE TRIGGER trg_estoque_movimentos_sync AFTER INSERT OR UPDATE ON estoque_movimentos FOR EACH ROW EXECUTE FUNCTION sync_produto_estoque_atual();
