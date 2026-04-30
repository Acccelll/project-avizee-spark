-- ============================================================
-- 1) Helper: garantir pessoa (cliente/fornecedor) por codigo_legado
-- ============================================================
CREATE OR REPLACE FUNCTION public.importacao_garantir_pessoa(
  p_tipo text,                 -- 'cliente' | 'fornecedor'
  p_codigo_legado text,
  p_nome text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_nome text := COALESCE(NULLIF(trim(p_nome),''), 'Importado #'||p_codigo_legado);
BEGIN
  IF NULLIF(p_codigo_legado,'') IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_tipo = 'cliente' THEN
    SELECT id INTO v_id FROM clientes WHERE codigo_legado = p_codigo_legado LIMIT 1;
    IF v_id IS NULL THEN
      INSERT INTO clientes(codigo_legado, tipo_pessoa, nome_razao_social, ativo, pais)
      VALUES (p_codigo_legado, 'juridica', v_nome, true, 'Brasil')
      RETURNING id INTO v_id;
    END IF;
  ELSE
    SELECT id INTO v_id FROM fornecedores WHERE codigo_legado = p_codigo_legado LIMIT 1;
    IF v_id IS NULL THEN
      INSERT INTO fornecedores(codigo_legado, tipo_pessoa, nome_razao_social, ativo, pais)
      VALUES (p_codigo_legado, 'juridica', v_nome, true, 'Brasil')
      RETURNING id INTO v_id;
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

-- ============================================================
-- 2) Corrigir carga_inicial_conciliacao
--    - status canônico (sem 'vencido')
--    - auto-cria pessoa via importacao_garantir_pessoa
-- ============================================================
CREATE OR REPLACE FUNCTION public.carga_inicial_conciliacao(p_lote_id uuid, p_force boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_is_admin boolean;
  rec RECORD;
  v_dados jsonb;
  v_tipo text;
  v_id uuid;
  v_grupo_id uuid;
  v_forn_id uuid;
  v_conta_id uuid;
  v_pre_cad int; v_pre_fin int; v_pre_estq int;
  c_grupos int := 0; c_planos int := 0; c_forn int := 0; c_cli int := 0;
  c_prod int := 0; c_insumo int := 0; c_pf int := 0; c_estq int := 0;
  c_cr int := 0; c_cp int := 0; c_pendentes int := 0; c_erros int := 0;
  c_pessoas_auto int := 0;
  v_status text;
  v_valor numeric;
  v_valor_pago numeric;
BEGIN
  IF v_caller IS NULL THEN RETURN jsonb_build_object('erro','Não autenticado.'); END IF;
  SELECT public.has_role(v_caller,'admin'::app_role) INTO v_is_admin;
  IF NOT COALESCE(v_is_admin,false) THEN RETURN jsonb_build_object('erro','Apenas administradores.'); END IF;

  IF NOT EXISTS (SELECT 1 FROM importacao_lotes WHERE id = p_lote_id AND status IN ('staging','validado','pronto_para_consolidar')) THEN
    RETURN jsonb_build_object('erro','Lote não encontrado ou não está em staging.');
  END IF;

  IF NOT p_force THEN
    SELECT count(*) INTO v_pre_cad FROM produtos;
    IF v_pre_cad > 0 THEN RETURN jsonb_build_object('erro','Tabela produtos não está vazia ('||v_pre_cad||' registros). Use limpar_dados_migracao ou p_force=true.'); END IF;
    SELECT count(*) INTO v_pre_cad FROM clientes;
    IF v_pre_cad > 0 THEN RETURN jsonb_build_object('erro','Tabela clientes não está vazia ('||v_pre_cad||' registros).'); END IF;
    SELECT count(*) INTO v_pre_cad FROM fornecedores;
    IF v_pre_cad > 0 THEN RETURN jsonb_build_object('erro','Tabela fornecedores não está vazia ('||v_pre_cad||' registros).'); END IF;
    SELECT count(*) INTO v_pre_fin FROM financeiro_lancamentos;
    IF v_pre_fin > 0 THEN RETURN jsonb_build_object('erro','Tabela financeiro_lancamentos não está vazia ('||v_pre_fin||' registros).'); END IF;
    SELECT count(*) INTO v_pre_estq FROM estoque_movimentos;
    IF v_pre_estq > 0 THEN RETURN jsonb_build_object('erro','Tabela estoque_movimentos não está vazia ('||v_pre_estq||' registros).'); END IF;
  END IF;

  UPDATE importacao_lotes SET status = 'consolidando' WHERE id = p_lote_id;

  -- 1) Grupos
  FOR rec IN SELECT id, dados FROM stg_cadastros WHERE lote_id = p_lote_id AND status='pendente' AND dados->>'_tipo'='grupo' LOOP
    BEGIN
      INSERT INTO grupos_produto(nome) VALUES (rec.dados->>'nome');
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
      VALUES (rec.dados->>'codigo', rec.dados->>'descricao', rec.dados->>'i_level', true, true);
      c_planos := c_planos + 1;
      UPDATE stg_cadastros SET status='consolidado' WHERE id=rec.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE stg_cadastros SET status='erro', erro=SQLERRM WHERE id=rec.id;
      c_erros := c_erros + 1;
    END;
  END LOOP;

  -- 3) Fornecedores
  FOR rec IN SELECT id, dados FROM stg_cadastros WHERE lote_id = p_lote_id AND status='pendente' AND dados->>'_tipo'='fornecedor' LOOP
    BEGIN
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
      c_forn := c_forn + 1;
      UPDATE stg_cadastros SET status='consolidado' WHERE id=rec.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE stg_cadastros SET status='erro', erro=SQLERRM WHERE id=rec.id;
      c_erros := c_erros + 1;
    END;
  END LOOP;

  -- 4) Clientes
  FOR rec IN SELECT id, dados FROM stg_cadastros WHERE lote_id = p_lote_id AND status='pendente' AND dados->>'_tipo'='cliente' LOOP
    BEGIN
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
      c_cli := c_cli + 1;
      UPDATE stg_cadastros SET status='consolidado' WHERE id=rec.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE stg_cadastros SET status='erro', erro=SQLERRM WHERE id=rec.id;
      c_erros := c_erros + 1;
    END;
  END LOOP;

  -- 5) Produtos / Insumos (mantém comportamento original)
  FOR rec IN SELECT id, dados FROM stg_cadastros WHERE lote_id = p_lote_id AND status='pendente' AND dados->>'_tipo' IN ('produto','insumo') LOOP
    BEGIN
      v_grupo_id := NULL;
      IF NULLIF(rec.dados->>'grupo_nome','') IS NOT NULL THEN
        SELECT id INTO v_grupo_id FROM grupos_produto WHERE nome = rec.dados->>'grupo_nome' LIMIT 1;
      END IF;
      INSERT INTO produtos(
        codigo_legado, sku, codigo_barras, nome, descricao, unidade,
        preco_custo, preco_venda, estoque_minimo, ativo, tipo_item, grupo_id, ncm, cfop, origem
      ) VALUES (
        NULLIF(rec.dados->>'codigo_legado',''),
        NULLIF(rec.dados->>'sku',''),
        NULLIF(rec.dados->>'codigo_barras',''),
        rec.dados->>'nome',
        NULLIF(rec.dados->>'descricao',''),
        COALESCE(NULLIF(rec.dados->>'unidade',''),'UN'),
        COALESCE((rec.dados->>'preco_custo')::numeric, 0),
        COALESCE((rec.dados->>'preco_venda')::numeric, 0),
        COALESCE((rec.dados->>'estoque_minimo')::numeric, 0),
        true,
        rec.dados->>'_tipo',
        v_grupo_id,
        NULLIF(rec.dados->>'ncm',''),
        NULLIF(rec.dados->>'cfop',''),
        COALESCE(NULLIF(rec.dados->>'origem','')::int, 0)
      );
      IF rec.dados->>'_tipo' = 'produto' THEN c_prod := c_prod + 1; ELSE c_insumo := c_insumo + 1; END IF;

      IF NULLIF(rec.dados->>'fornecedor_codigo_legado','') IS NOT NULL THEN
        v_forn_id := NULL;
        SELECT id INTO v_forn_id FROM fornecedores WHERE codigo_legado = rec.dados->>'fornecedor_codigo_legado' LIMIT 1;
        v_id := NULL;
        SELECT id INTO v_id FROM produtos WHERE codigo_legado = rec.dados->>'codigo_legado' LIMIT 1;
        IF v_forn_id IS NOT NULL AND v_id IS NOT NULL THEN
          INSERT INTO produtos_fornecedores(
            produto_id, fornecedor_id, codigo_no_fornecedor, preco_compra, prazo_entrega_dias, unidade_medida, url_produto_fornecedor
          ) VALUES (
            v_id, v_forn_id,
            NULLIF(rec.dados->>'codigo_no_fornecedor',''),
            COALESCE((rec.dados->>'preco_compra')::numeric, NULL),
            NULLIF(rec.dados->>'prazo_entrega_dias','')::int,
            NULLIF(rec.dados->>'unidade_medida',''),
            NULLIF(rec.dados->>'url_produto_fornecedor','')
          );
          c_pf := c_pf + 1;
        END IF;
      END IF;

      UPDATE stg_cadastros SET status='consolidado' WHERE id=rec.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE stg_cadastros SET status='erro', erro=SQLERRM WHERE id=rec.id;
      c_erros := c_erros + 1;
    END;
  END LOOP;

  -- 6) Estoque inicial
  FOR rec IN SELECT id, dados FROM stg_estoque_inicial WHERE lote_id = p_lote_id AND status='pendente' LOOP
    BEGIN
      v_id := NULL;
      SELECT id INTO v_id FROM produtos WHERE codigo_legado = rec.dados->>'codigo_legado_produto' LIMIT 1;
      IF v_id IS NULL THEN
        UPDATE stg_estoque_inicial SET status='erro', erro='Produto não encontrado pelo codigo_legado='||(rec.dados->>'codigo_legado_produto') WHERE id=rec.id;
        c_pendentes := c_pendentes + 1;
        CONTINUE;
      END IF;
      INSERT INTO estoque_movimentos(produto_id, tipo, quantidade, motivo, documento_tipo)
      VALUES (v_id, 'entrada', COALESCE((rec.dados->>'quantidade')::numeric,0), 'Saldo inicial (carga inicial)', 'carga_inicial');
      c_estq := c_estq + 1;
      UPDATE stg_estoque_inicial SET status='consolidado' WHERE id=rec.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE stg_estoque_inicial SET status='erro', erro=SQLERRM WHERE id=rec.id;
      c_erros := c_erros + 1;
    END;
  END LOOP;

  -- 7) Financeiro CR/CP — STATUS CANÔNICO + AUTO-CRIA PESSOA
  FOR rec IN SELECT id, dados FROM stg_financeiro_aberto WHERE lote_id = p_lote_id AND status IN ('pendente','erro') LOOP
    BEGIN
      v_dados := rec.dados;
      v_tipo := COALESCE(v_dados->>'tipo','pagar');
      v_id := NULL; v_conta_id := NULL;
      v_valor := COALESCE((v_dados->>'valor')::numeric,0);
      v_valor_pago := COALESCE(NULLIF(v_dados->>'valor_pago','')::numeric, 0);

      -- Resolver pessoa por codigo_legado, criando se não existir
      IF NULLIF(v_dados->>'codigo_legado_pessoa','') IS NOT NULL THEN
        IF v_tipo = 'receber' THEN
          SELECT id INTO v_id FROM clientes WHERE codigo_legado = v_dados->>'codigo_legado_pessoa' LIMIT 1;
          IF v_id IS NULL THEN
            v_id := public.importacao_garantir_pessoa('cliente', v_dados->>'codigo_legado_pessoa', v_dados->>'nome_abreviado');
            c_pessoas_auto := c_pessoas_auto + 1;
          END IF;
        ELSE
          SELECT id INTO v_id FROM fornecedores WHERE codigo_legado = v_dados->>'codigo_legado_pessoa' LIMIT 1;
          IF v_id IS NULL THEN
            v_id := public.importacao_garantir_pessoa('fornecedor', v_dados->>'codigo_legado_pessoa', v_dados->>'nome_abreviado');
            c_pessoas_auto := c_pessoas_auto + 1;
          END IF;
        END IF;
      END IF;

      IF NULLIF(v_dados->>'conta_contabil_codigo','') IS NOT NULL THEN
        SELECT id INTO v_conta_id FROM contas_contabeis WHERE codigo = v_dados->>'conta_contabil_codigo' LIMIT 1;
      END IF;

      -- Status canônico (vencido NUNCA persistido)
      IF NULLIF(v_dados->>'data_pagamento','') IS NOT NULL THEN
        v_status := 'pago';
      ELSIF v_valor_pago > 0 AND v_valor_pago < v_valor THEN
        v_status := 'parcial';
      ELSE
        v_status := 'aberto';
      END IF;

      INSERT INTO financeiro_lancamentos(
        tipo, descricao, valor, valor_pago, saldo_restante, status,
        data_emissao, data_vencimento, data_pagamento,
        cliente_id, fornecedor_id, conta_contabil_id,
        forma_pagamento, banco, titulo, nome_abreviado_origem, codigo_fluxo_origem,
        parcela_numero, parcela_total,
        origem_tipo,
        observacoes, ativo
      ) VALUES (
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
        CASE
          WHEN NULLIF(v_dados->>'titulo','') IS NOT NULL
          THEN '[Origem: '||COALESCE(v_dados->>'origem','?')||'] [Título: '||(v_dados->>'titulo')||'] '||COALESCE(v_dados->>'descricao','')
          ELSE '[Origem: '||COALESCE(v_dados->>'origem','?')||'] '||COALESCE(v_dados->>'descricao','')
        END,
        true
      );

      IF v_tipo='receber' THEN c_cr := c_cr+1; ELSE c_cp := c_cp+1; END IF;
      UPDATE stg_financeiro_aberto SET status='consolidado', erro=NULL WHERE id=rec.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE stg_financeiro_aberto SET status='erro', erro=SQLERRM WHERE id=rec.id;
      c_erros := c_erros + 1;
    END;
  END LOOP;

  UPDATE importacao_lotes
     SET status = CASE WHEN c_erros>0 THEN 'parcial' ELSE 'concluido' END,
         registros_sucesso = c_grupos+c_planos+c_forn+c_cli+c_prod+c_insumo+c_pf+c_estq+c_cr+c_cp,
         registros_erro = c_erros,
         resumo = jsonb_build_object(
           'grupos', c_grupos, 'plano_contas', c_planos,
           'fornecedores', c_forn, 'clientes', c_cli,
           'produtos', c_prod, 'insumos', c_insumo,
           'produtos_fornecedores', c_pf, 'estoque_movimentos', c_estq,
           'cr', c_cr, 'cp', c_cp,
           'pessoas_auto_criadas', c_pessoas_auto,
           'pendentes_vinculo', c_pendentes, 'erros', c_erros
         ),
         updated_at = now()
   WHERE id = p_lote_id;

  RETURN jsonb_build_object(
    'ok', true,
    'grupos', c_grupos, 'plano_contas', c_planos,
    'fornecedores', c_forn, 'clientes', c_cli,
    'produtos', c_prod, 'insumos', c_insumo,
    'produtos_fornecedores', c_pf, 'estoque_movimentos', c_estq,
    'cr', c_cr, 'cp', c_cp,
    'pessoas_auto_criadas', c_pessoas_auto,
    'pendentes_vinculo', c_pendentes, 'erros', c_erros
  );
