
-- ============================================================
-- 1. Estender chk_fin_lanc_origem_tipo para aceitar 'societario'
-- ============================================================
ALTER TABLE public.financeiro_lancamentos DROP CONSTRAINT IF EXISTS chk_fin_lanc_origem_tipo;
ALTER TABLE public.financeiro_lancamentos
  ADD CONSTRAINT chk_fin_lanc_origem_tipo
  CHECK (origem_tipo = ANY (ARRAY['manual','fiscal_nota','comercial','compras','parcelamento','folha','sistemica','societario']));

-- ============================================================
-- 2. Tabela socios
-- ============================================================
CREATE TABLE public.socios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cpf text UNIQUE,
  email text,
  telefone text,
  ativo boolean NOT NULL DEFAULT true,
  percentual_participacao_atual numeric(5,2) NOT NULL DEFAULT 0,
  data_entrada date,
  data_saida date,
  forma_recebimento_padrao text,
  chave_pix text,
  banco text,
  agencia text,
  conta text,
  tipo_conta text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT chk_socios_pct_nao_negativo CHECK (percentual_participacao_atual >= 0 AND percentual_participacao_atual <= 100),
  CONSTRAINT chk_socios_datas CHECK (data_saida IS NULL OR data_entrada IS NULL OR data_saida >= data_entrada)
);
CREATE INDEX idx_socios_ativo ON public.socios(ativo) WHERE ativo = true;

-- ============================================================
-- 3. Tabela socios_participacoes (histórico)
-- ============================================================
CREATE TABLE public.socios_participacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id uuid NOT NULL REFERENCES public.socios(id) ON DELETE CASCADE,
  percentual numeric(5,2) NOT NULL,
  vigencia_inicio date NOT NULL,
  vigencia_fim date,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT chk_part_pct CHECK (percentual >= 0 AND percentual <= 100),
  CONSTRAINT chk_part_vigencia CHECK (vigencia_fim IS NULL OR vigencia_fim >= vigencia_inicio)
);
CREATE INDEX idx_socios_part_socio ON public.socios_participacoes(socio_id);
CREATE INDEX idx_socios_part_vigencia ON public.socios_participacoes(vigencia_inicio, vigencia_fim);

-- EXCLUDE constraint: impedir sobreposição de vigência por sócio
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE public.socios_participacoes
  ADD CONSTRAINT excl_socios_part_overlap
  EXCLUDE USING gist (
    socio_id WITH =,
    daterange(vigencia_inicio, COALESCE(vigencia_fim, 'infinity'::date), '[]') WITH &&
  );

-- ============================================================
-- 4. Tabela socios_parametros (pró-labore por competência)
-- ============================================================
CREATE TABLE public.socios_parametros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia text NOT NULL UNIQUE,
  pro_labore_total numeric(15,2) NOT NULL DEFAULT 0,
  base_referencia text NOT NULL DEFAULT 'manual',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT chk_socios_param_base CHECK (base_referencia IN ('manual','salario_minimo')),
  CONSTRAINT chk_socios_param_competencia CHECK (competencia ~ '^\d{4}-\d{2}$'),
  CONSTRAINT chk_socios_param_valor CHECK (pro_labore_total >= 0)
);

-- ============================================================
-- 5. Tabela apuracoes_societarias (mestre)
-- ============================================================
CREATE TABLE public.apuracoes_societarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia text NOT NULL UNIQUE,
  fechamento_mensal_id uuid REFERENCES public.fechamentos_mensais(id) ON DELETE SET NULL,
  lucro_base numeric(15,2) NOT NULL DEFAULT 0,
  ajustes numeric(15,2) NOT NULL DEFAULT 0,
  lucro_distribuivel numeric(15,2) NOT NULL DEFAULT 0,
  pro_labore_total numeric(15,2) NOT NULL DEFAULT 0,
  bonus_total numeric(15,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'rascunho',
  observacoes text,
  fechado_em timestamptz,
  fechado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT chk_apuracao_status CHECK (status IN ('rascunho','fechado','aprovado','cancelado')),
  CONSTRAINT chk_apuracao_competencia CHECK (competencia ~ '^\d{4}-\d{2}$')
);
CREATE INDEX idx_apuracao_status ON public.apuracoes_societarias(status);

