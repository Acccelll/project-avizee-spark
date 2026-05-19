-- ============================================================================
-- Edição privilegiada: Admin + Financeiro podem corrigir lançamentos, baixas,
-- parcelas de NF e cabeçalho/itens de notas fiscais já confirmadas.
-- ============================================================================

-- 1) Bypass controlado da trigger de status pago/parcial via GUC transacional.
--    Uso: SET LOCAL avizee.admin_override = 'on'; ... reset implícito no commit.
CREATE OR REPLACE FUNCTION public.trg_lancamento_status_requer_baixa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tem_baixa boolean;
  v_override text;
BEGIN
  -- Permite que RPCs SECURITY DEFINER privilegiadas marquem a transação como
  -- override. Sem isso, qualquer UPDATE de status para pago/parcial sem baixa
  -- ainda é bloqueado normalmente.
  BEGIN
    v_override := current_setting('avizee.admin_override', true);
  EXCEPTION WHEN OTHERS THEN
    v_override := NULL;
  END;
  IF v_override = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IN ('pago','parcial')
     AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.valor_pago IS DISTINCT FROM NEW.valor_pago) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.financeiro_baixas
      WHERE lancamento_id = NEW.id AND estornada_em IS NULL
    ) INTO v_tem_baixa;
    IF NOT v_tem_baixa THEN
      RAISE EXCEPTION 'Lancamento % nao pode ter status % sem baixa registrada. Use o fluxo de baixa financeira.', NEW.id, NEW.status
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Helper de gate por papel: admin OU financeiro.
CREATE OR REPLACE FUNCTION public.can_edit_financeiro_avancado(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'financeiro'::app_role)
$$;

