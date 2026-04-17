-- ============================================================================
-- RODADA 1 — COMERCIAL
-- ============================================================================

-- 1. Frete em ordens_venda (schema drift fix)
ALTER TABLE public.ordens_venda
  ADD COLUMN IF NOT EXISTS frete_valor numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frete_tipo text,
  ADD COLUMN IF NOT EXISTS modalidade text,
  ADD COLUMN IF NOT EXISTS transportadora_id uuid,
  ADD COLUMN IF NOT EXISTS frete_simulacao_id uuid,
  ADD COLUMN IF NOT EXISTS origem_frete text,
  ADD COLUMN IF NOT EXISTS servico_frete text,
  ADD COLUMN IF NOT EXISTS peso_total numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prazo_entrega_dias integer,
  ADD COLUMN IF NOT EXISTS volumes integer;

-- 2. Status canônico — saneamento prévio (idempotente)
UPDATE public.orcamentos SET status = 'rascunho'
  WHERE status IS NULL OR status NOT IN ('rascunho','pendente','aprovado','convertido','rejeitado','cancelado');

UPDATE public.orcamentos SET status = 'pendente' WHERE status = 'confirmado';

UPDATE public.ordens_venda SET status = 'pendente'
  WHERE status IS NULL OR status NOT IN ('rascunho','pendente','aprovada','em_separacao','faturada_parcial','faturada','cancelada');

UPDATE public.ordens_venda SET status_faturamento = 'aguardando'
  WHERE status_faturamento IS NULL OR status_faturamento NOT IN ('aguardando','parcial','faturado');

-- 3. CHECK constraints
ALTER TABLE public.orcamentos DROP CONSTRAINT IF EXISTS chk_orcamentos_status;
ALTER TABLE public.orcamentos
  ADD CONSTRAINT chk_orcamentos_status
  CHECK (status IN ('rascunho','pendente','aprovado','convertido','rejeitado','cancelado'));

ALTER TABLE public.ordens_venda DROP CONSTRAINT IF EXISTS chk_ordens_venda_status;
ALTER TABLE public.ordens_venda
  ADD CONSTRAINT chk_ordens_venda_status
  CHECK (status IN ('rascunho','pendente','aprovada','em_separacao','faturada_parcial','faturada','cancelada'));

ALTER TABLE public.ordens_venda DROP CONSTRAINT IF EXISTS chk_ordens_venda_status_fat;
ALTER TABLE public.ordens_venda
  ADD CONSTRAINT chk_ordens_venda_status_fat
  CHECK (status_faturamento IN ('aguardando','parcial','faturado'));