-- ============================================================
-- 6. Tabela apuracoes_societarias_itens
-- ============================================================
CREATE TABLE public.apuracoes_societarias_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apuracao_id uuid NOT NULL REFERENCES public.apuracoes_societarias(id) ON DELETE CASCADE,
  socio_id uuid NOT NULL REFERENCES public.socios(id) ON DELETE RESTRICT,
  percentual_aplicado numeric(5,2) NOT NULL DEFAULT 0,
  direito_teorico numeric(15,2) NOT NULL DEFAULT 0,
  pro_labore_calculado numeric(15,2) NOT NULL DEFAULT 0,
  bonus_calculado numeric(15,2) NOT NULL DEFAULT 0,
  distribuicao_calculada numeric(15,2) NOT NULL DEFAULT 0,
  retirado_no_periodo numeric(15,2) NOT NULL DEFAULT 0,
  saldo_disponivel numeric(15,2) NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_apuracao_socio UNIQUE (apuracao_id, socio_id)
);
CREATE INDEX idx_apuracao_itens_socio ON public.apuracoes_societarias_itens(socio_id);

-- ============================================================
-- 7. Tabela socios_retiradas
-- ============================================================
CREATE TABLE public.socios_retiradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id uuid NOT NULL REFERENCES public.socios(id) ON DELETE RESTRICT,
  competencia text NOT NULL,
  apuracao_id uuid REFERENCES public.apuracoes_societarias(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  criterio_rateio text NOT NULL DEFAULT 'manual',
  valor_total_evento numeric(15,2),
  percentual_aplicado numeric(5,2),
  valor_calculado numeric(15,2) NOT NULL DEFAULT 0,
  valor_aprovado numeric(15,2),
  data_prevista date,
  data_pagamento date,
  status text NOT NULL DEFAULT 'rascunho',
  financeiro_lancamento_id uuid REFERENCES public.financeiro_lancamentos(id) ON DELETE SET NULL,
  motivo_cancelamento text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT chk_retirada_tipo CHECK (tipo IN ('pro_labore','bonus','distribuicao_lucros','ajuste')),
  CONSTRAINT chk_retirada_criterio CHECK (criterio_rateio IN ('percentual_societario','valor_fixo','manual')),
  CONSTRAINT chk_retirada_status CHECK (status IN ('rascunho','aprovado','financeiro_gerado','pago','cancelado')),
  CONSTRAINT chk_retirada_competencia CHECK (competencia ~ '^\d{4}-\d{2}$'),
  CONSTRAINT uq_retirada_financeiro UNIQUE (financeiro_lancamento_id)
);
CREATE INDEX idx_retiradas_socio ON public.socios_retiradas(socio_id);
CREATE INDEX idx_retiradas_competencia ON public.socios_retiradas(competencia);
CREATE INDEX idx_retiradas_apuracao ON public.socios_retiradas(apuracao_id);
CREATE INDEX idx_retiradas_status ON public.socios_retiradas(status);

-- ============================================================
-- 8. Triggers de updated_at e audit
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_socios_audit_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := COALESCE(NEW.created_at, now());
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  END IF;
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_socios_audit BEFORE INSERT OR UPDATE ON public.socios
  FOR EACH ROW EXECUTE FUNCTION public.set_socios_audit_cols();
CREATE TRIGGER trg_socios_part_audit BEFORE INSERT OR UPDATE ON public.socios_participacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_socios_audit_cols();
CREATE TRIGGER trg_socios_param_audit BEFORE INSERT OR UPDATE ON public.socios_parametros
  FOR EACH ROW EXECUTE FUNCTION public.set_socios_audit_cols();
CREATE TRIGGER trg_apuracao_audit BEFORE INSERT OR UPDATE ON public.apuracoes_societarias
  FOR EACH ROW EXECUTE FUNCTION public.set_socios_audit_cols();
CREATE TRIGGER trg_retiradas_audit BEFORE INSERT OR UPDATE ON public.socios_retiradas
  FOR EACH ROW EXECUTE FUNCTION public.set_socios_audit_cols();

CREATE TRIGGER trg_apuracao_itens_updated BEFORE UPDATE ON public.apuracoes_societarias_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 9. Trigger sincroniza percentual_atual no cadastro do sócio
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_sync_pct_atual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_socio uuid;
  v_pct numeric(5,2);
