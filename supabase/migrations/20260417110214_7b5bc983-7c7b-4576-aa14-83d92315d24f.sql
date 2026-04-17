-- =========================================================
-- 1) Saneamento de status legados (idempotente)
-- =========================================================
UPDATE public.cotacoes_compra SET status='aberta' WHERE status IS NULL;
UPDATE public.cotacoes_compra SET status='cancelada' WHERE status IN ('rejeitada');
UPDATE public.pedidos_compra  SET status='aprovado' WHERE status IS NULL;
UPDATE public.compras         SET status='rascunho' WHERE status IS NULL;
UPDATE public.compras         SET status='confirmada' WHERE status IN ('recebida','entregue','concluida');

-- =========================================================
-- 2) CHECKs de status canônicos
-- =========================================================
ALTER TABLE public.cotacoes_compra DROP CONSTRAINT IF EXISTS chk_cotacoes_compra_status;
ALTER TABLE public.cotacoes_compra ADD CONSTRAINT chk_cotacoes_compra_status
  CHECK (status IN ('rascunho','aberta','convertida','cancelada'));

ALTER TABLE public.pedidos_compra DROP CONSTRAINT IF EXISTS chk_pedidos_compra_status;
ALTER TABLE public.pedidos_compra ADD CONSTRAINT chk_pedidos_compra_status
  CHECK (status IN ('rascunho','aprovado','enviado','recebido_parcial','recebido','cancelado'));

ALTER TABLE public.compras DROP CONSTRAINT IF EXISTS chk_compras_status;
ALTER TABLE public.compras ADD CONSTRAINT chk_compras_status
  CHECK (status IN ('rascunho','confirmada','cancelada'));

-- =========================================================
-- 3) Coluna pedido_compra_id em compras (rastreabilidade)
-- =========================================================
ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS pedido_compra_id uuid;

