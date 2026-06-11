
-- =============================================================
-- Tenancy: completar cobertura de empresa_id (Grupos 1–3).
-- Padrão: admin permanece cross-tenant (current_empresa_id() OR has_role(admin)).
-- Combina com policies de papel existentes via AND.
-- =============================================================

DO $$
DECLARE
  v_default uuid;
BEGIN
  SELECT id INTO v_default FROM public.empresas WHERE ativo = true ORDER BY created_at LIMIT 1;
  IF v_default IS NULL THEN
    RAISE EXCEPTION 'Nenhuma empresa ativa encontrada para backfill';
  END IF;

  -- contas_bancarias
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contas_bancarias' AND column_name='empresa_id') THEN
    ALTER TABLE public.contas_bancarias ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
    UPDATE public.contas_bancarias SET empresa_id = v_default WHERE empresa_id IS NULL;
    ALTER TABLE public.contas_bancarias ALTER COLUMN empresa_id SET NOT NULL;
  END IF;

  -- cartoes_credito
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cartoes_credito' AND column_name='empresa_id') THEN
    ALTER TABLE public.cartoes_credito ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
    UPDATE public.cartoes_credito SET empresa_id = v_default WHERE empresa_id IS NULL;
    ALTER TABLE public.cartoes_credito ALTER COLUMN empresa_id SET NOT NULL;
  END IF;

  -- cartao_faturas (coluna já existe; só backfill + NOT NULL)
  UPDATE public.cartao_faturas SET empresa_id = v_default WHERE empresa_id IS NULL;
  ALTER TABLE public.cartao_faturas ALTER COLUMN empresa_id SET NOT NULL;

  -- budgets_mensais (coluna já existe)
  UPDATE public.budgets_mensais SET empresa_id = v_default WHERE empresa_id IS NULL;
  ALTER TABLE public.budgets_mensais ALTER COLUMN empresa_id SET NOT NULL;

  -- funcionarios
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='funcionarios' AND column_name='empresa_id') THEN
    ALTER TABLE public.funcionarios ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
    UPDATE public.funcionarios SET empresa_id = v_default WHERE empresa_id IS NULL;
    ALTER TABLE public.funcionarios ALTER COLUMN empresa_id SET NOT NULL;
  END IF;

  -- folha_pagamento
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='folha_pagamento' AND column_name='empresa_id') THEN
    ALTER TABLE public.folha_pagamento ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
    UPDATE public.folha_pagamento SET empresa_id = v_default WHERE empresa_id IS NULL;
    ALTER TABLE public.folha_pagamento ALTER COLUMN empresa_id SET NOT NULL;
  END IF;

  -- socios
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='socios' AND column_name='empresa_id') THEN
    ALTER TABLE public.socios ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
    UPDATE public.socios SET empresa_id = v_default WHERE empresa_id IS NULL;
    ALTER TABLE public.socios ALTER COLUMN empresa_id SET NOT NULL;
  END IF;

  -- socios_participacoes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='socios_participacoes' AND column_name='empresa_id') THEN
    ALTER TABLE public.socios_participacoes ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
    UPDATE public.socios_participacoes SET empresa_id = v_default WHERE empresa_id IS NULL;
    ALTER TABLE public.socios_participacoes ALTER COLUMN empresa_id SET NOT NULL;
  END IF;

  -- precos_especiais
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='precos_especiais' AND column_name='empresa_id') THEN
    ALTER TABLE public.precos_especiais ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
    UPDATE public.precos_especiais SET empresa_id = v_default WHERE empresa_id IS NULL;
    ALTER TABLE public.precos_especiais ALTER COLUMN empresa_id SET NOT NULL;
  END IF;

  -- frete_simulacoes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='frete_simulacoes' AND column_name='empresa_id') THEN
    ALTER TABLE public.frete_simulacoes ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
    UPDATE public.frete_simulacoes SET empresa_id = v_default WHERE empresa_id IS NULL;
    ALTER TABLE public.frete_simulacoes ALTER COLUMN empresa_id SET NOT NULL;
  END IF;

  -- social_contas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='social_contas' AND column_name='empresa_id') THEN
    ALTER TABLE public.social_contas ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
    UPDATE public.social_contas SET empresa_id = v_default WHERE empresa_id IS NULL;
    ALTER TABLE public.social_contas ALTER COLUMN empresa_id SET NOT NULL;
  END IF;
END $$;

-- DEFAULT (auto-fill via current_empresa_id)
ALTER TABLE public.contas_bancarias     ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
ALTER TABLE public.cartoes_credito      ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
ALTER TABLE public.cartao_faturas       ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
ALTER TABLE public.budgets_mensais      ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
ALTER TABLE public.funcionarios         ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
ALTER TABLE public.folha_pagamento      ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
ALTER TABLE public.socios               ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
ALTER TABLE public.socios_participacoes ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
ALTER TABLE public.precos_especiais     ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
ALTER TABLE public.frete_simulacoes     ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
ALTER TABLE public.social_contas        ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();