BEGIN
  v_socio := COALESCE(NEW.socio_id, OLD.socio_id);
  SELECT percentual INTO v_pct
  FROM public.socios_participacoes
  WHERE socio_id = v_socio
    AND vigencia_inicio <= CURRENT_DATE
    AND (vigencia_fim IS NULL OR vigencia_fim >= CURRENT_DATE)
  ORDER BY vigencia_inicio DESC
  LIMIT 1;

  UPDATE public.socios SET percentual_participacao_atual = COALESCE(v_pct, 0)
  WHERE id = v_socio;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_part_sync_pct_atual
  AFTER INSERT OR UPDATE OR DELETE ON public.socios_participacoes
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_pct_atual();

-- ============================================================
-- 10. Trigger bloqueia DELETE de sócio com histórico
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_block_socio_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.socios_retiradas WHERE socio_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.apuracoes_societarias_itens WHERE socio_id = OLD.id) THEN
    RAISE EXCEPTION 'Não é possível excluir sócio com histórico. Inative-o.';
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER trg_socios_block_delete BEFORE DELETE ON public.socios
  FOR EACH ROW EXECUTE FUNCTION public.trg_block_socio_delete();

-- ============================================================
-- 11. Trigger bloqueia DELETE/UPDATE de apuração fechada
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_block_apuracao_fechada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('fechado','aprovado') THEN
      RAISE EXCEPTION 'Não é possível excluir apuração com status %', OLD.status;
    END IF;
    RETURN OLD;
  END IF;
  -- UPDATE: permitir alteração apenas para status (transições controladas via RPC)
  IF OLD.status IN ('fechado','aprovado') AND NEW.status = OLD.status THEN
    -- bloqueia mudanças em colunas calculadas
    IF NEW.lucro_base IS DISTINCT FROM OLD.lucro_base
       OR NEW.ajustes IS DISTINCT FROM OLD.ajustes
       OR NEW.lucro_distribuivel IS DISTINCT FROM OLD.lucro_distribuivel
       OR NEW.pro_labore_total IS DISTINCT FROM OLD.pro_labore_total
       OR NEW.bonus_total IS DISTINCT FROM OLD.bonus_total THEN
      RAISE EXCEPTION 'Apuração % está % e não permite alteração de valores. Reabra antes.', OLD.competencia, OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_apuracao_block BEFORE UPDATE OR DELETE ON public.apuracoes_societarias
  FOR EACH ROW EXECUTE FUNCTION public.trg_block_apuracao_fechada();

-- ============================================================
-- 12. RLS
-- ============================================================
ALTER TABLE public.socios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.socios_participacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.socios_parametros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apuracoes_societarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apuracoes_societarias_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.socios_retiradas ENABLE ROW LEVEL SECURITY;

-- Visualização: admin OU financeiro
CREATE POLICY socios_select ON public.socios FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY socios_part_select ON public.socios_participacoes FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY socios_param_select ON public.socios_parametros FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY apuracao_select ON public.apuracoes_societarias FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY apuracao_itens_select ON public.apuracoes_societarias_itens FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY retiradas_select ON public.socios_retiradas FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

-- INSERT/UPDATE/DELETE: somente admin
CREATE POLICY socios_admin_all ON public.socios FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY socios_part_admin_all ON public.socios_participacoes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY socios_param_admin_all ON public.socios_parametros FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY apuracao_admin_all ON public.apuracoes_societarias FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY apuracao_itens_admin_all ON public.apuracoes_societarias_itens FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY retiradas_admin_all ON public.socios_retiradas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 13. RPCs
-- ============================================================