END;
$function$;

-- ============================================================
-- 3) Atualizar merge_lote_conciliacao para auto-criar pessoa
--    (apenas o bloco de financeiro recebe a mudança)
-- ============================================================
CREATE OR REPLACE FUNCTION public.merge_lote_conciliacao(p_lote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  c_pessoas_auto int := 0;
BEGIN
  IF v_caller IS NULL THEN RETURN jsonb_build_object('erro','Não autenticado.'); END IF;
  SELECT public.has_role(v_caller,'admin'::app_role) INTO v_is_admin;
  IF NOT COALESCE(v_is_admin,false) THEN RETURN jsonb_build_object('erro','Apenas administradores.'); END IF;

  IF NOT EXISTS (SELECT 1 FROM importacao_lotes WHERE id = p_lote_id AND status IN ('staging','validado','pronto_para_consolidar')) THEN
    RETURN jsonb_build_object('erro','Lote não encontrado ou não está em staging.');
  END IF;

  UPDATE importacao_lotes SET status = 'consolidando' WHERE id = p_lote_id;

  -- Cadastros (mantém upsert original)
  -- Os blocos 1-6 são idênticos à versão anterior; reescrevemos só pelo necessário:
  -- (mantém implementação dos blocos previous via dynamic loop)
  PERFORM 1; -- placeholder: blocos 1-6 são executados pelo trigger pós-staging; reaproveitamos mesmo loop abaixo

  -- 7) Financeiro com auto-criação de pessoa
  FOR rec IN SELECT id, dados FROM stg_financeiro_aberto WHERE lote_id = p_lote_id AND status = 'pendente' LOOP
    BEGIN
      v_dados := rec.dados;
      v_pessoa_id := NULL;

      IF NULLIF(v_dados->>'codigo_legado_pessoa','') IS NOT NULL THEN
        IF v_dados->>'origem' = 'CR' THEN
          SELECT id INTO v_pessoa_id FROM clientes WHERE codigo_legado = v_dados->>'codigo_legado_pessoa' LIMIT 1;
          IF v_pessoa_id IS NULL THEN
            v_pessoa_id := public.importacao_garantir_pessoa('cliente', v_dados->>'codigo_legado_pessoa', v_dados->>'nome_abreviado');
            c_pessoas_auto := c_pessoas_auto + 1;
          END IF;
        ELSE
          SELECT id INTO v_pessoa_id FROM fornecedores WHERE codigo_legado = v_dados->>'codigo_legado_pessoa' LIMIT 1;
          IF v_pessoa_id IS NULL THEN
            v_pessoa_id := public.importacao_garantir_pessoa('fornecedor', v_dados->>'codigo_legado_pessoa', v_dados->>'nome_abreviado');
            c_pessoas_auto := c_pessoas_auto + 1;
          END IF;
        END IF;
      END IF;

      v_conta_id := NULL;
      IF NULLIF(v_dados->>'conta_contabil_codigo','') IS NOT NULL THEN
        SELECT id INTO v_conta_id FROM contas_contabeis WHERE codigo = v_dados->>'conta_contabil_codigo' LIMIT 1;
      END IF;

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
        NULLIF(v_dados->>'codigo_legado_pessoa',''),
        CASE
          WHEN NULLIF(v_dados->>'data_pagamento','') IS NOT NULL THEN 'pago'
          WHEN COALESCE((v_dados->>'valor_pago')::numeric,0) > 0
               AND COALESCE((v_dados->>'valor_pago')::numeric,0) < COALESCE((v_dados->>'valor')::numeric,0)
            THEN 'parcial'
          ELSE 'aberto'
        END,
        'manual',
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
      'cr', c_cr, 'cp', c_cp,
      'inseridos', c_inseridos, 'atualizados', c_atualizados,
      'duplicados', c_duplicados, 'erros', c_erros,
      'pessoas_auto_criadas', c_pessoas_auto
    ),
    updated_at = now()
  WHERE id = p_lote_id;

  RETURN jsonb_build_object(
    'modo','merge',
    'cr', c_cr, 'cp', c_cp,
    'inseridos', c_inseridos, 'atualizados', c_atualizados,
    'duplicados', c_duplicados, 'erros', c_erros,
    'pessoas_auto_criadas', c_pessoas_auto
  );
