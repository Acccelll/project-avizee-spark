
-- =============================================
-- PROMPT 12: RLS READ RESTRICTIONS
-- =============================================

-- Drop existing overly-permissive SELECT policies first, then create restricted ones
-- financeiro_lancamentos
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can view financeiro_lancamentos" ON public.financeiro_lancamentos;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "fin_lanc_select_restricted" ON public.financeiro_lancamentos
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro')
  );

-- financeiro_baixas
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can view financeiro_baixas" ON public.financeiro_baixas;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "fin_baixas_select_restricted" ON public.financeiro_baixas
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro')
  );

-- auditoria_logs
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can view auditoria_logs" ON public.auditoria_logs;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "audit_select_restricted" ON public.auditoria_logs
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
  );

-- folha_pagamento
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can view folha_pagamento" ON public.folha_pagamento;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "fopag_select_restricted" ON public.folha_pagamento
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro')
  );

-- =============================================
-- PROMPT 14: CHECK CONSTRAINTS
-- =============================================

DO $$ BEGIN
  ALTER TABLE public.orcamentos ADD CONSTRAINT chk_orcamentos_status
    CHECK (status IN ('rascunho','confirmado','aprovado','rejeitado','convertido','cancelado','expirado'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.ordens_venda ADD CONSTRAINT chk_ordens_venda_status
    CHECK (status IN ('rascunho','aprovada','em_producao','faturada','cancelada','entregue'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.compras ADD CONSTRAINT chk_compras_status
    CHECK (status IN ('rascunho','pendente','aprovada','recebida','cancelada','parcial'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.financeiro_lancamentos ADD CONSTRAINT chk_fin_lanc_tipo
    CHECK (tipo IN ('pagar','receber'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.financeiro_lancamentos ADD CONSTRAINT chk_fin_lanc_status
    CHECK (status IN ('aberto','parcial','pago','cancelado','vencido'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.cotacoes_compra ADD CONSTRAINT chk_cotacoes_compra_status
    CHECK (status IN ('rascunho','enviada','respondida','finalizada','cancelada'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN NULL;
END $$;

-- =============================================
-- PROMPT 16: INDEXES FOR NEW MODULES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_apresentacao_geracoes_status ON public.apresentacao_geracoes(status);
CREATE INDEX IF NOT EXISTS idx_apresentacao_geracoes_template ON public.apresentacao_geracoes(template_id);
CREATE INDEX IF NOT EXISTS idx_email_send_log_status ON public.email_send_log(status);
CREATE INDEX IF NOT EXISTS idx_email_send_log_template ON public.email_send_log(template_name);
CREATE INDEX IF NOT EXISTS idx_email_send_log_created ON public.email_send_log(created_at);
CREATE INDEX IF NOT EXISTS idx_social_posts_data ON public.social_posts(data_publicacao);
CREATE INDEX IF NOT EXISTS idx_social_contas_ativo ON public.social_contas(ativo);
