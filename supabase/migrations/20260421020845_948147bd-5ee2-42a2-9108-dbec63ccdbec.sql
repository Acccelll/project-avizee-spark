-- ============================================================
-- 1) merge_lote_conciliacao: versão upsert da carga inicial
-- ============================================================
CREATE OR REPLACE FUNCTION public.merge_lote_conciliacao(p_lote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_admin boolean;
  rec RECORD;
  v_dados jsonb;
  v_id uuid;
  v_grupo_id uuid;
  v_forn_id uuid;
  v_conta_id uuid;
  v_produto_id uuid;
  v_pessoa_id uuid;
  v_quantidade numeric;
  v_saldo_anterior numeric;
  v_data_corte text;
  v_existente uuid;
  c_grupos int := 0; c_planos int := 0; c_forn int := 0; c_cli int := 0;
  c_prod int := 0; c_insumo int := 0; c_estq int := 0;
  c_cr int := 0; c_cp int := 0;
  c_atualizados int := 0; c_inseridos int := 0; c_duplicados int := 0; c_erros int := 0;
BEGIN
  IF v_caller IS NULL THEN RETURN jsonb_build_object('erro','Não autenticado.'); END IF;
  SELECT public.has_role(v_caller,'admin'::app_role) INTO v_is_admin;
  IF NOT COALESCE(v_is_admin,false) THEN RETURN jsonb_build_object('erro','Apenas administradores.'); END IF;

  IF NOT EXISTS (SELECT 1 FROM importacao_lotes WHERE id = p_lote_id AND status IN ('staging','validado','pronto_para_consolidar')) THEN
    RETURN jsonb_build_object('erro','Lote não encontrado ou não está em staging.');
  END IF;

  UPDATE importacao_lotes SET status = 'consolidando' WHERE id = p_lote_id;

  -- 1) Grupos
  FOR rec IN SELECT id, dados FROM stg_cadastros WHERE lote_id = p_lote_id AND status='pendente' AND dados->>'_tipo'='grupo' LOOP
    BEGIN
      INSERT INTO grupos_produto(nome) VALUES (rec.dados->>'nome')
      ON CONFLICT (nome) DO NOTHING;
      c_grupos := c_grupos + 1;
      UPDATE stg_cadastros SET status='consolidado' WHERE id=rec.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE stg_cadastros SET status='erro', erro=SQLERRM WHERE id=rec.id;
      c_erros := c_erros + 1;
    END;
  END LOOP;

  -- 2) Plano de contas
  FOR rec IN SELECT id, dados FROM stg_cadastros WHERE lote_id = p_lote_id AND status='pendente' AND dados->>'_tipo'='plano_conta' LOOP
    BEGIN
      INSERT INTO contas_contabeis(codigo, descricao, i_level, aceita_lancamento, ativo)
      VALUES (rec.dados->>'codigo', rec.dados->>'descricao', rec.dados->>'i_level', true, true)
      ON CONFLICT (codigo) DO UPDATE
        SET descricao = EXCLUDED.descricao,
            i_level   = EXCLUDED.i_level;
      c_planos := c_planos + 1;
      UPDATE stg_cadastros SET status='consolidado' WHERE id=rec.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE stg_cadastros SET status='erro', erro=SQLERRM WHERE id=rec.id;
      c_erros := c_erros + 1;
    END;
  END LOOP;

  -- 3) Fornecedores (upsert por codigo_legado, fallback cpf_cnpj)
  FOR rec IN SELECT id, dados FROM stg_cadastros WHERE lote_id = p_lote_id AND status='pendente' AND dados->>'_tipo'='fornecedor' LOOP
    BEGIN
      v_existente := NULL;
      IF NULLIF(rec.dados->>'codigo_legado','') IS NOT NULL THEN
        SELECT id INTO v_existente FROM fornecedores WHERE codigo_legado = rec.dados->>'codigo_legado' LIMIT 1;
      END IF;
      IF v_existente IS NULL AND NULLIF(rec.dados->>'cpf_cnpj','') IS NOT NULL THEN
        SELECT id INTO v_existente FROM fornecedores WHERE cpf_cnpj = rec.dados->>'cpf_cnpj' LIMIT 1;
      END IF;

      IF v_existente IS NULL THEN
        INSERT INTO fornecedores(
          codigo_legado, cpf_cnpj, inscricao_estadual, tipo_pessoa, nome_razao_social,
          nome_fantasia, contato, email, telefone, celular,
          cep, logradouro, numero, complemento, bairro, cidade, uf, pais,
          prazo_padrao, observacoes, ativo
        ) VALUES (
          NULLIF(rec.dados->>'codigo_legado',''),
          NULLIF(rec.dados->>'cpf_cnpj',''),
          NULLIF(rec.dados->>'inscricao_estadual',''),
          COALESCE(NULLIF(rec.dados->>'tipo_pessoa',''),'juridica'),
          rec.dados->>'nome_razao_social',
          NULLIF(rec.dados->>'nome_fantasia',''),
          NULLIF(rec.dados->>'contato',''),
          NULLIF(rec.dados->>'email',''),
          NULLIF(rec.dados->>'telefone',''),
          NULLIF(rec.dados->>'celular',''),
          NULLIF(rec.dados->>'cep',''),
          NULLIF(rec.dados->>'logradouro',''),
          NULLIF(rec.dados->>'numero',''),
          NULLIF(rec.dados->>'complemento',''),
          NULLIF(rec.dados->>'bairro',''),
          NULLIF(rec.dados->>'cidade',''),
          NULLIF(rec.dados->>'uf',''),
          COALESCE(NULLIF(rec.dados->>'pais',''),'Brasil'),
          NULLIF(rec.dados->>'prazo_padrao','')::int,
          NULLIF(rec.dados->>'observacoes',''),
          true
        );
        c_inseridos := c_inseridos + 1;
      ELSE
        UPDATE fornecedores SET
          codigo_legado = COALESCE(codigo_legado, NULLIF(rec.dados->>'codigo_legado','')),
          cpf_cnpj = COALESCE(cpf_cnpj, NULLIF(rec.dados->>'cpf_cnpj','')),
          nome_razao_social = COALESCE(NULLIF(rec.dados->>'nome_razao_social',''), nome_razao_social),
          nome_fantasia = COALESCE(nome_fantasia, NULLIF(rec.dados->>'nome_fantasia','')),
          email = COALESCE(email, NULLIF(rec.dados->>'email','')),
          telefone = COALESCE(telefone, NULLIF(rec.dados->>'telefone','')),
          cidade = COALESCE(cidade, NULLIF(rec.dados->>'cidade','')),
          uf = COALESCE(uf, NULLIF(rec.dados->>'uf','')),
          updated_at = now()
        WHERE id = v_existente;
        c_atualizados := c_atualizados + 1;
      END IF;

      c_forn := c_forn + 1;
      UPDATE stg_cadastros SET status='consolidado' WHERE id=rec.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE stg_cadastros SET status='erro', erro=SQLERRM WHERE id=rec.id;
      c_erros := c_erros + 1;
    END;
  END LOOP;

  -- 4) Clientes (upsert por codigo_legado, fallback cpf_cnpj)
  FOR rec IN SELECT id, dados FROM stg_cadastros WHERE lote_id = p_lote_id AND status='pendente' AND dados->>'_tipo'='cliente' LOOP
    BEGIN
      v_existente := NULL;
      IF NULLIF(rec.dados->>'codigo_legado','') IS NOT NULL THEN
        SELECT id INTO v_existente FROM clientes WHERE codigo_legado = rec.dados->>'codigo_legado' LIMIT 1;
      END IF;
      IF v_existente IS NULL AND NULLIF(rec.dados->>'cpf_cnpj','') IS NOT NULL THEN
        SELECT id INTO v_existente FROM clientes WHERE cpf_cnpj = rec.dados->>'cpf_cnpj' LIMIT 1;
      END IF;

      IF v_existente IS NULL THEN
        INSERT INTO clientes(
          codigo_legado, cpf_cnpj, inscricao_estadual, tipo_pessoa, nome_razao_social,
          nome_fantasia, contato, email, telefone, celular,
          cep, logradouro, numero, complemento, bairro, cidade, uf, pais,
          prazo_padrao, observacoes, ativo
        ) VALUES (
          NULLIF(rec.dados->>'codigo_legado',''),
          NULLIF(rec.dados->>'cpf_cnpj',''),
          NULLIF(rec.dados->>'inscricao_estadual',''),
          COALESCE(NULLIF(rec.dados->>'tipo_pessoa',''),'juridica'),
          rec.dados->>'nome_razao_social',
          NULLIF(rec.dados->>'nome_fantasia',''),
          NULLIF(rec.dados->>'contato',''),
          NULLIF(rec.dados->>'email',''),
          NULLIF(rec.dados->>'telefone',''),
          NULLIF(rec.dados->>'celular',''),
          NULLIF(rec.dados->>'cep',''),
          NULLIF(rec.dados->>'logradouro',''),
          NULLIF(rec.dados->>'numero',''),
          NULLIF(rec.dados->>'complemento',''),
          NULLIF(rec.dados->>'bairro',''),
          NULLIF(rec.dados->>'cidade',''),
          NULLIF(rec.dados->>'uf',''),
          COALESCE(NULLIF(rec.dados->>'pais',''),'Brasil'),
          NULLIF(rec.dados->>'prazo_padrao','')::int,
          NULLIF(rec.dados->>'observacoes',''),
          true
        );
        c_inseridos := c_inseridos + 1;
      ELSE
        UPDATE clientes SET
          codigo_legado = COALESCE(codigo_legado, NULLIF(rec.dados->>'codigo_legado','')),
          cpf_cnpj = COALESCE(cpf_cnpj, NULLIF(rec.dados->>'cpf_cnpj','')),
          nome_razao_social = COALESCE(NULLIF(rec.dados->>'nome_razao_social',''), nome_razao_social),
          nome_fantasia = COALESCE(nome_fantasia, NULLIF(rec.dados->>'nome_fantasia','')),
          email = COALESCE(email, NULLIF(rec.dados->>'email','')),
          telefone = COALESCE(telefone, NULLIF(rec.dados->>'telefone','')),
          cidade = COALESCE(cidade, NULLIF(rec.dados->>'cidade','')),
          uf = COALESCE(uf, NULLIF(rec.dados->>'uf','')),
          updated_at = now()
        WHERE id = v_existente;
        c_atualizados := c_atualizados + 1;
      END IF;

      c_cli := c_cli + 1;
      UPDATE stg_cadastros SET status='consolidado' WHERE id=rec.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE stg_cadastros SET status='erro', erro=SQLERRM WHERE id=rec.id;
      c_erros := c_erros + 1;
    END;
  END LOOP;

  -- 5) Produtos / Insumos (upsert por codigo_legado)
  FOR rec IN SELECT id, dados FROM stg_cadastros WHERE lote_id = p_lote_id AND status='pendente' AND dados->>'_tipo' IN ('produto','insumo') LOOP
    BEGIN
      v_existente := NULL;
      IF NULLIF(rec.dados->>'codigo_legado','') IS NOT NULL THEN
        SELECT id INTO v_existente FROM produtos WHERE codigo_legado = rec.dados->>'codigo_legado' LIMIT 1;
      END IF;

      v_grupo_id := NULL;
      IF NULLIF(rec.dados->>'grupo_nome','') IS NOT NULL THEN
        SELECT id INTO v_grupo_id FROM grupos_produto WHERE nome = rec.dados->>'grupo_nome' LIMIT 1;
      END IF;

      IF v_existente IS NULL THEN
        INSERT INTO produtos(
          codigo_legado, codigo_interno, nome, unidade_medida,
          preco_custo, preco_venda, peso_liquido,
          grupo_id, tipo_item, estoque_atual, ativo
        ) VALUES (
          NULLIF(rec.dados->>'codigo_legado',''),
          COALESCE(NULLIF(rec.dados->>'codigo_interno',''), rec.dados->>'codigo_legado'),
          rec.dados->>'nome',
          COALESCE(NULLIF(rec.dados->>'unidade_medida',''),'UN'),
          COALESCE(NULLIF(rec.dados->>'preco_custo','')::numeric, 0),
          COALESCE(NULLIF(rec.dados->>'preco_venda','')::numeric, 0),
          NULLIF(rec.dados->>'peso_liquido','')::numeric,
          v_grupo_id,
          COALESCE(rec.dados->>'_tipo','produto'),
          0,
          true
        );
        IF rec.dados->>'_tipo' = 'insumo' THEN c_insumo := c_insumo + 1; ELSE c_prod := c_prod + 1; END IF;
        c_inseridos := c_inseridos + 1;
      ELSE
        UPDATE produtos SET
          codigo_interno = COALESCE(codigo_interno, NULLIF(rec.dados->>'codigo_interno','')),
          nome = COALESCE(NULLIF(rec.dados->>'nome',''), nome),
          unidade_medida = COALESCE(unidade_medida, NULLIF(rec.dados->>'unidade_medida','')),
          preco_custo = COALESCE(NULLIF(rec.dados->>'preco_custo','')::numeric, preco_custo),
          preco_venda = COALESCE(NULLIF(rec.dados->>'preco_venda','')::numeric, preco_venda),
          grupo_id = COALESCE(v_grupo_id, grupo_id),
          updated_at = now()
        WHERE id = v_existente;
        c_atualizados := c_atualizados + 1;
        IF rec.dados->>'_tipo' = 'insumo' THEN c_insumo := c_insumo + 1; ELSE c_prod := c_prod + 1; END IF;
      END IF;

      UPDATE stg_cadastros SET status='consolidado' WHERE id=rec.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE stg_cadastros SET status='erro', erro=SQLERRM WHERE id=rec.id;
      c_erros := c_erros + 1;
    END;
  END LOOP;

  -- 6) Estoque (movimento de abertura — idempotente via dedup por documento_id+produto)
  FOR rec IN SELECT id, dados FROM stg_estoque_inicial WHERE lote_id = p_lote_id AND status = 'pendente' LOOP
    BEGIN
      v_produto_id := NULL;
      IF NULLIF(rec.dados->>'codigo_legado_produto','') IS NOT NULL THEN
        SELECT id INTO v_produto_id FROM produtos WHERE codigo_legado = rec.dados->>'codigo_legado_produto' LIMIT 1;
      END IF;

      IF v_produto_id IS NULL THEN
        UPDATE stg_estoque_inicial SET status='erro', erro='Produto não encontrado' WHERE id=rec.id;
        c_erros := c_erros + 1;
        CONTINUE;
      END IF;

      v_quantidade := COALESCE((rec.dados->>'quantidade')::numeric, 0);
      v_data_corte := COALESCE(rec.dados->>'data_estoque_inicial', to_char(now(),'YYYY-MM-DD'));
      SELECT COALESCE(estoque_atual,0) INTO v_saldo_anterior FROM produtos WHERE id = v_produto_id;

      -- Se o saldo já bate, marca como duplicado (idempotente)
      IF v_saldo_anterior = v_quantidade THEN
        UPDATE stg_estoque_inicial SET status='duplicado', erro='Saldo já corresponde' WHERE id=rec.id;
        c_duplicados := c_duplicados + 1;
        CONTINUE;
      END IF;

      INSERT INTO estoque_movimentos(produto_id, tipo, quantidade, saldo_anterior, saldo_atual, motivo, documento_tipo, documento_id, created_at)
      VALUES (
        v_produto_id,
        CASE WHEN v_quantidade >= v_saldo_anterior THEN 'entrada' ELSE 'saida' END,
        ABS(v_quantidade - v_saldo_anterior),
        v_saldo_anterior, v_quantidade,
        'Ajuste merge conciliação (Lote: '||p_lote_id||')',
        'abertura', p_lote_id, v_data_corte::timestamptz
      );
      c_estq := c_estq + 1;
      UPDATE stg_estoque_inicial SET status='consolidado' WHERE id=rec.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE stg_estoque_inicial SET status='erro', erro=SQLERRM WHERE id=rec.id;
      c_erros := c_erros + 1;
    END;
  END LOOP;

  -- 7) Financeiro (CR + CP) — dedup por (origem_id_legado) ou (pessoa+tipo+valor+data_venc+parcela)
  FOR rec IN SELECT id, dados FROM stg_financeiro_aberto WHERE lote_id = p_lote_id AND status = 'pendente' LOOP
    BEGIN
      v_dados := rec.dados;
      v_pessoa_id := NULL;

      -- Resolve pessoa (cliente p/ CR, fornecedor p/ CP) por codigo_legado
      IF NULLIF(v_dados->>'codigo_legado_pessoa','') IS NOT NULL THEN
        IF v_dados->>'origem' = 'CR' THEN
          SELECT id INTO v_pessoa_id FROM clientes WHERE codigo_legado = v_dados->>'codigo_legado_pessoa' LIMIT 1;
        ELSE
          SELECT id INTO v_pessoa_id FROM fornecedores WHERE codigo_legado = v_dados->>'codigo_legado_pessoa' LIMIT 1;
        END IF;
      END IF;

      v_conta_id := NULL;
      IF NULLIF(v_dados->>'conta_contabil_codigo','') IS NOT NULL THEN
        SELECT id INTO v_conta_id FROM contas_contabeis WHERE codigo = v_dados->>'conta_contabil_codigo' LIMIT 1;
      END IF;

      -- Dedup
      v_existente := NULL;
      SELECT id INTO v_existente FROM financeiro_lancamentos
      WHERE tipo = COALESCE(v_dados->>'tipo','receber')
        AND data_vencimento = (v_dados->>'data_vencimento')::date
        AND valor = COALESCE((v_dados->>'valor')::numeric, 0)
        AND COALESCE(parcela_numero, 0) = COALESCE((v_dados->>'parcela_numero')::int, 0)
        AND (
          (v_dados->>'origem' = 'CR' AND cliente_id IS NOT DISTINCT FROM v_pessoa_id)
          OR (v_dados->>'origem' = 'CP' AND fornecedor_id IS NOT DISTINCT FROM v_pessoa_id)
        )
      LIMIT 1;

      IF v_existente IS NOT NULL THEN
        UPDATE stg_financeiro_aberto SET status='duplicado', erro='Lançamento já existe: '||v_existente WHERE id=rec.id;
        c_duplicados := c_duplicados + 1;
        CONTINUE;
      END IF;

      INSERT INTO financeiro_lancamentos(
        tipo, descricao, titulo,
        data_emissao, data_vencimento, data_pagamento,
        valor, valor_pago,
        cliente_id, fornecedor_id, conta_contabil_id,
        forma_pagamento, banco,
        parcela_numero, parcela_total,
        nome_abreviado_origem, codigo_fluxo_origem,
        status, origem_tipo, ativo
      ) VALUES (
        COALESCE(v_dados->>'tipo','receber'),
        NULLIF(v_dados->>'descricao',''),
        NULLIF(v_dados->>'titulo',''),
        NULLIF(v_dados->>'data_emissao','')::date,
        (v_dados->>'data_vencimento')::date,
        NULLIF(v_dados->>'data_pagamento','')::date,
        COALESCE((v_dados->>'valor')::numeric, 0),
        NULLIF(v_dados->>'valor_pago','')::numeric,
        CASE WHEN v_dados->>'origem'='CR' THEN v_pessoa_id END,
        CASE WHEN v_dados->>'origem'='CP' THEN v_pessoa_id END,
        v_conta_id,
        NULLIF(v_dados->>'forma_pagamento',''),
        NULLIF(v_dados->>'banco',''),
        NULLIF(v_dados->>'parcela_numero','')::int,
        NULLIF(v_dados->>'parcela_total','')::int,
        NULLIF(v_dados->>'nome_abreviado',''),
        NULLIF(v_dados->>'origem',''),
        CASE
          WHEN NULLIF(v_dados->>'data_pagamento','') IS NOT NULL THEN 'pago'
          WHEN COALESCE((v_dados->>'valor_pago')::numeric,0) > 0 THEN 'parcial'
          ELSE 'aberto'
        END,
        'migracao_conciliacao',
        true
      );

      IF v_dados->>'origem' = 'CR' THEN c_cr := c_cr + 1; ELSE c_cp := c_cp + 1; END IF;
      c_inseridos := c_inseridos + 1;
      UPDATE stg_financeiro_aberto SET status='consolidado' WHERE id=rec.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE stg_financeiro_aberto SET status='erro', erro=SQLERRM WHERE id=rec.id;
      c_erros := c_erros + 1;
    END;
  END LOOP;

  UPDATE importacao_lotes SET
    status = CASE WHEN c_erros = 0 THEN 'concluido' WHEN c_inseridos + c_atualizados > 0 THEN 'parcial' ELSE 'erro' END,
    registros_sucesso = c_inseridos + c_atualizados,
    registros_atualizados = c_atualizados,
    registros_duplicados = c_duplicados,
    registros_erro = c_erros,
    resumo = jsonb_build_object(
      'modo','merge',
      'grupos', c_grupos, 'planos', c_planos,
      'fornecedores', c_forn, 'clientes', c_cli,
      'produtos', c_prod, 'insumos', c_insumo,
      'estoque', c_estq,
      'cr', c_cr, 'cp', c_cp,
      'inseridos', c_inseridos, 'atualizados', c_atualizados,
      'duplicados', c_duplicados, 'erros', c_erros
    ),
    updated_at = now()
  WHERE id = p_lote_id;

  RETURN jsonb_build_object(
    'modo','merge',
    'grupos', c_grupos, 'planos', c_planos,
    'fornecedores', c_forn, 'clientes', c_cli,
    'produtos', c_prod, 'insumos', c_insumo,
    'estoque', c_estq,
    'cr', c_cr, 'cp', c_cp,
    'inseridos', c_inseridos, 'atualizados', c_atualizados,
    'duplicados', c_duplicados, 'erros', c_erros
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_lote_conciliacao(uuid) TO authenticated;

-- ============================================================
-- 2) consolidar_lote_faturamento v2: auto-cria cliente faltante
-- ============================================================
CREATE OR REPLACE FUNCTION public.consolidar_lote_faturamento(p_lote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  IF NOT EXISTS (SELECT 1 FROM importacao_lotes WHERE id = p_lote_id AND status IN ('staging', 'pronto_para_consolidar', 'validado')) THEN
    RETURN jsonb_build_object('erro', 'Lote não encontrado ou não está em staging');
  END IF;

  UPDATE importacao_lotes SET status = 'consolidando' WHERE id = p_lote_id;

  FOR rec IN SELECT id, dados, status FROM stg_faturamento WHERE lote_id = p_lote_id AND status = 'pendente'
  LOOP
    BEGIN
      v_dados := rec.dados;
      v_existing_nf := NULL;

      -- Dedup
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

      -- Resolve cliente (por CNPJ exato OU normalizado)
      v_cliente_id := NULL;
      v_cnpj_clean := regexp_replace(COALESCE(v_dados->>'cpf_cnpj_cliente',''), '[^0-9]', '', 'g');

      IF v_cnpj_clean <> '' THEN
        SELECT id INTO v_cliente_id FROM clientes
        WHERE regexp_replace(COALESCE(cpf_cnpj,''), '[^0-9]', '', 'g') = v_cnpj_clean
        LIMIT 1;

        -- Auto-cria cliente mínimo se não existir
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
        cliente_id, natureza_operacao, status, tipo, tipo_operacao,
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
        'autorizada',
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
          IF v_item->>'codigo_legado_produto' IS NOT NULL AND v_item->>'codigo_legado_produto' != '' THEN
            SELECT id INTO v_produto_id FROM produtos WHERE codigo_legado = v_item->>'codigo_legado_produto' LIMIT 1;
          END IF;
          IF v_produto_id IS NULL AND v_item->>'codigo_produto' IS NOT NULL AND v_item->>'codigo_produto' != '' THEN
            SELECT id INTO v_produto_id FROM produtos WHERE codigo_interno = v_item->>'codigo_produto' LIMIT 1;
          END IF;

          INSERT INTO notas_fiscais_itens (
            nota_fiscal_id, produto_id, codigo_produto, descricao, quantidade, unidade,
            valor_unitario, valor_total, ncm, cfop, cst,
            icms_base, icms_aliquota, icms_valor,
            ipi_aliquota, ipi_valor,
            pis_aliquota, pis_valor,
            cofins_aliquota, cofins_valor
          ) VALUES (
            v_nf_id, v_produto_id,
            COALESCE(v_item->>'codigo_produto', ''),
            COALESCE(v_item->>'descricao', ''),
            COALESCE((v_item->>'quantidade')::numeric, 0),
            COALESCE(v_item->>'unidade', 'UN'),
            COALESCE((v_item->>'valor_unitario')::numeric, 0),
            COALESCE((v_item->>'valor_total')::numeric, 0),
            v_item->>'ncm', v_item->>'cfop', v_item->>'cst',
            NULLIF(v_item->>'icms_base','')::numeric,
            NULLIF(v_item->>'icms_aliquota','')::numeric,
            NULLIF(v_item->>'icms_valor','')::numeric,
            NULLIF(v_item->>'ipi_aliquota','')::numeric,
            NULLIF(v_item->>'ipi_valor','')::numeric,
            NULLIF(v_item->>'pis_aliquota','')::numeric,
            NULLIF(v_item->>'pis_valor','')::numeric,
            NULLIF(v_item->>'cofins_aliquota','')::numeric,
            NULLIF(v_item->>'cofins_valor','')::numeric
          );
          v_inseridos_itens := v_inseridos_itens + 1;
        END LOOP;
      END IF;

      UPDATE stg_faturamento SET status = 'consolidado' WHERE id = rec.id;

    EXCEPTION WHEN OTHERS THEN
      UPDATE stg_faturamento SET status = 'erro', erro = SQLERRM WHERE id = rec.id;
      v_erros := v_erros + 1;
    END;
  END LOOP;

  UPDATE importacao_lotes SET
    status = CASE WHEN v_erros = 0 THEN 'concluido' WHEN v_inseridos_nf > 0 THEN 'parcial' ELSE 'erro' END,
    registros_sucesso = v_inseridos_nf,
    registros_erro = v_erros,
    resumo = jsonb_build_object('nfs_inseridas', v_inseridos_nf, 'itens_inseridos', v_inseridos_itens, 'clientes_criados', v_clientes_criados, 'erros', v_erros),
    updated_at = now()
  WHERE id = p_lote_id;

  RETURN jsonb_build_object('nfs_inseridas', v_inseridos_nf, 'itens_inseridos', v_inseridos_itens, 'clientes_criados', v_clientes_criados, 'erros', v_erros);
END;
$$;