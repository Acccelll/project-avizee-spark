-- Revisão estrutural do módulo Financeiro
-- Objetivo: consolidar Financeiro como fonte única (títulos, baixas, estorno,
-- conciliação e fluxo de caixa) sem quebrar compatibilidade de dados legados.

-- 1) Canonização de status persistido + status temporal derivado
UPDATE public.financeiro_lancamentos
SET status = CASE
  WHEN status IN ('aberto','parcial','pago','cancelado') THEN status
  WHEN status IN ('vencido','estornado') THEN 'aberto'
  WHEN status IN ('quitado','liquidado','baixado') THEN 'pago'
  ELSE 'aberto'
END;

ALTER TABLE public.financeiro_lancamentos
  DROP CONSTRAINT IF EXISTS chk_financeiro_status;
ALTER TABLE public.financeiro_lancamentos
  ADD CONSTRAINT chk_financeiro_status
  CHECK (status IN ('aberto','parcial','pago','cancelado'));

CREATE OR REPLACE FUNCTION public.financeiro_status_efetivo(
  p_status text,
  p_data_vencimento date,
  p_data_referencia date DEFAULT CURRENT_DATE
)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_status, 'aberto') = 'aberto'
         AND p_data_vencimento IS NOT NULL
         AND p_data_vencimento < p_data_referencia THEN 'vencido'
    ELSE COALESCE(p_status, 'aberto')
  END;
$$;

-- Mantém RPC legado sem gravar vencido fisicamente.
CREATE OR REPLACE FUNCTION public.marcar_lancamentos_vencidos()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.financeiro_lancamentos
     SET status = 'aberto', updated_at = now()
   WHERE status = 'vencido';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 2) Origem e rastreabilidade do lançamento
ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS origem_tipo text,
  ADD COLUMN IF NOT EXISTS origem_tabela text,
  ADD COLUMN IF NOT EXISTS origem_id uuid,
  ADD COLUMN IF NOT EXISTS origem_descricao text;

UPDATE public.financeiro_lancamentos
SET origem_tipo = CASE
      WHEN documento_pai_id IS NOT NULL THEN 'parcelamento'
      WHEN nota_fiscal_id IS NOT NULL THEN 'fiscal_nota'
      ELSE 'manual'
    END,
    origem_tabela = CASE
      WHEN documento_pai_id IS NOT NULL THEN 'financeiro_lancamentos'
      WHEN nota_fiscal_id IS NOT NULL THEN 'notas_fiscais'
      ELSE NULL
    END,
    origem_id = CASE
      WHEN documento_pai_id IS NOT NULL THEN documento_pai_id
      WHEN nota_fiscal_id IS NOT NULL THEN nota_fiscal_id
      ELSE NULL
    END
WHERE origem_tipo IS NULL;

ALTER TABLE public.financeiro_lancamentos
  ALTER COLUMN origem_tipo SET DEFAULT 'manual';

ALTER TABLE public.financeiro_lancamentos
  DROP CONSTRAINT IF EXISTS chk_financeiro_origem_tipo;
ALTER TABLE public.financeiro_lancamentos
  ADD CONSTRAINT chk_financeiro_origem_tipo
  CHECK (origem_tipo IN ('manual','fiscal_nota','comercial','compras','parcelamento','sistemica'));

-- 3) Estrutura de baixa/estorno e conciliação por evento liquidado
ALTER TABLE public.financeiro_baixas
  ADD COLUMN IF NOT EXISTS estornada_em timestamptz,
  ADD COLUMN IF NOT EXISTS estornada_por_baixa_id uuid,
  ADD COLUMN IF NOT EXISTS motivo_estorno text,
  ADD COLUMN IF NOT EXISTS conciliacao_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS conciliado_em timestamptz,
  ADD COLUMN IF NOT EXISTS conciliado_por uuid,
  ADD COLUMN IF NOT EXISTS extrato_referencia text;

ALTER TABLE public.financeiro_baixas
  DROP CONSTRAINT IF EXISTS chk_financeiro_baixas_conciliacao_status;
