
-- ============================================================
-- FASE 1: Tabela genérica de comentários polimórficos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade_tipo TEXT NOT NULL,
  entidade_id UUID NOT NULL,
  usuario_id UUID NOT NULL,
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comentarios_entidade
  ON public.comentarios(entidade_tipo, entidade_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comentarios_usuario
  ON public.comentarios(usuario_id);

ALTER TABLE public.comentarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comentarios_select_authenticated" ON public.comentarios;
CREATE POLICY "comentarios_select_authenticated"
  ON public.comentarios FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "comentarios_insert_owner" ON public.comentarios;
CREATE POLICY "comentarios_insert_owner"
  ON public.comentarios FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "comentarios_update_owner_or_admin" ON public.comentarios;
CREATE POLICY "comentarios_update_owner_or_admin"
  ON public.comentarios FOR UPDATE
  TO authenticated
  USING (auth.uid() = usuario_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "comentarios_delete_owner_or_admin" ON public.comentarios;
CREATE POLICY "comentarios_delete_owner_or_admin"
  ON public.comentarios FOR DELETE
  TO authenticated
  USING (auth.uid() = usuario_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_comentarios_updated_at
  BEFORE UPDATE ON public.comentarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- FASE 4: Triggers anti-exclusão de contas em uso
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_delete_conta_bancaria_em_uso()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.ativo = true AND NEW.ativo = false) THEN
    IF EXISTS (
      SELECT 1 FROM public.financeiro_lancamentos
      WHERE conta_bancaria_id = OLD.id AND ativo = true AND status IN ('aberto','parcial')
    ) THEN
      RAISE EXCEPTION 'Conta bancária % possui lançamentos financeiros em aberto e não pode ser excluída/inativada', OLD.descricao
        USING ERRCODE = 'foreign_key_violation';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.financeiro_baixas WHERE conta_bancaria_id = OLD.id LIMIT 1
    ) AND TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Conta bancária % possui histórico de baixas e não pode ser excluída', OLD.descricao
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_conta_bancaria ON public.contas_bancarias;
CREATE TRIGGER trg_prevent_delete_conta_bancaria
  BEFORE DELETE OR UPDATE ON public.contas_bancarias
  FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_conta_bancaria_em_uso();

CREATE OR REPLACE FUNCTION public.prevent_delete_conta_contabil_em_uso()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.ativo = true AND NEW.ativo = false) THEN
    IF EXISTS (
      SELECT 1 FROM public.financeiro_lancamentos
      WHERE conta_contabil_id = OLD.id AND ativo = true LIMIT 1
    ) THEN
      RAISE EXCEPTION 'Conta contábil % possui lançamentos vinculados e não pode ser excluída/inativada', OLD.descricao
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_conta_contabil ON public.contas_contabeis;
CREATE TRIGGER trg_prevent_delete_conta_contabil
  BEFORE DELETE OR UPDATE ON public.contas_contabeis
  FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_conta_contabil_em_uso();

-- ============================================================
-- FASE 5: Triggers de auditoria em config
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_config_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dados_ant JSONB;
  v_dados_novo JSONB;
  v_registro_id TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_dados_novo := to_jsonb(NEW);
    v_registro_id := NEW.id::text;
  ELSIF TG_OP = 'UPDATE' THEN
    v_dados_ant := to_jsonb(OLD);
    v_dados_novo := to_jsonb(NEW);
    v_registro_id := NEW.id::text;
  ELSE
    v_dados_ant := to_jsonb(OLD);
    v_registro_id := OLD.id::text;
  END IF;

  INSERT INTO public.auditoria_logs (acao, tabela, registro_id, dados_anteriores, dados_novos, usuario_id)
  VALUES (TG_OP, TG_TABLE_NAME, v_registro_id, v_dados_ant, v_dados_novo, auth.uid());

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_empresa_config ON public.empresa_config;
CREATE TRIGGER trg_audit_empresa_config
  AFTER INSERT OR UPDATE OR DELETE ON public.empresa_config
  FOR EACH ROW EXECUTE FUNCTION public.audit_config_changes();

