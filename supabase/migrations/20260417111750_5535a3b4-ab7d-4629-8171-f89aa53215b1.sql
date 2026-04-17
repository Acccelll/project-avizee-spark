-- =============================================================
-- ROUND 3 — SUPRIMENTOS/LOGÍSTICA
-- =============================================================

-- 1. DROPAR constraint antiga antes de sanear -----------------
ALTER TABLE public.remessas DROP CONSTRAINT IF EXISTS chk_remessas_status_transporte;

-- 2. Saneamento de status legados ----------------------------
UPDATE public.remessas SET status_transporte = 'expedido'
  WHERE status_transporte = 'coletado';
UPDATE public.remessas
   SET status_transporte = 'aguardando_separacao'
 WHERE status_transporte IS NULL
    OR btrim(status_transporte) = ''
    OR status_transporte NOT IN (
      'aguardando_separacao','separado','expedido','em_transito',
      'entregue','devolvido','cancelado'
    );

-- 3. Recria CHECK constraint com novos valores ---------------
ALTER TABLE public.remessas
  ADD CONSTRAINT chk_remessas_status_transporte
  CHECK (status_transporte IN (
    'aguardando_separacao','separado','expedido','em_transito',
    'entregue','devolvido','cancelado'
  ));

-- 4. Colunas auxiliares para lifecycle -----------------------
ALTER TABLE public.remessas
  ADD COLUMN IF NOT EXISTS data_expedicao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_entrega_real TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;

-- 5. Tabela remessa_itens (1:N pedido↔remessa) ---------------
CREATE TABLE IF NOT EXISTS public.remessa_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remessa_id UUID NOT NULL REFERENCES public.remessas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id),
  ordem_venda_item_id UUID REFERENCES public.ordens_venda_itens(id),
  quantidade NUMERIC NOT NULL CHECK (quantidade > 0),
  peso_unitario NUMERIC DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_remessa_itens_remessa ON public.remessa_itens(remessa_id);
CREATE INDEX IF NOT EXISTS idx_remessa_itens_produto ON public.remessa_itens(produto_id);
CREATE INDEX IF NOT EXISTS idx_remessa_itens_ov_item ON public.remessa_itens(ordem_venda_item_id);

ALTER TABLE public.remessa_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ri_select ON public.remessa_itens;
DROP POLICY IF EXISTS ri_insert ON public.remessa_itens;
DROP POLICY IF EXISTS ri_update ON public.remessa_itens;
DROP POLICY IF EXISTS ri_delete ON public.remessa_itens;
CREATE POLICY ri_select ON public.remessa_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY ri_insert ON public.remessa_itens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY ri_update ON public.remessa_itens FOR UPDATE TO authenticated USING (true);
CREATE POLICY ri_delete ON public.remessa_itens FOR DELETE TO authenticated USING (true);