ALTER TABLE public.financeiro_baixas
  ADD CONSTRAINT chk_financeiro_baixas_conciliacao_status
  CHECK (conciliacao_status IN ('pendente','conciliado','divergente','desconciliado'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'financeiro_baixas_estornada_por_fkey'
  ) THEN
    ALTER TABLE public.financeiro_baixas
      ADD CONSTRAINT financeiro_baixas_estornada_por_fkey
      FOREIGN KEY (estornada_por_baixa_id)
      REFERENCES public.financeiro_baixas(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_financeiro_baixa_estorno_unico
  ON public.financeiro_baixas(estornada_por_baixa_id)
  WHERE estornada_por_baixa_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financeiro_baixas_conciliacao
  ON public.financeiro_baixas(conta_bancaria_id, data_baixa, conciliacao_status)
  WHERE estornada_em IS NULL;

-- Backfill de conciliação legado (pares existentes -> baixas conciliadas por lançamento)
UPDATE public.financeiro_baixas b
SET conciliacao_status = 'conciliado',
    conciliado_em = now()
WHERE b.estornada_em IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.conciliacao_pares cp
    WHERE cp.lancamento_id = b.lancamento_id
  );

-- 4) Recalcular saldo apenas em baixas ativas (não estornadas)
CREATE OR REPLACE FUNCTION public.trg_sync_financeiro_saldo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lanc_id uuid;
  v_valor numeric;
  v_total_pago numeric;
  v_novo_saldo numeric;
  v_novo_status text;
  v_data_pgto date;
BEGIN
  v_lanc_id := COALESCE(NEW.lancamento_id, OLD.lancamento_id);

  SELECT valor INTO v_valor FROM public.financeiro_lancamentos WHERE id = v_lanc_id;
  IF v_valor IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(valor_pago), 0), MAX(data_baixa)
    INTO v_total_pago, v_data_pgto
  FROM public.financeiro_baixas
  WHERE lancamento_id = v_lanc_id
    AND estornada_em IS NULL;

  v_novo_saldo := GREATEST(v_valor - v_total_pago, 0);

  IF v_total_pago <= 0 THEN
    v_novo_status := 'aberto';
    v_data_pgto := NULL;
  ELSIF v_novo_saldo <= 0.009 THEN
    v_novo_status := 'pago';
    v_novo_saldo := 0;
  ELSE
    v_novo_status := 'parcial';
  END IF;

  UPDATE public.financeiro_lancamentos
  SET valor_pago = v_total_pago,
      saldo_restante = v_novo_saldo,
      status = CASE WHEN status = 'cancelado' THEN status ELSE v_novo_status END,
      data_pagamento = CASE WHEN v_novo_status = 'pago' THEN v_data_pgto ELSE NULL END,
      updated_at = now()
  WHERE id = v_lanc_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 5) Política de exclusão/cancelamento de título
CREATE OR REPLACE FUNCTION public.trg_financeiro_lancamento_proteger_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.financeiro_baixas b
    WHERE b.lancamento_id = OLD.id
      AND b.estornada_em IS NULL
  ) THEN
    RAISE EXCEPTION 'Exclusão bloqueada: lançamento possui baixa ativa. Use cancelamento/estorno.';
  END IF;

  IF COALESCE(OLD.origem_tipo, 'manual') <> 'manual' THEN
    RAISE EXCEPTION 'Exclusão bloqueada: lançamento de origem % deve ser tratado no módulo de origem.', OLD.origem_tipo;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_financeiro_lancamento_proteger_delete ON public.financeiro_lancamentos;
CREATE TRIGGER trg_financeiro_lancamento_proteger_delete
BEFORE DELETE ON public.financeiro_lancamentos
FOR EACH ROW EXECUTE FUNCTION public.trg_financeiro_lancamento_proteger_delete();

CREATE OR REPLACE FUNCTION public.financeiro_cancelar_lancamento(
  p_lancamento_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lanc record;
BEGIN
  SELECT * INTO v_lanc
  FROM public.financeiro_lancamentos
  WHERE id = p_lancamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lançamento não encontrado: %', p_lancamento_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.financeiro_baixas b
    WHERE b.lancamento_id = p_lancamento_id
      AND b.estornada_em IS NULL
  ) THEN
    RAISE EXCEPTION 'Não é permitido cancelar lançamento com baixa ativa. Estorne as baixas primeiro.';
  END IF;

  UPDATE public.financeiro_lancamentos
     SET status = 'cancelado',
         motivo_estorno = COALESCE(p_motivo, motivo_estorno),
         updated_at = now()
   WHERE id = p_lancamento_id;
END;
$$;