-- Triggers safety-net (BEFORE INSERT)
DROP TRIGGER IF EXISTS trg_contas_bancarias_set_empresa ON public.contas_bancarias;
CREATE TRIGGER trg_contas_bancarias_set_empresa BEFORE INSERT ON public.contas_bancarias
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_default();

DROP TRIGGER IF EXISTS trg_cartoes_credito_set_empresa ON public.cartoes_credito;
CREATE TRIGGER trg_cartoes_credito_set_empresa BEFORE INSERT ON public.cartoes_credito
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_default();

DROP TRIGGER IF EXISTS trg_cartao_faturas_set_empresa ON public.cartao_faturas;
CREATE TRIGGER trg_cartao_faturas_set_empresa BEFORE INSERT ON public.cartao_faturas
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_default();

DROP TRIGGER IF EXISTS trg_budgets_mensais_set_empresa ON public.budgets_mensais;
CREATE TRIGGER trg_budgets_mensais_set_empresa BEFORE INSERT ON public.budgets_mensais
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_default();

DROP TRIGGER IF EXISTS trg_funcionarios_set_empresa ON public.funcionarios;
CREATE TRIGGER trg_funcionarios_set_empresa BEFORE INSERT ON public.funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_default();

DROP TRIGGER IF EXISTS trg_folha_pagamento_set_empresa ON public.folha_pagamento;
CREATE TRIGGER trg_folha_pagamento_set_empresa BEFORE INSERT ON public.folha_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_default();

DROP TRIGGER IF EXISTS trg_socios_set_empresa ON public.socios;
CREATE TRIGGER trg_socios_set_empresa BEFORE INSERT ON public.socios
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_default();

DROP TRIGGER IF EXISTS trg_socios_participacoes_set_empresa ON public.socios_participacoes;
CREATE TRIGGER trg_socios_participacoes_set_empresa BEFORE INSERT ON public.socios_participacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_default();

DROP TRIGGER IF EXISTS trg_precos_especiais_set_empresa ON public.precos_especiais;
CREATE TRIGGER trg_precos_especiais_set_empresa BEFORE INSERT ON public.precos_especiais
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_default();

DROP TRIGGER IF EXISTS trg_frete_simulacoes_set_empresa ON public.frete_simulacoes;
CREATE TRIGGER trg_frete_simulacoes_set_empresa BEFORE INSERT ON public.frete_simulacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_default();

DROP TRIGGER IF EXISTS trg_social_contas_set_empresa ON public.social_contas;
CREATE TRIGGER trg_social_contas_set_empresa BEFORE INSERT ON public.social_contas
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_default();

-- Índices
CREATE INDEX IF NOT EXISTS idx_contas_bancarias_empresa     ON public.contas_bancarias(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cartoes_credito_empresa      ON public.cartoes_credito(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cartao_faturas_empresa       ON public.cartao_faturas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_budgets_mensais_empresa      ON public.budgets_mensais(empresa_id);
CREATE INDEX IF NOT EXISTS idx_funcionarios_empresa         ON public.funcionarios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_folha_pagamento_empresa      ON public.folha_pagamento(empresa_id);
CREATE INDEX IF NOT EXISTS idx_socios_empresa               ON public.socios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_socios_participacoes_empresa ON public.socios_participacoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_precos_especiais_empresa     ON public.precos_especiais(empresa_id);
CREATE INDEX IF NOT EXISTS idx_frete_simulacoes_empresa     ON public.frete_simulacoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_social_contas_empresa        ON public.social_contas(empresa_id);

-- =============================================================
-- RLS: substituir policies preservando regras de papel via AND
-- =============================================================

-- contas_bancarias (financeiro/admin)
DROP POLICY IF EXISTS cb_select ON public.contas_bancarias;
DROP POLICY IF EXISTS cb_insert ON public.contas_bancarias;
DROP POLICY IF EXISTS cb_update ON public.contas_bancarias;
DROP POLICY IF EXISTS cb_delete ON public.contas_bancarias;

CREATE POLICY cb_select ON public.contas_bancarias FOR SELECT TO authenticated
  USING ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
         AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));
CREATE POLICY cb_insert ON public.contas_bancarias FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
              AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));
CREATE POLICY cb_update ON public.contas_bancarias FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
         AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));
CREATE POLICY cb_delete ON public.contas_bancarias FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)
         AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));

-- cartoes_credito (financeiro/admin)
DROP POLICY IF EXISTS cartoes_credito_select_auth ON public.cartoes_credito;
DROP POLICY IF EXISTS cartoes_credito_write_financeiro ON public.cartoes_credito;

CREATE POLICY cartoes_credito_select ON public.cartoes_credito FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY cartoes_credito_insert ON public.cartoes_credito FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
              AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));
