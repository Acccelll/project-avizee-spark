
-- ============================================================================
-- 1) NOVOS CAMPOS
-- ============================================================================
ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS data_emissao date,
  ADD COLUMN IF NOT EXISTS titulo text,
  ADD COLUMN IF NOT EXISTS nome_abreviado_origem text,
  ADD COLUMN IF NOT EXISTS codigo_fluxo_origem text;

ALTER TABLE public.contas_contabeis
  ADD COLUMN IF NOT EXISTS i_level text;

ALTER TABLE public.produtos_fornecedores
  ADD COLUMN IF NOT EXISTS url_produto_fornecedor text;

-- Índice util para match por código legado em CR/CP
CREATE INDEX IF NOT EXISTS idx_clientes_codigo_legado ON public.clientes(codigo_legado);
CREATE INDEX IF NOT EXISTS idx_fornecedores_codigo_legado ON public.fornecedores(codigo_legado);
CREATE INDEX IF NOT EXISTS idx_produtos_codigo_legado ON public.produtos(codigo_legado);
CREATE INDEX IF NOT EXISTS idx_contas_contabeis_codigo ON public.contas_contabeis(codigo);

-- ============================================================================
-- 2) LIMPEZA EXPANDIDA — agora também zera CADASTROS para uma carga inicial real
-- ============================================================================
CREATE OR REPLACE FUNCTION public.limpar_dados_migracao(p_confirmar boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_is_admin boolean;
  c_baixas int := 0; c_caixa int := 0; c_lanc int := 0;
  c_stg_fin int := 0; c_stg_estq int := 0; c_stg_fat int := 0; c_stg_cad int := 0; c_stg_xml int := 0;
  c_logs int := 0; c_lotes int := 0;
  c_estq_mov int := 0; c_prod_forn int := 0;
  c_prod int := 0; c_cli int := 0; c_forn int := 0;
  c_grupos int := 0; c_contas int := 0;
BEGIN
  IF NOT p_confirmar THEN
    RETURN jsonb_build_object('erro','Confirmação obrigatória (p_confirmar=true).');
  END IF;
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('erro','Não autenticado.');
  END IF;
  SELECT public.has_role(v_caller, 'admin'::app_role) INTO v_is_admin;
  IF NOT COALESCE(v_is_admin,false) THEN
    RETURN jsonb_build_object('erro','Apenas administradores podem executar esta limpeza.');
  END IF;

  -- Financeiro / caixa
  DELETE FROM public.financeiro_baixas WHERE true;       GET DIAGNOSTICS c_baixas = ROW_COUNT;
  DELETE FROM public.caixa_movimentos WHERE true;        GET DIAGNOSTICS c_caixa = ROW_COUNT;
  DELETE FROM public.financeiro_lancamentos WHERE true;  GET DIAGNOSTICS c_lanc = ROW_COUNT;

  -- Estoque & cadastros (vínculos primeiro, depois pais)
  DELETE FROM public.estoque_movimentos WHERE true;      GET DIAGNOSTICS c_estq_mov = ROW_COUNT;
  DELETE FROM public.produtos_fornecedores WHERE true;   GET DIAGNOSTICS c_prod_forn = ROW_COUNT;
  DELETE FROM public.produtos WHERE true;                GET DIAGNOSTICS c_prod = ROW_COUNT;
  DELETE FROM public.clientes WHERE true;                GET DIAGNOSTICS c_cli = ROW_COUNT;
  DELETE FROM public.fornecedores WHERE true;            GET DIAGNOSTICS c_forn = ROW_COUNT;
  DELETE FROM public.grupos_produto WHERE true;          GET DIAGNOSTICS c_grupos = ROW_COUNT;
  DELETE FROM public.contas_contabeis WHERE true;        GET DIAGNOSTICS c_contas = ROW_COUNT;

  -- Staging & logs
  DELETE FROM public.stg_financeiro_aberto WHERE true;   GET DIAGNOSTICS c_stg_fin = ROW_COUNT;
  DELETE FROM public.stg_estoque_inicial WHERE true;     GET DIAGNOSTICS c_stg_estq = ROW_COUNT;
  DELETE FROM public.stg_faturamento WHERE true;         GET DIAGNOSTICS c_stg_fat = ROW_COUNT;
  DELETE FROM public.stg_cadastros WHERE true;           GET DIAGNOSTICS c_stg_cad = ROW_COUNT;
  BEGIN
    DELETE FROM public.stg_compras_xml WHERE true;       GET DIAGNOSTICS c_stg_xml = ROW_COUNT;
  EXCEPTION WHEN undefined_table THEN c_stg_xml := 0; END;
  DELETE FROM public.importacao_logs WHERE true;         GET DIAGNOSTICS c_logs = ROW_COUNT;
  DELETE FROM public.importacao_lotes WHERE true;        GET DIAGNOSTICS c_lotes = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'apagados', jsonb_build_object(
      'financeiro_baixas', c_baixas,
      'caixa_movimentos', c_caixa,
      'financeiro_lancamentos', c_lanc,
      'estoque_movimentos', c_estq_mov,
      'produtos_fornecedores', c_prod_forn,
      'produtos', c_prod,
      'clientes', c_cli,
      'fornecedores', c_forn,
      'grupos_produto', c_grupos,
      'contas_contabeis', c_contas,
      'stg_financeiro_aberto', c_stg_fin,
      'stg_estoque_inicial', c_stg_estq,
      'stg_faturamento', c_stg_fat,
      'stg_cadastros', c_stg_cad,
      'stg_compras_xml', c_stg_xml,
      'importacao_logs', c_logs,
      'importacao_lotes', c_lotes
    )
  );
