-- =========================================================
-- RODADA 0 — Estabilização
-- =========================================================

-- 1) FK clientes.forma_pagamento_id -> formas_pagamento(id)
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS forma_pagamento_id uuid REFERENCES public.formas_pagamento(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_forma_pagamento_id
  ON public.clientes(forma_pagamento_id) WHERE forma_pagamento_id IS NOT NULL;

-- Migrar dado legado: forma_pagamento_padrao (texto) -> forma_pagamento_id (FK)
-- Faz match por descrição (case-insensitive) com formas_pagamento ativas
UPDATE public.clientes c
SET forma_pagamento_id = fp.id
FROM public.formas_pagamento fp
WHERE c.forma_pagamento_id IS NULL
  AND c.forma_pagamento_padrao IS NOT NULL
  AND c.forma_pagamento_padrao != ''
  AND lower(trim(fp.descricao)) = lower(trim(c.forma_pagamento_padrao));

-- NÃO faz DROP da coluna legada nesta rodada (compatibilidade frontend).
-- O DROP será executado na Rodada 1 após Clientes.tsx migrar 100%.

-- =========================================================
-- 2) RPC set_principal_endereco — atomicamente marca um endereço
-- como principal e desmarca os outros do mesmo cliente
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_principal_endereco(
  p_cliente_id uuid,
  p_endereco_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clientes_enderecos_entrega
    WHERE id = p_endereco_id AND cliente_id = p_cliente_id
  ) THEN
    RAISE EXCEPTION 'Endereço não pertence ao cliente informado';
  END IF;

  UPDATE public.clientes_enderecos_entrega
  SET principal = (id = p_endereco_id)
  WHERE cliente_id = p_cliente_id;
END;
$$;

-- =========================================================
-- 3) RPC save_produto_composicao — substitui composição inteira
-- de um produto pai (delete + insert atômico)
-- =========================================================
CREATE OR REPLACE FUNCTION public.save_produto_composicao(
  p_produto_pai_id uuid,
  p_itens jsonb,
  p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.produtos WHERE id = p_produto_pai_id) THEN
    RAISE EXCEPTION 'Produto pai não encontrado';
  END IF;

  -- Atualiza flag eh_composto se vier no payload
  IF p_payload ? 'eh_composto' THEN
    UPDATE public.produtos
    SET eh_composto = COALESCE((p_payload->>'eh_composto')::boolean, false),
        updated_at = now()
    WHERE id = p_produto_pai_id;
  END IF;

  -- Substitui composição
  DELETE FROM public.produto_composicoes WHERE produto_pai_id = p_produto_pai_id;

  IF p_itens IS NOT NULL AND jsonb_typeof(p_itens) = 'array' AND jsonb_array_length(p_itens) > 0 THEN
    INSERT INTO public.produto_composicoes (produto_pai_id, produto_filho_id, quantidade, observacoes)
    SELECT
      p_produto_pai_id,
      (i->>'produto_filho_id')::uuid,
      COALESCE((i->>'quantidade')::numeric, 0),
      NULLIF(i->>'observacoes','')
    FROM jsonb_array_elements(p_itens) AS i
    WHERE i->>'produto_filho_id' IS NOT NULL AND i->>'produto_filho_id' != '';
  END IF;
END;
$$;

-- =========================================================
-- 4) RPC proximo_numero_nf — alias canônico para proximo_numero_nota_fiscal
-- =========================================================
CREATE OR REPLACE FUNCTION public.proximo_numero_nf()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.proximo_numero_nota_fiscal()
$$;

-- =========================================================
-- 5) RPC gerar_pedido_compra — converte cotação em pedido transacionalmente
-- =========================================================
CREATE OR REPLACE FUNCTION public.gerar_pedido_compra(
  p_cotacao_id uuid,
  p_observacoes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cotacao RECORD;
  v_numero text;
  v_pedido_id uuid;
  v_fornecedor_id uuid;
  v_valor_total numeric := 0;
  v_item RECORD;
  v_preco numeric;
BEGIN
  SELECT * INTO v_cotacao FROM public.cotacoes_compra WHERE id = p_cotacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotação não encontrada';
  END IF;
  IF v_cotacao.status = 'convertida' THEN
    RAISE EXCEPTION 'Cotação já convertida em pedido';
  END IF;

  -- Resolve fornecedor a partir das propostas selecionadas (assume um único fornecedor)
  SELECT DISTINCT fornecedor_id INTO v_fornecedor_id
  FROM public.cotacoes_compra_propostas
  WHERE cotacao_compra_id = p_cotacao_id AND selecionado = true
  LIMIT 1;

  v_numero := public.proximo_numero_pedido_compra();

  INSERT INTO public.pedidos_compra (
    numero, fornecedor_id, data_pedido, valor_total, status, observacoes, cotacao_compra_id
  ) VALUES (
    v_numero, v_fornecedor_id, CURRENT_DATE, 0, 'aprovado',
    COALESCE(p_observacoes, v_cotacao.observacoes), p_cotacao_id
  ) RETURNING id INTO v_pedido_id;

  -- Itens com proposta selecionada
  FOR v_item IN
    SELECT i.id, i.produto_id, i.quantidade,
           COALESCE(p.preco_unitario, 0) AS preco_unitario
    FROM public.cotacoes_compra_itens i
    LEFT JOIN public.cotacoes_compra_propostas p
      ON p.item_id = i.id AND p.selecionado = true
    WHERE i.cotacao_compra_id = p_cotacao_id
  LOOP
    v_preco := COALESCE(v_item.preco_unitario, 0);
    INSERT INTO public.pedidos_compra_itens (
      pedido_compra_id, produto_id, quantidade, preco_unitario, subtotal
    ) VALUES (
      v_pedido_id, v_item.produto_id, v_item.quantidade, v_preco,
      v_preco * COALESCE(v_item.quantidade, 0)
    );
    v_valor_total := v_valor_total + (v_preco * COALESCE(v_item.quantidade, 0));
  END LOOP;

  UPDATE public.pedidos_compra SET valor_total = v_valor_total WHERE id = v_pedido_id;
  UPDATE public.cotacoes_compra SET status = 'convertida', updated_at = now() WHERE id = p_cotacao_id;

  RETURN jsonb_build_object('pedido_id', v_pedido_id, 'pedido_numero', v_numero, 'valor_total', v_valor_total);
END;
$$;
