DO $$
DECLARE
  rec RECORD;
  v_dados jsonb;
  v_tipo text;
  v_id uuid;
  v_conta_id uuid;
  v_status text;
  v_valor numeric;
  v_valor_pago numeric;
  v_empresa uuid;
  c_ok int := 0;
  c_err int := 0;
BEGIN
  -- Pega empresa dos lançamentos já existentes (todos pertencem à mesma)
  SELECT empresa_id INTO v_empresa
  FROM financeiro_lancamentos
  WHERE empresa_id IS NOT NULL
  GROUP BY empresa_id
  ORDER BY count(*) DESC
  LIMIT 1;

  IF v_empresa IS NULL THEN
    SELECT id INTO v_empresa FROM empresas ORDER BY created_at LIMIT 1;
  END IF;

  FOR rec IN
    SELECT s.id, s.dados
    FROM stg_financeiro_aberto s
    WHERE s.status = 'erro'
  LOOP
    BEGIN
      v_dados := rec.dados;
      v_tipo := COALESCE(v_dados->>'tipo','pagar');
      v_id := NULL; v_conta_id := NULL;
      v_valor := COALESCE((v_dados->>'valor')::numeric,0);
      v_valor_pago := COALESCE(NULLIF(v_dados->>'valor_pago','')::numeric, 0);

      IF NULLIF(v_dados->>'codigo_legado_pessoa','') IS NOT NULL THEN
        IF v_tipo = 'receber' THEN
          SELECT id INTO v_id FROM clientes WHERE codigo_legado = v_dados->>'codigo_legado_pessoa' LIMIT 1;
          IF v_id IS NULL THEN
            v_id := public.importacao_garantir_pessoa('cliente', v_dados->>'codigo_legado_pessoa', v_dados->>'nome_abreviado');
          END IF;
        ELSE
          SELECT id INTO v_id FROM fornecedores WHERE codigo_legado = v_dados->>'codigo_legado_pessoa' LIMIT 1;
          IF v_id IS NULL THEN
            v_id := public.importacao_garantir_pessoa('fornecedor', v_dados->>'codigo_legado_pessoa', v_dados->>'nome_abreviado');
          END IF;
        END IF;
      END IF;

      IF NULLIF(v_dados->>'conta_contabil_codigo','') IS NOT NULL THEN
        SELECT id INTO v_conta_id FROM contas_contabeis WHERE codigo = v_dados->>'conta_contabil_codigo' LIMIT 1;
      END IF;

      IF NULLIF(v_dados->>'data_pagamento','') IS NOT NULL THEN
        v_status := 'pago';
      ELSIF v_valor_pago > 0 AND v_valor_pago < v_valor THEN
        v_status := 'parcial';
      ELSE
        v_status := 'aberto';
      END IF;

      INSERT INTO financeiro_lancamentos(
        empresa_id,
        tipo, descricao, valor, valor_pago, saldo_restante, status,
        data_emissao, data_vencimento, data_pagamento,
        cliente_id, fornecedor_id, conta_contabil_id,
        forma_pagamento, banco, titulo, nome_abreviado_origem, codigo_fluxo_origem,
        parcela_numero, parcela_total,
        origem_tipo, observacoes, ativo
      ) VALUES (
        v_empresa,
        v_tipo,
        NULLIF(v_dados->>'descricao',''),
        v_valor,
        CASE WHEN v_status='pago' THEN v_valor
             WHEN v_status='parcial' THEN v_valor_pago
             ELSE 0 END,
        CASE WHEN v_status='pago' THEN 0
             WHEN v_status='parcial' THEN GREATEST(v_valor - v_valor_pago, 0)
             ELSE v_valor END,
        v_status,
        NULLIF(v_dados->>'data_emissao','')::date,
        NULLIF(v_dados->>'data_vencimento','')::date,
        NULLIF(v_dados->>'data_pagamento','')::date,
        CASE WHEN v_tipo='receber' THEN v_id ELSE NULL END,
        CASE WHEN v_tipo='pagar'   THEN v_id ELSE NULL END,
        v_conta_id,
        NULLIF(v_dados->>'forma_pagamento',''),
        NULLIF(v_dados->>'banco',''),
        NULLIF(v_dados->>'titulo',''),
        NULLIF(v_dados->>'nome_abreviado',''),
        NULLIF(v_dados->>'codigo_legado_pessoa',''),
        NULLIF(v_dados->>'parcela_numero','')::int,
        NULLIF(v_dados->>'parcela_total','')::int,
        'manual',
        '[Reprocessado] [Origem: '||COALESCE(v_dados->>'origem','?')||'] '||COALESCE(v_dados->>'descricao',''),
        true
      );

      UPDATE stg_financeiro_aberto SET status='consolidado', erro=NULL WHERE id=rec.id;
      c_ok := c_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE stg_financeiro_aberto SET erro = 'Reprocessamento v2 falhou: '||SQLERRM WHERE id=rec.id;
      c_err := c_err + 1;
    END;
  END LOOP;

  RAISE NOTICE 'Reprocessamento v2: % ok, % erros, empresa=%', c_ok, c_err, v_empresa;
END;
$$;