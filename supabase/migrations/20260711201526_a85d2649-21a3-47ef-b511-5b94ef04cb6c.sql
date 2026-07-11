
-- =========================================================
-- Sprint 2 — Lotes de importação de extrato
-- =========================================================
CREATE TABLE public.financeiro_extrato_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  conta_bancaria_id uuid NOT NULL REFERENCES public.contas_bancarias(id) ON DELETE CASCADE,
  arquivo_nome text NOT NULL,
  arquivo_hash text,
  origem text NOT NULL DEFAULT 'ofx',
  total_transacoes integer NOT NULL DEFAULT 0,
  inseridas integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativo',
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_fin_lote_origem CHECK (origem IN ('ofx','pdf_cartao','csv','manual')),
  CONSTRAINT chk_fin_lote_status CHECK (status IN ('ativo','arquivado'))
);
CREATE INDEX idx_fin_lote_conta_data ON public.financeiro_extrato_lotes(conta_bancaria_id, created_at DESC);
CREATE INDEX idx_fin_lote_empresa ON public.financeiro_extrato_lotes(empresa_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_extrato_lotes TO authenticated;
GRANT ALL ON public.financeiro_extrato_lotes TO service_role;

ALTER TABLE public.financeiro_extrato_lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY fin_lote_select ON public.financeiro_extrato_lotes
  FOR SELECT USING (empresa_id = public.current_empresa_id());
CREATE POLICY fin_lote_insert ON public.financeiro_extrato_lotes
  FOR INSERT WITH CHECK (empresa_id = public.current_empresa_id());
CREATE POLICY fin_lote_update ON public.financeiro_extrato_lotes
  FOR UPDATE USING (empresa_id = public.current_empresa_id());
CREATE POLICY fin_lote_delete ON public.financeiro_extrato_lotes
  FOR DELETE USING (empresa_id = public.current_empresa_id());

CREATE TRIGGER trg_fin_lote_updated
  BEFORE UPDATE ON public.financeiro_extrato_lotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Coluna lote_id em transações
ALTER TABLE public.financeiro_extrato_importacoes
  ADD COLUMN lote_id uuid REFERENCES public.financeiro_extrato_lotes(id) ON DELETE SET NULL;
CREATE INDEX idx_fin_extrato_lote ON public.financeiro_extrato_importacoes(lote_id);

-- =========================================================
-- Sprint 3 — Tolerâncias de conciliação em empresa_config
-- =========================================================
ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS conciliacao_tolerancias jsonb NOT NULL
  DEFAULT '{"dias": 3, "valor_centavos": 10}'::jsonb;

-- =========================================================
-- Sprint 4 — Trilha de auditoria de conciliação
-- =========================================================
CREATE TABLE public.financeiro_conciliacao_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  usuario_id uuid,
  acao text NOT NULL,
  entidade text NOT NULL,
  entidade_id uuid,
  payload jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_fin_conc_aud_acao CHECK (
    acao IN ('importacao','conciliacao','estorno','ajuste','exclusao','sugestao_aceita','sugestao_rejeitada')
  )
);
CREATE INDEX idx_fin_conc_aud_empresa_data ON public.financeiro_conciliacao_auditoria(empresa_id, criado_em DESC);
CREATE INDEX idx_fin_conc_aud_entidade ON public.financeiro_conciliacao_auditoria(entidade, entidade_id);

GRANT SELECT, INSERT ON public.financeiro_conciliacao_auditoria TO authenticated;
GRANT ALL ON public.financeiro_conciliacao_auditoria TO service_role;

ALTER TABLE public.financeiro_conciliacao_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY fin_conc_aud_select ON public.financeiro_conciliacao_auditoria
  FOR SELECT USING (empresa_id = public.current_empresa_id());
CREATE POLICY fin_conc_aud_insert ON public.financeiro_conciliacao_auditoria
  FOR INSERT WITH CHECK (empresa_id = public.current_empresa_id());
