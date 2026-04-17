-- ============================================================
-- RODADA 4 — FINANCEIRO
-- Padroniza statuses, saldo automático, baixas transacionais,
-- estorno, parcelamento atômico, geração via folha de pagamento.
-- ============================================================

-- 1) Sanitização de statuses legados antes do CHECK
UPDATE public.financeiro_lancamentos
SET status = CASE
  WHEN status IS NULL THEN 'aberto'
  WHEN status IN ('aberto','parcial','pago','vencido','cancelado','estornado') THEN status
  WHEN status IN ('pendente','em_aberto') THEN 'aberto'
  WHEN status IN ('quitado','liquidado','baixado') THEN 'pago'
  WHEN status IN ('atrasado') THEN 'vencido'
  ELSE 'aberto'
END
WHERE status IS NULL OR status NOT IN ('aberto','parcial','pago','vencido','cancelado','estornado');

-- 2) CHECK constraint canônico
ALTER TABLE public.financeiro_lancamentos
  DROP CONSTRAINT IF EXISTS chk_financeiro_status;
ALTER TABLE public.financeiro_lancamentos
  ADD CONSTRAINT chk_financeiro_status
  CHECK (status IN ('aberto','parcial','pago','vencido','cancelado','estornado'));

ALTER TABLE public.financeiro_lancamentos
  DROP CONSTRAINT IF EXISTS chk_financeiro_tipo;
ALTER TABLE public.financeiro_lancamentos
  ADD CONSTRAINT chk_financeiro_tipo
  CHECK (tipo IN ('receber','pagar'));

-- 3) Backfill de saldo_restante e valor_pago
UPDATE public.financeiro_lancamentos l
SET valor_pago = COALESCE(b.total_pago, 0),
    saldo_restante = GREATEST(l.valor - COALESCE(b.total_pago, 0), 0)
FROM (
  SELECT lancamento_id, SUM(valor_pago) AS total_pago
  FROM public.financeiro_baixas
  GROUP BY lancamento_id
) b
WHERE b.lancamento_id = l.id;

UPDATE public.financeiro_lancamentos
SET saldo_restante = valor,
    valor_pago = 0
WHERE saldo_restante IS NULL;

-- 4) Trigger para sincronizar saldo a partir de baixas
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
  WHERE lancamento_id = v_lanc_id;

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
      status = CASE WHEN status IN ('cancelado','estornado') THEN status ELSE v_novo_status END,
      data_pagamento = CASE WHEN v_novo_status = 'pago' THEN v_data_pgto ELSE NULL END,
      updated_at = now()
  WHERE id = v_lanc_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_financeiro_baixas_sync ON public.financeiro_baixas;
CREATE TRIGGER trg_financeiro_baixas_sync
AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_baixas
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_financeiro_saldo();

-- 5) Trigger para inicializar saldo no insert do lançamento
CREATE OR REPLACE FUNCTION public.trg_init_financeiro_saldo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.saldo_restante IS NULL THEN
    NEW.saldo_restante := NEW.valor;
  END IF;
  IF NEW.valor_pago IS NULL THEN
    NEW.valor_pago := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financeiro_init_saldo ON public.financeiro_lancamentos;
CREATE TRIGGER trg_financeiro_init_saldo
BEFORE INSERT ON public.financeiro_lancamentos
FOR EACH ROW EXECUTE FUNCTION public.trg_init_financeiro_saldo();