CREATE POLICY cartoes_credito_update ON public.cartoes_credito FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
         AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));
CREATE POLICY cartoes_credito_delete ON public.cartoes_credito FOR DELETE TO authenticated
  USING ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
         AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));

-- cartao_faturas
DROP POLICY IF EXISTS cartao_faturas_select ON public.cartao_faturas;
DROP POLICY IF EXISTS cartao_faturas_write ON public.cartao_faturas;

CREATE POLICY cartao_faturas_select ON public.cartao_faturas FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY cartao_faturas_write ON public.cartao_faturas FOR ALL TO authenticated
  USING ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
         AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)))
  WITH CHECK ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
              AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));

-- budgets_mensais
DROP POLICY IF EXISTS bm_select ON public.budgets_mensais;
DROP POLICY IF EXISTS bm_insert ON public.budgets_mensais;
DROP POLICY IF EXISTS bm_update ON public.budgets_mensais;
DROP POLICY IF EXISTS bm_delete ON public.budgets_mensais;

CREATE POLICY bm_select ON public.budgets_mensais FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY bm_insert ON public.budgets_mensais FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
              AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));
CREATE POLICY bm_update ON public.budgets_mensais FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
         AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));
CREATE POLICY bm_delete ON public.budgets_mensais FOR DELETE TO authenticated
  USING ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
         AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));

-- funcionarios (admin-only — preserva isolamento de PII)
DROP POLICY IF EXISTS func_select ON public.funcionarios;
DROP POLICY IF EXISTS func_insert ON public.funcionarios;
DROP POLICY IF EXISTS func_update ON public.funcionarios;
DROP POLICY IF EXISTS func_delete ON public.funcionarios;

CREATE POLICY func_select ON public.funcionarios FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)
         AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));
CREATE POLICY func_insert ON public.funcionarios FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY func_update ON public.funcionarios FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY func_delete ON public.funcionarios FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));

-- folha_pagamento (admin/financeiro)
DROP POLICY IF EXISTS "Admin financeiro can select folha_pagamento" ON public.folha_pagamento;
DROP POLICY IF EXISTS fopag_select_restricted ON public.folha_pagamento;
DROP POLICY IF EXISTS folha_insert ON public.folha_pagamento;
DROP POLICY IF EXISTS folha_update ON public.folha_pagamento;

CREATE POLICY fopag_select_restricted ON public.folha_pagamento FOR SELECT TO authenticated
  USING ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
         AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));
CREATE POLICY folha_insert ON public.folha_pagamento FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
              AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));
CREATE POLICY folha_update ON public.folha_pagamento FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
         AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));

-- socios (admin all + select financeiro)
DROP POLICY IF EXISTS socios_admin_all ON public.socios;
DROP POLICY IF EXISTS socios_select ON public.socios;

CREATE POLICY socios_select ON public.socios FOR SELECT TO authenticated
  USING ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
         AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));
CREATE POLICY socios_admin_all ON public.socios FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)
         AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role)
              AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));

-- socios_participacoes
DROP POLICY IF EXISTS socios_part_admin_all ON public.socios_participacoes;
DROP POLICY IF EXISTS socios_part_select ON public.socios_participacoes;

CREATE POLICY socios_part_select ON public.socios_participacoes FOR SELECT TO authenticated
  USING ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
         AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));
CREATE POLICY socios_part_admin_all ON public.socios_participacoes FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)
         AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role)
              AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));

-- precos_especiais (admin/vendedor)
DROP POLICY IF EXISTS pe_select ON public.precos_especiais;
DROP POLICY IF EXISTS pe_insert_role ON public.precos_especiais;
DROP POLICY IF EXISTS pe_update_role ON public.precos_especiais;
DROP POLICY IF EXISTS pe_delete_role ON public.precos_especiais;

CREATE POLICY pe_select ON public.precos_especiais FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY pe_insert_role ON public.precos_especiais FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'vendedor'::app_role))
              AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));
CREATE POLICY pe_update_role ON public.precos_especiais FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'vendedor'::app_role))
         AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));
CREATE POLICY pe_delete_role ON public.precos_especiais FOR DELETE TO authenticated
  USING ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'vendedor'::app_role))
         AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));

-- frete_simulacoes (admin/vendedor/estoquista/operador_logistico)
DROP POLICY IF EXISTS frete_sim_select ON public.frete_simulacoes;
DROP POLICY IF EXISTS frete_sim_insert_role ON public.frete_simulacoes;
DROP POLICY IF EXISTS frete_sim_update_role ON public.frete_simulacoes;
DROP POLICY IF EXISTS frete_sim_delete_role ON public.frete_simulacoes;

