
-- ---------- B1. COTACAO STATUS CANONICO ----------
UPDATE public.cotacoes_compra SET status = 'aprovada' WHERE status = 'finalizada';

ALTER TABLE public.cotacoes_compra DROP CONSTRAINT IF EXISTS chk_cotacoes_compra_status;
ALTER TABLE public.cotacoes_compra ADD CONSTRAINT chk_cotacoes_compra_status
  CHECK (status IN ('rascunho','aberta','em_analise','aguardando_aprovacao','aprovada','convertida','rejeitada','cancelada'));

CREATE OR REPLACE FUNCTION public.fn_cotacao_compra_transicao()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_old text := COALESCE(OLD.status,'rascunho'); v_new text := NEW.status; v_ok boolean := false;
BEGIN
  IF v_old = v_new THEN RETURN NEW; END IF;
  IF v_old IN ('convertida','cancelada','rejeitada') THEN
    RAISE EXCEPTION 'Cotação em status terminal (%): transição para % não permitida', v_old, v_new;
  END IF;
  v_ok := CASE
    WHEN v_old = 'rascunho'              AND v_new IN ('aberta','cancelada') THEN true
    WHEN v_old = 'aberta'                AND v_new IN ('em_analise','aguardando_aprovacao','cancelada') THEN true
    WHEN v_old = 'em_analise'            AND v_new IN ('aguardando_aprovacao','aberta','cancelada') THEN true
    WHEN v_old = 'aguardando_aprovacao'  AND v_new IN ('aprovada','rejeitada','em_analise','cancelada') THEN true
    WHEN v_old = 'aprovada'              AND v_new IN ('convertida','cancelada') THEN true
    ELSE false END;
  IF NOT v_ok THEN RAISE EXCEPTION 'Transição inválida de status de cotação: % -> %', v_old, v_new; END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_cotacao_compra_transicao ON public.cotacoes_compra;
CREATE TRIGGER trg_cotacao_compra_transicao BEFORE UPDATE OF status ON public.cotacoes_compra
  FOR EACH ROW EXECUTE FUNCTION public.fn_cotacao_compra_transicao();

CREATE OR REPLACE FUNCTION public.fn_cotacao_compra_protege_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status <> 'rascunho' THEN
    RAISE EXCEPTION 'Cotação % não pode ser excluída (status=%). Use cancelar_cotacao_compra.', OLD.id, OLD.status;
  END IF;
  IF EXISTS (SELECT 1 FROM public.pedidos_compra WHERE cotacao_compra_id = OLD.id) THEN
    RAISE EXCEPTION 'Cotação % possui pedido vinculado e não pode ser excluída.', OLD.id;
  END IF;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_cotacao_compra_protege_delete ON public.cotacoes_compra;
CREATE TRIGGER trg_cotacao_compra_protege_delete BEFORE DELETE ON public.cotacoes_compra
  FOR EACH ROW EXECUTE FUNCTION public.fn_cotacao_compra_protege_delete();