END;
$function$;

-- ============================================================================
-- 3) CARGA INICIAL — INSERT-ONLY, bloqueia se houver dados (a menos que p_force=true)
-- ============================================================================
-- Espera o lote já populado em stg_cadastros + stg_estoque_inicial + stg_financeiro_aberto.
-- Esquema dos dados (jsonb):
--   stg_cadastros:
--     {_tipo:'fornecedor', codigo_legado, cpf_cnpj, nome_razao_social, nome_fantasia, ...}
--     {_tipo:'cliente',    codigo_legado, cpf_cnpj, ...}
--     {_tipo:'grupo',      nome}
--     {_tipo:'produto'|'insumo', codigo_legado, nome, grupo_nome, unidade_medida, variacoes,
--                                preco_custo, preco_venda, peso, ncm, fornecedor_principal_legado,
--                                fornecedor_principal_nome, ref_fornecedor, url_produto_fornecedor}
--     {_tipo:'plano_conta', codigo, descricao, i_level}
--   stg_estoque_inicial:
--     {codigo_legado_produto, quantidade}
--   stg_financeiro_aberto:
--     {origem:'CR'|'CP', tipo:'receber'|'pagar', data_emissao, data_vencimento, data_pagamento,
--      valor, valor_pago, descricao, titulo, codigo_legado_pessoa, nome_abreviado,
--      forma_pagamento, banco, conta_contabil_codigo, parcela_numero, parcela_total}
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
  v_status text;