-- Cria apuração mensal e itens para sócios ativos
CREATE OR REPLACE FUNCTION public.criar_apuracao_societaria(
  p_competencia text,
  p_lucro_base numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_fechamento_id uuid;
  v_lucro numeric(15,2);
  v_pro_labore numeric(15,2);
  v_data_ref date;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF p_competencia !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'Competência inválida (use AAAA-MM)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.apuracoes_societarias WHERE competencia = p_competencia) THEN
    RAISE EXCEPTION 'Já existe apuração para %', p_competencia;
  END IF;

  v_data_ref := (p_competencia || '-01')::date;

  -- Buscar fechamento mensal vinculado e lucro sugerido
  SELECT id INTO v_fechamento_id FROM public.fechamentos_mensais WHERE competencia = p_competencia LIMIT 1;
  IF p_lucro_base IS NOT NULL THEN
    v_lucro := p_lucro_base;
  ELSIF v_fechamento_id IS NOT NULL THEN
    SELECT COALESCE(SUM(CASE WHEN tipo='receber' THEN saldo_total ELSE -saldo_total END), 0)
      INTO v_lucro
      FROM public.fechamento_financeiro_saldos WHERE fechamento_id = v_fechamento_id;
  ELSE
    v_lucro := 0;
  END IF;

  -- Pró-labore parametrizado
  SELECT pro_labore_total INTO v_pro_labore FROM public.socios_parametros WHERE competencia = p_competencia;
  v_pro_labore := COALESCE(v_pro_labore, 0);

  INSERT INTO public.apuracoes_societarias(competencia, fechamento_mensal_id, lucro_base, lucro_distribuivel, pro_labore_total, status)
    VALUES (p_competencia, v_fechamento_id, v_lucro, v_lucro, v_pro_labore, 'rascunho')
    RETURNING id INTO v_id;

  -- Inserir itens para sócios ativos com participação vigente
  INSERT INTO public.apuracoes_societarias_itens(apuracao_id, socio_id, percentual_aplicado, direito_teorico, pro_labore_calculado)
  SELECT v_id, s.id,
         COALESCE(p.percentual, s.percentual_participacao_atual),
         ROUND(v_lucro * COALESCE(p.percentual, s.percentual_participacao_atual) / 100, 2),
         ROUND(v_pro_labore * COALESCE(p.percentual, s.percentual_participacao_atual) / 100, 2)
  FROM public.socios s
  LEFT JOIN LATERAL (
    SELECT percentual FROM public.socios_participacoes
    WHERE socio_id = s.id
      AND vigencia_inicio <= v_data_ref
      AND (vigencia_fim IS NULL OR vigencia_fim >= v_data_ref)
    ORDER BY vigencia_inicio DESC LIMIT 1
  ) p ON true
  WHERE s.ativo = true;

  RETURN v_id;
END;
$$;

-- Recalcula valores da apuração (usa retiradas existentes para retirado_no_periodo)
CREATE OR REPLACE FUNCTION public.recalcular_apuracao_societaria(p_apuracao_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ap public.apuracoes_societarias%ROWTYPE;
  v_bonus_total numeric(15,2);
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  SELECT * INTO v_ap FROM public.apuracoes_societarias WHERE id = p_apuracao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Apuração não encontrada'; END IF;
  IF v_ap.status IN ('fechado','aprovado') THEN
    RAISE EXCEPTION 'Apuração % não permite recálculo. Reabra antes.', v_ap.status;
  END IF;

  -- Soma bônus aprovados/gerados/pagos da competência
  SELECT COALESCE(SUM(valor_calculado), 0) INTO v_bonus_total
  FROM public.socios_retiradas
  WHERE competencia = v_ap.competencia AND tipo = 'bonus'
    AND status IN ('aprovado','financeiro_gerado','pago');

  UPDATE public.apuracoes_societarias
    SET lucro_distribuivel = lucro_base + ajustes,
        bonus_total = v_bonus_total
    WHERE id = p_apuracao_id;

  -- Recalcular itens
  UPDATE public.apuracoes_societarias_itens i
    SET direito_teorico = ROUND((v_ap.lucro_base + v_ap.ajustes) * i.percentual_aplicado / 100, 2),
        pro_labore_calculado = ROUND(v_ap.pro_labore_total * i.percentual_aplicado / 100, 2),
        bonus_calculado = COALESCE((
          SELECT SUM(valor_calculado) FROM public.socios_retiradas r
          WHERE r.socio_id = i.socio_id AND r.competencia = v_ap.competencia AND r.tipo = 'bonus'
            AND r.status IN ('aprovado','financeiro_gerado','pago')
        ), 0),
        retirado_no_periodo = COALESCE((
          SELECT SUM(valor_calculado) FROM public.socios_retiradas r
          WHERE r.socio_id = i.socio_id AND r.competencia = v_ap.competencia
            AND r.status IN ('financeiro_gerado','pago')
        ), 0)
    WHERE i.apuracao_id = p_apuracao_id;

  UPDATE public.apuracoes_societarias_itens
    SET saldo_disponivel = direito_teorico + pro_labore_calculado + bonus_calculado - retirado_no_periodo
    WHERE apuracao_id = p_apuracao_id;
END;
$$;

-- Fechar apuração
CREATE OR REPLACE FUNCTION public.fechar_apuracao_societaria(p_apuracao_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  SELECT status INTO v_status FROM public.apuracoes_societarias WHERE id = p_apuracao_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Apuração não encontrada'; END IF;
  IF v_status <> 'rascunho' THEN RAISE EXCEPTION 'Só é possível fechar apurações em rascunho'; END IF;
  PERFORM public.recalcular_apuracao_societaria(p_apuracao_id);
  UPDATE public.apuracoes_societarias
    SET status = 'fechado', fechado_em = now(), fechado_por = auth.uid()
    WHERE id = p_apuracao_id;
END;
$$;

-- Reabrir apuração
CREATE OR REPLACE FUNCTION public.reabrir_apuracao_societaria(p_apuracao_id uuid, p_motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN
    RAISE EXCEPTION 'Motivo da reabertura é obrigatório';
  END IF;
  UPDATE public.apuracoes_societarias
    SET status = 'rascunho',
        observacoes = COALESCE(observacoes,'') || E'\n[REABERTURA ' || to_char(now(),'YYYY-MM-DD HH24:MI') || '] ' || p_motivo,
        fechado_em = NULL, fechado_por = NULL
    WHERE id = p_apuracao_id AND status IN ('fechado','aprovado');
END;
$$;

-- Aprovar retirada
CREATE OR REPLACE FUNCTION public.aprovar_retirada_socio(p_retirada_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  UPDATE public.socios_retiradas
    SET status = 'aprovado', valor_aprovado = COALESCE(valor_aprovado, valor_calculado)
    WHERE id = p_retirada_id AND status = 'rascunho';
  IF NOT FOUND THEN RAISE EXCEPTION 'Retirada não encontrada ou já aprovada'; END IF;
END;
$$;

-- Gerar financeiro (idempotente)
CREATE OR REPLACE FUNCTION public.gerar_financeiro_retirada(
  p_retirada_id uuid,
  p_data_vencimento date,
  p_conta_bancaria_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ret public.socios_retiradas%ROWTYPE;
  v_socio public.socios%ROWTYPE;
  v_lanc_id uuid;
  v_valor numeric(15,2);
  v_descricao text;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  SELECT * INTO v_ret FROM public.socios_retiradas WHERE id = p_retirada_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retirada não encontrada'; END IF;

  -- Idempotência: já gerado
  IF v_ret.financeiro_lancamento_id IS NOT NULL THEN
    RETURN v_ret.financeiro_lancamento_id;
  END IF;

  IF v_ret.status NOT IN ('aprovado') THEN
    RAISE EXCEPTION 'Retirada precisa estar aprovada (atual: %)', v_ret.status;
  END IF;

  SELECT * INTO v_socio FROM public.socios WHERE id = v_ret.socio_id;
  v_valor := COALESCE(v_ret.valor_aprovado, v_ret.valor_calculado);
  v_descricao := 'Retirada sócio ' || v_socio.nome || ' — ' || v_ret.tipo || ' (' || v_ret.competencia || ')';

  INSERT INTO public.financeiro_lancamentos(
    tipo, descricao, titulo, valor, data_vencimento, status,
    origem_tipo, origem_tabela, origem_id, origem_descricao,
    conta_bancaria_id, observacoes, codigo_fluxo_origem, nome_abreviado_origem
  ) VALUES (
    'pagar', v_descricao, v_descricao, v_valor, p_data_vencimento, 'aberto',
    'societario', 'socios_retiradas', v_ret.id, v_descricao,
    p_conta_bancaria_id, v_ret.observacoes, 'SOC-' || upper(v_ret.tipo), v_socio.nome
  ) RETURNING id INTO v_lanc_id;

  UPDATE public.socios_retiradas
    SET financeiro_lancamento_id = v_lanc_id, status = 'financeiro_gerado'
    WHERE id = p_retirada_id;

  RETURN v_lanc_id;
END;
$$;

-- Cancelar retirada
CREATE OR REPLACE FUNCTION public.cancelar_retirada_socio(p_retirada_id uuid, p_motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lanc_id uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN RAISE EXCEPTION 'Motivo obrigatório'; END IF;
  SELECT financeiro_lancamento_id INTO v_lanc_id FROM public.socios_retiradas WHERE id = p_retirada_id FOR UPDATE;
  IF v_lanc_id IS NOT NULL THEN
    UPDATE public.financeiro_lancamentos
      SET status = 'cancelado', ativo = false, motivo_estorno = p_motivo
      WHERE id = v_lanc_id;
  END IF;
  UPDATE public.socios_retiradas
    SET status = 'cancelado', motivo_cancelamento = p_motivo
    WHERE id = p_retirada_id;
END;
$$;