DROP TRIGGER IF EXISTS trg_audit_app_configuracoes ON public.app_configuracoes;
CREATE TRIGGER trg_audit_app_configuracoes
  AFTER INSERT OR UPDATE OR DELETE ON public.app_configuracoes
  FOR EACH ROW EXECUTE FUNCTION public.audit_config_changes();

-- ============================================================
-- FASE 6: Índices de performance (apenas os ainda faltantes)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_fin_lanc_venc_status_tipo
  ON public.financeiro_lancamentos(data_vencimento, status, tipo)
  WHERE ativo = true;

CREATE INDEX IF NOT EXISTS idx_estoque_mov_produto_created
  ON public.estoque_movimentos(produto_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente_status
  ON public.orcamentos(cliente_id, status);

CREATE INDEX IF NOT EXISTS idx_produtos_fornecedores_produto
  ON public.produtos_fornecedores(produto_id);

CREATE INDEX IF NOT EXISTS idx_produtos_fornecedores_fornecedor
  ON public.produtos_fornecedores(fornecedor_id);

-- ============================================================
-- FASE 8: Hash anti-duplicidade em importacao_lotes
-- ============================================================
ALTER TABLE public.importacao_lotes
  ADD COLUMN IF NOT EXISTS hash_conteudo TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_importacao_lotes_hash
  ON public.importacao_lotes(hash_conteudo)
  WHERE hash_conteudo IS NOT NULL;

-- ============================================================
-- FASE 3: quantidade_recebida em pedidos_compra_itens + RPC
-- ============================================================
ALTER TABLE public.pedidos_compra_itens
  ADD COLUMN IF NOT EXISTS quantidade_recebida NUMERIC NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.receber_compra(p_pedido_id uuid, p_data_recebimento date, p_itens jsonb, p_observacoes text DEFAULT NULL::text)
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
  v_item_pedido_id uuid;
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
    v_item_pedido_id := NULLIF(v_item->>'item_pedido_id','')::uuid;
    IF v_qtd_rec <= 0 THEN CONTINUE; END IF;
    v_subtotal := v_qtd_rec * v_valor_unit;

    INSERT INTO public.compras_itens (
      compra_id, produto_id, descricao, quantidade, valor_unitario, valor_total
    ) VALUES (
      v_compra_id, v_produto_id, v_item->>'descricao',
      v_qtd_rec, v_valor_unit, v_subtotal
    );
    v_valor_prod := v_valor_prod + v_subtotal;

    -- Incrementa quantidade_recebida no item do pedido (se identificado)
    IF v_item_pedido_id IS NOT NULL THEN
      UPDATE public.pedidos_compra_itens
        SET quantidade_recebida = COALESCE(quantidade_recebida,0) + v_qtd_rec
       WHERE id = v_item_pedido_id;
    ELSIF v_produto_id IS NOT NULL THEN
      UPDATE public.pedidos_compra_itens
        SET quantidade_recebida = COALESCE(quantidade_recebida,0) + v_qtd_rec
       WHERE id = (
         SELECT id FROM public.pedidos_compra_itens
          WHERE pedido_compra_id = p_pedido_id
            AND produto_id = v_produto_id
            AND COALESCE(quantidade_recebida,0) < COALESCE(quantidade,0)
          ORDER BY id LIMIT 1
       );
    END IF;

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

  -- Recalcula status do pedido com base em quantidade_recebida real
  SELECT COALESCE(SUM(quantidade),0), COALESCE(SUM(quantidade_recebida),0)
    INTO v_qtd_total_pedida, v_qtd_total_recebida
    FROM public.pedidos_compra_itens WHERE pedido_compra_id = p_pedido_id;

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

-- ============================================================
-- FASE 7: Tabela orcamento_drafts (rascunhos server-side)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.orcamento_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL,
  draft_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, draft_key)
);

CREATE INDEX IF NOT EXISTS idx_orcamento_drafts_user
  ON public.orcamento_drafts(usuario_id, updated_at DESC);

