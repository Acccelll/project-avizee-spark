
-- ═══════════════════════════════════════════════════════════════════════════
-- ÉPICO A — Fundações de dados do Financeiro Inteligente 2.0
-- Aditivo. Não altera colunas existentes.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Fornecedores: marca "cadastro parcial" ─────────────────────────────
ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS cadastro_status text NOT NULL DEFAULT 'completo';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_fornecedores_cadastro_status'
  ) THEN
    ALTER TABLE public.fornecedores
      ADD CONSTRAINT chk_fornecedores_cadastro_status
      CHECK (cadastro_status IN ('completo','parcial'));
  END IF;
END$$;

-- ── 2. Extrato importações: origem + sugestão do motor ────────────────────
ALTER TABLE public.financeiro_extrato_importacoes
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'ofx',
  ADD COLUMN IF NOT EXISTS documento_importacao_id uuid,
  ADD COLUMN IF NOT EXISTS sugestao_lancamento_id uuid,
  ADD COLUMN IF NOT EXISTS sugestao_score numeric(4,3),
  ADD COLUMN IF NOT EXISTS sugestao_motivos jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_fin_extrato_origem'
  ) THEN
    ALTER TABLE public.financeiro_extrato_importacoes
      ADD CONSTRAINT chk_fin_extrato_origem
      CHECK (origem IN ('ofx','pdf_cartao','csv','manual'));
  END IF;
END$$;

-- ── 3. Lançamentos: dados específicos por forma de pagamento ──────────────
ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS forma_pagamento_dados jsonb;

-- ═══════════════════════════════════════════════════════════════════════════
-- Novas tabelas
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 4. financeiro_importacoes_docs ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.financeiro_importacoes_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT current_empresa_id(),
  origem text NOT NULL,
  arquivo_nome text NOT NULL,
  arquivo_hash text,
  conta_bancaria_id uuid REFERENCES public.contas_bancarias(id) ON DELETE SET NULL,
  cartao_id uuid REFERENCES public.cartoes_credito(id) ON DELETE SET NULL,
  periodo_inicio date,
  periodo_fim date,
  total_transacoes integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'processado',
  raw_texto text,
  importado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_fin_imp_docs_origem CHECK (origem IN ('ofx','pdf_cartao','csv','manual')),
  CONSTRAINT chk_fin_imp_docs_status CHECK (status IN ('processando','processado','falha')),
  CONSTRAINT chk_fin_imp_docs_alvo CHECK (conta_bancaria_id IS NOT NULL OR cartao_id IS NOT NULL)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_importacoes_docs TO authenticated;
GRANT ALL ON public.financeiro_importacoes_docs TO service_role;
ALTER TABLE public.financeiro_importacoes_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_imp_docs_select" ON public.financeiro_importacoes_docs
  FOR SELECT TO authenticated
  USING (empresa_id = current_empresa_id() OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "fin_imp_docs_write" ON public.financeiro_importacoes_docs
  FOR ALL TO authenticated
  USING ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
         AND (empresa_id = current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)))
  WITH CHECK ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
              AND (empresa_id = current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));

CREATE INDEX IF NOT EXISTS idx_fin_imp_docs_empresa ON public.financeiro_importacoes_docs(empresa_id);
CREATE INDEX IF NOT EXISTS idx_fin_imp_docs_hash ON public.financeiro_importacoes_docs(arquivo_hash) WHERE arquivo_hash IS NOT NULL;

-- FK reversa em financeiro_extrato_importacoes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fin_extrato_documento_importacao_fk'
  ) THEN
    ALTER TABLE public.financeiro_extrato_importacoes
      ADD CONSTRAINT fin_extrato_documento_importacao_fk
      FOREIGN KEY (documento_importacao_id)
      REFERENCES public.financeiro_importacoes_docs(id) ON DELETE SET NULL;
  END IF;
END$$;

-- ── 5. financeiro_aliases ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.financeiro_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT current_empresa_id(),
  descricao_normalizada text NOT NULL,
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  conta_contabil_id uuid REFERENCES public.contas_contabeis(id) ON DELETE SET NULL,
  centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  hits integer NOT NULL DEFAULT 1,
  ultima_confirmacao_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_fin_alias_desc UNIQUE (empresa_id, descricao_normalizada),
  CONSTRAINT chk_fin_alias_alvo CHECK (
    fornecedor_id IS NOT NULL OR cliente_id IS NOT NULL
    OR conta_contabil_id IS NOT NULL OR centro_custo_id IS NOT NULL
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_aliases TO authenticated;
GRANT ALL ON public.financeiro_aliases TO service_role;
ALTER TABLE public.financeiro_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_aliases_select" ON public.financeiro_aliases
  FOR SELECT TO authenticated
  USING (empresa_id = current_empresa_id() OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "fin_aliases_write" ON public.financeiro_aliases
  FOR ALL TO authenticated
  USING ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
         AND (empresa_id = current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)))
  WITH CHECK ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
              AND (empresa_id = current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));