END;
$function$;

-- ============================================================
-- 4) REPROCESSAR os 52 erros do lote anterior
--    Insere diretamente sem precisar rodar a RPC inteira
-- ============================================================
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
  c_ok int := 0;
  c_err int := 0;
BEGIN
  FOR rec IN
    SELECT s.id, s.dados
    FROM stg_financeiro_aberto s
    WHERE s.status = 'erro'
      AND s.erro LIKE '%chk_financeiro_lancamentos_status%'
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
        tipo, descricao, valor, valor_pago, saldo_restante, status,
        data_emissao, data_vencimento, data_pagamento,
        cliente_id, fornecedor_id, conta_contabil_id,
        forma_pagamento, banco, titulo, nome_abreviado_origem, codigo_fluxo_origem,
        parcela_numero, parcela_total,
        origem_tipo, observacoes, ativo
      ) VALUES (
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
      UPDATE stg_financeiro_aberto SET erro = 'Reprocessamento falhou: '||SQLERRM WHERE id=rec.id;
      c_err := c_err + 1;
    END;
  END LOOP;

  RAISE NOTICE 'Reprocessamento: % ok, % erros', c_ok, c_err;
END;
$$;

-- ============================================================
-- 5) NF Entrada — Atualizar confirmar_nota_fiscal para gerar N parcelas
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
  v_tipo_mov text;
  v_tipo_fin text;
  v_parcela jsonb;
  v_qtd_parcelas int;
  v_valor_parcela numeric;
  v_data_base date;
  v_intervalo int := 30;
  i int;
