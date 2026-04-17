
-- ============================================================
-- RODADA 5 — FISCAL
-- 1) Status canônico do documento + status SEFAZ separado
-- 2) Saneamento de dados legados
-- 3) RPCs transacionais: confirmar, estornar, devolução
-- 4) Alinhamento com estoque e financeiro (idempotente)
-- ============================================================

-- ---------- 1) Saneamento de status (antes do CHECK) ----------
-- Status do documento canônico: rascunho | confirmada | cancelada
-- Status SEFAZ: nao_enviada | em_processamento | autorizada | rejeitada | denegada | cancelada_sefaz | inutilizada

ALTER TABLE public.notas_fiscais DROP CONSTRAINT IF EXISTS chk_notas_fiscais_status;

UPDATE public.notas_fiscais SET status = 'rascunho'
  WHERE status IS NULL OR status IN ('pendente','aberta','em_digitacao','digitacao');

UPDATE public.notas_fiscais SET status = 'confirmada'
  WHERE status IN ('autorizada','emitida','enviada');

UPDATE public.notas_fiscais SET status = 'cancelada'
  WHERE status IN ('cancelada','denegada','inutilizada');

-- status_sefaz: copiar do status legado quando aplicável
UPDATE public.notas_fiscais
   SET status_sefaz = 'autorizada'
 WHERE status = 'confirmada' AND (status_sefaz IS NULL OR status_sefaz = '') AND protocolo_autorizacao IS NOT NULL;

UPDATE public.notas_fiscais
   SET status_sefaz = 'nao_enviada'
 WHERE status_sefaz IS NULL OR status_sefaz = '';

-- ---------- 2) CHECK constraints canônicos ----------
ALTER TABLE public.notas_fiscais
  ADD CONSTRAINT chk_notas_fiscais_status
  CHECK (status IN ('rascunho','confirmada','cancelada'));

ALTER TABLE public.notas_fiscais
  ADD CONSTRAINT chk_notas_fiscais_status_sefaz
  CHECK (status_sefaz IN (
    'nao_enviada','em_processamento','autorizada','rejeitada',
    'denegada','cancelada_sefaz','inutilizada'
  ));

-- ---------- 3) FK de devolução (NF referenciada) já existe ----------
-- Garantir índices úteis
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_status ON public.notas_fiscais(status);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_status_sefaz ON public.notas_fiscais(status_sefaz);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_nf_referenciada ON public.notas_fiscais(nf_referenciada_id);
CREATE INDEX IF NOT EXISTS idx_nf_eventos_nf ON public.nota_fiscal_eventos(nota_fiscal_id, data_evento DESC);