CREATE OR REPLACE FUNCTION public.cancelar_cotacao_compra(p_id uuid, p_motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old text;
BEGIN
  SELECT status INTO v_old FROM public.cotacoes_compra WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotação % não encontrada', p_id; END IF;
  IF v_old IN ('convertida','cancelada','rejeitada') THEN
    RAISE EXCEPTION 'Cotação em status terminal (%): cancelamento não permitido', v_old;
  END IF;
  UPDATE public.cotacoes_compra SET status = 'cancelada',
         observacoes = COALESCE(observacoes,'') || CASE WHEN p_motivo IS NOT NULL THEN E'\n[CANCELAMENTO] ' || p_motivo ELSE '' END,
         updated_at = now() WHERE id = p_id;
  INSERT INTO public.auditoria_logs (tabela, acao, registro_id, usuario_id, dados_anteriores, dados_novos)
  VALUES ('cotacoes_compra','cancelar_cotacao_compra',p_id::text,auth.uid(),
          jsonb_build_object('status',v_old), jsonb_build_object('status','cancelada','motivo',p_motivo));
  RETURN jsonb_build_object('cotacao_id',p_id,'status','cancelada');
END; $$;

-- ---------- B2. PEDIDO STATUS CANONICO ----------
UPDATE public.pedidos_compra SET status = 'parcialmente_recebido' WHERE status = 'recebido_parcial';
UPDATE public.pedidos_compra SET status = 'enviado_ao_fornecedor' WHERE status = 'enviado';

ALTER TABLE public.pedidos_compra DROP CONSTRAINT IF EXISTS chk_pedidos_compra_status;
ALTER TABLE public.pedidos_compra ADD CONSTRAINT chk_pedidos_compra_status
  CHECK (status IN ('rascunho','aguardando_aprovacao','aprovado','enviado_ao_fornecedor','aguardando_recebimento','parcialmente_recebido','recebido','cancelado'));

CREATE OR REPLACE FUNCTION public.fn_pedido_compra_transicao()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_old text := COALESCE(OLD.status,'rascunho'); v_new text := NEW.status; v_ok boolean := false;
BEGIN
  IF v_old = v_new THEN RETURN NEW; END IF;
  IF v_old IN ('recebido','cancelado') THEN
    RAISE EXCEPTION 'Pedido em status terminal (%): transição para % não permitida', v_old, v_new;
  END IF;
  v_ok := CASE
    WHEN v_old = 'rascunho'                AND v_new IN ('aguardando_aprovacao','aprovado','cancelado') THEN true
    WHEN v_old = 'aguardando_aprovacao'    AND v_new IN ('aprovado','rascunho','cancelado') THEN true
    WHEN v_old = 'aprovado'                AND v_new IN ('enviado_ao_fornecedor','aguardando_recebimento','parcialmente_recebido','recebido','cancelado') THEN true
    WHEN v_old = 'enviado_ao_fornecedor'   AND v_new IN ('aguardando_recebimento','parcialmente_recebido','recebido','cancelado') THEN true
    WHEN v_old = 'aguardando_recebimento'  AND v_new IN ('parcialmente_recebido','recebido','cancelado') THEN true
    WHEN v_old = 'parcialmente_recebido'   AND v_new IN ('recebido','aprovado') THEN true
    ELSE false END;
  IF NOT v_ok THEN RAISE EXCEPTION 'Transição inválida de status de pedido: % -> %', v_old, v_new; END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_pedido_compra_transicao ON public.pedidos_compra;
CREATE TRIGGER trg_pedido_compra_transicao BEFORE UPDATE OF status ON public.pedidos_compra
  FOR EACH ROW EXECUTE FUNCTION public.fn_pedido_compra_transicao();

-- ---------- B7. CONDICAO_PAGAMENTO ----------
UPDATE public.pedidos_compra
   SET condicao_pagamento = COALESCE(condicao_pagamento, condicoes_pagamento)
 WHERE condicao_pagamento IS NULL AND condicoes_pagamento IS NOT NULL;
COMMENT ON COLUMN public.pedidos_compra.condicoes_pagamento IS 'DEPRECATED: usar condicao_pagamento';

-- ---------- B8. INTEGRIDADE ----------
ALTER TABLE public.pedidos_compra_itens
  ADD COLUMN IF NOT EXISTS proposta_selecionada_id uuid
  REFERENCES public.cotacoes_compra_propostas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cotacao_propostas_cotacao_id ON public.cotacoes_compra_propostas(cotacao_compra_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_compra_cotacao_id ON public.pedidos_compra(cotacao_compra_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_compra_fornecedor_status ON public.pedidos_compra(fornecedor_id, status);
CREATE INDEX IF NOT EXISTS idx_compras_pedido_id ON public.compras(pedido_compra_id);

DO $$ DECLARE v_dup int;
BEGIN
  SELECT COUNT(*) INTO v_dup FROM (SELECT item_id, fornecedor_id FROM public.cotacoes_compra_propostas
    WHERE item_id IS NOT NULL GROUP BY item_id, fornecedor_id HAVING COUNT(*) > 1) d;
  IF v_dup = 0 THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS ux_cotacao_propostas_item_fornecedor
             ON public.cotacoes_compra_propostas(item_id, fornecedor_id) WHERE item_id IS NOT NULL';
  ELSE RAISE NOTICE 'Pulando ux_cotacao_propostas_item_fornecedor: % duplicatas', v_dup; END IF;
END $$;

DO $$ DECLARE v_dup int;
BEGIN
  SELECT COUNT(*) INTO v_dup FROM (SELECT cotacao_compra_id FROM public.pedidos_compra
    WHERE cotacao_compra_id IS NOT NULL GROUP BY cotacao_compra_id HAVING COUNT(*) > 1) d;
  IF v_dup = 0 THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS ux_pedidos_compra_cotacao_id
             ON public.pedidos_compra(cotacao_compra_id) WHERE cotacao_compra_id IS NOT NULL';
  ELSE RAISE NOTICE 'Pulando ux_pedidos_compra_cotacao_id: % duplicatas', v_dup; END IF;
END $$;

-- ---------- B3. gerar_pedido_compra v2 ----------
CREATE OR REPLACE FUNCTION public.gerar_pedido_compra(p_cotacao_id uuid, p_observacoes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cotacao RECORD; v_existing uuid; v_existing_numero text;
  v_numero text; v_pedido_id uuid; v_fornecedor_id uuid;
  v_valor_total numeric := 0; v_item RECORD; v_pendentes int;
BEGIN
  SELECT * INTO v_cotacao FROM public.cotacoes_compra WHERE id = p_cotacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotação % não encontrada', p_cotacao_id; END IF;

  SELECT id, numero INTO v_existing, v_existing_numero
    FROM public.pedidos_compra WHERE cotacao_compra_id = p_cotacao_id LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('pedido_id',v_existing,'pedido_numero',v_existing_numero,'idempotente',true);
  END IF;

  IF v_cotacao.status <> 'aprovada' THEN
    RAISE EXCEPTION 'Cotação deve estar aprovada (status atual: %)', v_cotacao.status;
  END IF;

  SELECT COUNT(*) INTO v_pendentes FROM public.cotacoes_compra_itens i
    WHERE i.cotacao_compra_id = p_cotacao_id
      AND NOT EXISTS (SELECT 1 FROM public.cotacoes_compra_propostas p
        WHERE p.item_id = i.id AND p.selecionado = true AND COALESCE(p.preco_unitario,0) > 0);
  IF v_pendentes > 0 THEN RAISE EXCEPTION 'Existem % itens sem proposta selecionada válida', v_pendentes; END IF;

  SELECT DISTINCT fornecedor_id INTO v_fornecedor_id FROM public.cotacoes_compra_propostas
    WHERE cotacao_compra_id = p_cotacao_id AND selecionado = true LIMIT 1;

  v_numero := public.proximo_numero_pedido_compra();

  INSERT INTO public.pedidos_compra (numero, fornecedor_id, data_pedido, valor_total, status, observacoes, cotacao_compra_id)
  VALUES (v_numero, v_fornecedor_id, CURRENT_DATE, 0, 'aprovado',
          COALESCE(p_observacoes, v_cotacao.observacoes), p_cotacao_id) RETURNING id INTO v_pedido_id;

  FOR v_item IN
    SELECT i.id AS item_id, i.produto_id, i.quantidade, p.id AS proposta_id, COALESCE(p.preco_unitario,0) AS preco_unitario
      FROM public.cotacoes_compra_itens i
      JOIN public.cotacoes_compra_propostas p ON p.item_id = i.id AND p.selecionado = true
     WHERE i.cotacao_compra_id = p_cotacao_id
  LOOP
    INSERT INTO public.pedidos_compra_itens (pedido_compra_id, produto_id, quantidade, preco_unitario, subtotal, proposta_selecionada_id)
    VALUES (v_pedido_id, v_item.produto_id, v_item.quantidade, v_item.preco_unitario,
            v_item.preco_unitario * COALESCE(v_item.quantidade,0), v_item.proposta_id);
    v_valor_total := v_valor_total + v_item.preco_unitario * COALESCE(v_item.quantidade,0);
  END LOOP;

  UPDATE public.pedidos_compra SET valor_total = v_valor_total WHERE id = v_pedido_id;
  UPDATE public.cotacoes_compra SET status = 'convertida', updated_at = now() WHERE id = p_cotacao_id;

  INSERT INTO public.auditoria_logs (tabela, acao, registro_id, usuario_id, dados_novos)
  VALUES ('pedidos_compra','gerar_pedido_compra',v_pedido_id::text,auth.uid(),
          jsonb_build_object('cotacao_id',p_cotacao_id,'pedido_numero',v_numero,'valor_total',v_valor_total));

  RETURN jsonb_build_object('pedido_id',v_pedido_id,'pedido_numero',v_numero,'valor_total',v_valor_total);
END; $$;

-- ---------- B4. receber_compra v2 ----------
CREATE OR REPLACE FUNCTION public.receber_compra(p_pedido_id uuid, p_data_recebimento date, p_itens jsonb, p_observacoes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pedido RECORD; v_compra_id uuid; v_numero text; v_item jsonb;
  v_qtd_pedida numeric; v_qtd_recebida numeric; v_qtd_nova numeric;
  v_status text; v_valor_total numeric := 0; v_saldo_ant numeric;
  v_produto_id uuid; v_qtd_pedido numeric; v_qtd_ja_rec numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_pedido_id::text));

  SELECT * INTO v_pedido FROM public.pedidos_compra WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido % não encontrado', p_pedido_id; END IF;
  IF v_pedido.status NOT IN ('aprovado','enviado_ao_fornecedor','aguardando_recebimento','parcialmente_recebido') THEN
    RAISE EXCEPTION 'Pedido em status inválido para recebimento: %', v_pedido.status;
  END IF;

  -- Validação de quantidades
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_produto_id := NULLIF(v_item->>'produto_id','')::uuid;
    v_qtd_nova := COALESCE((v_item->>'quantidade_recebida')::numeric, 0);
    IF v_qtd_nova <= 0 OR v_produto_id IS NULL THEN CONTINUE; END IF;
    SELECT quantidade, COALESCE(quantidade_recebida,0) INTO v_qtd_pedido, v_qtd_ja_rec
      FROM public.pedidos_compra_itens
     WHERE pedido_compra_id = p_pedido_id AND produto_id = v_produto_id LIMIT 1;
    IF FOUND AND v_qtd_nova > (v_qtd_pedido - v_qtd_ja_rec) THEN
      RAISE EXCEPTION 'Quantidade recebida (%) excede saldo pendente (%) do produto %',
        v_qtd_nova, (v_qtd_pedido - v_qtd_ja_rec), v_produto_id;
    END IF;
  END LOOP;

  v_numero := 'CMP-' || to_char(now(),'YYYYMMDDHH24MISS');
  INSERT INTO public.compras (numero, fornecedor_id, data_compra, data_entrega_real, pedido_compra_id, status, observacoes, valor_total)
  VALUES (v_numero, v_pedido.fornecedor_id, p_data_recebimento, p_data_recebimento, p_pedido_id, 'confirmada', p_observacoes, 0)
  RETURNING id INTO v_compra_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_produto_id := NULLIF(v_item->>'produto_id','')::uuid;
    v_qtd_nova := COALESCE((v_item->>'quantidade_recebida')::numeric, 0);
    IF v_qtd_nova <= 0 THEN CONTINUE; END IF;

    INSERT INTO public.compras_itens (compra_id, produto_id, descricao, quantidade, valor_unitario, valor_total)
    VALUES (v_compra_id, v_produto_id, v_item->>'descricao', v_qtd_nova,
            COALESCE((v_item->>'valor_unitario')::numeric,0),
            v_qtd_nova * COALESCE((v_item->>'valor_unitario')::numeric,0));

    v_valor_total := v_valor_total + v_qtd_nova * COALESCE((v_item->>'valor_unitario')::numeric,0);

    IF v_produto_id IS NOT NULL THEN
      SELECT COALESCE(estoque_atual,0) INTO v_saldo_ant FROM public.produtos WHERE id = v_produto_id;
      INSERT INTO public.estoque_movimentos (produto_id, tipo, quantidade, saldo_anterior, saldo_atual, documento_id, documento_tipo, motivo)
      VALUES (v_produto_id, 'entrada', v_qtd_nova, v_saldo_ant, v_saldo_ant + v_qtd_nova, v_compra_id, 'compra', 'Recebimento de compra ' || v_numero);

      UPDATE public.pedidos_compra_itens
         SET quantidade_recebida = COALESCE(quantidade_recebida,0) + v_qtd_nova
       WHERE pedido_compra_id = p_pedido_id AND produto_id = v_produto_id;
    END IF;
  END LOOP;

  UPDATE public.compras SET valor_total = v_valor_total WHERE id = v_compra_id;

  SELECT COALESCE(SUM(quantidade),0), COALESCE(SUM(quantidade_recebida),0)
    INTO v_qtd_pedida, v_qtd_recebida
    FROM public.pedidos_compra_itens WHERE pedido_compra_id = p_pedido_id;

  IF v_qtd_recebida >= v_qtd_pedida AND v_qtd_pedida > 0 THEN v_status := 'recebido';
  ELSIF v_qtd_recebida > 0 THEN v_status := 'parcialmente_recebido';
  ELSE v_status := v_pedido.status; END IF;

  UPDATE public.pedidos_compra SET status = v_status, data_entrega_real = p_data_recebimento, updated_at = now() WHERE id = p_pedido_id;

  INSERT INTO public.auditoria_logs (tabela, acao, registro_id, usuario_id, dados_novos)
  VALUES ('pedidos_compra','receber_compra',p_pedido_id::text,auth.uid(),
          jsonb_build_object('compra_id',v_compra_id,'numero',v_numero,'status_pedido',v_status,'valor_total',v_valor_total));

  RETURN jsonb_build_object('compra_id',v_compra_id,'numero',v_numero,'status_pedido',v_status,'valor_total',v_valor_total);
END; $$;

-- ---------- B5. estornar_recebimento_compra v2 ----------
CREATE OR REPLACE FUNCTION public.estornar_recebimento_compra(p_compra_id uuid, p_motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_compra RECORD; v_pedido_id uuid; v_item RECORD; v_saldo_ant numeric;
  v_qtd_pedida numeric; v_qtd_recebida numeric; v_status text;
BEGIN
  SELECT * INTO v_compra FROM public.compras WHERE id = p_compra_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compra % não encontrada', p_compra_id; END IF;
  IF v_compra.status = 'cancelada' THEN RAISE EXCEPTION 'Compra já está cancelada'; END IF;

  v_pedido_id := v_compra.pedido_compra_id;
  IF v_pedido_id IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtext(v_pedido_id::text)); END IF;

  FOR v_item IN SELECT produto_id, quantidade FROM public.compras_itens WHERE compra_id = p_compra_id LOOP
    IF v_item.produto_id IS NOT NULL THEN
      SELECT COALESCE(estoque_atual,0) INTO v_saldo_ant FROM public.produtos WHERE id = v_item.produto_id;
      INSERT INTO public.estoque_movimentos (produto_id, tipo, quantidade, saldo_anterior, saldo_atual, documento_id, documento_tipo, motivo)
      VALUES (v_item.produto_id, 'saida', v_item.quantidade, v_saldo_ant, v_saldo_ant - v_item.quantidade,
              p_compra_id, 'compra', COALESCE('Estorno: ' || p_motivo, 'Estorno de recebimento'));
      IF v_pedido_id IS NOT NULL THEN
        UPDATE public.pedidos_compra_itens
           SET quantidade_recebida = GREATEST(COALESCE(quantidade_recebida,0) - v_item.quantidade, 0)
         WHERE pedido_compra_id = v_pedido_id AND produto_id = v_item.produto_id;
      END IF;
    END IF;
  END LOOP;

  UPDATE public.compras SET status = 'cancelada',
         observacoes = COALESCE(observacoes,'') || CASE WHEN p_motivo IS NOT NULL THEN E'\n[ESTORNO] ' || p_motivo ELSE '' END,
         updated_at = now() WHERE id = p_compra_id;

  IF v_pedido_id IS NOT NULL THEN
    SELECT COALESCE(SUM(quantidade),0), COALESCE(SUM(quantidade_recebida),0)
      INTO v_qtd_pedida, v_qtd_recebida
      FROM public.pedidos_compra_itens WHERE pedido_compra_id = v_pedido_id;
    IF v_qtd_recebida <= 0 THEN v_status := 'aprovado';
    ELSIF v_qtd_recebida >= v_qtd_pedida THEN v_status := 'recebido';
    ELSE v_status := 'parcialmente_recebido'; END IF;
    UPDATE public.pedidos_compra SET status = v_status, updated_at = now() WHERE id = v_pedido_id;
  END IF;

  INSERT INTO public.auditoria_logs (tabela, acao, registro_id, usuario_id, dados_novos)
  VALUES ('compras','estornar_recebimento_compra',p_compra_id::text,auth.uid(),
          jsonb_build_object('motivo',p_motivo,'pedido_id',v_pedido_id,'status_pedido',v_status));

  RETURN jsonb_build_object('compra_id',p_compra_id,'pedido_id',v_pedido_id,'status_pedido',v_status);
END; $$;

-- ---------- B6. replace_pedido_compra_itens v2 (DROP first - return type changing) ----------
DROP FUNCTION IF EXISTS public.replace_pedido_compra_itens(uuid, jsonb);
CREATE FUNCTION public.replace_pedido_compra_itens(p_pedido_id uuid, p_itens jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text; v_item jsonb; v_total numeric := 0; v_qtd numeric; v_preco numeric;
BEGIN
  SELECT status INTO v_status FROM public.pedidos_compra WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido % não encontrado', p_pedido_id; END IF;
  IF v_status NOT IN ('rascunho','aguardando_aprovacao','aprovado') THEN
    RAISE EXCEPTION 'Edição de itens não permitida no status %', v_status;
  END IF;

  DELETE FROM public.pedidos_compra_itens WHERE pedido_compra_id = p_pedido_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_qtd := COALESCE((v_item->>'quantidade')::numeric,0);
    v_preco := COALESCE((v_item->>'preco_unitario')::numeric, (v_item->>'valor_unitario')::numeric, 0);
    INSERT INTO public.pedidos_compra_itens (pedido_compra_id, produto_id, quantidade, preco_unitario, subtotal)
    VALUES (p_pedido_id, NULLIF(v_item->>'produto_id','')::uuid, v_qtd, v_preco, v_qtd * v_preco);
    v_total := v_total + v_qtd * v_preco;
  END LOOP;

  UPDATE public.pedidos_compra SET valor_total = v_total, updated_at = now() WHERE id = p_pedido_id;
  RETURN jsonb_build_object('pedido_id',p_pedido_id,'valor_total',v_total);
END; $$;

-- ---------- B9. AUDITORIA STATUS ----------
CREATE OR REPLACE FUNCTION public.fn_audit_status_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.auditoria_logs (tabela, acao, registro_id, usuario_id, dados_anteriores, dados_novos)
    VALUES (TG_TABLE_NAME, 'status_change', NEW.id::text, auth.uid(),
            jsonb_build_object('status', OLD.status), jsonb_build_object('status', NEW.status));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_audit_cotacao_compra_status ON public.cotacoes_compra;
CREATE TRIGGER trg_audit_cotacao_compra_status AFTER UPDATE OF status ON public.cotacoes_compra
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_status_change();

DROP TRIGGER IF EXISTS trg_audit_pedido_compra_status ON public.pedidos_compra;
CREATE TRIGGER trg_audit_pedido_compra_status AFTER UPDATE OF status ON public.pedidos_compra
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_status_change();

-- ---------- B10. VIEW v_trilha_compras ----------
DROP VIEW IF EXISTS public.v_trilha_compras;
CREATE VIEW public.v_trilha_compras WITH (security_invoker = true) AS
SELECT
  cc.id AS cotacao_id, cc.numero AS cotacao_numero, cc.status AS cotacao_status,
  pc.id AS pedido_id, pc.numero AS pedido_numero, pc.status AS pedido_status,
  pc.fornecedor_id, f.nome_razao_social AS fornecedor_nome, pc.valor_total AS pedido_valor_total,
  c.id AS compra_id, c.numero AS compra_numero, c.status AS compra_status,
  c.valor_total AS compra_valor_total, c.data_entrega_real
FROM public.cotacoes_compra cc
LEFT JOIN public.pedidos_compra pc ON pc.cotacao_compra_id = cc.id
LEFT JOIN public.fornecedores f    ON f.id = pc.fornecedor_id
LEFT JOIN public.compras c         ON c.pedido_compra_id = pc.id;