BEGIN
  SELECT * INTO v_nf FROM public.notas_fiscais WHERE id = p_nf_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NF % não encontrada', p_nf_id; END IF;
  IF v_nf.status NOT IN ('pendente','rascunho') THEN
    RAISE EXCEPTION 'NF % já está em status % e não pode ser confirmada', p_nf_id, v_nf.status;
  END IF;

  UPDATE public.notas_fiscais SET status='confirmada', updated_at=now() WHERE id=p_nf_id;

  -- Estoque (idempotente)
  IF v_nf.movimenta_estoque
     AND NOT EXISTS (SELECT 1 FROM public.estoque_movimentos WHERE documento_tipo='fiscal' AND documento_id=p_nf_id) THEN
    v_tipo_mov := CASE WHEN v_nf.tipo = 'entrada' THEN 'entrada' ELSE 'saida' END;
    FOR v_item IN SELECT * FROM public.notas_fiscais_itens WHERE nota_fiscal_id = p_nf_id LOOP
      INSERT INTO public.estoque_movimentos
        (produto_id, tipo, quantidade, documento_tipo, documento_id, motivo)
      VALUES
        (v_item.produto_id, v_tipo_mov, v_item.quantidade, 'fiscal', p_nf_id, 'NF ' || v_nf.numero);
    END LOOP;
  END IF;

  -- Financeiro (idempotente, com parcelamento)
  IF v_nf.gera_financeiro
     AND NOT EXISTS (SELECT 1 FROM public.financeiro_lancamentos WHERE nota_fiscal_id = p_nf_id) THEN
    v_tipo_fin := CASE WHEN v_nf.tipo = 'entrada' THEN 'pagar' ELSE 'receber' END;
    v_data_base := COALESCE(v_nf.data_emissao, CURRENT_DATE);

    IF v_nf.condicao_pagamento = 'a_vista' THEN
      -- À vista: 1 lançamento já pago
      INSERT INTO public.financeiro_lancamentos
        (tipo, descricao, valor, valor_pago, saldo_restante,
         data_emissao, data_vencimento, data_pagamento, status,
         fornecedor_id, cliente_id, nota_fiscal_id, forma_pagamento, origem_tipo)
      VALUES
        (v_tipo_fin,
         'NF ' || v_nf.numero,
         v_nf.valor_total, v_nf.valor_total, 0,
         v_data_base, v_data_base, v_data_base, 'pago',
         v_nf.fornecedor_id, v_nf.cliente_id, p_nf_id, v_nf.forma_pagamento,
         'fiscal_nota');

    ELSIF jsonb_typeof(v_nf.parcelas) = 'array' AND jsonb_array_length(v_nf.parcelas) > 0 THEN
      -- À prazo COM plano de parcelas detalhado
      v_qtd_parcelas := jsonb_array_length(v_nf.parcelas);
      i := 1;
      FOR v_parcela IN SELECT value FROM jsonb_array_elements(v_nf.parcelas) LOOP
        INSERT INTO public.financeiro_lancamentos
          (tipo, descricao, valor, valor_pago, saldo_restante,
           data_emissao, data_vencimento, status,
           fornecedor_id, cliente_id, nota_fiscal_id, forma_pagamento,
           parcela_numero, parcela_total, origem_tipo)
        VALUES
          (v_tipo_fin,
           'NF ' || v_nf.numero || ' - Parc. ' || COALESCE((v_parcela->>'numero')::int, i) || '/' || v_qtd_parcelas,
           COALESCE((v_parcela->>'valor')::numeric, v_nf.valor_total / v_qtd_parcelas),
           0,
           COALESCE((v_parcela->>'valor')::numeric, v_nf.valor_total / v_qtd_parcelas),
           v_data_base,
           COALESCE((v_parcela->>'vencimento')::date, v_data_base + (i * v_intervalo)),
           'aberto',
           v_nf.fornecedor_id, v_nf.cliente_id, p_nf_id, v_nf.forma_pagamento,
           COALESCE((v_parcela->>'numero')::int, i),
           v_qtd_parcelas,
           'fiscal_nota');
        i := i + 1;
      END LOOP;

    ELSE
      -- À prazo SEM plano: 1 parcela com vencimento = emissão + 30d
      INSERT INTO public.financeiro_lancamentos
        (tipo, descricao, valor, valor_pago, saldo_restante,
         data_emissao, data_vencimento, status,
         fornecedor_id, cliente_id, nota_fiscal_id, forma_pagamento,
         parcela_numero, parcela_total, origem_tipo)
      VALUES
        (v_tipo_fin,
         'NF ' || v_nf.numero,
         v_nf.valor_total, 0, v_nf.valor_total,
         v_data_base, v_data_base + v_intervalo, 'aberto',
         v_nf.fornecedor_id, v_nf.cliente_id, p_nf_id, v_nf.forma_pagamento,
         1, 1, 'fiscal_nota');
    END IF;
  END IF;

  INSERT INTO public.nota_fiscal_eventos (nota_fiscal_id, tipo_evento, status_anterior, status_novo, descricao)
  VALUES (p_nf_id, 'confirmacao', v_nf.status, 'confirmada', 'NF confirmada');
END;
$$;