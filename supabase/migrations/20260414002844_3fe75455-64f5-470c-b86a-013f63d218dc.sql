
-- =====================================================
-- FASE 1: SANEAMENTO ESTRUTURAL DA MIGRAÇÃO
-- =====================================================

-- 1. Novas colunas em produtos
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS codigo_legado text;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS variacoes text;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS tipo_item text DEFAULT 'produto';

-- 2. Novas colunas em clientes/fornecedores
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS codigo_legado text;
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS codigo_legado text;

-- 3. Índices de deduplicação
CREATE INDEX IF NOT EXISTS idx_produtos_codigo_legado ON public.produtos(codigo_legado) WHERE codigo_legado IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clientes_codigo_legado ON public.clientes(codigo_legado) WHERE codigo_legado IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fornecedores_codigo_legado ON public.fornecedores(codigo_legado) WHERE codigo_legado IS NOT NULL;

-- 4. Colunas extras em importacao_lotes para auditoria detalhada
ALTER TABLE public.importacao_lotes ADD COLUMN IF NOT EXISTS registros_duplicados integer DEFAULT 0;
ALTER TABLE public.importacao_lotes ADD COLUMN IF NOT EXISTS registros_atualizados integer DEFAULT 0;
ALTER TABLE public.importacao_lotes ADD COLUMN IF NOT EXISTS registros_ignorados integer DEFAULT 0;
ALTER TABLE public.importacao_lotes ADD COLUMN IF NOT EXISTS fase text;
ALTER TABLE public.importacao_lotes ADD COLUMN IF NOT EXISTS resumo jsonb;

-- 5. Tabela de staging para cadastros
CREATE TABLE IF NOT EXISTS public.stg_cadastros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES public.importacao_lotes(id) ON DELETE CASCADE,
  dados jsonb NOT NULL,
  status text DEFAULT 'pendente',
  erro text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stg_cadastros_lote ON public.stg_cadastros(lote_id);

ALTER TABLE public.stg_cadastros ENABLE ROW LEVEL SECURITY;
CREATE POLICY stg_cad_select ON public.stg_cadastros FOR SELECT TO authenticated USING (true);
CREATE POLICY stg_cad_insert ON public.stg_cadastros FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY stg_cad_update ON public.stg_cadastros FOR UPDATE TO authenticated USING (true);
CREATE POLICY stg_cad_delete ON public.stg_cadastros FOR DELETE TO authenticated USING (true);

