
-- 1) Origem da recorrência
ALTER TABLE public.financeiro_recorrencias
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS origem_id uuid;

ALTER TABLE public.financeiro_recorrencias
  DROP CONSTRAINT IF EXISTS chk_recorrencia_origem;
ALTER TABLE public.financeiro_recorrencias
  ADD CONSTRAINT chk_recorrencia_origem CHECK (origem IN ('manual','nfe'));

CREATE INDEX IF NOT EXISTS idx_recorrencias_origem
  ON public.financeiro_recorrencias (origem, origem_id);

-- 2) Vínculo NF → recorrência
ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS recorrencia_id uuid REFERENCES public.financeiro_recorrencias(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notas_fiscais_recorrencia
  ON public.notas_fiscais (recorrencia_id);

-- 3) Skip parcelas em confirmar_nota_fiscal quando NF é recorrente
CREATE OR REPLACE FUNCTION public.confirmar_nota_fiscal(p_nf_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_nf       public.notas_fiscais%rowtype;
  v_item     record;
  v_tipo_mov text;
  v_tipo_fin text;
  v_data_base date;
  v_fornecedor_id uuid;
  v_cliente_id    uuid;
  v_parcela jsonb;
  v_qtd_parcelas int;
  v_intervalo int := 30;
  i int;
BEGIN
  PERFORM set_config('app.nf_internal_op','1',true);

  SELECT * INTO v_nf FROM public.notas_fiscais WHERE id = p_nf_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NF % não encontrada', p_nf_id;
  END IF;
  IF v_nf.status = 'confirmada' THEN
    RETURN;
  END IF;

  UPDATE public.notas_fiscais
     SET status = 'confirmada', confirmada_em = now(), updated_at = now()
   WHERE id = p_nf_id;

  IF v_nf.movimenta_estoque THEN
    v_tipo_mov := CASE WHEN v_nf.tipo = 'entrada' THEN 'entrada' ELSE 'saida' END;
    FOR v_item IN
      SELECT produto_id, quantidade
        FROM public.notas_fiscais_itens
       WHERE nota_fiscal_id = p_nf_id
    LOOP
      INSERT INTO public.estoque_movimentos
        (produto_id, tipo, quantidade, documento_tipo, documento_id, motivo, empresa_id)
      VALUES
        (v_item.produto_id, v_tipo_mov, v_item.quantidade, 'nota_fiscal', p_nf_id, 'NF ' || v_nf.numero, v_nf.empresa_id);
    END LOOP;
  END IF;

  IF v_nf.gera_financeiro
     AND v_nf.recorrencia_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.financeiro_lancamentos WHERE nota_fiscal_id = p_nf_id) THEN
    v_tipo_fin := CASE WHEN v_nf.tipo = 'entrada' THEN 'pagar' ELSE 'receber' END;
    v_data_base := COALESCE(v_nf.data_emissao, CURRENT_DATE);
    v_fornecedor_id := CASE WHEN v_nf.tipo = 'entrada' THEN v_nf.fornecedor_id ELSE NULL END;
    v_cliente_id    := CASE WHEN v_nf.tipo = 'saida'   THEN v_nf.cliente_id    ELSE NULL END;

    IF v_nf.condicao_pagamento = 'a_vista' THEN
      INSERT INTO public.financeiro_lancamentos
        (tipo, descricao, valor, valor_pago, saldo_restante,
         data_emissao, data_vencimento, status,
         fornecedor_id, cliente_id, nota_fiscal_id, forma_pagamento, origem_tipo, empresa_id)
      VALUES
        (v_tipo_fin, 'NF ' || v_nf.numero,
         v_nf.valor_total, 0, v_nf.valor_total,
         v_data_base, v_data_base, 'aberto',
         v_fornecedor_id, v_cliente_id, p_nf_id, v_nf.forma_pagamento, 'fiscal_nota', v_nf.empresa_id);

    ELSIF jsonb_typeof(v_nf.parcelas) = 'array' AND jsonb_array_length(v_nf.parcelas) > 0 THEN
      v_qtd_parcelas := jsonb_array_length(v_nf.parcelas);
      i := 1;
      FOR v_parcela IN SELECT value FROM jsonb_array_elements(v_nf.parcelas) LOOP
        INSERT INTO public.financeiro_lancamentos
          (tipo, descricao, valor, valor_pago, saldo_restante,
           data_emissao, data_vencimento, status,
           fornecedor_id, cliente_id, nota_fiscal_id, forma_pagamento,
           parcela_numero, parcela_total, origem_tipo, empresa_id)
        VALUES
          (v_tipo_fin,
           'NF ' || v_nf.numero || ' - Parc. ' || COALESCE((v_parcela->>'numero')::int, i) || '/' || v_qtd_parcelas,
           COALESCE((v_parcela->>'valor')::numeric, v_nf.valor_total / v_qtd_parcelas),
           0,
           COALESCE((v_parcela->>'valor')::numeric, v_nf.valor_total / v_qtd_parcelas),
           v_data_base,
           COALESCE((v_parcela->>'vencimento')::date, v_data_base + (v_intervalo * i)),
           'aberto',
           v_fornecedor_id, v_cliente_id, p_nf_id, v_nf.forma_pagamento,
           COALESCE((v_parcela->>'numero')::int, i), v_qtd_parcelas, 'fiscal_nota', v_nf.empresa_id);
        i := i + 1;
      END LOOP;
    ELSE
      INSERT INTO public.financeiro_lancamentos
        (tipo, descricao, valor, valor_pago, saldo_restante,
         data_emissao, data_vencimento, status,
         fornecedor_id, cliente_id, nota_fiscal_id, forma_pagamento, origem_tipo, empresa_id)
      VALUES
        (v_tipo_fin, 'NF ' || v_nf.numero,
         v_nf.valor_total, 0, v_nf.valor_total,
         v_data_base, v_data_base + v_intervalo, 'aberto',
         v_fornecedor_id, v_cliente_id, p_nf_id, v_nf.forma_pagamento, 'fiscal_nota', v_nf.empresa_id);
    END IF;
  END IF;

  INSERT INTO public.nota_fiscal_eventos (nota_fiscal_id, tipo_evento, status_anterior, status_novo, descricao, usuario_id)
  VALUES (
    p_nf_id, 'confirmacao', v_nf.status, 'confirmada',
    CASE WHEN v_nf.recorrencia_id IS NOT NULL
      THEN 'NF confirmada — financeiro será gerado pela recorrência'
      ELSE 'NF confirmada com impacto operacional'
    END,
    auth.uid()
  );

  PERFORM set_config('app.nf_internal_op','',true);
END;
$function$;