CREATE POLICY frete_sim_select ON public.frete_simulacoes FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY frete_sim_insert_role ON public.frete_simulacoes FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'vendedor'::app_role) OR has_role(auth.uid(),'estoquista'::app_role) OR has_role(auth.uid(),'operador_logistico'::app_role))
              AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));
CREATE POLICY frete_sim_update_role ON public.frete_simulacoes FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'vendedor'::app_role) OR has_role(auth.uid(),'estoquista'::app_role) OR has_role(auth.uid(),'operador_logistico'::app_role))
         AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));
CREATE POLICY frete_sim_delete_role ON public.frete_simulacoes FOR DELETE TO authenticated
  USING ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'vendedor'::app_role) OR has_role(auth.uid(),'estoquista'::app_role) OR has_role(auth.uid(),'operador_logistico'::app_role))
         AND (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));

-- frete_simulacoes_opcoes (herda empresa via parent)
DROP POLICY IF EXISTS frete_opc_select ON public.frete_simulacoes_opcoes;
DROP POLICY IF EXISTS frete_opc_insert_role ON public.frete_simulacoes_opcoes;
DROP POLICY IF EXISTS frete_opc_update_role ON public.frete_simulacoes_opcoes;
DROP POLICY IF EXISTS frete_opc_delete_role ON public.frete_simulacoes_opcoes;

CREATE POLICY frete_opc_select ON public.frete_simulacoes_opcoes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.frete_simulacoes s
                  WHERE s.id = frete_simulacoes_opcoes.simulacao_id
                    AND (s.empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role))));
CREATE POLICY frete_opc_insert_role ON public.frete_simulacoes_opcoes FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'vendedor'::app_role) OR has_role(auth.uid(),'estoquista'::app_role) OR has_role(auth.uid(),'operador_logistico'::app_role))
              AND EXISTS (SELECT 1 FROM public.frete_simulacoes s
                           WHERE s.id = frete_simulacoes_opcoes.simulacao_id
                             AND (s.empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role))));
CREATE POLICY frete_opc_update_role ON public.frete_simulacoes_opcoes FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'vendedor'::app_role) OR has_role(auth.uid(),'estoquista'::app_role) OR has_role(auth.uid(),'operador_logistico'::app_role))
         AND EXISTS (SELECT 1 FROM public.frete_simulacoes s
                      WHERE s.id = frete_simulacoes_opcoes.simulacao_id
                        AND (s.empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role))));
CREATE POLICY frete_opc_delete_role ON public.frete_simulacoes_opcoes FOR DELETE TO authenticated
  USING ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'vendedor'::app_role) OR has_role(auth.uid(),'estoquista'::app_role) OR has_role(auth.uid(),'operador_logistico'::app_role))
         AND EXISTS (SELECT 1 FROM public.frete_simulacoes s
                      WHERE s.id = frete_simulacoes_opcoes.simulacao_id
                        AND (s.empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role))));

-- social_contas (admin write; leitura tenant)
DROP POLICY IF EXISTS social_contas_select_auth ON public.social_contas;
DROP POLICY IF EXISTS social_contas_insert_admin ON public.social_contas;
DROP POLICY IF EXISTS social_contas_update_admin ON public.social_contas;
DROP POLICY IF EXISTS social_contas_delete_admin ON public.social_contas;

CREATE POLICY social_contas_select_auth ON public.social_contas FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY social_contas_insert_admin ON public.social_contas FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY social_contas_update_admin ON public.social_contas FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY social_contas_delete_admin ON public.social_contas FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));

COMMENT ON COLUMN public.contas_bancarias.empresa_id     IS 'Tenancy. Admin é cross-tenant.';
COMMENT ON COLUMN public.cartoes_credito.empresa_id      IS 'Tenancy. Admin é cross-tenant.';
COMMENT ON COLUMN public.cartao_faturas.empresa_id       IS 'Tenancy. Admin é cross-tenant.';
COMMENT ON COLUMN public.budgets_mensais.empresa_id      IS 'Tenancy. Admin é cross-tenant.';
COMMENT ON COLUMN public.funcionarios.empresa_id         IS 'Tenancy. Admin é cross-tenant.';
COMMENT ON COLUMN public.folha_pagamento.empresa_id      IS 'Tenancy. Admin é cross-tenant.';
COMMENT ON COLUMN public.socios.empresa_id               IS 'Tenancy. Admin é cross-tenant.';
COMMENT ON COLUMN public.socios_participacoes.empresa_id IS 'Tenancy. Admin é cross-tenant.';
COMMENT ON COLUMN public.precos_especiais.empresa_id     IS 'Tenancy. Admin é cross-tenant.';
COMMENT ON COLUMN public.frete_simulacoes.empresa_id     IS 'Tenancy. Admin é cross-tenant.';
COMMENT ON COLUMN public.social_contas.empresa_id        IS 'Tenancy. Admin é cross-tenant.';