-- ============================================================
-- 4) RPC: confirmar_nota_fiscal (refatorada — usa status canônico)
-- Idempotente, atualiza estoque (via trigger) e gera financeiro
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirmar_nota_fiscal(p_nf_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nf RECORD;
  v_item RECORD;
  v_tipo_mov TEXT;
  v_tipo_fin TEXT;
BEGIN
  SELECT * INTO v_nf FROM public.notas_fiscais WHERE id = p_nf_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NF não encontrada'; END IF;
  IF v_nf.status = 'confirmada' THEN RETURN; END IF;
  IF v_nf.status = 'cancelada' THEN RAISE EXCEPTION 'NF cancelada não pode ser confirmada'; END IF;
  IF v_nf.numero IS NULL OR v_nf.numero = '' THEN RAISE EXCEPTION 'Número da NF é obrigatório'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notas_fiscais_itens WHERE nota_fiscal_id = p_nf_id LIMIT 1) THEN
    RAISE EXCEPTION 'NF não possui itens';
  END IF;

  UPDATE public.notas_fiscais
     SET status = 'confirmada',
         status_sefaz = COALESCE(NULLIF(status_sefaz,''), 'nao_enviada'),
         updated_at = now()
   WHERE id = p_nf_id;

  -- Estoque (idempotente: só insere se ainda não houver movimento desse documento)
  IF v_nf.movimenta_estoque
     AND NOT EXISTS (SELECT 1 FROM public.estoque_movimentos WHERE documento_tipo='fiscal' AND documento_id=p_nf_id) THEN
    v_tipo_mov := CASE WHEN v_nf.tipo = 'entrada' THEN 'entrada' ELSE 'saida' END;
    FOR v_item IN SELECT * FROM public.notas_fiscais_itens WHERE nota_fiscal_id = p_nf_id LOOP
      INSERT INTO public.estoque_movimentos
        (produto_id, tipo, quantidade, documento_tipo, documento_id, motivo)
      VALUES
        (v_item.produto_id, v_tipo_mov, v_item.quantidade, 'fiscal', p_nf_id,
         'NF ' || v_nf.numero);
      -- saldo_anterior/saldo_atual e produtos.estoque_atual são mantidos pelo trigger trg_estoque_movimentos_sync
    END LOOP;
  END IF;

  -- Financeiro (idempotente)
  IF v_nf.gera_financeiro
     AND NOT EXISTS (SELECT 1 FROM public.financeiro_lancamentos WHERE nota_fiscal_id = p_nf_id) THEN
    v_tipo_fin := CASE WHEN v_nf.tipo = 'entrada' THEN 'pagar' ELSE 'receber' END;
    INSERT INTO public.financeiro_lancamentos
      (tipo, descricao, valor, data_vencimento, status,
       fornecedor_id, cliente_id, nota_fiscal_id, forma_pagamento)
    VALUES
      (v_tipo_fin,
       'NF ' || v_nf.numero,
       v_nf.valor_total,
       COALESCE(v_nf.data_emissao, CURRENT_DATE),
       CASE WHEN v_nf.condicao_pagamento = 'a_vista' THEN 'pago' ELSE 'aberto' END,
       v_nf.fornecedor_id, v_nf.cliente_id, p_nf_id, v_nf.forma_pagamento);
  END IF;

  INSERT INTO public.nota_fiscal_eventos (nota_fiscal_id, tipo_evento, status_anterior, status_novo, descricao)
  VALUES (p_nf_id, 'confirmacao', v_nf.status, 'confirmada', 'NF confirmada');
END;
$$;