-- 4. FKs faltantes (idempotente — só adiciona se não existir)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orcamentos_cliente_id_fkey') THEN
    ALTER TABLE public.orcamentos ADD CONSTRAINT orcamentos_cliente_id_fkey
      FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orcamentos_vendedor_id_fkey') THEN
    ALTER TABLE public.orcamentos ADD CONSTRAINT orcamentos_vendedor_id_fkey
      FOREIGN KEY (vendedor_id) REFERENCES public.funcionarios(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orcamentos_transportadora_id_fkey') THEN
    ALTER TABLE public.orcamentos ADD CONSTRAINT orcamentos_transportadora_id_fkey
      FOREIGN KEY (transportadora_id) REFERENCES public.transportadoras(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ordens_venda_cliente_id_fkey') THEN
    ALTER TABLE public.ordens_venda ADD CONSTRAINT ordens_venda_cliente_id_fkey
      FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ordens_venda_cotacao_id_fkey') THEN
    ALTER TABLE public.ordens_venda ADD CONSTRAINT ordens_venda_cotacao_id_fkey
      FOREIGN KEY (cotacao_id) REFERENCES public.orcamentos(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ordens_venda_vendedor_id_fkey') THEN
    ALTER TABLE public.ordens_venda ADD CONSTRAINT ordens_venda_vendedor_id_fkey
      FOREIGN KEY (vendedor_id) REFERENCES public.funcionarios(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ordens_venda_transportadora_id_fkey') THEN
    ALTER TABLE public.ordens_venda ADD CONSTRAINT ordens_venda_transportadora_id_fkey
      FOREIGN KEY (transportadora_id) REFERENCES public.transportadoras(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. RPC: converter_orcamento_em_ov
CREATE OR REPLACE FUNCTION public.converter_orcamento_em_ov(
  p_orcamento_id uuid,
  p_po_number text DEFAULT NULL,
  p_data_po date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orc record;
  v_ov_id uuid;
  v_ov_numero text;
BEGIN
  SELECT * INTO v_orc FROM public.orcamentos WHERE id = p_orcamento_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado'; END IF;
  IF v_orc.status NOT IN ('aprovado','pendente','rascunho') THEN
    RAISE EXCEPTION 'Orçamento com status % não pode ser convertido', v_orc.status;
  END IF;

  v_ov_numero := public.proximo_numero_ordem_venda();
  v_ov_id := gen_random_uuid();

  INSERT INTO public.ordens_venda (
    id, numero, data_emissao, cliente_id, cotacao_id, vendedor_id,
    status, status_faturamento, valor_total, observacoes,
    po_number, data_po_cliente,
    frete_valor, frete_tipo, modalidade, transportadora_id, frete_simulacao_id,
    origem_frete, servico_frete, peso_total, prazo_entrega_dias, volumes
  ) VALUES (
    v_ov_id, v_ov_numero, CURRENT_DATE, v_orc.cliente_id, v_orc.id, v_orc.vendedor_id,
    'aprovada', 'aguardando', v_orc.valor_total, v_orc.observacoes,
    p_po_number, p_data_po,
    v_orc.frete_valor, v_orc.frete_tipo, v_orc.modalidade, v_orc.transportadora_id, v_orc.frete_simulacao_id,
    v_orc.origem_frete, v_orc.servico_frete, v_orc.peso_total, v_orc.prazo_entrega_dias, v_orc.volumes
  );

  INSERT INTO public.ordens_venda_itens (
    ordem_venda_id, produto_id, codigo_snapshot, descricao_snapshot, variacao,
    quantidade, unidade, valor_unitario, valor_total, peso_unitario, peso_total,
    quantidade_faturada
  )
  SELECT
    v_ov_id, oi.produto_id, oi.codigo_snapshot, oi.descricao_snapshot, oi.variacao,
    oi.quantidade, oi.unidade, oi.valor_unitario, oi.valor_total, oi.peso_unitario, oi.peso_total,
    0
  FROM public.orcamentos_itens oi
  WHERE oi.orcamento_id = p_orcamento_id;

  UPDATE public.orcamentos SET status = 'convertido', updated_at = now() WHERE id = p_orcamento_id;

  RETURN jsonb_build_object('ov_id', v_ov_id, 'ov_numero', v_ov_numero);
END;
$$;

-- 6. RPC: gerar_nf_de_pedido
CREATE OR REPLACE FUNCTION public.gerar_nf_de_pedido(
  p_pedido_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ped record;
  v_nf_id uuid;
  v_nf_numero text;
  v_total numeric := 0;
  v_peso_bruto numeric := 0;
  v_peso_liq numeric := 0;
  v_total_q numeric := 0;
  v_total_f numeric := 0;
  v_new_fat text;
BEGIN
  SELECT * INTO v_ped FROM public.ordens_venda WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_ped.status_faturamento = 'faturado' THEN
    RAISE EXCEPTION 'Pedido já totalmente faturado';
  END IF;

  v_nf_numero := public.proximo_numero_nf();
  v_nf_id := gen_random_uuid();

  -- Totais a partir dos itens com saldo
  SELECT
    COALESCE(SUM(oi.valor_total),0),
    COALESCE(SUM(COALESCE(p.peso_bruto,0) * oi.quantidade),0),
    COALESCE(SUM(COALESCE(p.peso_liquido,0) * oi.quantidade),0)
  INTO v_total, v_peso_bruto, v_peso_liq
  FROM public.ordens_venda_itens oi
  LEFT JOIN public.produtos p ON p.id = oi.produto_id
  WHERE oi.ordem_venda_id = p_pedido_id;

  INSERT INTO public.notas_fiscais (
    id, numero, tipo, data_emissao, cliente_id, ordem_venda_id,
    valor_total, valor_produtos, status, movimenta_estoque, gera_financeiro,
    origem, natureza_operacao, peso_bruto, peso_liquido, observacoes
  ) VALUES (
    v_nf_id, v_nf_numero, 'saida', CURRENT_DATE, v_ped.cliente_id, p_pedido_id,
    v_total, v_total, 'pendente', true, true,
    'pedido', 'Venda de mercadoria', v_peso_bruto, v_peso_liq,
    'Gerada a partir do Pedido ' || v_ped.numero
  );

  INSERT INTO public.notas_fiscais_itens (
    nota_fiscal_id, produto_id, quantidade, valor_unitario,
    ncm, cfop, cst, origem_mercadoria, unidade, codigo_produto
  )
  SELECT
    v_nf_id, oi.produto_id, oi.quantidade, oi.valor_unitario,
    p.ncm, p.cfop_padrao, p.cst, COALESCE(p.origem_mercadoria,'0'), COALESCE(p.unidade_medida,'UN'), p.sku
  FROM public.ordens_venda_itens oi
  LEFT JOIN public.produtos p ON p.id = oi.produto_id
  WHERE oi.ordem_venda_id = p_pedido_id;

  -- Atualiza quantidade_faturada (faturamento total)
  UPDATE public.ordens_venda_itens
  SET quantidade_faturada = quantidade
  WHERE ordem_venda_id = p_pedido_id;

  -- Recalcula status_faturamento
  SELECT
    COALESCE(SUM(quantidade),0),
    COALESCE(SUM(quantidade_faturada),0)
  INTO v_total_q, v_total_f
  FROM public.ordens_venda_itens WHERE ordem_venda_id = p_pedido_id;

  v_new_fat := CASE
    WHEN v_total_f >= v_total_q THEN 'faturado'
    WHEN v_total_f > 0 THEN 'parcial'
    ELSE 'aguardando'
  END;

  UPDATE public.ordens_venda
  SET status_faturamento = v_new_fat,
      status = CASE WHEN v_new_fat = 'faturado' THEN 'faturada'
                    WHEN v_new_fat = 'parcial' THEN 'faturada_parcial'
                    ELSE status END,
      updated_at = now()
  WHERE id = p_pedido_id;

  -- Evento fiscal (se a tabela existir)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='nf_eventos_fiscais') THEN
    INSERT INTO public.nf_eventos_fiscais (nota_fiscal_id, tipo_evento, status_novo, descricao, payload_resumido)
    VALUES (v_nf_id, 'criacao', 'pendente',
      'NF ' || v_nf_numero || ' gerada automaticamente a partir do Pedido ' || v_ped.numero,
      jsonb_build_object('valor_total', v_total, 'pedido_numero', v_ped.numero));
  END IF;

  RETURN jsonb_build_object('nf_id', v_nf_id, 'nf_numero', v_nf_numero);
END;
$$;