-- 6) RPC: registrar baixa transacional (total ou parcial)
CREATE OR REPLACE FUNCTION public.registrar_baixa_financeira(
  p_lancamento_id uuid,
  p_valor_pago numeric,
  p_data_baixa date,
  p_forma_pagamento text,
  p_conta_bancaria_id uuid,
  p_observacoes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lanc record;
  v_baixa_id uuid;
  v_signal int;
BEGIN
  IF p_valor_pago IS NULL OR p_valor_pago <= 0 THEN
    RAISE EXCEPTION 'Valor da baixa deve ser maior que zero';
  END IF;
  IF p_conta_bancaria_id IS NULL THEN
    RAISE EXCEPTION 'Conta bancária é obrigatória';
  END IF;

  SELECT * INTO v_lanc FROM public.financeiro_lancamentos
   WHERE id = p_lancamento_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lançamento % não encontrado', p_lancamento_id;
  END IF;
  IF v_lanc.status IN ('cancelado','estornado') THEN
    RAISE EXCEPTION 'Lançamento % está % e não aceita baixa', p_lancamento_id, v_lanc.status;
  END IF;
  IF p_valor_pago > COALESCE(v_lanc.saldo_restante, v_lanc.valor) + 0.009 THEN
    RAISE EXCEPTION 'Valor pago (%) excede saldo restante (%)', p_valor_pago, v_lanc.saldo_restante;
  END IF;

  INSERT INTO public.financeiro_baixas
    (lancamento_id, data_baixa, valor_pago, forma_pagamento, conta_bancaria_id, observacoes)
  VALUES
    (p_lancamento_id, p_data_baixa, p_valor_pago, p_forma_pagamento, p_conta_bancaria_id, p_observacoes)
  RETURNING id INTO v_baixa_id;

  -- Atualiza saldo da conta bancária
  v_signal := CASE WHEN v_lanc.tipo = 'receber' THEN 1 ELSE -1 END;
  UPDATE public.contas_bancarias
     SET saldo_atual = COALESCE(saldo_atual, 0) + (v_signal * p_valor_pago),
         updated_at = now()
   WHERE id = p_conta_bancaria_id;

  -- Movimento de caixa
  INSERT INTO public.caixa_movimentos
    (conta_bancaria_id, tipo, valor, descricao, forma_pagamento, saldo_atual)
  SELECT p_conta_bancaria_id,
         CASE WHEN v_lanc.tipo = 'receber' THEN 'entrada' ELSE 'saida' END,
         p_valor_pago,
         'Baixa financeira: ' || COALESCE(v_lanc.descricao, v_lanc.id::text),
         p_forma_pagamento,
         (SELECT saldo_atual FROM public.contas_bancarias WHERE id = p_conta_bancaria_id);

  RETURN v_baixa_id;
END;
$$;

-- 7) RPC: estornar baixa específica
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

  SELECT * INTO v_lanc FROM public.financeiro_lancamentos
   WHERE id = v_baixa.lancamento_id FOR UPDATE;

  -- Reverte saldo bancário
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

  DELETE FROM public.financeiro_baixas WHERE id = p_baixa_id;

  IF p_motivo IS NOT NULL THEN
    UPDATE public.financeiro_lancamentos
       SET motivo_estorno = p_motivo, updated_at = now()
     WHERE id = v_baixa.lancamento_id;
  END IF;
END;
$$;

