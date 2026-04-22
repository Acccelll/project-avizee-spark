-- Lifecycle RPCs paralelos aos de Pedido — Cotação de Compra
CREATE OR REPLACE FUNCTION public.enviar_cotacao_aprovacao(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cot RECORD;
BEGIN
  SELECT * INTO v_cot FROM public.cotacoes_compra WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;
  IF v_cot.status NOT IN ('aberta','em_analise') THEN
    RAISE EXCEPTION 'Cotação com status % não pode ser enviada para aprovação', v_cot.status;
  END IF;

  UPDATE public.cotacoes_compra
     SET status = 'aguardando_aprovacao',
         updated_at = now()
   WHERE id = p_id;

  INSERT INTO public.auditoria_logs (tabela, registro_id, acao, dados_anteriores, dados_novos, usuario_id)
  VALUES ('cotacoes_compra', p_id::text, 'enviar_aprovacao',
          jsonb_build_object('status', v_cot.status),
          jsonb_build_object('status', 'aguardando_aprovacao'),
          auth.uid());

  RETURN jsonb_build_object('status','aguardando_aprovacao');
END;
$$;

CREATE OR REPLACE FUNCTION public.aprovar_cotacao_compra(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cot RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem aprovar cotações';
  END IF;

  SELECT * INTO v_cot FROM public.cotacoes_compra WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;
  IF v_cot.status NOT IN ('aberta','em_analise','aguardando_aprovacao') THEN
    RAISE EXCEPTION 'Cotação com status % não pode ser aprovada', v_cot.status;
  END IF;

  UPDATE public.cotacoes_compra
     SET status = 'aprovada',
         updated_at = now()
   WHERE id = p_id;

  INSERT INTO public.auditoria_logs (tabela, registro_id, acao, dados_anteriores, dados_novos, usuario_id)
  VALUES ('cotacoes_compra', p_id::text, 'aprovar',
          jsonb_build_object('status', v_cot.status),
          jsonb_build_object('status', 'aprovada'),
          auth.uid());

  RETURN jsonb_build_object('status','aprovada');
END;
$$;

CREATE OR REPLACE FUNCTION public.rejeitar_cotacao_compra(p_id uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cot RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem rejeitar cotações';
  END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN
    RAISE EXCEPTION 'Informe o motivo da rejeição';
  END IF;

  SELECT * INTO v_cot FROM public.cotacoes_compra WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;
  IF v_cot.status IN ('convertida','rejeitada','cancelada') THEN
    RAISE EXCEPTION 'Cotação em status terminal % não pode ser rejeitada', v_cot.status;
  END IF;

  UPDATE public.cotacoes_compra
     SET status = 'rejeitada',
         observacoes = COALESCE(observacoes,'') || E'\n[Rejeitada: ' || p_motivo || ']',
         updated_at = now()
   WHERE id = p_id;

  INSERT INTO public.auditoria_logs (tabela, registro_id, acao, dados_anteriores, dados_novos, usuario_id)
  VALUES ('cotacoes_compra', p_id::text, 'rejeitar',
          jsonb_build_object('status', v_cot.status),
          jsonb_build_object('status','rejeitada','motivo', p_motivo),
          auth.uid());

  RETURN jsonb_build_object('status','rejeitada');
END;
$$;

-- Cancelamento de Pedido de Compra com gate de NF entrada e recebimento
CREATE OR REPLACE FUNCTION public.cancelar_pedido_compra(p_id uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ped RECORD;
  v_nf_count INT;
  v_recebido NUMERIC;
BEGIN
  IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN
    RAISE EXCEPTION 'Informe o motivo do cancelamento';
  END IF;

  SELECT * INTO v_ped FROM public.pedidos_compra WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_ped.status IN ('recebido','cancelado') THEN
    RAISE EXCEPTION 'Pedido em status terminal % não pode ser cancelado', v_ped.status;
  END IF;

  -- Bloqueia se há NF de entrada ativa vinculada ao pedido
  SELECT COUNT(*) INTO v_nf_count
    FROM public.compras c
   WHERE c.pedido_compra_id = p_id
     AND c.ativo = true
     AND COALESCE(c.status,'') NOT IN ('cancelado','cancelada');
  IF v_nf_count > 0 THEN
    RAISE EXCEPTION 'Pedido tem % NF(s) de entrada vinculada(s). Cancele a entrada antes.', v_nf_count;
  END IF;

  -- Bloqueia se há quantidade já recebida (pedido parcialmente recebido sem estorno)
  SELECT COALESCE(SUM(quantidade_recebida),0) INTO v_recebido
    FROM public.pedidos_compra_itens
   WHERE pedido_compra_id = p_id;
  IF v_recebido > 0 THEN
    RAISE EXCEPTION 'Pedido tem itens já recebidos. Estorne o recebimento antes de cancelar.';
  END IF;

  UPDATE public.pedidos_compra
     SET status = 'cancelado',
         observacoes = COALESCE(observacoes,'') || E'\n[Cancelado: ' || p_motivo || ']',
         updated_at = now()
   WHERE id = p_id;

  INSERT INTO public.auditoria_logs (tabela, registro_id, acao, dados_anteriores, dados_novos, usuario_id)
  VALUES ('pedidos_compra', p_id::text, 'cancelar',
          jsonb_build_object('status', v_ped.status),
          jsonb_build_object('status','cancelado','motivo', p_motivo),
          auth.uid());

  RETURN jsonb_build_object('status','cancelado');
END;
$$;