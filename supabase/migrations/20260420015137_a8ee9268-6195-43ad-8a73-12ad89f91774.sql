-- ============================================================
-- 1) Helper: normalização de texto para matching (sem acento, upper, trim)
-- ============================================================
CREATE OR REPLACE FUNCTION public.normalize_text_match(p_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_input IS NULL THEN NULL
    ELSE upper(trim(translate(
      p_input,
      'áàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
    )))
  END;
$$;

-- ============================================================
-- 2) Limpeza segura de dados operacionais (admin only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.limpar_dados_migracao(p_confirmar boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_admin boolean;
  v_lotes int;
  v_logs int;
  v_stg_fin int;
  v_stg_estoque int;
  v_stg_fat int;
  v_stg_cad int;
  v_stg_xml int;
  v_baixas int;
  v_caixa int;
  v_lancamentos int;
BEGIN
  IF NOT p_confirmar THEN
    RETURN jsonb_build_object('erro', 'Confirmação obrigatória (p_confirmar = true).');
  END IF;

  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('erro', 'Não autenticado.');
  END IF;

  SELECT public.has_role(v_caller, 'admin'::app_role) INTO v_is_admin;
  IF NOT COALESCE(v_is_admin, false) THEN
    RETURN jsonb_build_object('erro', 'Apenas administradores podem executar esta limpeza.');
  END IF;

  -- Ordem dependente: dependentes primeiro
  DELETE FROM public.financeiro_baixas;
  GET DIAGNOSTICS v_baixas = ROW_COUNT;

  DELETE FROM public.caixa_movimentos;
  GET DIAGNOSTICS v_caixa = ROW_COUNT;

  DELETE FROM public.financeiro_lancamentos;
  GET DIAGNOSTICS v_lancamentos = ROW_COUNT;

  DELETE FROM public.stg_financeiro_aberto;
  GET DIAGNOSTICS v_stg_fin = ROW_COUNT;

  DELETE FROM public.stg_estoque_inicial;
  GET DIAGNOSTICS v_stg_estoque = ROW_COUNT;

  DELETE FROM public.stg_faturamento;
  GET DIAGNOSTICS v_stg_fat = ROW_COUNT;

  DELETE FROM public.stg_cadastros;
  GET DIAGNOSTICS v_stg_cad = ROW_COUNT;

  BEGIN
    DELETE FROM public.stg_compras_xml;
    GET DIAGNOSTICS v_stg_xml = ROW_COUNT;
  EXCEPTION WHEN undefined_table THEN
    v_stg_xml := 0;
  END;

  DELETE FROM public.importacao_logs;
  GET DIAGNOSTICS v_logs = ROW_COUNT;

  DELETE FROM public.importacao_lotes;
  GET DIAGNOSTICS v_lotes = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'apagados', jsonb_build_object(
      'financeiro_baixas', v_baixas,
      'caixa_movimentos', v_caixa,
      'financeiro_lancamentos', v_lancamentos,
      'stg_financeiro_aberto', v_stg_fin,
      'stg_estoque_inicial', v_stg_estoque,
      'stg_faturamento', v_stg_fat,
      'stg_cadastros', v_stg_cad,
      'stg_compras_xml', v_stg_xml,
      'importacao_logs', v_logs,
      'importacao_lotes', v_lotes
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.limpar_dados_migracao(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.limpar_dados_migracao(boolean) TO authenticated;

-- ============================================================
-- 3) Nova versão de consolidar_lote_financeiro
--    - Dedup determinístico
--    - Resolução de conta contábil
--    - Status: pago/parcial/vencido/aberto
--    - Observações estruturadas
--    - Contadores por origem (CR/CP/FOPAG)
-- ============================================================
CREATE OR REPLACE FUNCTION public.consolidar_lote_financeiro(p_lote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_inseridos int := 0;
  v_duplicados int := 0;
  v_pendentes_vinculo int := 0;
  v_erros int := 0;
  v_por_origem_cr int := 0;
  v_por_origem_cp int := 0;
  v_por_origem_fopag int := 0;
  v_dados jsonb;
  v_origem text;
  v_tipo text;
  v_entity_type text;
  v_entity_id uuid;
  v_match_via text;
  v_conta_contabil_id uuid;
  v_status_fin text;
  v_valor numeric;
  v_valor_pago numeric;
  v_saldo numeric;
  v_data_venc date;
  v_data_pag date;
  v_titulo text;
  v_parcela_num int;
  v_parcela_total int;
  v_obs text;
  v_obs_orig text;
  v_lancamento_id uuid;
  v_dup_count int;
  v_match_nome_count int;
  v_match_nome_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM importacao_lotes WHERE id = p_lote_id AND status IN ('staging','pronto_para_consolidar','validado')) THEN
    RETURN jsonb_build_object('erro','Lote não encontrado ou não está em staging');
  END IF;

  UPDATE importacao_lotes SET status = 'consolidando' WHERE id = p_lote_id;

  FOR rec IN SELECT id, dados FROM stg_financeiro_aberto WHERE lote_id = p_lote_id AND status = 'pendente'
  LOOP
    BEGIN
      v_dados := rec.dados;
      v_origem := COALESCE(v_dados->>'origem','');
      v_tipo := COALESCE(v_dados->>'tipo','pagar');
      v_entity_type := CASE WHEN v_tipo = 'receber' THEN 'cliente' ELSE 'fornecedor' END;
      v_entity_id := NULL;
      v_match_via := NULL;
      v_conta_contabil_id := NULL;

      v_valor := COALESCE((v_dados->>'valor')::numeric, 0);
      v_valor_pago := COALESCE((v_dados->>'valor_pago')::numeric, 0);
      v_data_venc := NULLIF(v_dados->>'data_vencimento','')::date;
      v_data_pag := NULLIF(v_dados->>'data_pagamento','')::date;
      v_titulo := NULLIF(v_dados->>'titulo','');
      v_parcela_num := NULLIF(v_dados->>'parcela_numero','')::int;
      v_parcela_total := NULLIF(v_dados->>'parcela_total','')::int;

      -- ============= Resolver conta contábil =============
      IF v_dados->>'conta_contabil_codigo' IS NOT NULL AND v_dados->>'conta_contabil_codigo' <> '' THEN
        SELECT id INTO v_conta_contabil_id FROM contas_contabeis
         WHERE codigo = v_dados->>'conta_contabil_codigo' AND ativo = true LIMIT 1;
      END IF;

      -- ============= Resolver pessoa =============
      -- 1) codigo_legado
      IF v_dados->>'codigo_legado_pessoa' IS NOT NULL AND v_dados->>'codigo_legado_pessoa' <> '' THEN
        IF v_entity_type = 'cliente' THEN
          SELECT id INTO v_entity_id FROM clientes
           WHERE codigo_legado = v_dados->>'codigo_legado_pessoa' AND ativo = true LIMIT 1;
        ELSE
          SELECT id INTO v_entity_id FROM fornecedores
           WHERE codigo_legado = v_dados->>'codigo_legado_pessoa' AND ativo = true LIMIT 1;
        END IF;
        IF v_entity_id IS NOT NULL THEN v_match_via := 'codigo_legado'; END IF;
      END IF;

      -- 2) cpf_cnpj
      IF v_entity_id IS NULL AND v_dados->>'cpf_cnpj' IS NOT NULL AND v_dados->>'cpf_cnpj' <> '' THEN
        IF v_entity_type = 'cliente' THEN
          SELECT id INTO v_entity_id FROM clientes
           WHERE cpf_cnpj = v_dados->>'cpf_cnpj' AND ativo = true LIMIT 1;
        ELSE
          SELECT id INTO v_entity_id FROM fornecedores
           WHERE cpf_cnpj = v_dados->>'cpf_cnpj' AND ativo = true LIMIT 1;
        END IF;
        IF v_entity_id IS NOT NULL THEN v_match_via := 'cpf_cnpj'; END IF;
      END IF;

      -- 3) Match exato por nome (sem acento, upper, trim) — somente se único
      IF v_entity_id IS NULL AND v_dados->>'nome_abreviado' IS NOT NULL AND v_dados->>'nome_abreviado' <> '' THEN
        IF v_entity_type = 'cliente' THEN
          SELECT count(*), max(id) INTO v_match_nome_count, v_match_nome_id FROM clientes
           WHERE ativo = true
             AND (normalize_text_match(nome_razao_social) = normalize_text_match(v_dados->>'nome_abreviado')
               OR normalize_text_match(nome_fantasia) = normalize_text_match(v_dados->>'nome_abreviado'));
        ELSE
          SELECT count(*), max(id) INTO v_match_nome_count, v_match_nome_id FROM fornecedores
           WHERE ativo = true
             AND (normalize_text_match(nome_razao_social) = normalize_text_match(v_dados->>'nome_abreviado')
               OR normalize_text_match(nome_fantasia) = normalize_text_match(v_dados->>'nome_abreviado'));
        END IF;
        IF v_match_nome_count = 1 THEN
          v_entity_id := v_match_nome_id;
          v_match_via := 'nome';
        END IF;
      END IF;

      IF v_entity_id IS NULL AND v_origem <> 'FOPAG' THEN
        v_pendentes_vinculo := v_pendentes_vinculo + 1;
      END IF;

      -- ============= Status derivado =============
      IF v_data_pag IS NOT NULL AND v_valor_pago >= v_valor AND v_valor > 0 THEN
        v_status_fin := 'pago';
      ELSIF v_valor_pago > 0 THEN
        v_status_fin := 'parcial';
      ELSIF v_data_venc IS NOT NULL AND v_data_venc < CURRENT_DATE THEN
        v_status_fin := 'vencido';
      ELSE
        v_status_fin := 'aberto';
      END IF;

      -- ============= Observações estruturadas =============
      v_obs_orig := COALESCE(v_dados->>'observacoes','');
      v_obs := '';
      IF v_origem <> '' THEN v_obs := v_obs || '[Origem: ' || v_origem || '] '; END IF;
      IF v_titulo IS NOT NULL THEN v_obs := v_obs || '[Título: ' || v_titulo || '] '; END IF;
      IF v_parcela_num IS NOT NULL AND v_parcela_total IS NOT NULL THEN
        v_obs := v_obs || '[Parcela: ' || v_parcela_num || '/' || v_parcela_total || '] ';
      END IF;
      IF v_dados->>'nome_abreviado' IS NOT NULL AND v_dados->>'nome_abreviado' <> '' THEN
        v_obs := v_obs || '[Nome Abrev: ' || (v_dados->>'nome_abreviado') || '] ';
      END IF;
      IF v_dados->>'pmv_pmp' IS NOT NULL AND v_dados->>'pmv_pmp' <> '' THEN
        v_obs := v_obs || '[' || (CASE WHEN v_tipo='receber' THEN 'PMV' ELSE 'PMP' END) || ': ' || (v_dados->>'pmv_pmp') || '] ';
      END IF;
      IF v_dados->>'socio' IS NOT NULL AND v_dados->>'socio' <> '' THEN
        v_obs := v_obs || '[Sócio: ' || (v_dados->>'socio') || '] ';
      END IF;
      IF v_obs_orig <> '' THEN v_obs := v_obs || '— ' || v_obs_orig; END IF;
      v_obs := v_obs || ' [Lote: ' || p_lote_id || ']';

      -- ============= Deduplicação determinística =============
      SELECT count(*) INTO v_dup_count FROM financeiro_lancamentos
       WHERE tipo = v_tipo
         AND data_vencimento = v_data_venc
         AND valor = v_valor
         AND COALESCE(cliente_id, '00000000-0000-0000-0000-000000000000'::uuid)
             = COALESCE(CASE WHEN v_entity_type='cliente' THEN v_entity_id ELSE NULL END, '00000000-0000-0000-0000-000000000000'::uuid)
         AND COALESCE(fornecedor_id, '00000000-0000-0000-0000-000000000000'::uuid)
             = COALESCE(CASE WHEN v_entity_type='fornecedor' THEN v_entity_id ELSE NULL END, '00000000-0000-0000-0000-000000000000'::uuid)
         AND (
           v_titulo IS NULL
           OR observacoes ILIKE '%[Título: ' || v_titulo || ']%'
         );

      IF v_dup_count > 0 THEN
        UPDATE stg_financeiro_aberto SET status='duplicado', erro='Já existe lançamento equivalente.' WHERE id = rec.id;
        v_duplicados := v_duplicados + 1;
        CONTINUE;
      END IF;

      v_saldo := GREATEST(v_valor - v_valor_pago, 0);

      INSERT INTO financeiro_lancamentos (
        tipo, descricao, data_vencimento, valor, valor_pago, saldo_restante, status,
        forma_pagamento, banco, observacoes,
        cliente_id, fornecedor_id, conta_contabil_id, data_pagamento,
        parcela_numero, parcela_total
      ) VALUES (
        v_tipo,
        COALESCE(NULLIF(v_dados->>'descricao',''), v_titulo, 'Migração via Conciliação'),
        v_data_venc,
        v_valor,
        v_valor_pago,
        v_saldo,
        v_status_fin,
        NULLIF(v_dados->>'forma_pagamento',''),
        NULLIF(v_dados->>'banco',''),
        v_obs,
        CASE WHEN v_entity_type='cliente' THEN v_entity_id ELSE NULL END,
        CASE WHEN v_entity_type='fornecedor' THEN v_entity_id ELSE NULL END,
        v_conta_contabil_id,
        CASE WHEN v_status_fin IN ('pago','parcial') THEN v_data_pag ELSE NULL END,
        v_parcela_num,
        v_parcela_total
      ) RETURNING id INTO v_lancamento_id;

      IF v_valor_pago > 0 AND v_data_pag IS NOT NULL THEN
        INSERT INTO financeiro_baixas (lancamento_id, valor_pago, data_baixa, forma_pagamento, observacoes)
        VALUES (
          v_lancamento_id, v_valor_pago, v_data_pag,
          NULLIF(v_dados->>'forma_pagamento',''),
          'Baixa importada via Conciliação'
        );
      END IF;

      UPDATE stg_financeiro_aberto SET status='consolidado' WHERE id = rec.id;
      v_inseridos := v_inseridos + 1;
      IF v_origem = 'CR' THEN v_por_origem_cr := v_por_origem_cr + 1;
      ELSIF v_origem = 'CP' THEN v_por_origem_cp := v_por_origem_cp + 1;
      ELSIF v_origem = 'FOPAG' THEN v_por_origem_fopag := v_por_origem_fopag + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      UPDATE stg_financeiro_aberto SET status='erro', erro=SQLERRM WHERE id = rec.id;
      v_erros := v_erros + 1;
    END;
  END LOOP;

  UPDATE importacao_lotes SET
    status = CASE WHEN v_erros = 0 THEN 'concluido' WHEN v_inseridos > 0 THEN 'parcial' ELSE 'erro' END,
    registros_sucesso = v_inseridos,
    registros_erro = v_erros,
    registros_duplicados = v_duplicados,
    resumo = COALESCE(resumo,'{}'::jsonb) || jsonb_build_object(
      'inseridos', v_inseridos,
      'duplicados', v_duplicados,
      'pendentes_vinculo', v_pendentes_vinculo,
      'erros', v_erros,
      'por_origem', jsonb_build_object('cr', v_por_origem_cr, 'cp', v_por_origem_cp, 'fopag', v_por_origem_fopag)
    ),
    updated_at = now()
  WHERE id = p_lote_id;

  RETURN jsonb_build_object(
    'inseridos', v_inseridos,
    'duplicados', v_duplicados,
    'pendentes_vinculo', v_pendentes_vinculo,
    'erros', v_erros,
    'por_origem', jsonb_build_object('cr', v_por_origem_cr, 'cp', v_por_origem_cp, 'fopag', v_por_origem_fopag)
  );
END;
$$;