CREATE INDEX IF NOT EXISTS idx_fin_aliases_desc ON public.financeiro_aliases(empresa_id, descricao_normalizada);

-- ── 6. financeiro_regras ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.financeiro_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT current_empresa_id(),
  nome text NOT NULL,
  padrao text NOT NULL,
  padrao_tipo text NOT NULL DEFAULT 'substring',
  quando_tipo text NOT NULL DEFAULT 'ambos',
  aplica_conta_contabil_id uuid REFERENCES public.contas_contabeis(id) ON DELETE SET NULL,
  aplica_centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  aplica_fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  prioridade integer NOT NULL DEFAULT 100,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_fin_regra_padrao_tipo CHECK (padrao_tipo IN ('substring','regex')),
  CONSTRAINT chk_fin_regra_quando_tipo CHECK (quando_tipo IN ('debito','credito','ambos'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_regras TO authenticated;
GRANT ALL ON public.financeiro_regras TO service_role;
ALTER TABLE public.financeiro_regras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_regras_select" ON public.financeiro_regras
  FOR SELECT TO authenticated
  USING (empresa_id = current_empresa_id() OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "fin_regras_write" ON public.financeiro_regras
  FOR ALL TO authenticated
  USING ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
         AND (empresa_id = current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)))
  WITH CHECK ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
              AND (empresa_id = current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));

CREATE INDEX IF NOT EXISTS idx_fin_regras_ativo ON public.financeiro_regras(empresa_id, ativo, prioridade DESC);

-- ── 7. financeiro_matching_feedback ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.financeiro_matching_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT current_empresa_id(),
  extrato_id uuid REFERENCES public.financeiro_extrato_importacoes(id) ON DELETE CASCADE,
  sugestao_lancamento_id uuid,
  sugestao_score numeric(4,3),
  escolha_final_lancamento_id uuid,
  acao text NOT NULL,
  motivo text,
  usuario_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_fin_feedback_acao CHECK (acao IN ('aceita','corrigida','rejeitada','criada_inline'))
);

GRANT SELECT, INSERT ON public.financeiro_matching_feedback TO authenticated;
GRANT ALL ON public.financeiro_matching_feedback TO service_role;
ALTER TABLE public.financeiro_matching_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_feedback_select" ON public.financeiro_matching_feedback
  FOR SELECT TO authenticated
  USING (empresa_id = current_empresa_id() OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "fin_feedback_insert" ON public.financeiro_matching_feedback
  FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
              AND (empresa_id = current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));

CREATE INDEX IF NOT EXISTS idx_fin_feedback_extrato ON public.financeiro_matching_feedback(extrato_id);

-- ── 8. cartao_fatura_lancamentos ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cartao_fatura_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT current_empresa_id(),
  cartao_fatura_id uuid NOT NULL REFERENCES public.cartao_faturas(id) ON DELETE CASCADE,
  data_compra date NOT NULL,
  descricao text NOT NULL,
  estabelecimento text,
  valor numeric(15,2) NOT NULL,
  parcela_atual integer,
  parcela_total integer,
  categoria_sugerida text,
  fornecedor_sugerido_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  conta_contabil_sugerida_id uuid REFERENCES public.contas_contabeis(id) ON DELETE SET NULL,
  lancamento_id uuid REFERENCES public.financeiro_lancamentos(id) ON DELETE SET NULL,
  hash text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_cartao_fatura_linha UNIQUE (cartao_fatura_id, hash),
  CONSTRAINT chk_cartao_fatura_lanc_status CHECK (status IN ('pendente','aceito','ignorado'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cartao_fatura_lancamentos TO authenticated;
GRANT ALL ON public.cartao_fatura_lancamentos TO service_role;
ALTER TABLE public.cartao_fatura_lancamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cartao_fat_lanc_select" ON public.cartao_fatura_lancamentos
  FOR SELECT TO authenticated
  USING (empresa_id = current_empresa_id() OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "cartao_fat_lanc_write" ON public.cartao_fatura_lancamentos
  FOR ALL TO authenticated
  USING ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
         AND (empresa_id = current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)))
  WITH CHECK ((has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
              AND (empresa_id = current_empresa_id() OR has_role(auth.uid(),'admin'::app_role)));

CREATE INDEX IF NOT EXISTS idx_cartao_fat_lanc_fatura ON public.cartao_fatura_lancamentos(cartao_fatura_id);
CREATE INDEX IF NOT EXISTS idx_cartao_fat_lanc_status ON public.cartao_fatura_lancamentos(empresa_id, status);

-- ── 9. Triggers updated_at ────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'financeiro_importacoes_docs',
    'financeiro_aliases',
    'financeiro_regras',
    'cartao_fatura_lancamentos'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%1$s_updated ON public.%1$s;
       CREATE TRIGGER trg_%1$s_updated BEFORE UPDATE ON public.%1$s
         FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();',
      t
    );
  END LOOP;
END$$;
