-- Onda 10 — Processamento de NF-e de entrada (estoque + financeiro)

ALTER TABLE public.nfe_distribuicao
  ADD COLUMN IF NOT EXISTS fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS processado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_processamento timestamptz,
  ADD COLUMN IF NOT EXISTS financeiro_lancamento_id uuid REFERENCES public.financeiro_lancamentos(id) ON DELETE SET NULL;

ALTER TABLE public.nfe_distribuicao_itens
  ADD COLUMN IF NOT EXISTS produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_nfe_dist_itens_produto ON public.nfe_distribuicao_itens(produto_id);
CREATE INDEX IF NOT EXISTS idx_nfe_dist_processado ON public.nfe_distribuicao(processado);

CREATE OR REPLACE FUNCTION public.processar_nfe_distribuicao(
  p_nfe_id uuid,
  p_fornecedor_id uuid,
  p_data_vencimento date,
  p_descricao text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nfe public.nfe_distribuicao%ROWTYPE;
  v_lanc_id uuid;
  v_user uuid := auth.uid();
  v_itens_processados integer := 0;
  v_itens_total integer := 0;
  v_descricao text;
BEGIN
  SELECT * INTO v_nfe FROM public.nfe_distribuicao WHERE id = p_nfe_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NF-e não encontrada';
  END IF;
  IF v_nfe.processado THEN
    RAISE EXCEPTION 'Esta NF-e já foi processada em %', v_nfe.data_processamento;
  END IF;
  IF v_nfe.status_manifestacao <> 'confirmada' THEN
    RAISE EXCEPTION 'Só é possível processar NF-e com manifestação Confirmada';
  END IF;
  IF NOT v_nfe.xml_importado THEN
    RAISE EXCEPTION 'Importe o XML antes de processar a entrada';
  END IF;
  IF p_fornecedor_id IS NULL THEN
    RAISE EXCEPTION 'Informe o fornecedor para gerar o título a pagar';
  END IF;

  -- Cria 1 título a pagar consolidado
  v_descricao := COALESCE(
    p_descricao,
    'NF-e ' || COALESCE(v_nfe.numero, '?') || '/' || COALESCE(v_nfe.serie, '?') ||
    ' — ' || COALESCE(v_nfe.nome_emitente, v_nfe.cnpj_emitente, 'Fornecedor')
  );

  INSERT INTO public.financeiro_lancamentos (
    tipo, descricao, titulo, valor, saldo_restante, data_vencimento, data_emissao,
    status, fornecedor_id, origem_tipo, origem_tabela, origem_id, origem_descricao
  ) VALUES (
    'pagar',
    v_descricao,
    'NF ' || COALESCE(v_nfe.numero, '—') || '/' || COALESCE(v_nfe.serie, '—'),
    COALESCE(v_nfe.valor_total, 0),
    COALESCE(v_nfe.valor_total, 0),
    p_data_vencimento,
    COALESCE(v_nfe.data_emissao::date, CURRENT_DATE),
    'aberto',
    p_fornecedor_id,
    'nfe_entrada',
    'nfe_distribuicao',
    v_nfe.id,
    'NF-e de entrada importada via XML — chave ' || v_nfe.chave_acesso
  ) RETURNING id INTO v_lanc_id;

  -- Movimentações de estoque (apenas itens com produto_id mapeado)
  SELECT COUNT(*) INTO v_itens_total FROM public.nfe_distribuicao_itens WHERE nfe_distribuicao_id = p_nfe_id;

  INSERT INTO public.estoque_movimentos (
    produto_id, tipo, quantidade, motivo, documento_tipo, documento_id, usuario_id
  )
  SELECT
    i.produto_id,
    'entrada',
    i.quantidade,
    'Entrada NF-e ' || COALESCE(v_nfe.numero,'?') || '/' || COALESCE(v_nfe.serie,'?'),
    'nfe_entrada',
    v_nfe.id,
    v_user
  FROM public.nfe_distribuicao_itens i
  WHERE i.nfe_distribuicao_id = p_nfe_id
    AND i.produto_id IS NOT NULL
    AND i.quantidade > 0;

  GET DIAGNOSTICS v_itens_processados = ROW_COUNT;

  -- Marca como processada
  UPDATE public.nfe_distribuicao
     SET processado = true,
         data_processamento = now(),
         fornecedor_id = p_fornecedor_id,
         financeiro_lancamento_id = v_lanc_id
   WHERE id = p_nfe_id;

  RETURN jsonb_build_object(
    'lancamento_id', v_lanc_id,
    'itens_processados', v_itens_processados,
    'itens_total', v_itens_total,
    'itens_sem_produto', v_itens_total - v_itens_processados
  );
END;
$$;

REVOKE ALL ON FUNCTION public.processar_nfe_distribuicao(uuid, uuid, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.processar_nfe_distribuicao(uuid, uuid, date, text) TO authenticated;