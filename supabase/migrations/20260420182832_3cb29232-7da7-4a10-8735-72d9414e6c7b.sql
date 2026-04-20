-- ============================================================
-- 1) STATUS CANÔNICO
-- ============================================================

-- Backfill: vencido -> aberto, estornado -> cancelado
UPDATE public.financeiro_lancamentos SET status = 'aberto' WHERE status = 'vencido';
UPDATE public.financeiro_lancamentos SET status = 'cancelado' WHERE status = 'estornado';

-- Drop checks duplicados (idempotente)
ALTER TABLE public.financeiro_lancamentos DROP CONSTRAINT IF EXISTS chk_fin_lanc_status;
ALTER TABLE public.financeiro_lancamentos DROP CONSTRAINT IF EXISTS chk_financeiro_lancamentos_status;
ALTER TABLE public.financeiro_lancamentos DROP CONSTRAINT IF EXISTS chk_financeiro_status;

ALTER TABLE public.financeiro_lancamentos
  ADD CONSTRAINT chk_financeiro_lancamentos_status
  CHECK (status IN ('aberto','parcial','pago','cancelado'));

-- Função de status efetivo (deriva 'vencido')
CREATE OR REPLACE FUNCTION public.financeiro_status_efetivo(p_status text, p_dv date, p_ref date)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_status = 'aberto' AND p_dv IS NOT NULL AND p_dv < p_ref THEN 'vencido'
    ELSE p_status
  END;
$$;

-- ============================================================
-- 2) ESTORNO LÓGICO DE BAIXAS
-- ============================================================

ALTER TABLE public.financeiro_baixas
  ADD COLUMN IF NOT EXISTS estornada_em timestamptz,
  ADD COLUMN IF NOT EXISTS estornada_por uuid,
  ADD COLUMN IF NOT EXISTS motivo_estorno text;

CREATE INDEX IF NOT EXISTS idx_fin_baixas_lanc_ativas
  ON public.financeiro_baixas (lancamento_id) WHERE estornada_em IS NULL;

-- Recalcula trigger de saldo considerando apenas baixas ativas
CREATE OR REPLACE FUNCTION public.trg_sync_financeiro_saldo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lancamento_id uuid;
  v_valor_total numeric;
  v_pago numeric;
  v_saldo numeric;
  v_status text;
  v_status_atual text;
BEGIN
  v_lancamento_id := COALESCE(NEW.lancamento_id, OLD.lancamento_id);

  SELECT valor, status INTO v_valor_total, v_status_atual
  FROM public.financeiro_lancamentos
  WHERE id = v_lancamento_id;

  IF v_status_atual = 'cancelado' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(valor_pago), 0) INTO v_pago
  FROM public.financeiro_baixas
  WHERE lancamento_id = v_lancamento_id
    AND estornada_em IS NULL;

  v_saldo := GREATEST(v_valor_total - v_pago, 0);

  IF v_pago <= 0.005 THEN
    v_status := 'aberto';
  ELSIF v_saldo <= 0.005 THEN
    v_status := 'pago';
  ELSE
    v_status := 'parcial';
  END IF;

  UPDATE public.financeiro_lancamentos
  SET valor_pago = v_pago,
      saldo_restante = v_saldo,
      status = v_status,
      data_pagamento = CASE WHEN v_status = 'pago' THEN COALESCE(NEW.data_baixa, data_pagamento) ELSE NULL END,
      updated_at = now()
  WHERE id = v_lancamento_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_financeiro_saldo ON public.financeiro_baixas;
CREATE TRIGGER trg_sync_financeiro_saldo
AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_baixas
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_financeiro_saldo();

-- ============================================================
-- 3) ORIGEM RASTREÁVEL
-- ============================================================

ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS origem_tipo text,
  ADD COLUMN IF NOT EXISTS origem_tabela text,
  ADD COLUMN IF NOT EXISTS origem_id uuid,
  ADD COLUMN IF NOT EXISTS origem_descricao text;