ALTER TABLE public.orcamento_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drafts_select_owner" ON public.orcamento_drafts;
CREATE POLICY "drafts_select_owner" ON public.orcamento_drafts
  FOR SELECT TO authenticated USING (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "drafts_insert_owner" ON public.orcamento_drafts;
CREATE POLICY "drafts_insert_owner" ON public.orcamento_drafts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "drafts_update_owner" ON public.orcamento_drafts;
CREATE POLICY "drafts_update_owner" ON public.orcamento_drafts
  FOR UPDATE TO authenticated USING (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "drafts_delete_owner" ON public.orcamento_drafts;
CREATE POLICY "drafts_delete_owner" ON public.orcamento_drafts
  FOR DELETE TO authenticated USING (auth.uid() = usuario_id);

CREATE TRIGGER trg_orcamento_drafts_updated_at
  BEFORE UPDATE ON public.orcamento_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- FASE 2: Workflow de aprovação de pedidos de compra
-- ============================================================
ALTER TABLE public.pedidos_compra
  ADD COLUMN IF NOT EXISTS requer_aprovacao BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aprovado_por UUID,
  ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao TEXT;

INSERT INTO public.app_configuracoes (chave, valor)
VALUES ('compras.limite_aprovacao', jsonb_build_object('valor', 0, 'descricao', 'Limite acima do qual pedidos de compra requerem aprovação. 0 = sem limite/sem aprovação obrigatória.'))
ON CONFLICT (chave) DO NOTHING;

CREATE OR REPLACE FUNCTION public.solicitar_aprovacao_pedido(p_pedido_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido RECORD;
  v_limite NUMERIC;
  v_novo_status TEXT;
BEGIN
  SELECT * INTO v_pedido FROM public.pedidos_compra WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;

  SELECT COALESCE((valor->>'valor')::numeric, 0) INTO v_limite
    FROM public.app_configuracoes WHERE chave = 'compras.limite_aprovacao';

  IF v_limite > 0 AND COALESCE(v_pedido.valor_total,0) >= v_limite THEN
    v_novo_status := 'aguardando_aprovacao';
    UPDATE public.pedidos_compra
       SET status = v_novo_status,
           requer_aprovacao = true,
           aprovado_por = NULL,
           aprovado_em = NULL,
           motivo_rejeicao = NULL,
           updated_at = now()
     WHERE id = p_pedido_id;
  ELSE
    v_novo_status := 'aprovado';
    UPDATE public.pedidos_compra
       SET status = v_novo_status,
           requer_aprovacao = false,
           aprovado_por = auth.uid(),
           aprovado_em = now(),
           updated_at = now()
     WHERE id = p_pedido_id;
  END IF;

  RETURN jsonb_build_object('status', v_novo_status, 'limite', v_limite, 'valor_pedido', v_pedido.valor_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.aprovar_pedido(p_pedido_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem aprovar pedidos';
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos_compra WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_pedido.status <> 'aguardando_aprovacao' THEN
    RAISE EXCEPTION 'Pedido com status % não pode ser aprovado', v_pedido.status;
  END IF;

  UPDATE public.pedidos_compra
     SET status = 'aprovado',
         aprovado_por = auth.uid(),
         aprovado_em = now(),
         motivo_rejeicao = NULL,
         updated_at = now()
   WHERE id = p_pedido_id;

  RETURN jsonb_build_object('status', 'aprovado', 'aprovado_por', auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.rejeitar_pedido(p_pedido_id uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem rejeitar pedidos';
  END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN
    RAISE EXCEPTION 'Informe o motivo da rejeição';
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos_compra WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_pedido.status <> 'aguardando_aprovacao' THEN
    RAISE EXCEPTION 'Pedido com status % não pode ser rejeitado', v_pedido.status;
  END IF;

  UPDATE public.pedidos_compra
     SET status = 'rejeitado',
         motivo_rejeicao = p_motivo,
         aprovado_por = auth.uid(),
         aprovado_em = now(),
         updated_at = now()
   WHERE id = p_pedido_id;

  RETURN jsonb_build_object('status', 'rejeitado', 'motivo', p_motivo);
END;
$$;
