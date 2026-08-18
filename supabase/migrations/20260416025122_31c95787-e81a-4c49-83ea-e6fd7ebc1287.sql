
-- PART 1: Schema consolidation
ALTER TABLE public.grupos_produto ADD COLUMN IF NOT EXISTS conta_contabil_id UUID REFERENCES public.contas_contabeis(id);
ALTER TABLE public.importacao_logs ADD COLUMN IF NOT EXISTS etapa TEXT;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orcamentos' AND column_name = 'frete_simulacao_id'
    AND data_type = 'text'
  ) THEN
    ALTER TABLE public.orcamentos DROP COLUMN frete_simulacao_id;
    ALTER TABLE public.orcamentos ADD COLUMN frete_simulacao_id UUID REFERENCES public.frete_simulacoes(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name LIKE '%orcamentos_transportadora_id%' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orcamentos ADD CONSTRAINT orcamentos_transportadora_id_fkey
      FOREIGN KEY (transportadora_id) REFERENCES public.transportadoras(id);
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.frete_simulacoes ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- PART 2: Atomic NF Confirmation RPC
CREATE OR REPLACE FUNCTION public.confirmar_nota_fiscal(p_nf_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_nf RECORD; v_item RECORD; v_saldo_ant NUMERIC; v_saldo_novo NUMERIC; v_qty NUMERIC; v_tipo_mov TEXT; v_tipo_fin TEXT;
BEGIN
  SELECT * INTO v_nf FROM notas_fiscais WHERE id = p_nf_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NF não encontrada'; END IF;
  IF v_nf.status = 'confirmada' THEN RETURN; END IF;
  IF v_nf.numero IS NULL OR v_nf.numero = '' THEN RAISE EXCEPTION 'Número da NF é obrigatório'; END IF;
  IF NOT EXISTS (SELECT 1 FROM notas_fiscais_itens WHERE nota_fiscal_id = p_nf_id LIMIT 1) THEN RAISE EXCEPTION 'NF não possui itens'; END IF;

  UPDATE notas_fiscais SET status = 'confirmada', status_sefaz = 'nao_enviada', updated_at = now() WHERE id = p_nf_id;

  IF v_nf.movimenta_estoque THEN
    FOR v_item IN SELECT * FROM notas_fiscais_itens WHERE nota_fiscal_id = p_nf_id LOOP
      SELECT estoque_atual INTO v_saldo_ant FROM produtos WHERE id = v_item.produto_id FOR UPDATE;
      v_saldo_ant := COALESCE(v_saldo_ant, 0);
      IF v_nf.tipo = 'entrada' THEN v_qty := v_item.quantidade; v_tipo_mov := 'entrada';
      ELSE v_qty := -v_item.quantidade; v_tipo_mov := 'saida'; END IF;
      v_saldo_novo := v_saldo_ant + v_qty;
      INSERT INTO estoque_movimentos (produto_id, tipo, quantidade, saldo_anterior, saldo_atual, documento_tipo, documento_id)
      VALUES (v_item.produto_id, v_tipo_mov, ABS(v_qty), v_saldo_ant, v_saldo_novo, 'fiscal', p_nf_id);
      UPDATE produtos SET estoque_atual = v_saldo_novo, updated_at = now() WHERE id = v_item.produto_id;
    END LOOP;
  END IF;

  IF v_nf.gera_financeiro THEN
    v_tipo_fin := CASE WHEN v_nf.tipo = 'entrada' THEN 'pagar' ELSE 'receber' END;
    INSERT INTO financeiro_lancamentos (tipo, descricao, valor, data_vencimento, status, fornecedor_id, cliente_id, nota_fiscal_id, forma_pagamento)
    VALUES (v_tipo_fin, 'NF ' || v_nf.numero, v_nf.valor_total, COALESCE(v_nf.data_emissao, CURRENT_DATE),
      CASE WHEN v_nf.condicao_pagamento = 'a_vista' THEN 'pago' ELSE 'aberto' END, v_nf.fornecedor_id, v_nf.cliente_id, p_nf_id, v_nf.forma_pagamento);
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.confirmar_nota_fiscal(UUID) TO authenticated;

-- PART 3: NF Number Sequence
CREATE SEQUENCE IF NOT EXISTS seq_nota_fiscal START 1;
SELECT setval('seq_nota_fiscal', GREATEST(1, COALESCE(
  (SELECT MAX(CAST(REGEXP_REPLACE(COALESCE(numero, '0'), '[^0-9]', '', 'g') AS BIGINT)) + 1 FROM notas_fiscais WHERE numero ~ '[0-9]'), 1)));

CREATE OR REPLACE FUNCTION public.proximo_numero_nota_fiscal()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT LPAD(nextval('seq_nota_fiscal')::text, 6, '0')
$$;
GRANT EXECUTE ON FUNCTION public.proximo_numero_nota_fiscal() TO authenticated;

-- PART 4: Financeiro RPCs v2
CREATE OR REPLACE FUNCTION public.financeiro_processar_estorno(p_lancamento_id UUID, p_motivo TEXT DEFAULT 'Estorno manual')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lanc RECORD;
BEGIN
  SELECT * INTO v_lanc FROM financeiro_lancamentos WHERE id = p_lancamento_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Lançamento não encontrado'); END IF;
  IF v_lanc.status NOT IN ('pago', 'parcial') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Só é possível estornar lançamentos pago ou parcial. Status: ' || COALESCE(v_lanc.status, 'null'));
  END IF;
  UPDATE financeiro_lancamentos SET status = 'estornado', motivo_estorno = p_motivo, valor_pago = 0, saldo_restante = v_lanc.valor, updated_at = now() WHERE id = p_lancamento_id;
  DELETE FROM financeiro_baixas WHERE lancamento_id = p_lancamento_id;
  RETURN jsonb_build_object('success', true, 'lancamento_id', p_lancamento_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.financeiro_processar_estorno(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.financeiro_processar_baixa_lote(p_items JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item JSONB; v_lanc RECORD; v_valor_baixa NUMERIC; v_novo_pago NUMERIC; v_novo_saldo NUMERIC; v_novo_status TEXT;
  v_processados INT := 0; v_ignorados INT := 0; v_erros TEXT[] := '{}';
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    BEGIN
      SELECT * INTO v_lanc FROM financeiro_lancamentos WHERE id = (v_item->>'lancamento_id')::UUID FOR UPDATE;
      IF NOT FOUND THEN v_erros := array_append(v_erros, 'Lançamento ' || (v_item->>'lancamento_id') || ' não encontrado'); CONTINUE; END IF;
      IF v_lanc.status = 'pago' THEN v_ignorados := v_ignorados + 1; CONTINUE; END IF;
      IF v_lanc.status NOT IN ('aberto', 'parcial', 'vencido') THEN v_erros := array_append(v_erros, 'Status ' || v_lanc.status || ' não permite baixa'); CONTINUE; END IF;

      v_valor_baixa := COALESCE((v_item->>'valor_pago')::NUMERIC, COALESCE(v_lanc.saldo_restante, v_lanc.valor));
      v_novo_pago := COALESCE(v_lanc.valor_pago, 0) + v_valor_baixa;
      v_novo_saldo := v_lanc.valor - v_novo_pago;
      IF v_novo_saldo <= 0.005 THEN v_novo_status := 'pago'; v_novo_saldo := 0; ELSE v_novo_status := 'parcial'; END IF;

      UPDATE financeiro_lancamentos SET status = v_novo_status, valor_pago = v_novo_pago, saldo_restante = v_novo_saldo,
        data_pagamento = COALESCE((v_item->>'data_baixa')::DATE, CURRENT_DATE),
        forma_pagamento = COALESCE(v_item->>'forma_pagamento', v_lanc.forma_pagamento),
        conta_bancaria_id = COALESCE((v_item->>'conta_bancaria_id')::UUID, v_lanc.conta_bancaria_id), updated_at = now()
      WHERE id = v_lanc.id;

      INSERT INTO financeiro_baixas (lancamento_id, valor_pago, data_baixa, forma_pagamento, conta_bancaria_id, observacoes)
      VALUES (v_lanc.id, v_valor_baixa, COALESCE((v_item->>'data_baixa')::DATE, CURRENT_DATE),
        COALESCE(v_item->>'forma_pagamento', v_lanc.forma_pagamento), (v_item->>'conta_bancaria_id')::UUID, v_item->>'observacoes');
      v_processados := v_processados + 1;
    EXCEPTION WHEN OTHERS THEN v_erros := array_append(v_erros, 'Erro: ' || SQLERRM); END;
  END LOOP;
  RETURN jsonb_build_object('success', true, 'processados', v_processados, 'ignorados', v_ignorados, 'erros', to_jsonb(v_erros));
END;
$$;
GRANT EXECUTE ON FUNCTION public.financeiro_processar_baixa_lote(JSONB) TO authenticated;