-- Backfill por FKs existentes
UPDATE public.financeiro_lancamentos
SET origem_tipo = 'fiscal_nota', origem_tabela = 'notas_fiscais', origem_id = nota_fiscal_id
WHERE nota_fiscal_id IS NOT NULL AND origem_tipo IS NULL;

UPDATE public.financeiro_lancamentos
SET origem_tipo = 'compras', origem_tabela = 'pedidos_compra', origem_id = pedido_compra_id
WHERE pedido_compra_id IS NOT NULL AND origem_tipo IS NULL;

UPDATE public.financeiro_lancamentos
SET origem_tipo = 'parcelamento', origem_tabela = 'financeiro_lancamentos', origem_id = documento_pai_id
WHERE documento_pai_id IS NOT NULL AND origem_tipo IS NULL;

UPDATE public.financeiro_lancamentos
SET origem_tipo = 'folha', origem_tabela = 'folha_pagamento'
WHERE funcionario_id IS NOT NULL AND origem_tipo IS NULL;

UPDATE public.financeiro_lancamentos
SET origem_tipo = 'manual'
WHERE origem_tipo IS NULL;

ALTER TABLE public.financeiro_lancamentos
  ALTER COLUMN origem_tipo SET DEFAULT 'manual',
  ALTER COLUMN origem_tipo SET NOT NULL;

ALTER TABLE public.financeiro_lancamentos DROP CONSTRAINT IF EXISTS chk_fin_lanc_origem_tipo;
ALTER TABLE public.financeiro_lancamentos
  ADD CONSTRAINT chk_fin_lanc_origem_tipo
  CHECK (origem_tipo IN ('manual','fiscal_nota','comercial','compras','parcelamento','folha','sistemica'));

CREATE INDEX IF NOT EXISTS idx_fin_lanc_origem ON public.financeiro_lancamentos (origem_tipo, origem_id);

-- ============================================================
-- 4) AUDITORIA FINANCEIRA
-- ============================================================

