-- =====================================================================
-- Sprint 1 — Fundação de Dados da Conciliação v2
-- Rollback controlado: desabilitar feature flag `conciliacao.v2` e, se
-- necessário antes de dados produtivos, remover na ordem inversa:
--   DROP TABLE public.conciliacao_matches;
--   DROP TABLE public.conciliacao_regras;
--   DROP TABLE public.conciliacao_extrato_linhas;
--   DROP TABLE public.conciliacao_extratos;
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.conciliacao_extratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  conta_bancaria_id uuid NOT NULL REFERENCES public.contas_bancarias(id) ON DELETE RESTRICT,
  arquivo_nome text,
  arquivo_hash text NOT NULL,
  formato text NOT NULL DEFAULT 'ofx',
  origem text NOT NULL DEFAULT 'upload',
  status text NOT NULL DEFAULT 'recebido',
  total_linhas integer NOT NULL DEFAULT 0,
  total_creditos numeric(14,2) NOT NULL DEFAULT 0,
  total_debitos numeric(14,2) NOT NULL DEFAULT 0,
  periodo_inicio date,
  periodo_fim date,
  metadados jsonb NOT NULL DEFAULT '{}'::jsonb,
  importado_por uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_conciliacao_extratos_formato CHECK (formato IN ('ofx', 'csv', 'cnab240', 'cnab400', 'manual')),
  CONSTRAINT chk_conciliacao_extratos_origem CHECK (origem IN ('upload', 'api', 'backfill', 'manual')),
  CONSTRAINT chk_conciliacao_extratos_status CHECK (status IN ('recebido', 'processando', 'processado', 'processado_com_erro', 'cancelado', 'arquivado')),
  CONSTRAINT chk_conciliacao_extratos_totais CHECK (total_linhas >= 0 AND total_creditos >= 0 AND total_debitos >= 0),
  CONSTRAINT chk_conciliacao_extratos_periodo CHECK (periodo_inicio IS NULL OR periodo_fim IS NULL OR periodo_inicio <= periodo_fim),
  CONSTRAINT ux_conciliacao_extratos_arquivo UNIQUE (empresa_id, conta_bancaria_id, arquivo_hash)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conciliacao_extratos TO authenticated;
GRANT ALL ON public.conciliacao_extratos TO service_role;
ALTER TABLE public.conciliacao_extratos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conciliacao_extratos_select ON public.conciliacao_extratos;
CREATE POLICY conciliacao_extratos_select
ON public.conciliacao_extratos
FOR SELECT
TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role))
  AND (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))
);

DROP POLICY IF EXISTS conciliacao_extratos_insert ON public.conciliacao_extratos;
CREATE POLICY conciliacao_extratos_insert
ON public.conciliacao_extratos
FOR INSERT
TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role))
  AND (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))
);

DROP POLICY IF EXISTS conciliacao_extratos_update ON public.conciliacao_extratos;
CREATE POLICY conciliacao_extratos_update
ON public.conciliacao_extratos
FOR UPDATE
TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role))
  AND (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role))
  AND (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))
);

DROP POLICY IF EXISTS conciliacao_extratos_delete ON public.conciliacao_extratos;
CREATE POLICY conciliacao_extratos_delete
ON public.conciliacao_extratos
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE TABLE IF NOT EXISTS public.conciliacao_extrato_linhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extrato_id uuid NOT NULL REFERENCES public.conciliacao_extratos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  conta_bancaria_id uuid NOT NULL REFERENCES public.contas_bancarias(id) ON DELETE RESTRICT,
  fitid text,
  hash_linha text NOT NULL,
  data_movimento date NOT NULL,
  valor numeric(14,2) NOT NULL,
  tipo_movimento text NOT NULL,
  descricao text NOT NULL,
  documento text,
  contraparte_nome text,
  contraparte_documento text,
  saldo_apos numeric(14,2),
  status text NOT NULL DEFAULT 'pendente',
  metadados jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_conciliacao_linhas_tipo CHECK (tipo_movimento IN ('credito', 'debito')),
  CONSTRAINT chk_conciliacao_linhas_status CHECK (status IN ('pendente', 'normalizada', 'sugerida', 'conciliada', 'ignorada', 'duplicada', 'erro')),
  CONSTRAINT chk_conciliacao_linhas_valor CHECK (valor <> 0),
  CONSTRAINT chk_conciliacao_linhas_tipo_valor CHECK (
    (tipo_movimento = 'credito' AND valor > 0)
    OR (tipo_movimento = 'debito' AND valor < 0)
  ),
  CONSTRAINT ux_conciliacao_linhas_hash UNIQUE (empresa_id, conta_bancaria_id, hash_linha)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conciliacao_extrato_linhas TO authenticated;
