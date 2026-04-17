-- Fase 3: FK explícita pedido_compra_id em financeiro_lancamentos
ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS pedido_compra_id uuid REFERENCES public.pedidos_compra(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_pedido_compra
  ON public.financeiro_lancamentos(pedido_compra_id);

-- Atualiza receber_compra para também gerar lançamento financeiro vinculado ao pedido
CREATE OR REPLACE FUNCTION public.receber_compra(
  p_pedido_id uuid,
  p_data_recebimento date,
  p_itens jsonb,
  p_observacoes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido      RECORD;
  v_compra_id   uuid;
  v_numero      text;
  v_valor_prod  numeric := 0;
  v_qtd_total_pedida   numeric := 0;
  v_qtd_total_recebida numeric := 0;
  v_item        jsonb;
  v_qtd_rec     numeric;
  v_valor_unit  numeric;
  v_subtotal    numeric;
  v_produto_id  uuid;
  v_status_ped  text;
  v_saldo_ant   numeric;
  v_prazo_dias  int;
  v_data_venc   date;
  v_lanc_id     uuid;
BEGIN
  SELECT * INTO v_pedido FROM public.pedidos_compra WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido de compra % não encontrado', p_pedido_id; END IF;
  IF v_pedido.status NOT IN ('aprovado','enviado','enviado_ao_fornecedor','aguardando_recebimento','recebido_parcial','rascunho') THEN
    RAISE EXCEPTION 'Pedido com status % não pode ser recebido', v_pedido.status;
  END IF;
  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Informe pelo menos um item para receber';
  END IF;

  v_numero := COALESCE(v_pedido.numero, to_char(now(),'YYYYMMDDHH24MISS'));

  INSERT INTO public.compras (
    numero, fornecedor_id, data_compra, data_entrega_real,
    valor_produtos, valor_total, status, observacoes,
    pedido_compra_id, ativo
  ) VALUES (
    v_numero, v_pedido.fornecedor_id, CURRENT_DATE, p_data_recebimento,
    0, 0, 'confirmada', p_observacoes,
    p_pedido_id, true
  ) RETURNING id INTO v_compra_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_qtd_rec    := COALESCE((v_item->>'quantidade_recebida')::numeric, 0);
    v_valor_unit := COALESCE((v_item->>'valor_unitario')::numeric, 0);
    v_produto_id := NULLIF(v_item->>'produto_id','')::uuid;
    IF v_qtd_rec <= 0 THEN CONTINUE; END IF;
    v_subtotal := v_qtd_rec * v_valor_unit;

    INSERT INTO public.compras_itens (
      compra_id, produto_id, descricao, quantidade, valor_unitario, valor_total
    ) VALUES (
      v_compra_id, v_produto_id, v_item->>'descricao',
      v_qtd_rec, v_valor_unit, v_subtotal
    );
    v_valor_prod := v_valor_prod + v_subtotal;

    IF v_produto_id IS NOT NULL THEN
      SELECT COALESCE(estoque_atual,0) INTO v_saldo_ant FROM public.produtos WHERE id = v_produto_id;
      INSERT INTO public.estoque_movimentos (
        produto_id, tipo, quantidade, saldo_anterior, saldo_atual,
        documento_id, documento_tipo, motivo
      ) VALUES (
        v_produto_id, 'entrada', v_qtd_rec, v_saldo_ant, v_saldo_ant + v_qtd_rec,
        v_compra_id, 'compra', 'Recebimento de compra ' || v_numero
      );
    END IF;
  END LOOP;

  UPDATE public.compras SET valor_produtos = v_valor_prod, valor_total = v_valor_prod
   WHERE id = v_compra_id;

  -- Gera lançamento financeiro a pagar vinculado ao pedido
  IF v_valor_prod > 0 THEN
    SELECT COALESCE(NULLIF(regexp_replace(COALESCE(v_pedido.condicao_pagamento,''),'\D','','g'),'')::int, 30)
      INTO v_prazo_dias;
    v_data_venc := p_data_recebimento + (v_prazo_dias || ' days')::interval;

    INSERT INTO public.financeiro_lancamentos (
      tipo, descricao, data_vencimento, valor, saldo_restante, status,
      fornecedor_id, pedido_compra_id, observacoes
    ) VALUES (
      'pagar',
      'Pedido de compra ' || v_numero,
      v_data_venc,
      v_valor_prod,
      v_valor_prod,
      'aberto',
      v_pedido.fornecedor_id,
      p_pedido_id,
      p_observacoes
    ) RETURNING id INTO v_lanc_id;
  END IF;

  -- Recalcula status do pedido
  SELECT COALESCE(SUM(quantidade),0) INTO v_qtd_total_pedida
    FROM public.pedidos_compra_itens WHERE pedido_compra_id = p_pedido_id;
  SELECT COALESCE(SUM(ci.quantidade),0) INTO v_qtd_total_recebida
    FROM public.compras_itens ci
    JOIN public.compras c ON c.id = ci.compra_id
   WHERE c.pedido_compra_id = p_pedido_id AND c.status = 'confirmada';

  IF v_qtd_total_recebida >= v_qtd_total_pedida AND v_qtd_total_pedida > 0 THEN
    v_status_ped := 'recebido';
  ELSIF v_qtd_total_recebida > 0 THEN
    v_status_ped := 'recebido_parcial';
  ELSE
    v_status_ped := v_pedido.status;
  END IF;

  UPDATE public.pedidos_compra
     SET status = v_status_ped,
         data_entrega_real = COALESCE(data_entrega_real, p_data_recebimento),
         updated_at = now()
   WHERE id = p_pedido_id;

  RETURN jsonb_build_object(
    'compra_id', v_compra_id,
    'numero', v_numero,
    'status_pedido', v_status_ped,
    'valor_total', v_valor_prod,
    'lancamento_id', v_lanc_id
  );
END;
$function$;

-- Fase 4: pg_trgm + sugerir_conciliacao_bancaria
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.sugerir_conciliacao_bancaria(
  p_conta_id uuid,
  p_extrato jsonb
)
RETURNS TABLE(extrato_id text, lancamento_id uuid, score numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_e jsonb;
  v_eid text;
  v_evalor numeric;
  v_edata date;
  v_edesc text;
BEGIN
  IF p_extrato IS NULL OR jsonb_typeof(p_extrato) <> 'array' THEN
    RETURN;
  END IF;

  FOR v_e IN SELECT * FROM jsonb_array_elements(p_extrato) LOOP
    v_eid    := v_e->>'id';
    v_evalor := COALESCE((v_e->>'valor')::numeric, 0);
    v_edata  := COALESCE((v_e->>'data')::date, CURRENT_DATE);
    v_edesc  := COALESCE(v_e->>'descricao','');

    RETURN QUERY
      SELECT
        v_eid AS extrato_id,
        l.id  AS lancamento_id,
        ( -- score: 0..1
          CASE WHEN ABS(COALESCE(l.valor,0) - ABS(v_evalor)) < 0.01 THEN 0.6 ELSE 0 END
          + GREATEST(0, 0.2 - (ABS(EXTRACT(EPOCH FROM (l.data_vencimento - v_edata))/86400) * 0.04))
          + (similarity(lower(COALESCE(l.descricao,'')), lower(v_edesc)) * 0.2)
        )::numeric AS score
      FROM public.financeiro_lancamentos l
      WHERE l.ativo = true
        AND l.status IN ('aberto','parcial')
        AND (p_conta_id IS NULL OR l.conta_bancaria_id = p_conta_id)
        AND ABS(COALESCE(l.valor,0) - ABS(v_evalor)) < 0.01
        AND ABS(EXTRACT(EPOCH FROM (l.data_vencimento - v_edata))/86400) <= 5
      ORDER BY score DESC
      LIMIT 3;
  END LOOP;
END;
$function$;