CREATE TABLE IF NOT EXISTS public.financeiro_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento text NOT NULL CHECK (evento IN ('criacao','alteracao','cancelamento','baixa','estorno_baixa','conciliacao','desconciliacao')),
  lancamento_id uuid,
  baixa_id uuid,
  payload jsonb,
  usuario_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fin_aud_lancamento ON public.financeiro_auditoria(lancamento_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fin_aud_baixa ON public.financeiro_auditoria(baixa_id, created_at DESC);

ALTER TABLE public.financeiro_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auditoria visível a admin/financeiro" ON public.financeiro_auditoria;
CREATE POLICY "Auditoria visível a admin/financeiro"
ON public.financeiro_auditoria FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro'));

-- Trigger de auditoria em lançamentos
CREATE OR REPLACE FUNCTION public.trg_financeiro_auditoria_lanc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.financeiro_auditoria(evento, lancamento_id, payload, usuario_id)
    VALUES ('criacao', NEW.id, to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'cancelado' THEN
      INSERT INTO public.financeiro_auditoria(evento, lancamento_id, payload, usuario_id)
      VALUES ('cancelamento', NEW.id, jsonb_build_object('antes', to_jsonb(OLD), 'depois', to_jsonb(NEW)), auth.uid());
    ELSIF NEW.status IS DISTINCT FROM OLD.status OR NEW.valor IS DISTINCT FROM OLD.valor OR NEW.data_vencimento IS DISTINCT FROM OLD.data_vencimento THEN
      INSERT INTO public.financeiro_auditoria(evento, lancamento_id, payload, usuario_id)
      VALUES ('alteracao', NEW.id, jsonb_build_object('antes', to_jsonb(OLD), 'depois', to_jsonb(NEW)), auth.uid());
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_financeiro_auditoria_lanc ON public.financeiro_lancamentos;
CREATE TRIGGER trg_financeiro_auditoria_lanc
AFTER INSERT OR UPDATE ON public.financeiro_lancamentos
FOR EACH ROW EXECUTE FUNCTION public.trg_financeiro_auditoria_lanc();

-- Trigger de auditoria em baixas
CREATE OR REPLACE FUNCTION public.trg_financeiro_auditoria_baixa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.financeiro_auditoria(evento, lancamento_id, baixa_id, payload, usuario_id)
    VALUES ('baixa', NEW.lancamento_id, NEW.id, to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' AND NEW.estornada_em IS NOT NULL AND OLD.estornada_em IS NULL THEN
    INSERT INTO public.financeiro_auditoria(evento, lancamento_id, baixa_id, payload, usuario_id)
    VALUES ('estorno_baixa', NEW.lancamento_id, NEW.id, jsonb_build_object('motivo', NEW.motivo_estorno, 'baixa', to_jsonb(NEW)), auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financeiro_auditoria_baixa ON public.financeiro_baixas;
CREATE TRIGGER trg_financeiro_auditoria_baixa
AFTER INSERT OR UPDATE ON public.financeiro_baixas
FOR EACH ROW EXECUTE FUNCTION public.trg_financeiro_auditoria_baixa();

-- ============================================================
-- 5) RPC CANCELAR LANÇAMENTO + PROTEÇÃO DE EXCLUSÃO
-- ============================================================

CREATE OR REPLACE FUNCTION public.financeiro_cancelar_lancamento(p_id uuid, p_motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_baixas_ativas int;
BEGIN
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'Motivo do cancelamento é obrigatório (mínimo 5 caracteres).';
  END IF;

  SELECT status INTO v_status FROM public.financeiro_lancamentos WHERE id = p_id FOR UPDATE;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Lançamento não encontrado: %', p_id;
  END IF;

  IF v_status IN ('cancelado','pago') THEN
    RAISE EXCEPTION 'Lançamento já está em status % e não pode ser cancelado.', v_status;
  END IF;

  SELECT COUNT(*) INTO v_baixas_ativas
  FROM public.financeiro_baixas
  WHERE lancamento_id = p_id AND estornada_em IS NULL;

  IF v_baixas_ativas > 0 THEN
    RAISE EXCEPTION 'Estorne as baixas ativas antes de cancelar este lançamento.';
  END IF;

  UPDATE public.financeiro_lancamentos
  SET status = 'cancelado',
      motivo_estorno = p_motivo,
      updated_at = now()
  WHERE id = p_id;
END;
$$;

-- Proteção de exclusão física
CREATE OR REPLACE FUNCTION public.trg_financeiro_protege_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_baixas_ativas int;
BEGIN
  IF OLD.origem_tipo IS DISTINCT FROM 'manual' THEN
    RAISE EXCEPTION 'Lançamento originado de % não pode ser excluído. Use cancelamento.', OLD.origem_tipo;
  END IF;

  SELECT COUNT(*) INTO v_baixas_ativas
  FROM public.financeiro_baixas
  WHERE lancamento_id = OLD.id AND estornada_em IS NULL;

  IF v_baixas_ativas > 0 THEN
    RAISE EXCEPTION 'Lançamento possui baixas ativas. Estorne antes de excluir.';
  END IF;

  IF OLD.status NOT IN ('aberto','cancelado') THEN
    RAISE EXCEPTION 'Apenas lançamentos manuais em aberto ou cancelados podem ser excluídos.';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_financeiro_protege_delete ON public.financeiro_lancamentos;
CREATE TRIGGER trg_financeiro_protege_delete
BEFORE DELETE ON public.financeiro_lancamentos
FOR EACH ROW EXECUTE FUNCTION public.trg_financeiro_protege_delete();

-- ============================================================
-- 6) CONCILIAÇÃO POR BAIXA
-- ============================================================

ALTER TABLE public.financeiro_baixas
  ADD COLUMN IF NOT EXISTS conciliacao_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS conciliacao_extrato_referencia text,
  ADD COLUMN IF NOT EXISTS conciliacao_data timestamptz,
  ADD COLUMN IF NOT EXISTS conciliacao_usuario uuid;

ALTER TABLE public.financeiro_baixas DROP CONSTRAINT IF EXISTS chk_fin_baixas_concil_status;
ALTER TABLE public.financeiro_baixas
  ADD CONSTRAINT chk_fin_baixas_concil_status
  CHECK (conciliacao_status IN ('pendente','conciliado','divergente','desconciliado'));

-- Backfill: baixas referenciadas em conciliacao_pares -> conciliado
UPDATE public.financeiro_baixas b
SET conciliacao_status = 'conciliado',
    conciliacao_data = cb.created_at
FROM public.conciliacao_pares cp
JOIN public.conciliacao_bancaria cb ON cb.id = cp.conciliacao_id
WHERE cp.lancamento_id = b.lancamento_id
  AND b.conciliacao_status = 'pendente';

CREATE OR REPLACE FUNCTION public.financeiro_conciliar_baixa(
  p_baixa_id uuid,
  p_status text,
  p_extrato_referencia text DEFAULT NULL
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
      conciliacao_extrato_referencia = COALESCE(p_extrato_referencia, conciliacao_extrato_referencia),
      conciliacao_data = CASE WHEN p_status = 'pendente' THEN NULL ELSE now() END,
      conciliacao_usuario = CASE WHEN p_status = 'pendente' THEN NULL ELSE auth.uid() END
  WHERE id = p_baixa_id;

  INSERT INTO public.financeiro_auditoria(evento, baixa_id, payload, usuario_id)
  VALUES (
    CASE WHEN p_status = 'desconciliado' OR p_status = 'pendente' THEN 'desconciliacao' ELSE 'conciliacao' END,
    p_baixa_id,
    jsonb_build_object('status', p_status, 'extrato', p_extrato_referencia),
    auth.uid()
  );
END;
$$;

CREATE OR REPLACE VIEW public.vw_conciliacao_eventos_financeiros
WITH (security_invoker = true)
AS
SELECT
  b.id AS baixa_id,
  b.lancamento_id,
  b.data_baixa,
  b.valor_pago,
  b.forma_pagamento,
  b.conta_bancaria_id,
  cb.descricao AS conta_descricao,
  l.tipo AS lancamento_tipo,
  l.descricao AS lancamento_descricao,
  l.cliente_id,
  l.fornecedor_id,
  b.conciliacao_status,
  b.conciliacao_extrato_referencia,
  b.conciliacao_data,
  b.estornada_em
FROM public.financeiro_baixas b
JOIN public.financeiro_lancamentos l ON l.id = b.lancamento_id
LEFT JOIN public.contas_bancarias cb ON cb.id = b.conta_bancaria_id
WHERE b.estornada_em IS NULL;

-- ============================================================
-- 7) FLUXO DE CAIXA UNIFICADO
-- ============================================================

CREATE OR REPLACE VIEW public.vw_fluxo_caixa_financeiro
WITH (security_invoker = true)
AS
-- Previsto
SELECT
  l.id AS lancamento_id,
  NULL::uuid AS baixa_id,
  l.tipo,
  l.conta_bancaria_id,
  l.data_vencimento AS data_ref,
  COALESCE(l.saldo_restante, l.valor) AS valor,
  'previsto'::text AS categoria,
  l.status,
  l.cliente_id,
  l.fornecedor_id,
  l.descricao
FROM public.financeiro_lancamentos l
WHERE l.ativo = true
  AND l.status IN ('aberto','parcial')
UNION ALL
-- Realizado
SELECT
  b.lancamento_id,
  b.id AS baixa_id,
  l.tipo,
  b.conta_bancaria_id,
  b.data_baixa AS data_ref,
  b.valor_pago AS valor,
  'realizado'::text AS categoria,
  l.status,
  l.cliente_id,
  l.fornecedor_id,
  l.descricao
FROM public.financeiro_baixas b
JOIN public.financeiro_lancamentos l ON l.id = b.lancamento_id
WHERE b.estornada_em IS NULL;