GRANT ALL ON public.conciliacao_extrato_linhas TO service_role;
ALTER TABLE public.conciliacao_extrato_linhas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conciliacao_linhas_select ON public.conciliacao_extrato_linhas;
CREATE POLICY conciliacao_linhas_select
ON public.conciliacao_extrato_linhas
FOR SELECT
TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role))
  AND (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))
);

DROP POLICY IF EXISTS conciliacao_linhas_insert ON public.conciliacao_extrato_linhas;
CREATE POLICY conciliacao_linhas_insert
ON public.conciliacao_extrato_linhas
FOR INSERT
TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role))
  AND (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))
);

DROP POLICY IF EXISTS conciliacao_linhas_update ON public.conciliacao_extrato_linhas;
CREATE POLICY conciliacao_linhas_update
ON public.conciliacao_extrato_linhas
FOR UPDATE
TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role))
  AND (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role))
  AND (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))
);

DROP POLICY IF EXISTS conciliacao_linhas_delete ON public.conciliacao_extrato_linhas;
CREATE POLICY conciliacao_linhas_delete
ON public.conciliacao_extrato_linhas
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE TABLE IF NOT EXISTS public.conciliacao_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  nome text NOT NULL,
  descricao text,
  tipo text NOT NULL,
  escopo text NOT NULL DEFAULT 'empresa',
  prioridade integer NOT NULL DEFAULT 100,
  ativo boolean NOT NULL DEFAULT false,
  versao integer NOT NULL DEFAULT 1,
  condicoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  acoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  vigencia_inicio date,
  vigencia_fim date,
  status text NOT NULL DEFAULT 'rascunho',
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_conciliacao_regras_tipo CHECK (tipo IN ('classificacao', 'matching', 'normalizacao', 'workflow', 'bloqueio')),
  CONSTRAINT chk_conciliacao_regras_escopo CHECK (escopo IN ('empresa', 'conta_bancaria', 'global')),
  CONSTRAINT chk_conciliacao_regras_status CHECK (status IN ('rascunho', 'ativa', 'inativa', 'arquivada')),
  CONSTRAINT chk_conciliacao_regras_prioridade CHECK (prioridade >= 0),
  CONSTRAINT chk_conciliacao_regras_versao CHECK (versao > 0),
  CONSTRAINT chk_conciliacao_regras_vigencia CHECK (vigencia_inicio IS NULL OR vigencia_fim IS NULL OR vigencia_inicio <= vigencia_fim),
  CONSTRAINT ux_conciliacao_regras_nome_versao UNIQUE (empresa_id, nome, versao)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conciliacao_regras TO authenticated;
GRANT ALL ON public.conciliacao_regras TO service_role;
ALTER TABLE public.conciliacao_regras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conciliacao_regras_select ON public.conciliacao_regras;
CREATE POLICY conciliacao_regras_select
ON public.conciliacao_regras
FOR SELECT
TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role))
  AND (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))
);

DROP POLICY IF EXISTS conciliacao_regras_insert ON public.conciliacao_regras;
CREATE POLICY conciliacao_regras_insert
ON public.conciliacao_regras
FOR INSERT
TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role))
  AND (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))
);

DROP POLICY IF EXISTS conciliacao_regras_update ON public.conciliacao_regras;
CREATE POLICY conciliacao_regras_update
ON public.conciliacao_regras
FOR UPDATE
TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role))
  AND (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role))
  AND (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))
);

DROP POLICY IF EXISTS conciliacao_regras_delete ON public.conciliacao_regras;
CREATE POLICY conciliacao_regras_delete
ON public.conciliacao_regras
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE TABLE IF NOT EXISTS public.conciliacao_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  extrato_linha_id uuid NOT NULL REFERENCES public.conciliacao_extrato_linhas(id) ON DELETE RESTRICT,
  lancamento_id uuid NOT NULL REFERENCES public.financeiro_lancamentos(id) ON DELETE RESTRICT,
  baixa_id uuid REFERENCES public.financeiro_baixas(id) ON DELETE SET NULL,
  regra_id uuid REFERENCES public.conciliacao_regras(id) ON DELETE SET NULL,
  operation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_tipo text NOT NULL DEFAULT 'heuristico',
  status text NOT NULL DEFAULT 'sugerido',
  score numeric(5,4) NOT NULL DEFAULT 0,
  motivos jsonb NOT NULL DEFAULT '[]'::jsonb,
  sugerido_por uuid DEFAULT auth.uid(),
  aprovado_por uuid,
  aprovado_em timestamptz,
  rejeitado_por uuid,
  rejeitado_em timestamptz,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_conciliacao_matches_tipo CHECK (match_tipo IN ('manual', 'exato', 'regra', 'heuristico', 'ia')),
  CONSTRAINT chk_conciliacao_matches_status CHECK (status IN ('sugerido', 'em_revisao', 'aprovado', 'rejeitado', 'cancelado', 'aplicado')),
  CONSTRAINT chk_conciliacao_matches_score CHECK (score >= 0 AND score <= 1),
  CONSTRAINT chk_conciliacao_matches_aprovacao CHECK ((status NOT IN ('aprovado', 'aplicado')) OR aprovado_por IS NOT NULL),
  CONSTRAINT chk_conciliacao_matches_rejeicao CHECK (status <> 'rejeitado' OR rejeitado_por IS NOT NULL),
  CONSTRAINT ux_conciliacao_matches_operation UNIQUE (operation_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conciliacao_matches TO authenticated;
GRANT ALL ON public.conciliacao_matches TO service_role;
ALTER TABLE public.conciliacao_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conciliacao_matches_select ON public.conciliacao_matches;
CREATE POLICY conciliacao_matches_select
ON public.conciliacao_matches
FOR SELECT
TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role))
  AND (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))
);