-- ============================================================
-- 5) RPC: estornar_nota_fiscal — reverte estoque e remove financeiro pendente
-- ============================================================
CREATE OR REPLACE FUNCTION public.estornar_nota_fiscal(p_nf_id uuid, p_motivo text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nf RECORD;
  v_mov RECORD;
  v_tipo_inv TEXT;
  v_tem_baixa BOOLEAN;
BEGIN
  SELECT * INTO v_nf FROM public.notas_fiscais WHERE id = p_nf_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NF não encontrada'; END IF;
  IF v_nf.status <> 'confirmada' THEN RAISE EXCEPTION 'Apenas NF confirmada pode ser estornada'; END IF;
  IF v_nf.status_sefaz = 'autorizada' THEN
    RAISE EXCEPTION 'NF autorizada na SEFAZ não pode ser estornada localmente — use cancelamento SEFAZ';
  END IF;

  -- Verifica financeiro: não permite estorno se houver baixa
  SELECT EXISTS (
    SELECT 1 FROM public.financeiro_baixas b
      JOIN public.financeiro_lancamentos l ON l.id = b.lancamento_id
     WHERE l.nota_fiscal_id = p_nf_id
  ) INTO v_tem_baixa;
  IF v_tem_baixa THEN
    RAISE EXCEPTION 'NF possui financeiro com baixas — estorne as baixas antes';
  END IF;

  -- Reverte movimentos de estoque criando movimentos opostos
  FOR v_mov IN SELECT * FROM public.estoque_movimentos
                WHERE documento_tipo='fiscal' AND documento_id=p_nf_id LOOP
    v_tipo_inv := CASE WHEN v_mov.tipo='entrada' THEN 'saida' ELSE 'entrada' END;
    INSERT INTO public.estoque_movimentos
      (produto_id, tipo, quantidade, documento_tipo, documento_id, motivo)
    VALUES
      (v_mov.produto_id, v_tipo_inv, v_mov.quantidade, 'fiscal_estorno', p_nf_id,
       COALESCE(p_motivo, 'Estorno NF ' || v_nf.numero));
  END LOOP;

  -- Remove financeiro em aberto
  DELETE FROM public.financeiro_lancamentos
   WHERE nota_fiscal_id = p_nf_id AND status IN ('aberto','vencido');

  UPDATE public.notas_fiscais
     SET status = 'rascunho', updated_at = now()
   WHERE id = p_nf_id;

  INSERT INTO public.nota_fiscal_eventos (nota_fiscal_id, tipo_evento, status_anterior, status_novo, descricao)
  VALUES (p_nf_id, 'estorno', 'confirmada', 'rascunho', COALESCE(p_motivo,'Estorno'));
END;
$$;

-- ============================================================
-- 6) RPC: gerar_devolucao_nota_fiscal — cria NF de devolução referenciada
-- ============================================================
CREATE OR REPLACE FUNCTION public.gerar_devolucao_nota_fiscal(
  p_nf_origem_id uuid,
  p_itens jsonb DEFAULT NULL  -- [{produto_id, quantidade}] ou NULL p/ devolução total
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origem RECORD;
  v_dev_id uuid;
  v_item RECORD;
  v_qtde NUMERIC;
  v_tipo_dev TEXT;
  v_valor_total NUMERIC := 0;
BEGIN
  SELECT * INTO v_origem FROM public.notas_fiscais WHERE id = p_nf_origem_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NF de origem não encontrada'; END IF;
  IF v_origem.status <> 'confirmada' THEN RAISE EXCEPTION 'Apenas NF confirmada pode ser devolvida'; END IF;

  -- Inverte tipo: saída origem → entrada devolução, e vice-versa
  v_tipo_dev := CASE WHEN v_origem.tipo='saida' THEN 'entrada' ELSE 'saida' END;

  INSERT INTO public.notas_fiscais (
    tipo, modelo_documento, tipo_operacao, finalidade_nfe,
    natureza_operacao, serie, data_emissao,
    cliente_id, fornecedor_id, nf_referenciada_id,
    movimenta_estoque, gera_financeiro, status, status_sefaz,
    ambiente_emissao, observacoes
  ) VALUES (
    v_tipo_dev, v_origem.modelo_documento, 'devolucao', '4',
    'Devolução de ' || COALESCE(v_origem.natureza_operacao,'mercadoria'),
    v_origem.serie, CURRENT_DATE,
    v_origem.cliente_id, v_origem.fornecedor_id, p_nf_origem_id,
    true, true, 'rascunho', 'nao_enviada',
    v_origem.ambiente_emissao,
    'Devolução referente à NF ' || COALESCE(v_origem.numero,'')
  ) RETURNING id INTO v_dev_id;

  -- Copia itens (totais ou parciais)
  FOR v_item IN
    SELECT i.* FROM public.notas_fiscais_itens i WHERE i.nota_fiscal_id = p_nf_origem_id
  LOOP
    IF p_itens IS NULL THEN
      v_qtde := v_item.quantidade;
    ELSE
      SELECT (elem->>'quantidade')::numeric INTO v_qtde
        FROM jsonb_array_elements(p_itens) elem
       WHERE (elem->>'produto_id')::uuid = v_item.produto_id
       LIMIT 1;
      IF v_qtde IS NULL OR v_qtde <= 0 THEN CONTINUE; END IF;
      IF v_qtde > v_item.quantidade THEN
        RAISE EXCEPTION 'Quantidade de devolução excede a NF original (produto %)', v_item.produto_id;
      END IF;
    END IF;

    INSERT INTO public.notas_fiscais_itens (
      nota_fiscal_id, produto_id, codigo_produto, descricao, ncm, cfop, cst,
      quantidade, unidade, valor_unitario, valor_total
    ) VALUES (
      v_dev_id, v_item.produto_id, v_item.codigo_produto, v_item.descricao,
      v_item.ncm, v_item.cfop, v_item.cst,
      v_qtde, v_item.unidade, v_item.valor_unitario, v_qtde * v_item.valor_unitario
    );
    v_valor_total := v_valor_total + (v_qtde * v_item.valor_unitario);
  END LOOP;

  UPDATE public.notas_fiscais SET valor_total = v_valor_total, valor_produtos = v_valor_total
   WHERE id = v_dev_id;

  INSERT INTO public.nota_fiscal_eventos (nota_fiscal_id, tipo_evento, status_anterior, status_novo, descricao, payload_resumido)
  VALUES (v_dev_id, 'criacao_devolucao', NULL, 'rascunho',
          'Devolução criada a partir de NF ' || COALESCE(v_origem.numero,''),
          jsonb_build_object('nf_origem', p_nf_origem_id));

  RETURN v_dev_id;
END;
$$;
