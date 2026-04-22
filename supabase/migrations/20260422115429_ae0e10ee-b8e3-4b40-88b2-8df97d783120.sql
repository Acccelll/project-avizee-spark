-- 1. Cancelar pedido de venda (com gate de NF ativa)
CREATE OR REPLACE FUNCTION public.cancelar_pedido_venda(
  p_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido record;
  v_nf_count int;
  v_user uuid := auth.uid();
BEGIN
  SELECT id, numero, status, status_faturamento
    INTO v_pedido
    FROM public.ordens_venda
   WHERE id = p_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_pedido.status = 'cancelada' THEN
    RAISE EXCEPTION 'Pedido já está cancelado' USING ERRCODE = 'P0001';
  END IF;

  IF v_pedido.status = 'faturada' THEN
    RAISE EXCEPTION 'Pedido totalmente faturado não pode ser cancelado' USING ERRCODE = 'P0001';
  END IF;

  -- Gate: bloquear se houver NF ativa não cancelada/denegada
  SELECT count(*) INTO v_nf_count
    FROM public.notas_fiscais
   WHERE ordem_venda_id = p_id
     AND ativo = true
     AND coalesce(status, '') NOT IN ('cancelada', 'denegada');

  IF v_nf_count > 0 THEN
    RAISE EXCEPTION 'Existem % nota(s) fiscal(is) ativa(s) vinculada(s). Cancele as NFs antes de cancelar o pedido.', v_nf_count
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.ordens_venda
     SET status = 'cancelada',
         observacoes = CASE
           WHEN p_motivo IS NOT NULL AND length(trim(p_motivo)) > 0
             THEN coalesce(observacoes || E'\n\n', '') || '[CANCELAMENTO] ' || p_motivo
           ELSE observacoes
         END,
         updated_at = now()
   WHERE id = p_id;

  INSERT INTO public.auditoria_logs (tabela, registro_id, acao, dados_novos, usuario_id)
  VALUES (
    'ordens_venda',
    p_id,
    'cancelar_pedido_venda',
    jsonb_build_object(
      'numero', v_pedido.numero,
      'status_anterior', v_pedido.status,
      'motivo', p_motivo
    ),
    v_user
  );

  RETURN jsonb_build_object(
    'id', p_id,
    'numero', v_pedido.numero,
    'status', 'cancelada'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancelar_pedido_venda(uuid, text) TO authenticated;

-- 2. Enviar orçamento para aprovação (rascunho → pendente)
CREATE OR REPLACE FUNCTION public.enviar_orcamento_aprovacao(
  p_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orc record;
  v_item_count int;
  v_user uuid := auth.uid();
BEGIN
  SELECT id, numero, status
    INTO v_orc
    FROM public.orcamentos
   WHERE id = p_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_orc.status <> 'rascunho' THEN
    RAISE EXCEPTION 'Apenas orçamentos em rascunho podem ser enviados para aprovação (status atual: %)', v_orc.status
      USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_item_count
    FROM public.orcamentos_itens
   WHERE orcamento_id = p_id;

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Orçamento precisa ter pelo menos um item para ser enviado para aprovação'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.orcamentos
     SET status = 'pendente',
         updated_at = now()
   WHERE id = p_id;

  INSERT INTO public.auditoria_logs (tabela, registro_id, acao, dados_novos, usuario_id)
  VALUES (
    'orcamentos',
    p_id,
    'enviar_aprovacao',
    jsonb_build_object('numero', v_orc.numero, 'status_anterior', 'rascunho', 'status_novo', 'pendente'),
    v_user
  );

  RETURN jsonb_build_object('id', p_id, 'numero', v_orc.numero, 'status', 'pendente');
END;
$$;

GRANT EXECUTE ON FUNCTION public.enviar_orcamento_aprovacao(uuid) TO authenticated;

-- 3. Aprovar orçamento (pendente → aprovado)
CREATE OR REPLACE FUNCTION public.aprovar_orcamento(
  p_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orc record;
  v_user uuid := auth.uid();
BEGIN
  SELECT id, numero, status
    INTO v_orc
    FROM public.orcamentos
   WHERE id = p_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_orc.status <> 'pendente' THEN
    RAISE EXCEPTION 'Apenas orçamentos pendentes podem ser aprovados (status atual: %)', v_orc.status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.orcamentos
     SET status = 'aprovado',
         updated_at = now()
   WHERE id = p_id;

  INSERT INTO public.auditoria_logs (tabela, registro_id, acao, dados_novos, usuario_id)
  VALUES (
    'orcamentos',
    p_id,
    'aprovar_orcamento',
    jsonb_build_object('numero', v_orc.numero, 'status_anterior', 'pendente', 'status_novo', 'aprovado'),
    v_user
  );

  RETURN jsonb_build_object('id', p_id, 'numero', v_orc.numero, 'status', 'aprovado');
END;
$$;

GRANT EXECUTE ON FUNCTION public.aprovar_orcamento(uuid) TO authenticated;