-- 8) RPC: gerar parcelas atomicamente (agrupador + filhas)
CREATE OR REPLACE FUNCTION public.gerar_parcelas_financeiras(
  p_base jsonb,
  p_num_parcelas int,
  p_intervalo_dias int DEFAULT 30
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id uuid;
  v_valor_total numeric;
  v_valor_parcela numeric;
  v_resto numeric;
  v_data_base date;
  i int;
  v_descricao text;
BEGIN
  IF p_num_parcelas IS NULL OR p_num_parcelas < 2 THEN
    RAISE EXCEPTION 'Número de parcelas deve ser >= 2';
  END IF;

  v_valor_total := (p_base->>'valor')::numeric;
  v_data_base := (p_base->>'data_vencimento')::date;
  v_descricao := COALESCE(p_base->>'descricao','Parcelamento');
  v_valor_parcela := round(v_valor_total / p_num_parcelas, 2);
  v_resto := round(v_valor_total - (v_valor_parcela * p_num_parcelas), 2);

  -- Agrupador (parcela_numero = 0)
  INSERT INTO public.financeiro_lancamentos
    (tipo, descricao, valor, data_vencimento, status,
     forma_pagamento, banco, cartao,
     cliente_id, fornecedor_id, conta_bancaria_id, conta_contabil_id,
     observacoes, parcela_numero, parcela_total)
  VALUES
    (COALESCE(p_base->>'tipo','receber'),
     v_descricao || ' (agrupador)',
     v_valor_total,
     v_data_base,
     'aberto',
     NULLIF(p_base->>'forma_pagamento',''),
     NULLIF(p_base->>'banco',''),
     NULLIF(p_base->>'cartao',''),
     NULLIF(p_base->>'cliente_id','')::uuid,
     NULLIF(p_base->>'fornecedor_id','')::uuid,
     NULLIF(p_base->>'conta_bancaria_id','')::uuid,
     NULLIF(p_base->>'conta_contabil_id','')::uuid,
     NULLIF(p_base->>'observacoes',''),
     0, p_num_parcelas)
  RETURNING id INTO v_parent_id;

  -- Parcelas filhas
  FOR i IN 1..p_num_parcelas LOOP
    INSERT INTO public.financeiro_lancamentos
      (tipo, descricao, valor, data_vencimento, status,
       forma_pagamento, banco, cartao,
       cliente_id, fornecedor_id, conta_bancaria_id, conta_contabil_id,
       observacoes, parcela_numero, parcela_total, documento_pai_id)
    VALUES
      (COALESCE(p_base->>'tipo','receber'),
       v_descricao || ' - ' || i || '/' || p_num_parcelas,
       CASE WHEN i = p_num_parcelas THEN v_valor_parcela + v_resto ELSE v_valor_parcela END,
       v_data_base + ((i - 1) * p_intervalo_dias),
       'aberto',
       NULLIF(p_base->>'forma_pagamento',''),
       NULLIF(p_base->>'banco',''),
       NULLIF(p_base->>'cartao',''),
       NULLIF(p_base->>'cliente_id','')::uuid,
       NULLIF(p_base->>'fornecedor_id','')::uuid,
       NULLIF(p_base->>'conta_bancaria_id','')::uuid,
       NULLIF(p_base->>'conta_contabil_id','')::uuid,
       NULLIF(p_base->>'observacoes',''),
       i, p_num_parcelas, v_parent_id);
  END LOOP;

  RETURN v_parent_id;
END;
$$;

-- 9) RPC: gerar financeiro a partir de folha de pagamento (idempotente)
CREATE OR REPLACE FUNCTION public.gerar_financeiro_folha(
  p_competencia text,
  p_data_vencimento date
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_count int := 0;
BEGIN
  FOR r IN
    SELECT fp.id, fp.funcionario_id, fp.valor_liquido, f.nome
      FROM public.folha_pagamento fp
      JOIN public.funcionarios f ON f.id = fp.funcionario_id
     WHERE fp.competencia = p_competencia
       AND COALESCE(fp.financeiro_gerado, false) = false
       AND COALESCE(fp.valor_liquido, 0) > 0
  LOOP
    INSERT INTO public.financeiro_lancamentos
      (tipo, descricao, valor, data_vencimento, status, funcionario_id, observacoes)
    VALUES
      ('pagar',
       'Folha ' || p_competencia || ' - ' || r.nome,
       r.valor_liquido,
       p_data_vencimento,
       'aberto',
       r.funcionario_id,
       'Gerado automaticamente da folha #' || r.id);

    UPDATE public.folha_pagamento SET financeiro_gerado = true WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 10) RPC: marcar lançamentos vencidos (job manual)
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
     SET status = 'vencido', updated_at = now()
   WHERE status = 'aberto'
     AND data_vencimento < CURRENT_DATE
     AND ativo = true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 11) Índices úteis
CREATE INDEX IF NOT EXISTS idx_fin_lanc_status_venc
  ON public.financeiro_lancamentos(status, data_vencimento)
  WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_fin_lanc_doc_pai
  ON public.financeiro_lancamentos(documento_pai_id)
  WHERE documento_pai_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fin_baixas_lanc
  ON public.financeiro_baixas(lancamento_id);