-- 6) Estorno sem perda de histórico
CREATE OR REPLACE FUNCTION public.estornar_baixa_financeira(
  p_baixa_id uuid,
  p_motivo text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_baixa record;
  v_lanc record;
  v_signal int;
BEGIN
  SELECT * INTO v_baixa FROM public.financeiro_baixas
   WHERE id = p_baixa_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Baixa % não encontrada', p_baixa_id;
  END IF;

  IF v_baixa.estornada_em IS NOT NULL THEN
    RAISE EXCEPTION 'Baixa % já estornada em %', p_baixa_id, v_baixa.estornada_em;
  END IF;

  SELECT * INTO v_lanc FROM public.financeiro_lancamentos
   WHERE id = v_baixa.lancamento_id FOR UPDATE;

  IF v_baixa.conta_bancaria_id IS NOT NULL THEN
    v_signal := CASE WHEN v_lanc.tipo = 'receber' THEN -1 ELSE 1 END;
    UPDATE public.contas_bancarias
       SET saldo_atual = COALESCE(saldo_atual, 0) + (v_signal * v_baixa.valor_pago),
           updated_at = now()
     WHERE id = v_baixa.conta_bancaria_id;

    INSERT INTO public.caixa_movimentos
      (conta_bancaria_id, tipo, valor, descricao, forma_pagamento, saldo_atual)
    SELECT v_baixa.conta_bancaria_id,
           CASE WHEN v_lanc.tipo = 'receber' THEN 'saida' ELSE 'entrada' END,
           v_baixa.valor_pago,
           'Estorno baixa: ' || COALESCE(p_motivo, v_lanc.descricao, v_lanc.id::text),
           v_baixa.forma_pagamento,
           (SELECT saldo_atual FROM public.contas_bancarias WHERE id = v_baixa.conta_bancaria_id);
  END IF;

  UPDATE public.financeiro_baixas
     SET estornada_em = now(),
         motivo_estorno = COALESCE(p_motivo, motivo_estorno),
         conciliacao_status = CASE WHEN conciliacao_status = 'conciliado' THEN 'desconciliado' ELSE conciliacao_status END
   WHERE id = p_baixa_id;

  UPDATE public.financeiro_lancamentos
     SET motivo_estorno = COALESCE(p_motivo, motivo_estorno),
         updated_at = now()
   WHERE id = v_baixa.lancamento_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_processar_estorno(
  p_lancamento_id uuid,
  p_motivo_estorno text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id
    FROM public.financeiro_baixas
    WHERE lancamento_id = p_lancamento_id
      AND estornada_em IS NULL
    ORDER BY data_baixa DESC, created_at DESC
  LOOP
    PERFORM public.estornar_baixa_financeira(r.id, COALESCE(p_motivo_estorno, 'Estorno manual'));
  END LOOP;

  UPDATE public.financeiro_lancamentos
     SET status = 'aberto',
         data_pagamento = NULL,
         updated_at = now()
   WHERE id = p_lancamento_id;
END;
$$;

-- 7) Conciliação sobre baixa/movimento (não por vencimento)
CREATE OR REPLACE FUNCTION public.financeiro_conciliar_baixa(
  p_baixa_id uuid,
  p_status text,
  p_extrato_referencia text DEFAULT NULL,
  p_usuario_id uuid DEFAULT auth.uid()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('pendente','conciliado','divergente','desconciliado') THEN
    RAISE EXCEPTION 'Status de conciliação inválido: %', p_status;
  END IF;

  UPDATE public.financeiro_baixas
     SET conciliacao_status = p_status,
         conciliado_em = CASE WHEN p_status = 'conciliado' THEN now() ELSE NULL END,
         conciliado_por = CASE WHEN p_status = 'conciliado' THEN p_usuario_id ELSE NULL END,
         extrato_referencia = COALESCE(p_extrato_referencia, extrato_referencia)
   WHERE id = p_baixa_id
     AND estornada_em IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Baixa não encontrada ou estornada: %', p_baixa_id;
  END IF;
END;
$$;

CREATE OR REPLACE VIEW public.vw_conciliacao_eventos_financeiros AS
SELECT
  b.id AS baixa_id,
  b.lancamento_id,
  l.tipo,
  l.descricao,
  l.status AS status_titulo,
  public.financeiro_status_efetivo(l.status, l.data_vencimento, CURRENT_DATE) AS status_efetivo,
  b.conta_bancaria_id,
  b.data_baixa AS data_movimento,
  b.valor_pago AS valor_movimento,
  b.forma_pagamento,
  b.conciliacao_status,
  b.conciliado_em,
  b.conciliado_por,
  b.extrato_referencia
FROM public.financeiro_baixas b
JOIN public.financeiro_lancamentos l ON l.id = b.lancamento_id
WHERE b.estornada_em IS NULL;

-- 8) Fluxo de caixa previsto x realizado com regra única
CREATE OR REPLACE VIEW public.vw_fluxo_caixa_financeiro AS
SELECT
  'previsto'::text AS natureza,
  l.id::text AS referencia_id,
  l.tipo,
  l.data_vencimento AS data_evento,
  COALESCE(l.saldo_restante, l.valor) AS valor,
  l.conta_bancaria_id,
  l.status,
  public.financeiro_status_efetivo(l.status, l.data_vencimento, CURRENT_DATE) AS status_efetivo
FROM public.financeiro_lancamentos l
WHERE l.ativo = true
  AND l.status IN ('aberto','parcial')
  AND COALESCE(l.saldo_restante, l.valor) > 0
UNION ALL
SELECT
  'realizado'::text AS natureza,
  b.id::text AS referencia_id,
  l.tipo,
  b.data_baixa AS data_evento,
  b.valor_pago AS valor,
  b.conta_bancaria_id,
  l.status,
  public.financeiro_status_efetivo(l.status, l.data_vencimento, CURRENT_DATE) AS status_efetivo
FROM public.financeiro_baixas b
JOIN public.financeiro_lancamentos l ON l.id = b.lancamento_id
WHERE b.estornada_em IS NULL;

-- 9) Visão canônica de lançamentos (status persistido x efetivo)
CREATE OR REPLACE VIEW public.vw_financeiro_lancamentos_canonico AS
SELECT
  l.*,
  l.status AS status_persistido,
  public.financeiro_status_efetivo(l.status, l.data_vencimento, CURRENT_DATE) AS status_efetivo