-- =========================================================
-- 4) Foreign Keys (idempotentes)
-- =========================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_compras_fornecedor') THEN
    ALTER TABLE public.compras ADD CONSTRAINT fk_compras_fornecedor
      FOREIGN KEY (fornecedor_id) REFERENCES public.fornecedores(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_compras_pedido_compra') THEN
    ALTER TABLE public.compras ADD CONSTRAINT fk_compras_pedido_compra
      FOREIGN KEY (pedido_compra_id) REFERENCES public.pedidos_compra(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_compras_itens_compra') THEN
    ALTER TABLE public.compras_itens ADD CONSTRAINT fk_compras_itens_compra
      FOREIGN KEY (compra_id) REFERENCES public.compras(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_compras_itens_produto') THEN
    ALTER TABLE public.compras_itens ADD CONSTRAINT fk_compras_itens_produto
      FOREIGN KEY (produto_id) REFERENCES public.produtos(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_cci_cotacao') THEN
    ALTER TABLE public.cotacoes_compra_itens ADD CONSTRAINT fk_cci_cotacao
      FOREIGN KEY (cotacao_compra_id) REFERENCES public.cotacoes_compra(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_cci_produto') THEN
    ALTER TABLE public.cotacoes_compra_itens ADD CONSTRAINT fk_cci_produto
      FOREIGN KEY (produto_id) REFERENCES public.produtos(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_ccp_cotacao') THEN
    ALTER TABLE public.cotacoes_compra_propostas ADD CONSTRAINT fk_ccp_cotacao
      FOREIGN KEY (cotacao_compra_id) REFERENCES public.cotacoes_compra(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_ccp_item') THEN
    ALTER TABLE public.cotacoes_compra_propostas ADD CONSTRAINT fk_ccp_item
      FOREIGN KEY (item_id) REFERENCES public.cotacoes_compra_itens(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_ccp_fornecedor') THEN
    ALTER TABLE public.cotacoes_compra_propostas ADD CONSTRAINT fk_ccp_fornecedor
      FOREIGN KEY (fornecedor_id) REFERENCES public.fornecedores(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_pedidos_compra_fornecedor') THEN
    ALTER TABLE public.pedidos_compra ADD CONSTRAINT fk_pedidos_compra_fornecedor
      FOREIGN KEY (fornecedor_id) REFERENCES public.fornecedores(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_pedidos_compra_cotacao') THEN
    ALTER TABLE public.pedidos_compra ADD CONSTRAINT fk_pedidos_compra_cotacao
      FOREIGN KEY (cotacao_compra_id) REFERENCES public.cotacoes_compra(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_pci_pedido') THEN
    ALTER TABLE public.pedidos_compra_itens ADD CONSTRAINT fk_pci_pedido
      FOREIGN KEY (pedido_compra_id) REFERENCES public.pedidos_compra(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_pci_produto') THEN
    ALTER TABLE public.pedidos_compra_itens ADD CONSTRAINT fk_pci_produto
      FOREIGN KEY (produto_id) REFERENCES public.produtos(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_compras_pedido_compra_id ON public.compras(pedido_compra_id);
CREATE INDEX IF NOT EXISTS idx_compras_fornecedor_id ON public.compras(fornecedor_id);

-- =========================================================
-- 5) RPC: receber_compra
--    p_itens = jsonb array de { pedido_item_id, produto_id, quantidade_recebida, valor_unitario }
-- =========================================================
CREATE OR REPLACE FUNCTION public.receber_compra(
  p_pedido_id uuid,
  p_data_recebimento date,
  p_itens jsonb,
  p_observacoes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  SELECT * INTO v_pedido FROM public.pedidos_compra WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido de compra % não encontrado', p_pedido_id; END IF;
  IF v_pedido.status NOT IN ('aprovado','enviado','recebido_parcial') THEN
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

    -- Movimenta estoque (entrada)
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

  -- Determinar status do pedido pós-recebimento (compara totais agregados)
  SELECT COALESCE(SUM(quantidade),0) INTO v_qtd_total_pedida
    FROM public.pedidos_compra_itens WHERE pedido_compra_id = p_pedido_id;
  SELECT COALESCE(SUM(ci.quantidade),0) INTO v_qtd_total_recebida
    FROM public.compras_itens ci
    JOIN public.compras c ON c.id = ci.compra_id
   WHERE c.pedido_compra_id = p_pedido_id AND c.status = 'confirmada';

  IF v_qtd_total_recebida >= v_qtd_total_pedida AND v_qtd_total_pedida > 0 THEN
    v_status_ped := 'recebido';
  ELSE
    v_status_ped := 'recebido_parcial';
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
    'valor_total', v_valor_prod
  );
END;
$$;

-- =========================================================
-- 6) RPC: estornar_recebimento_compra
-- =========================================================
CREATE OR REPLACE FUNCTION public.estornar_recebimento_compra(
  p_compra_id uuid,
  p_motivo text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_compra RECORD;
  v_pedido_id uuid;
  v_item RECORD;
  v_saldo_ant numeric;
  v_qtd_pedida numeric;
  v_qtd_recebida numeric;
  v_status text;
BEGIN
  SELECT * INTO v_compra FROM public.compras WHERE id = p_compra_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compra % não encontrada', p_compra_id; END IF;
  IF v_compra.status = 'cancelada' THEN
    RAISE EXCEPTION 'Compra já está cancelada';
  END IF;

  v_pedido_id := v_compra.pedido_compra_id;

  -- Estorna estoque
  FOR v_item IN SELECT produto_id, quantidade FROM public.compras_itens WHERE compra_id = p_compra_id LOOP
    IF v_item.produto_id IS NOT NULL THEN
      SELECT COALESCE(estoque_atual,0) INTO v_saldo_ant FROM public.produtos WHERE id = v_item.produto_id;
      INSERT INTO public.estoque_movimentos (
        produto_id, tipo, quantidade, saldo_anterior, saldo_atual,
        documento_id, documento_tipo, motivo
      ) VALUES (
        v_item.produto_id, 'saida', v_item.quantidade, v_saldo_ant, v_saldo_ant - v_item.quantidade,
        p_compra_id, 'compra', COALESCE('Estorno: ' || p_motivo, 'Estorno de recebimento')
      );
    END IF;
  END LOOP;

  UPDATE public.compras
     SET status = 'cancelada',
         observacoes = COALESCE(observacoes,'') ||
                       CASE WHEN p_motivo IS NOT NULL THEN E'\n[ESTORNO] ' || p_motivo ELSE '' END,
         updated_at = now()
   WHERE id = p_compra_id;

  IF v_pedido_id IS NOT NULL THEN
    SELECT COALESCE(SUM(quantidade),0) INTO v_qtd_pedida
      FROM public.pedidos_compra_itens WHERE pedido_compra_id = v_pedido_id;
    SELECT COALESCE(SUM(ci.quantidade),0) INTO v_qtd_recebida
      FROM public.compras_itens ci JOIN public.compras c ON c.id = ci.compra_id
     WHERE c.pedido_compra_id = v_pedido_id AND c.status = 'confirmada';

    IF v_qtd_recebida <= 0 THEN
      v_status := 'aprovado';
    ELSIF v_qtd_recebida >= v_qtd_pedida THEN
      v_status := 'recebido';
    ELSE
      v_status := 'recebido_parcial';
    END IF;

    UPDATE public.pedidos_compra SET status = v_status, updated_at = now() WHERE id = v_pedido_id;
  END IF;

  RETURN jsonb_build_object('compra_id', p_compra_id, 'pedido_id', v_pedido_id, 'status_pedido', v_status);
END;
$$;