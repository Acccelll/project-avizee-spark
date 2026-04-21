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

  UPDATE importacao_lotes SET status = 'consolidando' WHERE id = p_lote_id;

  FOR rec IN SELECT id, dados, status FROM stg_faturamento WHERE lote_id = p_lote_id AND status IN ('pendente','erro')
  LOOP
    BEGIN
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
            icms_valor, ipi_valor, pis_valor, cofins_valor
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
            NULLIF(v_item->>'cofins_valor','')::numeric
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