-- 3) Edição privilegiada de UM lançamento. Estorna baixas se mudar
--    valor/forma/cartao/vencimento e regrava saldo.
CREATE OR REPLACE FUNCTION public.editar_lancamento_financeiro_admin(
  p_id uuid,
  p_payload jsonb,
  p_motivo text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old public.financeiro_lancamentos%ROWTYPE;
  v_new public.financeiro_lancamentos%ROWTYPE;
  v_baixa record;
  v_baixas_estornadas integer := 0;
  v_precisa_estorno boolean;
  v_novo_valor numeric;
  v_nova_forma text;
  v_novo_cartao uuid;
  v_novo_venc date;
  v_nova_fatura uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sessao nao autenticada' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_edit_financeiro_avancado(v_uid) THEN
    RAISE EXCEPTION 'Apenas Admin ou Financeiro podem editar lancamentos protegidos' USING ERRCODE = '42501';
  END IF;
  IF coalesce(trim(p_motivo),'') = '' OR char_length(trim(p_motivo)) < 10 THEN
    RAISE EXCEPTION 'Informe o motivo da edicao (minimo 10 caracteres)' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_old FROM public.financeiro_lancamentos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lancamento % nao encontrado', p_id USING ERRCODE = 'P0002';
  END IF;

  v_novo_valor   := COALESCE((p_payload->>'valor')::numeric,            v_old.valor);
  v_nova_forma   := COALESCE( p_payload->>'forma_pagamento',            v_old.forma_pagamento);
  v_novo_cartao  := NULLIF(p_payload->>'cartao_id','')::uuid;
  v_novo_venc    := COALESCE((p_payload->>'data_vencimento')::date,     v_old.data_vencimento);

  v_precisa_estorno := (
    v_novo_valor IS DISTINCT FROM v_old.valor
    OR v_nova_forma IS DISTINCT FROM v_old.forma_pagamento
    OR v_novo_cartao IS DISTINCT FROM v_old.cartao_id
    OR v_novo_venc IS DISTINCT FROM v_old.data_vencimento
  ) AND v_old.status IN ('pago','parcial');

  IF v_precisa_estorno THEN
    FOR v_baixa IN
      SELECT id FROM public.financeiro_baixas
      WHERE lancamento_id = p_id AND estornada_em IS NULL
    LOOP
      PERFORM public.estornar_baixa_financeira(v_baixa.id, format('Edicao privilegiada: %s', p_motivo));
      v_baixas_estornadas := v_baixas_estornadas + 1;
    END LOOP;
  END IF;

  -- Re-resolve fatura de cartao quando aplicavel.
  IF v_nova_forma = 'cartao_credito' AND v_novo_cartao IS NOT NULL THEN
    BEGIN
      v_nova_fatura := public.cartao_fatura_para_data(v_novo_cartao, v_novo_venc);
    EXCEPTION WHEN OTHERS THEN
      v_nova_fatura := NULL;
    END;
  END IF;

  -- Ativa bypass APENAS dentro desta transacao SECURITY DEFINER.
  PERFORM set_config('avizee.admin_override','on', true);

  UPDATE public.financeiro_lancamentos SET
    valor             = v_novo_valor,
    descricao         = COALESCE(p_payload->>'descricao', descricao),
    data_vencimento   = v_novo_venc,
    forma_pagamento   = v_nova_forma,
    banco             = COALESCE(p_payload->>'banco', banco),
    cartao            = COALESCE(p_payload->>'cartao', cartao),
    cartao_id         = CASE WHEN p_payload ? 'cartao_id'         THEN v_novo_cartao ELSE cartao_id END,
    cartao_fatura_id  = CASE WHEN v_precisa_estorno OR (p_payload ? 'cartao_id')
                              THEN v_nova_fatura
                              ELSE cartao_fatura_id END,
    cliente_id        = CASE WHEN p_payload ? 'cliente_id'        THEN NULLIF(p_payload->>'cliente_id','')::uuid ELSE cliente_id END,
    fornecedor_id     = CASE WHEN p_payload ? 'fornecedor_id'     THEN NULLIF(p_payload->>'fornecedor_id','')::uuid ELSE fornecedor_id END,
    conta_bancaria_id = CASE WHEN p_payload ? 'conta_bancaria_id' THEN NULLIF(p_payload->>'conta_bancaria_id','')::uuid ELSE conta_bancaria_id END,
    conta_contabil_id = CASE WHEN p_payload ? 'conta_contabil_id' THEN NULLIF(p_payload->>'conta_contabil_id','')::uuid ELSE conta_contabil_id END,
    centro_custo_id   = CASE WHEN p_payload ? 'centro_custo_id'   THEN NULLIF(p_payload->>'centro_custo_id','')::uuid ELSE centro_custo_id END,
    observacoes       = COALESCE(p_payload->>'observacoes', observacoes),
    status            = CASE WHEN v_precisa_estorno THEN 'aberto'
                             WHEN p_payload ? 'status' THEN p_payload->>'status'
                             ELSE status END,
    valor_pago        = CASE WHEN v_precisa_estorno THEN 0 ELSE valor_pago END,
    saldo_restante    = CASE WHEN v_precisa_estorno THEN v_novo_valor ELSE saldo_restante END,
    updated_at        = now()
  WHERE id = p_id
  RETURNING * INTO v_new;

  PERFORM set_config('avizee.admin_override','off', true);

  INSERT INTO public.auditoria_logs (tabela, acao, registro_id, usuario_id, dados_anteriores, dados_novos)
  VALUES (
    'financeiro_lancamentos',
    'edicao_privilegiada',
    p_id::text,
    v_uid,
    jsonb_build_object('motivo', p_motivo, 'baixas_estornadas', v_baixas_estornadas, 'antes', to_jsonb(v_old)),
    to_jsonb(v_new)
  );

  RETURN jsonb_build_object(
    'lancamento_id', v_new.id,
    'baixas_estornadas', v_baixas_estornadas,
    'status', v_new.status
  );
END;
$$;

-- 4) Edicao de uma baixa existente: estorna a antiga e cria nova com ajustes.
--    Mantem idempotencia delegando a regravacao do saldo aos triggers existentes.
CREATE OR REPLACE FUNCTION public.editar_baixa_admin(
  p_baixa_id uuid,
  p_payload jsonb,
  p_motivo text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old public.financeiro_baixas%ROWTYPE;
  v_nova_id uuid;
BEGIN
  IF v_uid IS NULL OR NOT public.can_edit_financeiro_avancado(v_uid) THEN
    RAISE EXCEPTION 'Apenas Admin ou Financeiro podem editar baixas' USING ERRCODE = '42501';
  END IF;
  IF coalesce(trim(p_motivo),'') = '' OR char_length(trim(p_motivo)) < 10 THEN
    RAISE EXCEPTION 'Informe o motivo da edicao (minimo 10 caracteres)' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_old FROM public.financeiro_baixas WHERE id = p_baixa_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Baixa % nao encontrada', p_baixa_id USING ERRCODE = 'P0002';
  END IF;

  -- Estorna a baixa antiga (libera saldo do lancamento via trigger).
  PERFORM public.estornar_baixa_financeira(p_baixa_id, format('Edicao privilegiada: %s', p_motivo));

  -- Cria nova baixa com payload merged.
  INSERT INTO public.financeiro_baixas (
    lancamento_id, valor_pago, data_pagamento, conta_bancaria_id,
    desconto, juros, multa, abatimento, observacoes, usuario_id
  ) VALUES (
    v_old.lancamento_id,
    COALESCE((p_payload->>'valor_pago')::numeric,     v_old.valor_pago),
    COALESCE((p_payload->>'data_pagamento')::date,    v_old.data_pagamento),
    COALESCE(NULLIF(p_payload->>'conta_bancaria_id','')::uuid, v_old.conta_bancaria_id),
    COALESCE((p_payload->>'desconto')::numeric,       v_old.desconto),
    COALESCE((p_payload->>'juros')::numeric,          v_old.juros),
    COALESCE((p_payload->>'multa')::numeric,          v_old.multa),
    COALESCE((p_payload->>'abatimento')::numeric,     v_old.abatimento),
    COALESCE(p_payload->>'observacoes', v_old.observacoes),
    v_uid
  ) RETURNING id INTO v_nova_id;

  INSERT INTO public.auditoria_logs (tabela, acao, registro_id, usuario_id, dados_anteriores, dados_novos)
  VALUES (
    'financeiro_baixas',
    'edicao_privilegiada',
    p_baixa_id::text,
    v_uid,
    jsonb_build_object('motivo', p_motivo, 'antes', to_jsonb(v_old)),
    jsonb_build_object('nova_baixa_id', v_nova_id, 'payload', p_payload)
  );

  RETURN jsonb_build_object('baixa_antiga_id', p_baixa_id, 'nova_baixa_id', v_nova_id);
END;
$$;

-- 5) Edicao isolada de UMA parcela de NF (vencimento/valor) sem regerar tudo.
CREATE OR REPLACE FUNCTION public.editar_parcela_nf_admin(
  p_lancamento_id uuid,
  p_payload jsonb,
  p_motivo text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_res jsonb;
BEGIN
  -- Reaproveita a RPC central de lancamentos (mesmo gate, estorno automatico).
  v_res := public.editar_lancamento_financeiro_admin(p_lancamento_id, p_payload, p_motivo);
  RETURN v_res;
END;
$$;

-- 6) Permissao de execucao para authenticated (RLS de tabelas continua valida).
GRANT EXECUTE ON FUNCTION public.editar_lancamento_financeiro_admin(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.editar_baixa_admin(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.editar_parcela_nf_admin(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_financeiro_avancado(uuid) TO authenticated;
