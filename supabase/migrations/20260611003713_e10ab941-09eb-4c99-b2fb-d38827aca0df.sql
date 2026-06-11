CREATE OR REPLACE FUNCTION public.vincular_orcamento_nf(
  p_orcamento_id uuid,
  p_nf_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orc record;
  v_nf record;
  v_ov_id uuid;
  v_ov_numero text;
BEGIN
  SELECT * INTO v_orc FROM public.orcamentos WHERE id = p_orcamento_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado'; END IF;

  SELECT id, cliente_id, ordem_venda_id, tipo, status, numero
    INTO v_nf
  FROM public.notas_fiscais WHERE id = p_nf_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nota fiscal não encontrada'; END IF;

  IF v_nf.tipo <> 'saida' THEN
    RAISE EXCEPTION 'Apenas notas fiscais de saída podem ser vinculadas';
  END IF;

  IF v_nf.ordem_venda_id IS NOT NULL THEN
    RAISE EXCEPTION 'Nota fiscal % já está vinculada a um pedido', COALESCE(v_nf.numero, p_nf_id::text);
  END IF;

  IF v_orc.cliente_id IS NOT NULL AND v_nf.cliente_id IS NOT NULL
     AND v_orc.cliente_id <> v_nf.cliente_id THEN
    RAISE EXCEPTION 'Cliente do orçamento difere do cliente da NF';
  END IF;

  -- Procurar OV existente para o orçamento
  SELECT id INTO v_ov_id FROM public.ordens_venda WHERE cotacao_id = p_orcamento_id LIMIT 1;

  IF v_ov_id IS NULL THEN
    -- Criar OV-ponte
    v_ov_numero := public.proximo_numero_ordem_venda();
    v_ov_id := gen_random_uuid();

    INSERT INTO public.ordens_venda (
      id, numero, data_emissao, cliente_id, cotacao_id, vendedor_id,
      status, status_faturamento, valor_total, observacoes,
      frete_valor, frete_tipo, modalidade, transportadora_id,
      peso_total, prazo_entrega_dias, volumes
    ) VALUES (
      v_ov_id, v_ov_numero, CURRENT_DATE,
      COALESCE(v_orc.cliente_id, v_nf.cliente_id),
      v_orc.id, v_orc.vendedor_id,
      'faturada', 'faturado', v_orc.valor_total,
      COALESCE(v_orc.observacoes, '') || E'\n[ponte] OV criada para vínculo retroativo à NF ' || COALESCE(v_nf.numero, p_nf_id::text),
      v_orc.frete_valor, v_orc.frete_tipo, v_orc.modalidade, v_orc.transportadora_id,
      v_orc.peso_total, v_orc.prazo_entrega_dias, v_orc.volumes
    );

    INSERT INTO public.ordens_venda_itens (
      ordem_venda_id, produto_id, codigo_snapshot, descricao_snapshot, variacao,
      quantidade, unidade, valor_unitario, valor_total, peso_unitario, peso_total,
      quantidade_faturada
    )
    SELECT
      v_ov_id, oi.produto_id, oi.codigo_snapshot, oi.descricao_snapshot, oi.variacao,
      oi.quantidade, oi.unidade, oi.valor_unitario, oi.valor_total, oi.peso_unitario, oi.peso_total,
      oi.quantidade
    FROM public.orcamentos_itens oi
    WHERE oi.orcamento_id = p_orcamento_id;

    UPDATE public.orcamentos SET status = 'convertido', updated_at = now() WHERE id = p_orcamento_id;
  ELSE
    -- OV existente: garantir status_faturamento coerente
    UPDATE public.ordens_venda
       SET status_faturamento = 'faturado',
           status = CASE WHEN status IN ('pendente','aprovada','em_separacao','aguardando_faturamento') THEN 'faturada' ELSE status END,
           updated_at = now()
     WHERE id = v_ov_id;
  END IF;

  UPDATE public.notas_fiscais
     SET ordem_venda_id = v_ov_id,
         updated_at = now()
   WHERE id = p_nf_id;

  INSERT INTO public.auditoria_logs (tabela, registro_id, acao, dados_anteriores, dados_novos, usuario_id)
  VALUES (
    'notas_fiscais', p_nf_id, 'vincular_orcamento',
    jsonb_build_object('ordem_venda_id', NULL),
    jsonb_build_object('ordem_venda_id', v_ov_id, 'orcamento_id', p_orcamento_id),
    auth.uid()
  );

  RETURN jsonb_build_object(
    'orcamento_id', p_orcamento_id,
    'nf_id', p_nf_id,
    'ov_id', v_ov_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.vincular_orcamento_nf(uuid, uuid) TO authenticated;