-- 6. RPC: ajustar_estoque_manual ------------------------------
CREATE OR REPLACE FUNCTION public.ajustar_estoque_manual(
  p_produto_id UUID,
  p_tipo TEXT,
  p_quantidade NUMERIC,
  p_motivo TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo_atual NUMERIC; v_novo_saldo NUMERIC;
  v_quantidade_mov NUMERIC; v_mov_id UUID;
BEGIN
  IF p_tipo NOT IN ('entrada','saida','ajuste') THEN
    RAISE EXCEPTION 'tipo invalido: %', p_tipo;
  END IF;
  IF p_quantidade IS NULL OR p_quantidade < 0 THEN
    RAISE EXCEPTION 'quantidade invalida';
  END IF;
  SELECT COALESCE(estoque_atual,0) INTO v_saldo_atual
    FROM public.produtos WHERE id = p_produto_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'produto % nao encontrado', p_produto_id;
  END IF;
  IF p_tipo = 'entrada' THEN
    v_novo_saldo := v_saldo_atual + p_quantidade;
    v_quantidade_mov := p_quantidade;
  ELSIF p_tipo = 'saida' THEN
    v_novo_saldo := v_saldo_atual - p_quantidade;
    v_quantidade_mov := p_quantidade;
  ELSE
    v_novo_saldo := p_quantidade;
    v_quantidade_mov := p_quantidade - v_saldo_atual;
  END IF;
  INSERT INTO public.estoque_movimentos
    (produto_id, tipo, quantidade, saldo_anterior, saldo_atual,
     motivo, documento_tipo, usuario_id)
  VALUES
    (p_produto_id, p_tipo, v_quantidade_mov, v_saldo_atual, v_novo_saldo,
     p_motivo, 'ajuste_manual', auth.uid())
  RETURNING id INTO v_mov_id;
  UPDATE public.produtos SET estoque_atual = v_novo_saldo, updated_at = now()
   WHERE id = p_produto_id;
  RETURN v_mov_id;
END; $$;
REVOKE ALL ON FUNCTION public.ajustar_estoque_manual(UUID, TEXT, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ajustar_estoque_manual(UUID, TEXT, NUMERIC, TEXT) TO authenticated;

-- 7. RPC: expedir_remessa -------------------------------------
CREATE OR REPLACE FUNCTION public.expedir_remessa(
  p_remessa_id UUID,
  p_data_expedicao TIMESTAMPTZ DEFAULT now()
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r_item RECORD; v_status TEXT; v_saldo NUMERIC;
BEGIN
  SELECT status_transporte INTO v_status FROM public.remessas
   WHERE id = p_remessa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'remessa % nao encontrada', p_remessa_id; END IF;
  IF v_status NOT IN ('aguardando_separacao','separado') THEN
    RAISE EXCEPTION 'remessa nao pode ser expedida no status %', v_status;
  END IF;
  FOR r_item IN SELECT produto_id, quantidade FROM public.remessa_itens
                 WHERE remessa_id = p_remessa_id LOOP
    SELECT COALESCE(estoque_atual,0) INTO v_saldo FROM public.produtos
     WHERE id = r_item.produto_id FOR UPDATE;
    INSERT INTO public.estoque_movimentos
      (produto_id, tipo, quantidade, saldo_anterior, saldo_atual,
       motivo, documento_tipo, documento_id, usuario_id)
    VALUES (r_item.produto_id, 'saida', r_item.quantidade, v_saldo,
            v_saldo - r_item.quantidade, 'Expedicao de remessa',
            'remessa', p_remessa_id, auth.uid());
    UPDATE public.produtos SET estoque_atual = v_saldo - r_item.quantidade,
                                updated_at = now()
     WHERE id = r_item.produto_id;
  END LOOP;
  UPDATE public.remessas
     SET status_transporte = 'expedido',
         data_expedicao = p_data_expedicao,
         data_postagem = COALESCE(data_postagem, p_data_expedicao::date),
         updated_at = now()
   WHERE id = p_remessa_id;
END; $$;
REVOKE ALL ON FUNCTION public.expedir_remessa(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expedir_remessa(UUID, TIMESTAMPTZ) TO authenticated;

-- 8. RPC: marcar_remessa_em_transito --------------------------
CREATE OR REPLACE FUNCTION public.marcar_remessa_em_transito(p_remessa_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.remessas SET status_transporte='em_transito', updated_at=now()
   WHERE id=p_remessa_id AND status_transporte IN ('expedido','separado');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'remessa % nao pode ir para em_transito', p_remessa_id;
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.marcar_remessa_em_transito(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marcar_remessa_em_transito(UUID) TO authenticated;

-- 9. RPC: marcar_remessa_entregue -----------------------------
CREATE OR REPLACE FUNCTION public.marcar_remessa_entregue(
  p_remessa_id UUID,
  p_data_entrega TIMESTAMPTZ DEFAULT now()
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.remessas
     SET status_transporte='entregue', data_entrega_real=p_data_entrega, updated_at=now()
   WHERE id=p_remessa_id AND status_transporte IN ('em_transito','expedido');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'remessa % nao pode ser marcada entregue', p_remessa_id;
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.marcar_remessa_entregue(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marcar_remessa_entregue(UUID, TIMESTAMPTZ) TO authenticated;

-- 10. RPC: cancelar_remessa ----------------------------------
CREATE OR REPLACE FUNCTION public.cancelar_remessa(
  p_remessa_id UUID,
  p_motivo TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r_item RECORD; v_status TEXT; v_saldo NUMERIC;
BEGIN
  SELECT status_transporte INTO v_status FROM public.remessas
   WHERE id=p_remessa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'remessa % nao encontrada', p_remessa_id; END IF;
  IF v_status IN ('entregue','cancelado') THEN
    RAISE EXCEPTION 'remessa nao pode ser cancelada (status %)', v_status;
  END IF;
  IF v_status IN ('expedido','em_transito') THEN
    FOR r_item IN SELECT produto_id, quantidade FROM public.remessa_itens
                   WHERE remessa_id=p_remessa_id LOOP
      SELECT COALESCE(estoque_atual,0) INTO v_saldo FROM public.produtos
       WHERE id=r_item.produto_id FOR UPDATE;
      INSERT INTO public.estoque_movimentos
        (produto_id, tipo, quantidade, saldo_anterior, saldo_atual,
         motivo, documento_tipo, documento_id, usuario_id)
      VALUES (r_item.produto_id, 'entrada', r_item.quantidade, v_saldo,
              v_saldo + r_item.quantidade, 'Estorno de remessa cancelada',
              'remessa_cancelamento', p_remessa_id, auth.uid());
      UPDATE public.produtos SET estoque_atual=v_saldo+r_item.quantidade, updated_at=now()
       WHERE id=r_item.produto_id;
    END LOOP;
  END IF;
  UPDATE public.remessas
     SET status_transporte='cancelado', motivo_cancelamento=p_motivo, updated_at=now()
   WHERE id=p_remessa_id;
END; $$;
REVOKE ALL ON FUNCTION public.cancelar_remessa(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancelar_remessa(UUID, TEXT) TO authenticated;