BEGIN
  -- Auth
  IF v_caller IS NULL THEN RETURN jsonb_build_object('erro','Não autenticado.'); END IF;
  SELECT public.has_role(v_caller,'admin'::app_role) INTO v_is_admin;
  IF NOT COALESCE(v_is_admin,false) THEN RETURN jsonb_build_object('erro','Apenas administradores.'); END IF;

  -- Lote válido?
  IF NOT EXISTS (SELECT 1 FROM importacao_lotes WHERE id = p_lote_id AND status IN ('staging','validado','pronto_para_consolidar')) THEN
    RETURN jsonb_build_object('erro','Lote não encontrado ou não está em staging.');
  END IF;

  -- INSERT-ONLY guard: tabelas-alvo devem estar vazias
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

  -- 1) Grupos de produto
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
        cep, logradouro, numero, complemento, bairro, cidade, uf, pais, caixa_postal,
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
        NULLIF(rec.dados->>'caixa_postal',''),
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

  -- 5) Produtos & Insumos
  FOR rec IN SELECT id, dados FROM stg_cadastros WHERE lote_id = p_lote_id AND status='pendente' AND dados->>'_tipo' IN ('produto','insumo') LOOP
    BEGIN
      v_grupo_id := NULL;
      IF NULLIF(rec.dados->>'grupo_nome','') IS NOT NULL THEN
        SELECT id INTO v_grupo_id FROM grupos_produto WHERE nome = rec.dados->>'grupo_nome' LIMIT 1;
      END IF;

      INSERT INTO produtos(
        codigo_legado, sku, nome, descricao, grupo_id, unidade_medida, variacoes,
        preco_custo, preco_venda, peso, ncm, tipo_item, eh_composto, ativo
      ) VALUES (
        NULLIF(rec.dados->>'codigo_legado',''),
        NULLIF(rec.dados->>'sku',''),
        rec.dados->>'nome',
        NULLIF(rec.dados->>'descricao',''),
        v_grupo_id,
        COALESCE(NULLIF(rec.dados->>'unidade_medida',''),'UN'),
        NULLIF(rec.dados->>'variacoes',''),
        COALESCE(NULLIF(rec.dados->>'preco_custo','')::numeric, 0),
        COALESCE(NULLIF(rec.dados->>'preco_venda','')::numeric, 0),
        COALESCE(NULLIF(rec.dados->>'peso','')::numeric, 0),
        COALESCE(NULLIF(rec.dados->>'ncm',''),'84369100'),
        rec.dados->>'_tipo',
        false,
        true
      ) RETURNING id INTO v_id;

      IF rec.dados->>'_tipo' = 'produto' THEN c_prod := c_prod+1; ELSE c_insumo := c_insumo+1; END IF;

      -- Vínculo produto-fornecedor (principal)
      v_forn_id := NULL;
      IF NULLIF(rec.dados->>'fornecedor_principal_legado','') IS NOT NULL THEN
        SELECT id INTO v_forn_id FROM fornecedores WHERE codigo_legado = rec.dados->>'fornecedor_principal_legado' LIMIT 1;
      END IF;
      IF v_forn_id IS NULL AND NULLIF(rec.dados->>'fornecedor_principal_nome','') IS NOT NULL THEN
        SELECT id INTO v_forn_id FROM fornecedores
         WHERE upper(unaccent(nome_razao_social)) = upper(unaccent(rec.dados->>'fornecedor_principal_nome')) LIMIT 1;
      END IF;
      IF v_forn_id IS NOT NULL THEN
        INSERT INTO produtos_fornecedores(
          produto_id, fornecedor_id, eh_principal,
          referencia_fornecedor, descricao_fornecedor, unidade_fornecedor, url_produto_fornecedor
        ) VALUES (
          v_id, v_forn_id, true,
          NULLIF(rec.dados->>'ref_fornecedor',''),
          NULLIF(rec.dados->>'ref_fornecedor',''),
          NULLIF(rec.dados->>'unidade_medida',''),
          NULLIF(rec.dados->>'url_produto_fornecedor','')
        );
        c_pf := c_pf + 1;
      END IF;

      UPDATE stg_cadastros SET status='consolidado' WHERE id=rec.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE stg_cadastros SET status='erro', erro=SQLERRM WHERE id=rec.id;
      c_erros := c_erros + 1;
    END;
  END LOOP;

  -- 6) Estoque inicial — gera estoque_movimentos do tipo 'entrada'/'inicial'
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

  -- 7) Financeiro CR/CP
  FOR rec IN SELECT id, dados FROM stg_financeiro_aberto WHERE lote_id = p_lote_id AND status='pendente' LOOP
    BEGIN
      v_dados := rec.dados;
      v_tipo := COALESCE(v_dados->>'tipo','pagar');
      v_id := NULL; v_conta_id := NULL;

      -- Resolver pessoa por codigo_legado
      IF NULLIF(v_dados->>'codigo_legado_pessoa','') IS NOT NULL THEN
        IF v_tipo = 'receber' THEN
          SELECT id INTO v_id FROM clientes WHERE codigo_legado = v_dados->>'codigo_legado_pessoa' LIMIT 1;
        ELSE
          SELECT id INTO v_id FROM fornecedores WHERE codigo_legado = v_dados->>'codigo_legado_pessoa' LIMIT 1;
        END IF;
      END IF;

      -- Resolver conta contábil
      IF NULLIF(v_dados->>'conta_contabil_codigo','') IS NOT NULL THEN
        SELECT id INTO v_conta_id FROM contas_contabeis WHERE codigo = v_dados->>'conta_contabil_codigo' LIMIT 1;
      END IF;

      -- Status derivado
      IF (v_dados->>'data_pagamento') IS NOT NULL AND (v_dados->>'data_pagamento') <> '' THEN
        v_status := 'pago';
      ELSIF (v_dados->>'data_vencimento') IS NOT NULL AND (v_dados->>'data_vencimento')::date < CURRENT_DATE THEN
        v_status := 'vencido';
      ELSE
        v_status := 'aberto';
      END IF;

      INSERT INTO financeiro_lancamentos(
        tipo, descricao, valor, valor_pago, saldo_restante, status,
        data_emissao, data_vencimento, data_pagamento,
        cliente_id, fornecedor_id, conta_contabil_id,
        forma_pagamento, banco, titulo, nome_abreviado_origem, codigo_fluxo_origem,
        parcela_numero, parcela_total,
        observacoes, ativo
      ) VALUES (
        v_tipo,
        NULLIF(v_dados->>'descricao',''),
        COALESCE((v_dados->>'valor')::numeric,0),
        CASE WHEN v_status='pago' THEN COALESCE((v_dados->>'valor')::numeric,0) ELSE 0 END,
        CASE WHEN v_status='pago' THEN 0 ELSE COALESCE((v_dados->>'valor')::numeric,0) END,
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
        CASE
          WHEN NULLIF(v_dados->>'titulo','') IS NOT NULL
          THEN '[Origem: '||COALESCE(v_dados->>'origem','?')||'] [Título: '||(v_dados->>'titulo')||'] '||COALESCE(v_dados->>'descricao','')
          ELSE '[Origem: '||COALESCE(v_dados->>'origem','?')||'] '||COALESCE(v_dados->>'descricao','')
        END,
        true
      );

      IF v_tipo='receber' THEN c_cr := c_cr+1; ELSE c_cp := c_cp+1; END IF;
      IF v_id IS NULL AND NULLIF(v_dados->>'codigo_legado_pessoa','') IS NOT NULL THEN
        c_pendentes := c_pendentes + 1;
        INSERT INTO importacao_logs(lote_id, nivel, etapa, mensagem)
        VALUES (p_lote_id,'warning','financeiro','Pessoa não vinculada: cod='||(v_dados->>'codigo_legado_pessoa')||' tipo='||v_tipo);
      END IF;
      UPDATE stg_financeiro_aberto SET status='consolidado' WHERE id=rec.id;
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
    'pendentes_vinculo', c_pendentes, 'erros', c_erros
  );
END;
$function$;