DROP POLICY IF EXISTS conciliacao_matches_insert ON public.conciliacao_matches;
CREATE POLICY conciliacao_matches_insert
ON public.conciliacao_matches
FOR INSERT
TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role))
  AND (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))
);

DROP POLICY IF EXISTS conciliacao_matches_update ON public.conciliacao_matches;
CREATE POLICY conciliacao_matches_update
ON public.conciliacao_matches
FOR UPDATE
TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role))
  AND (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role))
  AND (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))
);

DROP POLICY IF EXISTS conciliacao_matches_delete ON public.conciliacao_matches;
CREATE POLICY conciliacao_matches_delete
ON public.conciliacao_matches
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE INDEX IF NOT EXISTS idx_conciliacao_extratos_empresa_status
  ON public.conciliacao_extratos (empresa_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conciliacao_extratos_conta_periodo
  ON public.conciliacao_extratos (conta_bancaria_id, periodo_inicio, periodo_fim);

CREATE INDEX IF NOT EXISTS idx_conciliacao_linhas_extrato
  ON public.conciliacao_extrato_linhas (extrato_id, data_movimento);
CREATE INDEX IF NOT EXISTS idx_conciliacao_linhas_empresa_status
  ON public.conciliacao_extrato_linhas (empresa_id, status, data_movimento DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_conciliacao_linhas_fitid
  ON public.conciliacao_extrato_linhas (empresa_id, conta_bancaria_id, fitid)
  WHERE fitid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conciliacao_regras_empresa_status
  ON public.conciliacao_regras (empresa_id, status, ativo, prioridade);
CREATE INDEX IF NOT EXISTS idx_conciliacao_regras_tipo
  ON public.conciliacao_regras (empresa_id, tipo, escopo);

CREATE INDEX IF NOT EXISTS idx_conciliacao_matches_empresa_status
  ON public.conciliacao_matches (empresa_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conciliacao_matches_linha
  ON public.conciliacao_matches (extrato_linha_id, status);
CREATE INDEX IF NOT EXISTS idx_conciliacao_matches_lancamento
  ON public.conciliacao_matches (lancamento_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS ux_conciliacao_matches_ativo
  ON public.conciliacao_matches (extrato_linha_id, lancamento_id)
  WHERE status NOT IN ('rejeitado', 'cancelado');

DROP TRIGGER IF EXISTS trg_conciliacao_extratos_updated_at ON public.conciliacao_extratos;
CREATE TRIGGER trg_conciliacao_extratos_updated_at
BEFORE UPDATE ON public.conciliacao_extratos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_conciliacao_linhas_updated_at ON public.conciliacao_extrato_linhas;
CREATE TRIGGER trg_conciliacao_linhas_updated_at
BEFORE UPDATE ON public.conciliacao_extrato_linhas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_conciliacao_regras_updated_at ON public.conciliacao_regras;
CREATE TRIGGER trg_conciliacao_regras_updated_at
BEFORE UPDATE ON public.conciliacao_regras
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_conciliacao_matches_updated_at ON public.conciliacao_matches;
CREATE TRIGGER trg_conciliacao_matches_updated_at
BEFORE UPDATE ON public.conciliacao_matches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.conciliacao_extratos IS 'Conciliação v2: arquivos bancários importados com deduplicação por hash.';
COMMENT ON TABLE public.conciliacao_extrato_linhas IS 'Conciliação v2: linhas normalizadas dos extratos bancários.';
COMMENT ON TABLE public.conciliacao_regras IS 'Conciliação v2: regras versionadas de normalização, matching e workflow.';
COMMENT ON TABLE public.conciliacao_matches IS 'Conciliação v2: sugestões e decisões de matching entre extrato e financeiro.';