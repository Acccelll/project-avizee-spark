-- =========================================================================
-- 1) processar_extras: além de criar sintéticas/centros, faz pós-link
--    do plano analítico → sintética (maior prefixo de código compatível).
-- =========================================================================
CREATE OR REPLACE FUNCTION public.carga_inicial_processar_extras(p_lote_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  c_cc int := 0;
  c_sint int := 0;
  c_link int := 0;
BEGIN
  -- Centros de Custo
  FOR rec IN SELECT id, dados FROM stg_cadastros
    WHERE lote_id = p_lote_id AND status='pendente' AND dados->>'_tipo'='centro_custo'
  LOOP
    BEGIN
      INSERT INTO centros_custo(codigo, descricao, responsavel)
      VALUES (rec.dados->>'codigo', COALESCE(rec.dados->>'descricao', rec.dados->>'codigo'), rec.dados->>'responsavel')
      ON CONFLICT (codigo) DO UPDATE SET descricao=EXCLUDED.descricao, responsavel=EXCLUDED.responsavel;
      c_cc := c_cc + 1;
      UPDATE stg_cadastros SET status='consolidado' WHERE id=rec.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE stg_cadastros SET status='erro', erro_mensagem=SQLERRM WHERE id=rec.id;
    END;
  END LOOP;

  -- Sintéticas (em ordem por nível para FK self-ref)
  FOR rec IN SELECT id, dados FROM stg_cadastros
    WHERE lote_id = p_lote_id AND status='pendente' AND dados->>'_tipo'='sintetica'
    ORDER BY length(dados->>'codigo')
  LOOP
    BEGIN
      INSERT INTO contas_contabeis_sinteticas(codigo, descricao, nivel, conta_pai_codigo)
      VALUES (
        rec.dados->>'codigo',
        COALESCE(rec.dados->>'descricao', rec.dados->>'codigo'),
        NULLIF(rec.dados->>'nivel','')::int,
        NULLIF(rec.dados->>'conta_pai_codigo','')
      )
      ON CONFLICT (codigo) DO UPDATE SET descricao=EXCLUDED.descricao;
      c_sint := c_sint + 1;
      UPDATE stg_cadastros SET status='consolidado' WHERE id=rec.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE stg_cadastros SET status='erro', erro_mensagem=SQLERRM WHERE id=rec.id;
    END;
  END LOOP;

  -- Pós-link: amarra cada conta analítica à sintética cujo código é o maior prefixo do código analítico.
  WITH matches AS (
    SELECT
      ca.id AS analitica_id,
      (
        SELECT s.codigo FROM contas_contabeis_sinteticas s
         WHERE ca.codigo LIKE s.codigo || '%' OR ca.codigo = s.codigo
         ORDER BY length(s.codigo) DESC
         LIMIT 1
      ) AS sintetica_codigo
    FROM contas_contabeis ca
    WHERE ca.conta_sintetica_codigo IS NULL
  )
  UPDATE contas_contabeis ca
     SET conta_sintetica_codigo = m.sintetica_codigo
    FROM matches m
   WHERE ca.id = m.analitica_id
     AND m.sintetica_codigo IS NOT NULL;
  GET DIAGNOSTICS c_link = ROW_COUNT;

  RETURN jsonb_build_object('centros_custo', c_cc, 'sinteticas', c_sint, 'plano_links', c_link);
END;
$function$;

-- =========================================================================
-- 2) consolidar_lote_financeiro: resolve conta_bancaria_id pelo campo "banco"
--    e grava no INSERT.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.consolidar_lote_financeiro(p_lote_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_conta_bancaria_id uuid;
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
  v_banco_norm text;
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
      v_conta_bancaria_id := NULL;

      v_valor := COALESCE((v_dados->>'valor')::numeric, 0);
      v_valor_pago := COALESCE((v_dados->>'valor_pago')::numeric, 0);
      v_data_venc := NULLIF(v_dados->>'data_vencimento','')::date;
      v_data_pag := NULLIF(v_dados->>'data_pagamento','')::date;
      v_titulo := NULLIF(v_dados->>'titulo','');
      v_parcela_num := NULLIF(v_dados->>'parcela_numero','')::int;
      v_parcela_total := NULLIF(v_dados->>'parcela_total','')::int;

      IF v_dados->>'conta_contabil_codigo' IS NOT NULL AND v_dados->>'conta_contabil_codigo' <> '' THEN
        SELECT id INTO v_conta_contabil_id FROM contas_contabeis
         WHERE codigo = v_dados->>'conta_contabil_codigo' AND ativo = true LIMIT 1;
      END IF;

      -- Resolver conta bancária por descrição/titular do banco
      IF v_dados->>'banco' IS NOT NULL AND v_dados->>'banco' <> '' THEN
        v_banco_norm := upper(unaccent(trim(v_dados->>'banco')));
        SELECT id INTO v_conta_bancaria_id FROM contas_bancarias
         WHERE ativo = true
           AND (upper(unaccent(descricao)) = v_banco_norm
             OR upper(unaccent(COALESCE(titular,''))) = v_banco_norm
             OR upper(unaccent(descricao)) LIKE v_banco_norm || '%'
             OR upper(unaccent(descricao)) LIKE '%' || v_banco_norm || '%')
         ORDER BY (upper(unaccent(descricao)) = v_banco_norm) DESC,
                  length(descricao) ASC
         LIMIT 1;
      END IF;

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

      IF v_data_pag IS NOT NULL AND v_valor_pago >= v_valor AND v_valor > 0 THEN
        v_status_fin := 'pago';
      ELSIF v_valor_pago > 0 THEN
        v_status_fin := 'parcial';
      ELSIF v_data_venc IS NOT NULL AND v_data_venc < CURRENT_DATE THEN
        v_status_fin := 'vencido';
      ELSE
        v_status_fin := 'aberto';
      END IF;

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

      SELECT count(*) INTO v_dup_count FROM financeiro_lancamentos
       WHERE tipo = v_tipo
         AND data_vencimento = v_data_venc
         AND valor = v_valor
         AND COALESCE(cliente_id, '00000000-0000-0000-0000-000000000000'::uuid)
             = COALESCE(CASE WHEN v_entity_type='cliente' THEN v_entity_id ELSE NULL END, '00000000-0000-0000-0000-000000000000'::uuid)
         AND COALESCE(fornecedor_id, '00000000-0000-0000-0000-000000000000'::uuid)
             = COALESCE(CASE WHEN v_entity_type='fornecedor' THEN v_entity_id ELSE NULL END, '00000000-0000-0000-0000-000000000000'::uuid)
         AND (v_titulo IS NULL OR observacoes ILIKE '%[Título: ' || v_titulo || ']%');

      IF v_dup_count > 0 THEN
        UPDATE stg_financeiro_aberto SET status='duplicado', erro='Já existe lançamento equivalente.' WHERE id = rec.id;
        v_duplicados := v_duplicados + 1;
        CONTINUE;
      END IF;

      v_saldo := GREATEST(v_valor - v_valor_pago, 0);

      INSERT INTO financeiro_lancamentos (
        tipo, descricao, data_vencimento, valor, valor_pago, saldo_restante, status,
        forma_pagamento, banco, observacoes,
        cliente_id, fornecedor_id, conta_contabil_id, conta_bancaria_id, data_pagamento,
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
        v_conta_bancaria_id,
        CASE WHEN v_status_fin IN ('pago','parcial') THEN v_data_pag ELSE NULL END,
        v_parcela_num,
        v_parcela_total
      ) RETURNING id INTO v_lancamento_id;

      IF v_valor_pago > 0 AND v_data_pag IS NOT NULL THEN
        INSERT INTO financeiro_baixas (lancamento_id, valor_pago, data_baixa, forma_pagamento, conta_bancaria_id, observacoes)
        VALUES (
          v_lancamento_id, v_valor_pago, v_data_pag,
          NULLIF(v_dados->>'forma_pagamento',''),
          v_conta_bancaria_id,
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
$function$;

-- =========================================================================
-- 3) consolidar_lote_faturamento: grava custo_historico_unitario nos itens
-- =========================================================================
CREATE OR REPLACE FUNCTION public.consolidar_lote_faturamento(p_lote_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  v_inseridos_nf int := 0;
  v_inseridos_itens int := 0;
  v_clientes_criados int := 0;
  v_erros int := 0;
  v_dados jsonb;
  v_nf_id uuid;
  v_cliente_id uuid;
  v_existing_nf uuid;
  v_item jsonb;
  v_produto_id uuid;
  v_cnpj_clean text;
  v_tipo_pessoa text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM importacao_lotes WHERE id = p_lote_id AND status IN ('staging','pronto_para_consolidar','validado','consolidando')) THEN
    RETURN jsonb_build_object('erro', 'Lote não encontrado ou não está em staging');
  END IF;

  PERFORM set_config('app.nf_internal_op', '1', true);
  UPDATE importacao_lotes SET status = 'consolidando' WHERE id = p_lote_id;

  FOR rec IN SELECT id, dados, status FROM stg_faturamento WHERE lote_id = p_lote_id AND status IN ('pendente','erro')
  LOOP
    BEGIN
      PERFORM set_config('app.nf_internal_op', '1', true);
      v_dados := rec.dados;
      v_existing_nf := NULL;

      IF v_dados->>'chave_acesso' IS NOT NULL AND v_dados->>'chave_acesso' != '' THEN
        SELECT id INTO v_existing_nf FROM notas_fiscais WHERE chave_acesso = v_dados->>'chave_acesso' LIMIT 1;
      END IF;
      IF v_existing_nf IS NULL AND v_dados->>'numero' IS NOT NULL THEN
        SELECT id INTO v_existing_nf FROM notas_fiscais
        WHERE numero = v_dados->>'numero'
          AND COALESCE(serie, '') = COALESCE(v_dados->>'serie', '')
          AND data_emissao::text = v_dados->>'data_emissao'
        LIMIT 1;
      END IF;

      IF v_existing_nf IS NOT NULL THEN
        UPDATE stg_faturamento SET status = 'duplicado', erro = 'NF já existe: ' || v_existing_nf WHERE id = rec.id;
        CONTINUE;
      END IF;

      v_cliente_id := NULL;
      v_cnpj_clean := regexp_replace(COALESCE(v_dados->>'cpf_cnpj_cliente',''), '[^0-9]', '', 'g');

      IF v_cnpj_clean <> '' THEN
        SELECT id INTO v_cliente_id FROM clientes
        WHERE regexp_replace(COALESCE(cpf_cnpj,''), '[^0-9]', '', 'g') = v_cnpj_clean
        LIMIT 1;

        IF v_cliente_id IS NULL AND COALESCE(v_dados->>'cliente_nome','') <> '' THEN
          v_tipo_pessoa := CASE WHEN length(v_cnpj_clean) = 14 THEN 'juridica' ELSE 'fisica' END;
          INSERT INTO clientes(
            codigo_legado, cpf_cnpj, tipo_pessoa, nome_razao_social,
            cidade, uf, ativo, observacoes
          ) VALUES (
            'migracao_nf:' || v_cnpj_clean,
            v_dados->>'cpf_cnpj_cliente',
            v_tipo_pessoa,
            v_dados->>'cliente_nome',
            NULLIF(v_dados->>'cliente_cidade',''),
            NULLIF(v_dados->>'cliente_uf',''),
            true,
            'Cliente criado automaticamente via importação de NF histórica'
          )
          RETURNING id INTO v_cliente_id;
          v_clientes_criados := v_clientes_criados + 1;
        END IF;
      END IF;

      INSERT INTO notas_fiscais (
        numero, serie, data_emissao, chave_acesso, valor_total, valor_produtos,
        cliente_id, natureza_operacao, status, status_sefaz, tipo, tipo_operacao,
        movimenta_estoque, gera_financeiro, origem,
        icms_valor, ipi_valor, pis_valor, cofins_valor,
        frete_valor, desconto_valor, outras_despesas
      ) VALUES (
        v_dados->>'numero',
        v_dados->>'serie',
        (v_dados->>'data_emissao')::date,
        NULLIF(v_dados->>'chave_acesso',''),
        COALESCE((v_dados->>'valor_total')::numeric, 0),
        COALESCE((v_dados->>'valor_produtos')::numeric, 0),
        v_cliente_id,
        v_dados->>'natureza_operacao',
        'importada',
        'importada_externa',
        COALESCE(v_dados->>'tipo', 'saida'),
        COALESCE(v_dados->>'tipo_operacao', 'venda'),
        false,
        false,
        'importacao_historica',
        NULLIF(v_dados->>'icms_valor','')::numeric,
        NULLIF(v_dados->>'ipi_valor','')::numeric,
        NULLIF(v_dados->>'pis_valor','')::numeric,
        NULLIF(v_dados->>'cofins_valor','')::numeric,
        NULLIF(v_dados->>'frete_valor','')::numeric,
        NULLIF(v_dados->>'desconto_valor','')::numeric,
        NULLIF(v_dados->>'outras_despesas','')::numeric
      ) RETURNING id INTO v_nf_id;

      v_inseridos_nf := v_inseridos_nf + 1;

      IF v_dados->'itens' IS NOT NULL AND jsonb_typeof(v_dados->'itens') = 'array' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_dados->'itens')
        LOOP
          v_produto_id := NULL;
          IF v_item->>'codigo_legado_produto' IS NOT NULL AND v_item->>'codigo_legado_produto' <> '' THEN
            SELECT id INTO v_produto_id FROM produtos WHERE codigo_legado = v_item->>'codigo_legado_produto' LIMIT 1;
          END IF;
          IF v_produto_id IS NULL AND v_item->>'codigo_produto' IS NOT NULL AND v_item->>'codigo_produto' <> '' THEN
            SELECT id INTO v_produto_id FROM produtos WHERE codigo_interno = v_item->>'codigo_produto' LIMIT 1;
          END IF;

          INSERT INTO notas_fiscais_itens (
            nota_fiscal_id, produto_id, codigo_produto, descricao, quantidade,
            unidade, valor_unitario, valor_total, ncm, cfop, cst,
            icms_valor, ipi_valor, pis_valor, cofins_valor,
            custo_historico_unitario
          ) VALUES (
            v_nf_id,
            v_produto_id,
            v_item->>'codigo_produto',
            COALESCE(v_item->>'descricao','Item'),
            COALESCE((v_item->>'quantidade')::numeric, 1),
            COALESCE(v_item->>'unidade','UN'),
            COALESCE((v_item->>'valor_unitario')::numeric, 0),
            COALESCE((v_item->>'valor_total')::numeric, 0),
            v_item->>'ncm',
            v_item->>'cfop',
            v_item->>'cst',
            NULLIF(v_item->>'icms_valor','')::numeric,
            NULLIF(v_item->>'ipi_valor','')::numeric,
            NULLIF(v_item->>'pis_valor','')::numeric,
            NULLIF(v_item->>'cofins_valor','')::numeric,
            NULLIF(v_item->>'custo_unitario','')::numeric
          );
          v_inseridos_itens := v_inseridos_itens + 1;
        END LOOP;
      END IF;

      UPDATE stg_faturamento SET status = 'consolidado', erro = NULL WHERE id = rec.id;

    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros + 1;
      UPDATE stg_faturamento SET status = 'erro', erro = SQLERRM WHERE id = rec.id;
    END;
  END LOOP;

  PERFORM set_config('app.nf_internal_op', '0', true);

  UPDATE importacao_lotes
  SET status = CASE WHEN v_erros = 0 THEN 'concluido' ELSE 'concluido_com_erros' END,
      registros_sucesso = v_inseridos_nf,
      registros_erro = v_erros
  WHERE id = p_lote_id;

  RETURN jsonb_build_object(
    'nfs_inseridas', v_inseridos_nf,
    'itens_inseridos', v_inseridos_itens,
    'clientes_criados', v_clientes_criados,
    'erros', v_erros
  );
END;
$function$;