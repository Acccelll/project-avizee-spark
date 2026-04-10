
-- ============================================================
-- 1. FUNCIONARIOS
-- ============================================================
DROP POLICY IF EXISTS "func_select" ON public.funcionarios;
DROP POLICY IF EXISTS "func_insert" ON public.funcionarios;
DROP POLICY IF EXISTS "func_update" ON public.funcionarios;
DROP POLICY IF EXISTS "func_delete" ON public.funcionarios;

CREATE POLICY "func_select" ON public.funcionarios FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "func_insert" ON public.funcionarios FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "func_update" ON public.funcionarios FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "func_delete" ON public.funcionarios FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 2. FOLHA_PAGAMENTO
-- ============================================================
DROP POLICY IF EXISTS "folha_select" ON public.folha_pagamento;
DROP POLICY IF EXISTS "folha_insert" ON public.folha_pagamento;
DROP POLICY IF EXISTS "folha_update" ON public.folha_pagamento;

CREATE POLICY "folha_select" ON public.folha_pagamento FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "folha_insert" ON public.folha_pagamento FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "folha_update" ON public.folha_pagamento FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

-- ============================================================
-- 3. FINANCEIRO_LANCAMENTOS
-- ============================================================
DROP POLICY IF EXISTS "fl_select" ON public.financeiro_lancamentos;
DROP POLICY IF EXISTS "fl_insert" ON public.financeiro_lancamentos;
DROP POLICY IF EXISTS "fl_update" ON public.financeiro_lancamentos;
DROP POLICY IF EXISTS "fl_delete" ON public.financeiro_lancamentos;

CREATE POLICY "fl_select" ON public.financeiro_lancamentos FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "fl_insert" ON public.financeiro_lancamentos FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "fl_update" ON public.financeiro_lancamentos FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "fl_delete" ON public.financeiro_lancamentos FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 4. FINANCEIRO_BAIXAS
-- ============================================================
DROP POLICY IF EXISTS "fb_select" ON public.financeiro_baixas;
DROP POLICY IF EXISTS "fb_insert" ON public.financeiro_baixas;
DROP POLICY IF EXISTS "fb_update" ON public.financeiro_baixas;
DROP POLICY IF EXISTS "fb_delete" ON public.financeiro_baixas;

CREATE POLICY "fb_select" ON public.financeiro_baixas FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "fb_insert" ON public.financeiro_baixas FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "fb_update" ON public.financeiro_baixas FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "fb_delete" ON public.financeiro_baixas FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 5. CONTAS_BANCARIAS
-- ============================================================
DROP POLICY IF EXISTS "cb_select" ON public.contas_bancarias;
DROP POLICY IF EXISTS "cb_insert" ON public.contas_bancarias;
DROP POLICY IF EXISTS "cb_update" ON public.contas_bancarias;
DROP POLICY IF EXISTS "cb_delete" ON public.contas_bancarias;

CREATE POLICY "cb_select" ON public.contas_bancarias FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "cb_insert" ON public.contas_bancarias FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "cb_update" ON public.contas_bancarias FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "cb_delete" ON public.contas_bancarias FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 6. CAIXA_MOVIMENTOS
-- ============================================================
DROP POLICY IF EXISTS "cm_select" ON public.caixa_movimentos;
DROP POLICY IF EXISTS "cm_insert" ON public.caixa_movimentos;

CREATE POLICY "cm_select" ON public.caixa_movimentos FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "cm_insert" ON public.caixa_movimentos FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

-- ============================================================
-- 7. PUBLIC QUOTATION VIEWS (exclude internal fields)
-- ============================================================
CREATE OR REPLACE VIEW public.orcamentos_public_view AS
SELECT
  id, numero, data_orcamento, validade, valor_total,
  observacoes, status, prazo_entrega, prazo_pagamento,
  frete_tipo, cliente_snapshot, public_token, ativo
FROM public.orcamentos
WHERE public_token IS NOT NULL AND ativo = true;

GRANT SELECT ON public.orcamentos_public_view TO anon;

CREATE OR REPLACE VIEW public.orcamentos_itens_public_view AS
SELECT
  oi.id, oi.orcamento_id, oi.descricao_snapshot, oi.codigo_snapshot,
  oi.quantidade, oi.unidade, oi.valor_unitario, oi.valor_total,
  oi.variacao, oi.peso_unitario, oi.peso_total
FROM public.orcamentos_itens oi
INNER JOIN public.orcamentos o ON o.id = oi.orcamento_id
WHERE o.public_token IS NOT NULL AND o.ativo = true;

GRANT SELECT ON public.orcamentos_itens_public_view TO anon;

-- Remove old anon policies that exposed all columns
DROP POLICY IF EXISTS "orcamentos_public_token" ON public.orcamentos;
DROP POLICY IF EXISTS "oi_public" ON public.orcamentos_itens;