-- 6. Adicionar FK em stg_* existentes (se ainda não existem)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stg_estoque_inicial_lote_id_fkey') THEN
    ALTER TABLE public.stg_estoque_inicial ADD CONSTRAINT stg_estoque_inicial_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES public.importacao_lotes(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stg_financeiro_aberto_lote_id_fkey') THEN
    ALTER TABLE public.stg_financeiro_aberto ADD CONSTRAINT stg_financeiro_aberto_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES public.importacao_lotes(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stg_faturamento_lote_id_fkey') THEN
    ALTER TABLE public.stg_faturamento ADD CONSTRAINT stg_faturamento_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES public.importacao_lotes(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 7. Índices em stg_* existentes
CREATE INDEX IF NOT EXISTS idx_stg_estoque_lote ON public.stg_estoque_inicial(lote_id);
CREATE INDEX IF NOT EXISTS idx_stg_financeiro_lote ON public.stg_financeiro_aberto(lote_id);
CREATE INDEX IF NOT EXISTS idx_stg_faturamento_lote ON public.stg_faturamento(lote_id);

-- 8. Atualizar CHECK constraint do financeiro_lancamentos para incluir 'parcial'
ALTER TABLE public.financeiro_lancamentos DROP CONSTRAINT IF EXISTS chk_financeiro_lancamentos_status;
ALTER TABLE public.financeiro_lancamentos ADD CONSTRAINT chk_financeiro_lancamentos_status
  CHECK (status IN ('aberto', 'pago', 'cancelado', 'vencido', 'parcial'));

-- =====================================================
-- RPC: consolidar_lote_cadastros
-- =====================================================
CREATE OR REPLACE FUNCTION public.consolidar_lote_cadastros(p_lote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_inseridos int := 0;
  v_atualizados int := 0;
  v_erros int := 0;
  v_ignorados int := 0;
  v_tipo text;
  v_dados jsonb;
  v_existing_id uuid;
  v_grupo_id uuid;
BEGIN
  -- Verificar se lote existe e está em staging
  IF NOT EXISTS (SELECT 1 FROM importacao_lotes WHERE id = p_lote_id AND status IN ('staging', 'pronto_para_consolidar', 'validado')) THEN
    RETURN jsonb_build_object('erro', 'Lote não encontrado ou não está em staging');
  END IF;

  UPDATE importacao_lotes SET status = 'consolidando' WHERE id = p_lote_id;

  FOR rec IN SELECT id, dados, status FROM stg_cadastros WHERE lote_id = p_lote_id AND status = 'pendente'
  LOOP
    BEGIN
      v_dados := rec.dados;
      v_tipo := v_dados->>'_tipo_entidade'; -- 'produto', 'cliente', 'fornecedor', 'grupo_produto'

      IF v_tipo = 'grupo_produto' THEN
        -- Upsert grupo
        SELECT id INTO v_existing_id FROM grupos_produto WHERE nome = (v_dados->>'nome') LIMIT 1;
        IF v_existing_id IS NULL THEN
          INSERT INTO grupos_produto (nome, descricao)
          VALUES (v_dados->>'nome', v_dados->>'descricao')
          RETURNING id INTO v_existing_id;
          v_inseridos := v_inseridos + 1;
        ELSE
          v_ignorados := v_ignorados + 1;
        END IF;
        UPDATE stg_cadastros SET status = 'consolidado' WHERE id = rec.id;

      ELSIF v_tipo = 'produto' THEN
        v_existing_id := NULL;
        -- Lookup: codigo_legado > codigo_interno
        IF v_dados->>'codigo_legado' IS NOT NULL AND v_dados->>'codigo_legado' != '' THEN
          SELECT id INTO v_existing_id FROM produtos WHERE codigo_legado = v_dados->>'codigo_legado' LIMIT 1;
        END IF;
        IF v_existing_id IS NULL AND v_dados->>'codigo_interno' IS NOT NULL AND v_dados->>'codigo_interno' != '' THEN
          SELECT id INTO v_existing_id FROM produtos WHERE codigo_interno = v_dados->>'codigo_interno' LIMIT 1;
        END IF;
        -- Resolve grupo
        v_grupo_id := NULL;
        IF v_dados->>'grupo_nome' IS NOT NULL AND v_dados->>'grupo_nome' != '' THEN
          SELECT id INTO v_grupo_id FROM grupos_produto WHERE nome = v_dados->>'grupo_nome' LIMIT 1;
          IF v_grupo_id IS NULL THEN
            INSERT INTO grupos_produto (nome) VALUES (v_dados->>'grupo_nome') RETURNING id INTO v_grupo_id;
          END IF;
        END IF;

        IF v_existing_id IS NOT NULL THEN
          UPDATE produtos SET
            nome = COALESCE(NULLIF(v_dados->>'nome',''), nome),
            codigo_legado = COALESCE(NULLIF(v_dados->>'codigo_legado',''), codigo_legado),
            codigo_interno = COALESCE(NULLIF(v_dados->>'codigo_interno',''), codigo_interno),
            unidade_medida = COALESCE(NULLIF(v_dados->>'unidade_medida',''), unidade_medida),
            preco_custo = COALESCE((v_dados->>'preco_custo')::numeric, preco_custo),
            preco_venda = COALESCE((v_dados->>'preco_venda')::numeric, preco_venda),
            peso = COALESCE((v_dados->>'peso')::numeric, peso),
            ncm = COALESCE(NULLIF(v_dados->>'ncm',''), ncm),
            gtin = COALESCE(NULLIF(v_dados->>'gtin',''), gtin),
            variacoes = COALESCE(NULLIF(v_dados->>'variacoes',''), variacoes),
            tipo_item = COALESCE(NULLIF(v_dados->>'tipo_item',''), tipo_item),
            grupo_id = COALESCE(v_grupo_id, grupo_id),
            updated_at = now()
          WHERE id = v_existing_id;
          v_atualizados := v_atualizados + 1;
        ELSE
          INSERT INTO produtos (nome, codigo_legado, codigo_interno, unidade_medida, preco_custo, preco_venda, peso, ncm, gtin, variacoes, tipo_item, grupo_id)
          VALUES (
            v_dados->>'nome',
            NULLIF(v_dados->>'codigo_legado',''),
            NULLIF(v_dados->>'codigo_interno',''),
            COALESCE(NULLIF(v_dados->>'unidade_medida',''), 'UN'),
            (v_dados->>'preco_custo')::numeric,
            (v_dados->>'preco_venda')::numeric,
            (v_dados->>'peso')::numeric,
            NULLIF(v_dados->>'ncm',''),
            NULLIF(v_dados->>'gtin',''),
            NULLIF(v_dados->>'variacoes',''),
            COALESCE(NULLIF(v_dados->>'tipo_item',''), 'produto'),
            v_grupo_id
          );
          v_inseridos := v_inseridos + 1;
        END IF;
        UPDATE stg_cadastros SET status = 'consolidado' WHERE id = rec.id;

      ELSIF v_tipo = 'cliente' THEN
        v_existing_id := NULL;
        IF v_dados->>'codigo_legado' IS NOT NULL AND v_dados->>'codigo_legado' != '' THEN
          SELECT id INTO v_existing_id FROM clientes WHERE codigo_legado = v_dados->>'codigo_legado' LIMIT 1;
        END IF;
        IF v_existing_id IS NULL AND v_dados->>'cpf_cnpj' IS NOT NULL AND v_dados->>'cpf_cnpj' != '' THEN
          SELECT id INTO v_existing_id FROM clientes WHERE cpf_cnpj = v_dados->>'cpf_cnpj' LIMIT 1;
        END IF;

        IF v_existing_id IS NOT NULL THEN
          UPDATE clientes SET
            nome_razao_social = COALESCE(NULLIF(v_dados->>'nome_razao_social',''), nome_razao_social),
            nome_fantasia = COALESCE(NULLIF(v_dados->>'nome_fantasia',''), nome_fantasia),
            codigo_legado = COALESCE(NULLIF(v_dados->>'codigo_legado',''), codigo_legado),
            cpf_cnpj = COALESCE(NULLIF(v_dados->>'cpf_cnpj',''), cpf_cnpj),
            inscricao_estadual = COALESCE(NULLIF(v_dados->>'inscricao_estadual',''), inscricao_estadual),
            email = COALESCE(NULLIF(v_dados->>'email',''), email),
            telefone = COALESCE(NULLIF(v_dados->>'telefone',''), telefone),
            celular = COALESCE(NULLIF(v_dados->>'celular',''), celular),
            contato = COALESCE(NULLIF(v_dados->>'contato',''), contato),
            logradouro = COALESCE(NULLIF(v_dados->>'logradouro',''), logradouro),
            numero = COALESCE(NULLIF(v_dados->>'numero',''), numero),
            complemento = COALESCE(NULLIF(v_dados->>'complemento',''), complemento),
            bairro = COALESCE(NULLIF(v_dados->>'bairro',''), bairro),
            cidade = COALESCE(NULLIF(v_dados->>'cidade',''), cidade),
            uf = COALESCE(NULLIF(v_dados->>'uf',''), uf),
            cep = COALESCE(NULLIF(v_dados->>'cep',''), cep),
            prazo_padrao = COALESCE((v_dados->>'prazo_padrao')::int, prazo_padrao),
            observacoes = COALESCE(NULLIF(v_dados->>'observacoes',''), observacoes),
            tipo_pessoa = COALESCE(NULLIF(v_dados->>'tipo_pessoa',''), tipo_pessoa),
            updated_at = now()
          WHERE id = v_existing_id;
          v_atualizados := v_atualizados + 1;
        ELSE
          INSERT INTO clientes (nome_razao_social, nome_fantasia, codigo_legado, cpf_cnpj, inscricao_estadual, email, telefone, celular, contato, logradouro, numero, complemento, bairro, cidade, uf, cep, prazo_padrao, observacoes, tipo_pessoa)
          VALUES (
            COALESCE(v_dados->>'nome_razao_social', 'SEM NOME'),
            NULLIF(v_dados->>'nome_fantasia',''),
            NULLIF(v_dados->>'codigo_legado',''),
            NULLIF(v_dados->>'cpf_cnpj',''),
            NULLIF(v_dados->>'inscricao_estadual',''),
            NULLIF(v_dados->>'email',''),
            NULLIF(v_dados->>'telefone',''),
            NULLIF(v_dados->>'celular',''),
            NULLIF(v_dados->>'contato',''),
            NULLIF(v_dados->>'logradouro',''),
            NULLIF(v_dados->>'numero',''),
            NULLIF(v_dados->>'complemento',''),
            NULLIF(v_dados->>'bairro',''),
            NULLIF(v_dados->>'cidade',''),
            NULLIF(v_dados->>'uf',''),
            NULLIF(v_dados->>'cep',''),
            (v_dados->>'prazo_padrao')::int,
            NULLIF(v_dados->>'observacoes',''),
            COALESCE(NULLIF(v_dados->>'tipo_pessoa',''), 'J')
          );
          v_inseridos := v_inseridos + 1;
        END IF;
        UPDATE stg_cadastros SET status = 'consolidado' WHERE id = rec.id;

      ELSIF v_tipo = 'fornecedor' THEN
        v_existing_id := NULL;
        IF v_dados->>'codigo_legado' IS NOT NULL AND v_dados->>'codigo_legado' != '' THEN
          SELECT id INTO v_existing_id FROM fornecedores WHERE codigo_legado = v_dados->>'codigo_legado' LIMIT 1;
        END IF;
        IF v_existing_id IS NULL AND v_dados->>'cpf_cnpj' IS NOT NULL AND v_dados->>'cpf_cnpj' != '' THEN
          SELECT id INTO v_existing_id FROM fornecedores WHERE cpf_cnpj = v_dados->>'cpf_cnpj' LIMIT 1;
        END IF;

        IF v_existing_id IS NOT NULL THEN
          UPDATE fornecedores SET
            nome_razao_social = COALESCE(NULLIF(v_dados->>'nome_razao_social',''), nome_razao_social),
            nome_fantasia = COALESCE(NULLIF(v_dados->>'nome_fantasia',''), nome_fantasia),
            codigo_legado = COALESCE(NULLIF(v_dados->>'codigo_legado',''), codigo_legado),
            cpf_cnpj = COALESCE(NULLIF(v_dados->>'cpf_cnpj',''), cpf_cnpj),
            inscricao_estadual = COALESCE(NULLIF(v_dados->>'inscricao_estadual',''), inscricao_estadual),
            email = COALESCE(NULLIF(v_dados->>'email',''), email),
            telefone = COALESCE(NULLIF(v_dados->>'telefone',''), telefone),
            celular = COALESCE(NULLIF(v_dados->>'celular',''), celular),
            contato = COALESCE(NULLIF(v_dados->>'contato',''), contato),
            logradouro = COALESCE(NULLIF(v_dados->>'logradouro',''), logradouro),
            numero = COALESCE(NULLIF(v_dados->>'numero',''), numero),
            complemento = COALESCE(NULLIF(v_dados->>'complemento',''), complemento),
            bairro = COALESCE(NULLIF(v_dados->>'bairro',''), bairro),
            cidade = COALESCE(NULLIF(v_dados->>'cidade',''), cidade),
            uf = COALESCE(NULLIF(v_dados->>'uf',''), uf),
            cep = COALESCE(NULLIF(v_dados->>'cep',''), cep),
            prazo_padrao = COALESCE((v_dados->>'prazo_padrao')::int, prazo_padrao),
            observacoes = COALESCE(NULLIF(v_dados->>'observacoes',''), observacoes),
            tipo_pessoa = COALESCE(NULLIF(v_dados->>'tipo_pessoa',''), tipo_pessoa),
            updated_at = now()
          WHERE id = v_existing_id;
          v_atualizados := v_atualizados + 1;
        ELSE
          INSERT INTO fornecedores (nome_razao_social, nome_fantasia, codigo_legado, cpf_cnpj, inscricao_estadual, email, telefone, celular, contato, logradouro, numero, complemento, bairro, cidade, uf, cep, prazo_padrao, observacoes, tipo_pessoa)
          VALUES (
            COALESCE(v_dados->>'nome_razao_social', 'SEM NOME'),
            NULLIF(v_dados->>'nome_fantasia',''),
            NULLIF(v_dados->>'codigo_legado',''),
            NULLIF(v_dados->>'cpf_cnpj',''),
            NULLIF(v_dados->>'inscricao_estadual',''),
            NULLIF(v_dados->>'email',''),
            NULLIF(v_dados->>'telefone',''),
            NULLIF(v_dados->>'celular',''),
            NULLIF(v_dados->>'contato',''),
            NULLIF(v_dados->>'logradouro',''),
            NULLIF(v_dados->>'numero',''),
            NULLIF(v_dados->>'complemento',''),
            NULLIF(v_dados->>'bairro',''),
            NULLIF(v_dados->>'cidade',''),
            NULLIF(v_dados->>'uf',''),
            NULLIF(v_dados->>'cep',''),
            (v_dados->>'prazo_padrao')::int,
            NULLIF(v_dados->>'observacoes',''),
            COALESCE(NULLIF(v_dados->>'tipo_pessoa',''), 'J')
          );
          v_inseridos := v_inseridos + 1;
        END IF;
        UPDATE stg_cadastros SET status = 'consolidado' WHERE id = rec.id;

      ELSE
        UPDATE stg_cadastros SET status = 'erro', erro = 'Tipo de entidade desconhecido: ' || COALESCE(v_tipo, 'NULL') WHERE id = rec.id;
        v_erros := v_erros + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      UPDATE stg_cadastros SET status = 'erro', erro = SQLERRM WHERE id = rec.id;
      v_erros := v_erros + 1;
    END;
  END LOOP;

  -- Atualizar lote
  UPDATE importacao_lotes SET
    status = CASE WHEN v_erros = 0 THEN 'concluido' WHEN v_inseridos + v_atualizados > 0 THEN 'parcial' ELSE 'erro' END,
    registros_sucesso = v_inseridos + v_atualizados,
    registros_erro = v_erros,
    registros_atualizados = v_atualizados,
    registros_ignorados = v_ignorados,
    resumo = jsonb_build_object('inseridos', v_inseridos, 'atualizados', v_atualizados, 'erros', v_erros, 'ignorados', v_ignorados),
    updated_at = now()
  WHERE id = p_lote_id;

  RETURN jsonb_build_object('inseridos', v_inseridos, 'atualizados', v_atualizados, 'erros', v_erros, 'ignorados', v_ignorados);
END;
$$;

-- =====================================================
-- RPC: consolidar_lote_estoque
-- =====================================================
CREATE OR REPLACE FUNCTION public.consolidar_lote_estoque(p_lote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_inseridos int := 0;
  v_erros int := 0;
  v_ignorados int := 0;
  v_dados jsonb;
  v_produto_id uuid;
  v_quantidade numeric;
  v_custo numeric;
  v_saldo_anterior numeric;
  v_data_corte text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM importacao_lotes WHERE id = p_lote_id AND status IN ('staging', 'pronto_para_consolidar', 'validado')) THEN
    RETURN jsonb_build_object('erro', 'Lote não encontrado ou não está em staging');
  END IF;

  UPDATE importacao_lotes SET status = 'consolidando' WHERE id = p_lote_id;

  FOR rec IN SELECT id, dados, status FROM stg_estoque_inicial WHERE lote_id = p_lote_id AND status = 'pendente'
  LOOP
    BEGIN
      v_dados := rec.dados;
      v_produto_id := NULL;

      -- Resolve produto: codigo_legado > codigo_interno
      IF v_dados->>'codigo_legado' IS NOT NULL AND v_dados->>'codigo_legado' != '' THEN
        SELECT id INTO v_produto_id FROM produtos WHERE codigo_legado = v_dados->>'codigo_legado' LIMIT 1;
      END IF;
      IF v_produto_id IS NULL AND v_dados->>'codigo_produto' IS NOT NULL AND v_dados->>'codigo_produto' != '' THEN
        SELECT id INTO v_produto_id FROM produtos WHERE codigo_interno = v_dados->>'codigo_produto' LIMIT 1;
      END IF;
      IF v_produto_id IS NULL AND v_dados->>'produto_id' IS NOT NULL AND v_dados->>'produto_id' != '' THEN
        v_produto_id := (v_dados->>'produto_id')::uuid;
      END IF;

      IF v_produto_id IS NULL THEN
        UPDATE stg_estoque_inicial SET status = 'erro', erro = 'Produto não encontrado' WHERE id = rec.id;
        v_erros := v_erros + 1;
        CONTINUE;
      END IF;

      v_quantidade := COALESCE((v_dados->>'quantidade')::numeric, 0);
      v_custo := COALESCE((v_dados->>'custo_unitario')::numeric, 0);
      v_data_corte := COALESCE(v_dados->>'data_estoque_inicial', to_char(now(), 'YYYY-MM-DD'));

      SELECT COALESCE(estoque_atual, 0) INTO v_saldo_anterior FROM produtos WHERE id = v_produto_id;

      -- Gerar movimento de abertura
      INSERT INTO estoque_movimentos (produto_id, tipo, quantidade, saldo_anterior, saldo_atual, motivo, documento_tipo, documento_id, created_at)
      VALUES (
        v_produto_id,
        CASE WHEN v_quantidade >= v_saldo_anterior THEN 'entrada' ELSE 'saida' END,
        ABS(v_quantidade - v_saldo_anterior),
        v_saldo_anterior,
        v_quantidade,
        'Estoque inicial via migração (Lote: ' || p_lote_id || ')',
        'abertura',
        p_lote_id,
        v_data_corte::timestamptz
      );

      -- Trigger sync_produto_estoque_atual atualiza produtos.estoque_atual

      -- Atualizar custo se informado
      IF v_custo > 0 THEN
        UPDATE produtos SET preco_custo = v_custo WHERE id = v_produto_id;
      END IF;

      UPDATE stg_estoque_inicial SET status = 'consolidado' WHERE id = rec.id;
      v_inseridos := v_inseridos + 1;

    EXCEPTION WHEN OTHERS THEN
      UPDATE stg_estoque_inicial SET status = 'erro', erro = SQLERRM WHERE id = rec.id;
      v_erros := v_erros + 1;
    END;
  END LOOP;

  UPDATE importacao_lotes SET
    status = CASE WHEN v_erros = 0 THEN 'concluido' WHEN v_inseridos > 0 THEN 'parcial' ELSE 'erro' END,
    registros_sucesso = v_inseridos,
    registros_erro = v_erros,
    registros_ignorados = v_ignorados,
    resumo = jsonb_build_object('inseridos', v_inseridos, 'erros', v_erros, 'ignorados', v_ignorados),
    updated_at = now()
  WHERE id = p_lote_id;

  RETURN jsonb_build_object('inseridos', v_inseridos, 'erros', v_erros, 'ignorados', v_ignorados);
END;
$$;

-- =====================================================
-- RPC: consolidar_lote_financeiro
-- =====================================================
CREATE OR REPLACE FUNCTION public.consolidar_lote_financeiro(p_lote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_inseridos int := 0;
  v_erros int := 0;
  v_dados jsonb;
  v_entity_id uuid;
  v_lancamento_id uuid;
  v_status_fin text;
  v_valor numeric;
  v_valor_pago numeric;
  v_saldo numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM importacao_lotes WHERE id = p_lote_id AND status IN ('staging', 'pronto_para_consolidar', 'validado')) THEN
    RETURN jsonb_build_object('erro', 'Lote não encontrado ou não está em staging');
  END IF;

  UPDATE importacao_lotes SET status = 'consolidando' WHERE id = p_lote_id;

  FOR rec IN SELECT id, dados, status FROM stg_financeiro_aberto WHERE lote_id = p_lote_id AND status = 'pendente'
  LOOP
    BEGIN
      v_dados := rec.dados;
      v_entity_id := NULL;

      -- Resolve pessoa: codigo_legado > cpf_cnpj
      IF v_dados->>'entity_type' = 'cliente' THEN
        IF v_dados->>'codigo_legado_pessoa' IS NOT NULL AND v_dados->>'codigo_legado_pessoa' != '' THEN
          SELECT id INTO v_entity_id FROM clientes WHERE codigo_legado = v_dados->>'codigo_legado_pessoa' LIMIT 1;
        END IF;
        IF v_entity_id IS NULL AND v_dados->>'cpf_cnpj' IS NOT NULL AND v_dados->>'cpf_cnpj' != '' THEN
          SELECT id INTO v_entity_id FROM clientes WHERE cpf_cnpj = v_dados->>'cpf_cnpj' LIMIT 1;
        END IF;
      ELSIF v_dados->>'entity_type' = 'fornecedor' THEN
        IF v_dados->>'codigo_legado_pessoa' IS NOT NULL AND v_dados->>'codigo_legado_pessoa' != '' THEN
          SELECT id INTO v_entity_id FROM fornecedores WHERE codigo_legado = v_dados->>'codigo_legado_pessoa' LIMIT 1;
        END IF;
        IF v_entity_id IS NULL AND v_dados->>'cpf_cnpj' IS NOT NULL AND v_dados->>'cpf_cnpj' != '' THEN
          SELECT id INTO v_entity_id FROM fornecedores WHERE cpf_cnpj = v_dados->>'cpf_cnpj' LIMIT 1;
        END IF;
      END IF;

      v_valor := COALESCE((v_dados->>'valor')::numeric, 0);
      v_valor_pago := COALESCE((v_dados->>'valor_pago')::numeric, 0);
      v_saldo := v_valor - v_valor_pago;

      IF v_valor_pago >= v_valor AND v_valor > 0 THEN
        v_status_fin := 'pago';
      ELSIF v_valor_pago > 0 THEN
        v_status_fin := 'parcial';
      ELSE
        v_status_fin := 'aberto';
      END IF;

      INSERT INTO financeiro_lancamentos (
        tipo, descricao, data_vencimento, valor, valor_pago, saldo_restante, status,
        forma_pagamento, banco, observacoes,
        cliente_id, fornecedor_id,
        data_pagamento
      ) VALUES (
        COALESCE(v_dados->>'tipo', 'pagar'),
        v_dados->>'descricao',
        (v_dados->>'data_vencimento')::date,
        v_valor,
        v_valor_pago,
        v_saldo,
        v_status_fin,
        NULLIF(v_dados->>'forma_pagamento',''),
        NULLIF(v_dados->>'banco',''),
        COALESCE(v_dados->>'observacoes', '') || ' [Migração Lote: ' || p_lote_id || ']',
        CASE WHEN v_dados->>'entity_type' = 'cliente' THEN v_entity_id ELSE NULL END,
        CASE WHEN v_dados->>'entity_type' = 'fornecedor' THEN v_entity_id ELSE NULL END,
        CASE WHEN v_status_fin = 'pago' THEN (v_dados->>'data_pagamento')::date ELSE NULL END
      ) RETURNING id INTO v_lancamento_id;

      -- Se pago ou parcial, criar registro de baixa
      IF v_valor_pago > 0 THEN
        INSERT INTO financeiro_baixas (lancamento_id, valor_pago, data_baixa, forma_pagamento, observacoes)
        VALUES (
          v_lancamento_id,
          v_valor_pago,
          COALESCE((v_dados->>'data_pagamento')::date, CURRENT_DATE),
          NULLIF(v_dados->>'forma_pagamento',''),
          'Baixa importada via migração'
        );
      END IF;

      UPDATE stg_financeiro_aberto SET status = 'consolidado' WHERE id = rec.id;
      v_inseridos := v_inseridos + 1;

    EXCEPTION WHEN OTHERS THEN
      UPDATE stg_financeiro_aberto SET status = 'erro', erro = SQLERRM WHERE id = rec.id;
      v_erros := v_erros + 1;
    END;
  END LOOP;

  UPDATE importacao_lotes SET
    status = CASE WHEN v_erros = 0 THEN 'concluido' WHEN v_inseridos > 0 THEN 'parcial' ELSE 'erro' END,
    registros_sucesso = v_inseridos,
    registros_erro = v_erros,
    resumo = jsonb_build_object('inseridos', v_inseridos, 'erros', v_erros),
    updated_at = now()
  WHERE id = p_lote_id;

  RETURN jsonb_build_object('inseridos', v_inseridos, 'erros', v_erros);
END;
$$;

-- =====================================================
-- RPC: consolidar_lote_faturamento
-- =====================================================
CREATE OR REPLACE FUNCTION public.consolidar_lote_faturamento(p_lote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_inseridos_nf int := 0;
  v_inseridos_itens int := 0;
  v_erros int := 0;
  v_dados jsonb;
  v_nf_id uuid;
  v_cliente_id uuid;
  v_existing_nf uuid;
  v_item jsonb;
  v_produto_id uuid;
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

      -- Deduplicação: chave_acesso > numero+serie+data
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
        v_erros := v_erros + 1; -- contado como ignorado
        CONTINUE;
      END IF;

      -- Resolve cliente
      v_cliente_id := NULL;
      IF v_dados->>'cpf_cnpj_cliente' IS NOT NULL AND v_dados->>'cpf_cnpj_cliente' != '' THEN
        SELECT id INTO v_cliente_id FROM clientes WHERE cpf_cnpj = v_dados->>'cpf_cnpj_cliente' LIMIT 1;
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
        (v_dados->>'icms_valor')::numeric,
        (v_dados->>'ipi_valor')::numeric,
        (v_dados->>'pis_valor')::numeric,
        (v_dados->>'cofins_valor')::numeric,
        (v_dados->>'frete_valor')::numeric,
        (v_dados->>'desconto_valor')::numeric,
        (v_dados->>'outras_despesas')::numeric
      ) RETURNING id INTO v_nf_id;

      v_inseridos_nf := v_inseridos_nf + 1;

      -- Itens
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
            v_nf_id,
            v_produto_id,
            COALESCE(v_item->>'codigo_produto', ''),
            COALESCE(v_item->>'descricao', ''),
            COALESCE((v_item->>'quantidade')::numeric, 0),
            COALESCE(v_item->>'unidade', 'UN'),
            COALESCE((v_item->>'valor_unitario')::numeric, 0),
            COALESCE((v_item->>'valor_total')::numeric, 0),
            v_item->>'ncm',
            v_item->>'cfop',
            v_item->>'cst',
            (v_item->>'icms_base')::numeric,
            (v_item->>'icms_aliquota')::numeric,
            (v_item->>'icms_valor')::numeric,
            (v_item->>'ipi_aliquota')::numeric,
            (v_item->>'ipi_valor')::numeric,
            (v_item->>'pis_aliquota')::numeric,
            (v_item->>'pis_valor')::numeric,
            (v_item->>'cofins_aliquota')::numeric,
            (v_item->>'cofins_valor')::numeric
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
    resumo = jsonb_build_object('nfs_inseridas', v_inseridos_nf, 'itens_inseridos', v_inseridos_itens, 'erros', v_erros),
    updated_at = now()
  WHERE id = p_lote_id;

  RETURN jsonb_build_object('nfs_inseridas', v_inseridos_nf, 'itens_inseridos', v_inseridos_itens, 'erros', v_erros);
END;
$$;