FROM public.financeiro_lancamentos l;

-- 10) Auditoria mínima do ciclo financeiro
CREATE TABLE IF NOT EXISTS public.financeiro_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade text NOT NULL,
  entidade_id uuid,
  evento text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  usuario_id uuid DEFAULT auth.uid()
);

ALTER TABLE public.financeiro_auditoria ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'financeiro_auditoria' AND policyname = 'fin_audit_select'
  ) THEN
    CREATE POLICY fin_audit_select ON public.financeiro_auditoria
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'financeiro_auditoria' AND policyname = 'fin_audit_insert'
  ) THEN
    CREATE POLICY fin_audit_insert ON public.financeiro_auditoria
      FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_financeiro_auditoria_entidade
  ON public.financeiro_auditoria(entidade, entidade_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.trg_financeiro_auditoria_lancamentos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.financeiro_auditoria(entidade, entidade_id, evento, payload)
    VALUES ('financeiro_lancamentos', NEW.id, 'criacao_titulo', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.status IS DISTINCT FROM NEW.status)
       OR (OLD.valor IS DISTINCT FROM NEW.valor)
       OR (OLD.saldo_restante IS DISTINCT FROM NEW.saldo_restante)
       OR (OLD.valor_pago IS DISTINCT FROM NEW.valor_pago)
       OR (OLD.data_vencimento IS DISTINCT FROM NEW.data_vencimento)
       OR (OLD.conta_bancaria_id IS DISTINCT FROM NEW.conta_bancaria_id) THEN
      INSERT INTO public.financeiro_auditoria(entidade, entidade_id, evento, payload)
      VALUES (
        'financeiro_lancamentos',
        NEW.id,
        CASE
          WHEN OLD.status <> 'cancelado' AND NEW.status = 'cancelado' THEN 'cancelamento_titulo'
          WHEN OLD.status <> NEW.status THEN 'alteracao_status_titulo'
          ELSE 'alteracao_relevante_titulo'
        END,
        jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_financeiro_auditoria_lancamentos ON public.financeiro_lancamentos;
CREATE TRIGGER trg_financeiro_auditoria_lancamentos
AFTER INSERT OR UPDATE ON public.financeiro_lancamentos
FOR EACH ROW EXECUTE FUNCTION public.trg_financeiro_auditoria_lancamentos();

CREATE OR REPLACE FUNCTION public.trg_financeiro_auditoria_baixas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.financeiro_auditoria(entidade, entidade_id, evento, payload)
    VALUES (
      'financeiro_baixas',
      NEW.id,
      CASE WHEN NEW.conciliacao_status = 'conciliado' THEN 'conciliacao' ELSE 'baixa_financeira' END,
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.estornada_em IS NULL AND NEW.estornada_em IS NOT NULL THEN
      INSERT INTO public.financeiro_auditoria(entidade, entidade_id, evento, payload)
      VALUES ('financeiro_baixas', NEW.id, 'estorno_baixa', jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)));
    ELSIF OLD.conciliacao_status IS DISTINCT FROM NEW.conciliacao_status THEN
      INSERT INTO public.financeiro_auditoria(entidade, entidade_id, evento, payload)
      VALUES (
        'financeiro_baixas',
        NEW.id,
        CASE WHEN NEW.conciliacao_status = 'desconciliado' THEN 'desconciliacao' ELSE 'conciliacao' END,
        jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_financeiro_auditoria_baixas ON public.financeiro_baixas;
CREATE TRIGGER trg_financeiro_auditoria_baixas
AFTER INSERT OR UPDATE ON public.financeiro_baixas
FOR EACH ROW EXECUTE FUNCTION public.trg_financeiro_auditoria_baixas();
