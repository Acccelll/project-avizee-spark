-- ============================================================================
-- MIGRAÇÃO: Preservação total de histórico de produtos e faturamento
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

-- ============================================================================
-- 1. AJUSTES EM produtos
-- ============================================================================
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS descontinuado_em date,
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'cadastro_manual';

COMMENT ON COLUMN public.produtos.descontinuado_em IS
  'Data em que o produto foi marcado como inativo. Preenchida automaticamente via trigger.';
COMMENT ON COLUMN public.produtos.origem IS
  'Procedência do registro: cadastro_manual | importacao_conciliacao | importacao_legacy';

CREATE OR REPLACE FUNCTION public.trg_produto_descontinuado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.ativo = true AND NEW.ativo = false AND NEW.descontinuado_em IS NULL THEN
    NEW.descontinuado_em := now()::date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_produto_descontinuado ON public.produtos;
CREATE TRIGGER trg_produto_descontinuado
  BEFORE UPDATE ON public.produtos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_produto_descontinuado();

-- ============================================================================
-- 2. FUNÇÃO UTILITÁRIA: normalizar_descricao
-- ============================================================================
CREATE OR REPLACE FUNCTION public.normalizar_descricao(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(lower(unaccent(coalesce(p,''))), '\s+', ' ', 'g')::text
$$;

COMMENT ON FUNCTION public.normalizar_descricao(text) IS
  'Normaliza texto: remove acentos, lowercase, colapsa espaços, trim. Use para fuzzy match de produtos.';

-- ============================================================================
-- 3. TABELA PONTE: produto_identificadores_legacy
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.produto_identificadores_legacy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  origem text NOT NULL CHECK (origem IN ('faturamento_legacy','conciliacao_legacy','manual')),
  codigo_legacy text,
  descricao_legacy text,
  descricao_normalizada text,
  unidade_legacy text,
  match_tipo text NOT NULL CHECK (match_tipo IN ('exato_codigo','exato_descricao','manual','aproximado','nao_vinculado')),
  confianca_match numeric(3,2) NOT NULL DEFAULT 1.00 CHECK (confianca_match >= 0 AND confianca_match <= 1),
  ativo boolean NOT NULL DEFAULT true,
  observacao text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pil_origem_cod_desc
  ON public.produto_identificadores_legacy
  (origem, COALESCE(codigo_legacy,''), COALESCE(descricao_normalizada,''));

CREATE INDEX IF NOT EXISTS idx_pil_produto_id ON public.produto_identificadores_legacy(produto_id);
CREATE INDEX IF NOT EXISTS idx_pil_codigo_legacy ON public.produto_identificadores_legacy(codigo_legacy) WHERE codigo_legacy IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pil_descricao_norm ON public.produto_identificadores_legacy(descricao_normalizada) WHERE descricao_normalizada IS NOT NULL;

CREATE OR REPLACE FUNCTION public.trg_pil_normalizar()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.descricao_normalizada := public.normalizar_descricao(NEW.descricao_legacy);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pil_normalizar ON public.produto_identificadores_legacy;
CREATE TRIGGER trg_pil_normalizar
  BEFORE INSERT OR UPDATE OF descricao_legacy ON public.produto_identificadores_legacy
  FOR EACH ROW EXECUTE FUNCTION public.trg_pil_normalizar();

ALTER TABLE public.produto_identificadores_legacy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pil_select_authenticated" ON public.produto_identificadores_legacy;
CREATE POLICY "pil_select_authenticated" ON public.produto_identificadores_legacy
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "pil_insert_admin_financeiro_estoquista" ON public.produto_identificadores_legacy;
CREATE POLICY "pil_insert_admin_financeiro_estoquista" ON public.produto_identificadores_legacy
  FOR INSERT TO authenticated WITH CHECK (
    has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'financeiro'::app_role)
    OR has_role(auth.uid(),'estoquista'::app_role)
  );

DROP POLICY IF EXISTS "pil_update_admin_financeiro_estoquista" ON public.produto_identificadores_legacy;
CREATE POLICY "pil_update_admin_financeiro_estoquista" ON public.produto_identificadores_legacy
  FOR UPDATE TO authenticated USING (
    has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'financeiro'::app_role)
    OR has_role(auth.uid(),'estoquista'::app_role)
  );

DROP POLICY IF EXISTS "pil_delete_admin" ON public.produto_identificadores_legacy;
CREATE POLICY "pil_delete_admin" ON public.produto_identificadores_legacy
  FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

-- ============================================================================
-- 4. SNAPSHOT EM notas_fiscais_itens
-- ============================================================================
ALTER TABLE public.notas_fiscais_itens
  ADD COLUMN IF NOT EXISTS codigo_produto_origem text,
  ADD COLUMN IF NOT EXISTS descricao_produto_origem text,
  ADD COLUMN IF NOT EXISTS unidade_origem text,
  ADD COLUMN IF NOT EXISTS quantidade_origem numeric,
  ADD COLUMN IF NOT EXISTS valor_unitario_origem numeric,
  ADD COLUMN IF NOT EXISTS valor_total_origem numeric,
  ADD COLUMN IF NOT EXISTS produto_identificador_legacy_id uuid REFERENCES public.produto_identificadores_legacy(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS match_status text CHECK (match_status IN ('vinculado','nao_vinculado','manual','duvidoso')),
  ADD COLUMN IF NOT EXISTS origem_migracao text;

CREATE INDEX IF NOT EXISTS idx_nfi_match_status ON public.notas_fiscais_itens(match_status) WHERE match_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nfi_origem_migracao ON public.notas_fiscais_itens(origem_migracao) WHERE origem_migracao IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nfi_pil_id ON public.notas_fiscais_itens(produto_identificador_legacy_id) WHERE produto_identificador_legacy_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_nfi_legacy_snapshot
  ON public.notas_fiscais_itens (nota_fiscal_id, codigo_produto_origem, valor_total_origem)
  WHERE origem_migracao = 'faturamento_legacy';

CREATE OR REPLACE FUNCTION public.trg_nf_item_snapshot_imutavel()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.codigo_produto_origem IS NOT NULL OR OLD.descricao_produto_origem IS NOT NULL THEN
    IF NEW.codigo_produto_origem      IS DISTINCT FROM OLD.codigo_produto_origem
    OR NEW.descricao_produto_origem   IS DISTINCT FROM OLD.descricao_produto_origem
    OR NEW.unidade_origem             IS DISTINCT FROM OLD.unidade_origem
    OR NEW.quantidade_origem          IS DISTINCT FROM OLD.quantidade_origem
    OR NEW.valor_unitario_origem      IS DISTINCT FROM OLD.valor_unitario_origem
    OR NEW.valor_total_origem         IS DISTINCT FROM OLD.valor_total_origem
    THEN
      RAISE EXCEPTION 'Snapshot original do item da NF é imutável após o insert';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nf_item_snapshot_imutavel ON public.notas_fiscais_itens;
CREATE TRIGGER trg_nf_item_snapshot_imutavel
  BEFORE UPDATE ON public.notas_fiscais_itens
  FOR EACH ROW EXECUTE FUNCTION public.trg_nf_item_snapshot_imutavel();

-- ============================================================================
-- 5. BACKFILL — executado em DO block para sinalizar operação interna
-- ============================================================================
DO $$
BEGIN
  PERFORM set_config('app.nf_internal_op', '1', true);
  UPDATE public.notas_fiscais_itens nfi
     SET codigo_produto_origem    = nfi.codigo_produto,
         descricao_produto_origem = nfi.descricao,
         unidade_origem           = nfi.unidade,
         quantidade_origem        = nfi.quantidade,
         valor_unitario_origem    = nfi.valor_unitario,
         valor_total_origem       = nfi.valor_total,
         origem_migracao          = 'faturamento_legacy',
         match_status             = CASE WHEN nfi.produto_id IS NULL THEN 'nao_vinculado' ELSE 'vinculado' END
    FROM public.notas_fiscais nf
   WHERE nfi.nota_fiscal_id = nf.id
     AND nf.origem = 'importacao_historica'
     AND nfi.codigo_produto_origem IS NULL;
  PERFORM set_config('app.nf_internal_op', '0', true);
END $$;

-- ============================================================================
-- 6. REESCRITA: consolidar_lote_cadastros
-- ============================================================================
CREATE OR REPLACE FUNCTION public.consolidar_lote_cadastros(p_lote_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  v_inseridos int := 0; v_atualizados int := 0; v_erros int := 0; v_ignorados int := 0;
  v_tipo text; v_dados jsonb; v_existing_id uuid; v_grupo_id uuid;
  v_dup_codigos text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM importacao_lotes WHERE id = p_lote_id AND status IN ('staging','pronto_para_consolidar','validado')) THEN
    RETURN jsonb_build_object('erro','Lote não encontrado ou não está em staging');
  END IF;

  SELECT string_agg(DISTINCT cod, ', ') INTO v_dup_codigos
    FROM (
      SELECT dados->>'codigo_legado' AS cod
        FROM stg_cadastros
       WHERE lote_id = p_lote_id AND status = 'pendente'
         AND dados->>'_tipo_entidade' IN ('produto','insumo')
         AND COALESCE(dados->>'codigo_legado','') <> ''
       GROUP BY dados->>'codigo_legado'
       HAVING count(*) > 1
    ) d;

  IF v_dup_codigos IS NOT NULL THEN
    INSERT INTO importacao_logs(lote_id, nivel, etapa, mensagem)
    VALUES (p_lote_id,'error','consolidar_cadastros','Códigos de produto duplicados na planilha: '||v_dup_codigos);
    UPDATE importacao_lotes SET status='erro', resumo=jsonb_build_object('codigos_duplicados',v_dup_codigos)
     WHERE id = p_lote_id;
    RETURN jsonb_build_object('erro','Códigos duplicados na planilha: '||v_dup_codigos);
  END IF;

  UPDATE importacao_lotes SET status='consolidando' WHERE id = p_lote_id;

  FOR rec IN SELECT id, dados, status FROM stg_cadastros WHERE lote_id = p_lote_id AND status='pendente'
  LOOP
    BEGIN
      v_dados := rec.dados;
      v_tipo := v_dados->>'_tipo_entidade';

      IF v_tipo = 'grupo_produto' THEN
        SELECT id INTO v_existing_id FROM grupos_produto WHERE nome=(v_dados->>'nome') LIMIT 1;
        IF v_existing_id IS NULL THEN
          INSERT INTO grupos_produto (nome, descricao) VALUES (v_dados->>'nome', v_dados->>'descricao')
          RETURNING id INTO v_existing_id;
          v_inseridos := v_inseridos + 1;
        ELSE
          v_ignorados := v_ignorados + 1;
        END IF;
        UPDATE stg_cadastros SET status='consolidado' WHERE id = rec.id;

      ELSIF v_tipo IN ('produto','insumo') THEN
        v_existing_id := NULL;
        IF v_dados->>'codigo_legado' IS NOT NULL AND v_dados->>'codigo_legado' != '' THEN
          SELECT id INTO v_existing_id FROM produtos WHERE codigo_legado=v_dados->>'codigo_legado' LIMIT 1;
        END IF;
        IF v_existing_id IS NULL AND v_dados->>'codigo_interno' IS NOT NULL AND v_dados->>'codigo_interno' != '' THEN
          SELECT id INTO v_existing_id FROM produtos WHERE codigo_interno=v_dados->>'codigo_interno' LIMIT 1;
        END IF;

        v_grupo_id := NULL;
        IF v_dados->>'grupo_nome' IS NOT NULL AND v_dados->>'grupo_nome' != '' THEN
          SELECT id INTO v_grupo_id FROM grupos_produto WHERE nome=v_dados->>'grupo_nome' LIMIT 1;
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
          INSERT INTO produtos (
            nome, codigo_legado, codigo_interno, unidade_medida,
            preco_custo, preco_venda, peso, ncm, gtin, variacoes, tipo_item,
            grupo_id, origem
          )
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
            COALESCE(NULLIF(v_dados->>'tipo_item',''), CASE WHEN v_tipo='insumo' THEN 'insumo' ELSE 'produto' END),
            v_grupo_id,
            'importacao_conciliacao'
          )
          RETURNING id INTO v_existing_id;
          v_inseridos := v_inseridos + 1;
        END IF;

        IF v_dados->>'codigo_legado' IS NOT NULL AND v_dados->>'codigo_legado' != '' THEN
          INSERT INTO produto_identificadores_legacy (
            produto_id, origem, codigo_legacy, descricao_legacy, unidade_legacy,
            match_tipo, confianca_match
          ) VALUES (
            v_existing_id, 'conciliacao_legacy',
            v_dados->>'codigo_legado',
            v_dados->>'nome',
            COALESCE(NULLIF(v_dados->>'unidade_medida',''), 'UN'),
            'exato_codigo', 1.00
          )
          ON CONFLICT (origem, COALESCE(codigo_legacy,''), COALESCE(descricao_normalizada,'')) DO NOTHING;
        END IF;

        IF COALESCE(v_dados->>'fornecedor_principal_nome','') <> ''
           OR COALESCE(v_dados->>'fornecedor_principal_legado','') <> '' THEN
          PERFORM vincular_produto_fornecedor(
            v_existing_id,
            NULLIF(v_dados->>'fornecedor_principal_nome',''),
            NULLIF(v_dados->>'fornecedor_principal_legado',''),
            NULLIF(v_dados->>'ref_fornecedor',''),
            NULLIF(v_dados->>'url_produto_fornecedor',''),
            NULLIF(v_dados->>'preco_custo','')::numeric
          );
        END IF;

        UPDATE stg_cadastros SET status='consolidado' WHERE id = rec.id;

      ELSIF v_tipo = 'cliente' THEN
        v_existing_id := NULL;
        IF v_dados->>'codigo_legado' IS NOT NULL AND v_dados->>'codigo_legado' != '' THEN
          SELECT id INTO v_existing_id FROM clientes WHERE codigo_legado=v_dados->>'codigo_legado' LIMIT 1;
        END IF;
        IF v_existing_id IS NULL AND v_dados->>'cpf_cnpj' IS NOT NULL AND v_dados->>'cpf_cnpj' != '' THEN
          SELECT id INTO v_existing_id FROM clientes WHERE cpf_cnpj=v_dados->>'cpf_cnpj' LIMIT 1;
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
            COALESCE(v_dados->>'nome_razao_social','SEM NOME'),
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
            COALESCE(NULLIF(v_dados->>'tipo_pessoa',''),'J')
          );
          v_inseridos := v_inseridos + 1;
        END IF;
        UPDATE stg_cadastros SET status='consolidado' WHERE id = rec.id;

      ELSIF v_tipo = 'fornecedor' THEN
        v_existing_id := NULL;
        IF v_dados->>'codigo_legado' IS NOT NULL AND v_dados->>'codigo_legado' != '' THEN
          SELECT id INTO v_existing_id FROM fornecedores WHERE codigo_legado=v_dados->>'codigo_legado' LIMIT 1;
        END IF;
        IF v_existing_id IS NULL AND v_dados->>'cpf_cnpj' IS NOT NULL AND v_dados->>'cpf_cnpj' != '' THEN
          SELECT id INTO v_existing_id FROM fornecedores WHERE cpf_cnpj=v_dados->>'cpf_cnpj' LIMIT 1;
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
            COALESCE(v_dados->>'nome_razao_social','SEM NOME'),
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
            COALESCE(NULLIF(v_dados->>'tipo_pessoa',''),'J')
          );
          v_inseridos := v_inseridos + 1;
        END IF;
        UPDATE stg_cadastros SET status='consolidado' WHERE id = rec.id;

      ELSE
        UPDATE stg_cadastros SET status='erro', erro='Tipo de entidade desconhecido: '||COALESCE(v_tipo,'NULL') WHERE id = rec.id;
        v_erros := v_erros + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      UPDATE stg_cadastros SET status='erro', erro=SQLERRM WHERE id = rec.id;
      v_erros := v_erros + 1;
    END;
  END LOOP;

  UPDATE importacao_lotes SET
    status = CASE WHEN v_erros=0 THEN 'concluido' WHEN v_inseridos+v_atualizados>0 THEN 'parcial' ELSE 'erro' END,
    registros_sucesso = v_inseridos+v_atualizados,
    registros_erro = v_erros,
    registros_atualizados = v_atualizados,
    registros_ignorados = v_ignorados,
    resumo = jsonb_build_object('inseridos',v_inseridos,'atualizados',v_atualizados,'erros',v_erros,'ignorados',v_ignorados),
    updated_at = now()
  WHERE id = p_lote_id;

  RETURN jsonb_build_object('inseridos',v_inseridos,'atualizados',v_atualizados,'erros',v_erros,'ignorados',v_ignorados);
END;
$function$;

-- ============================================================================
-- 7. REESCRITA: consolidar_lote_faturamento
-- ============================================================================
CREATE OR REPLACE FUNCTION public.consolidar_lote_faturamento(p_lote_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  v_inseridos_nf int := 0; v_inseridos_itens int := 0; v_clientes_criados int := 0;
  v_descontinuados_criados int := 0;
  v_vinculados int := 0; v_duvidosos int := 0; v_nao_vinculados int := 0;
  v_erros int := 0;
  v_dados jsonb; v_nf_id uuid; v_cliente_id uuid; v_existing_nf uuid;
  v_item jsonb; v_produto_id uuid; v_pil_id uuid;
  v_match_tipo text; v_match_status text; v_confianca numeric(3,2);
  v_match_count int;
  v_codigo_legacy text; v_descricao_legacy text; v_descricao_norm text;
  v_unidade_legacy text; v_quantidade_orig numeric; v_valor_unit_orig numeric; v_valor_total_orig numeric;
  v_cnpj_clean text; v_tipo_pessoa text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM importacao_lotes WHERE id = p_lote_id AND status IN ('staging','pronto_para_consolidar','validado','consolidando')) THEN
    RETURN jsonb_build_object('erro','Lote não encontrado ou não está em staging');
  END IF;

  PERFORM set_config('app.nf_internal_op','1',true);
  UPDATE importacao_lotes SET status='consolidando' WHERE id = p_lote_id;

  FOR rec IN SELECT id, dados, status FROM stg_faturamento WHERE lote_id = p_lote_id AND status IN ('pendente','erro')
  LOOP
    BEGIN
      PERFORM set_config('app.nf_internal_op','1',true);
      v_dados := rec.dados;
      v_existing_nf := NULL;

      IF v_dados->>'chave_acesso' IS NOT NULL AND v_dados->>'chave_acesso' != '' THEN
        SELECT id INTO v_existing_nf FROM notas_fiscais WHERE chave_acesso=v_dados->>'chave_acesso' LIMIT 1;
      END IF;
      IF v_existing_nf IS NULL AND v_dados->>'numero' IS NOT NULL THEN
        SELECT id INTO v_existing_nf FROM notas_fiscais
        WHERE numero=v_dados->>'numero'
          AND COALESCE(serie,'')=COALESCE(v_dados->>'serie','')
          AND data_emissao::text=v_dados->>'data_emissao'
        LIMIT 1;
      END IF;

      IF v_existing_nf IS NOT NULL THEN
        UPDATE stg_faturamento SET status='duplicado', erro='NF já existe: '||v_existing_nf WHERE id = rec.id;
        CONTINUE;
      END IF;

      v_cliente_id := NULL;
      v_cnpj_clean := regexp_replace(COALESCE(v_dados->>'cpf_cnpj_cliente',''),'[^0-9]','','g');
      IF v_cnpj_clean <> '' THEN
        SELECT id INTO v_cliente_id FROM clientes
        WHERE regexp_replace(COALESCE(cpf_cnpj,''),'[^0-9]','','g')=v_cnpj_clean LIMIT 1;
        IF v_cliente_id IS NULL AND COALESCE(v_dados->>'cliente_nome','') <> '' THEN
          v_tipo_pessoa := CASE WHEN length(v_cnpj_clean)=14 THEN 'juridica' ELSE 'fisica' END;
          INSERT INTO clientes(codigo_legado, cpf_cnpj, tipo_pessoa, nome_razao_social, cidade, uf, ativo, observacoes)
          VALUES ('migracao_nf:'||v_cnpj_clean, v_dados->>'cpf_cnpj_cliente', v_tipo_pessoa,
                  v_dados->>'cliente_nome', NULLIF(v_dados->>'cliente_cidade',''), NULLIF(v_dados->>'cliente_uf',''),
                  true,'Cliente criado automaticamente via importação de NF histórica')
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
        v_dados->>'numero', v_dados->>'serie', (v_dados->>'data_emissao')::date,
        NULLIF(v_dados->>'chave_acesso',''),
        COALESCE((v_dados->>'valor_total')::numeric,0),
        COALESCE((v_dados->>'valor_produtos')::numeric,0),
        v_cliente_id, v_dados->>'natureza_operacao',
        'importada','importada_externa',
        COALESCE(v_dados->>'tipo','saida'), COALESCE(v_dados->>'tipo_operacao','venda'),
        false, false, 'importacao_historica',
        NULLIF(v_dados->>'icms_valor','')::numeric,
        NULLIF(v_dados->>'ipi_valor','')::numeric,
        NULLIF(v_dados->>'pis_valor','')::numeric,
        NULLIF(v_dados->>'cofins_valor','')::numeric,
        NULLIF(v_dados->>'frete_valor','')::numeric,
        NULLIF(v_dados->>'desconto_valor','')::numeric,
        NULLIF(v_dados->>'outras_despesas','')::numeric
      ) RETURNING id INTO v_nf_id;

      v_inseridos_nf := v_inseridos_nf + 1;

      IF v_dados->'itens' IS NOT NULL AND jsonb_typeof(v_dados->'itens')='array' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_dados->'itens')
        LOOP
          v_codigo_legacy := COALESCE(NULLIF(v_item->>'codigo_legado_produto',''), NULLIF(v_item->>'codigo_produto',''));
          v_descricao_legacy := COALESCE(NULLIF(v_item->>'descricao',''),'Item');
          v_unidade_legacy := COALESCE(NULLIF(v_item->>'unidade',''),'UN');
          v_quantidade_orig := COALESCE((v_item->>'quantidade')::numeric,0);
          v_valor_unit_orig := COALESCE((v_item->>'valor_unitario')::numeric,0);
          v_valor_total_orig := COALESCE((v_item->>'valor_total')::numeric,0);
          v_descricao_norm := normalizar_descricao(v_descricao_legacy);

          IF v_quantidade_orig <= 0 OR v_valor_total_orig <= 0 THEN
            v_erros := v_erros + 1;
            CONTINUE;
          END IF;

          v_produto_id := NULL; v_pil_id := NULL;
          v_match_tipo := NULL; v_match_status := 'nao_vinculado'; v_confianca := 0;

          -- Nível 1: exato por código
          IF v_codigo_legacy IS NOT NULL THEN
            SELECT count(DISTINCT id), max(id) INTO v_match_count, v_produto_id
              FROM produtos
             WHERE codigo_legado = v_codigo_legacy OR codigo_interno = v_codigo_legacy;
            IF v_match_count = 1 THEN
              v_match_tipo := 'exato_codigo'; v_match_status := 'vinculado'; v_confianca := 1.00;
            ELSIF v_match_count > 1 THEN
              v_produto_id := NULL; v_match_status := 'duvidoso';
            END IF;
          END IF;

          -- Nível 2: tabela ponte
          IF v_produto_id IS NULL AND v_match_status <> 'duvidoso' AND v_codigo_legacy IS NOT NULL THEN
            SELECT count(DISTINCT produto_id), max(produto_id) INTO v_match_count, v_produto_id
              FROM produto_identificadores_legacy
             WHERE ativo = true AND codigo_legacy = v_codigo_legacy;
            IF v_match_count = 1 THEN
              v_match_tipo := 'exato_codigo'; v_match_status := 'vinculado'; v_confianca := 0.95;
            ELSIF v_match_count > 1 THEN
              v_produto_id := NULL; v_match_status := 'duvidoso';
            END IF;
          END IF;

          -- Nível 3: descrição normalizada
          IF v_produto_id IS NULL AND v_match_status <> 'duvidoso' AND v_descricao_norm <> '' THEN
            SELECT count(DISTINCT p.id), max(p.id) INTO v_match_count, v_produto_id
              FROM produtos p
              LEFT JOIN produto_identificadores_legacy pil
                ON pil.produto_id = p.id AND pil.ativo = true
             WHERE normalizar_descricao(p.nome) = v_descricao_norm
                OR pil.descricao_normalizada = v_descricao_norm;
            IF v_match_count = 1 THEN
              v_match_tipo := 'exato_descricao'; v_match_status := 'vinculado'; v_confianca := 0.85;
            ELSIF v_match_count > 1 THEN
              v_produto_id := NULL; v_match_status := 'duvidoso';
            END IF;
          END IF;

          -- Sem match e tem código legado: criar produto descontinuado
          IF v_match_status = 'nao_vinculado' AND v_codigo_legacy IS NOT NULL THEN
            BEGIN
              INSERT INTO produtos (
                nome, codigo_legado, unidade_medida, ativo, descontinuado_em, tipo_item, origem
              ) VALUES (
                v_descricao_legacy, v_codigo_legacy, v_unidade_legacy, false, now()::date,
                'produto', 'importacao_legacy'
              ) RETURNING id INTO v_produto_id;
              v_descontinuados_criados := v_descontinuados_criados + 1;
            EXCEPTION WHEN unique_violation THEN
              SELECT id INTO v_produto_id FROM produtos WHERE codigo_legado = v_codigo_legacy LIMIT 1;
            END;
            v_match_tipo := 'exato_codigo';
            v_match_status := 'vinculado';
            v_confianca := 1.00;
          END IF;

          -- Persistir vínculo na tabela ponte
          IF v_produto_id IS NOT NULL AND v_match_tipo IS NOT NULL THEN
            INSERT INTO produto_identificadores_legacy (
              produto_id, origem, codigo_legacy, descricao_legacy, unidade_legacy,
              match_tipo, confianca_match
            ) VALUES (
              v_produto_id, 'faturamento_legacy', v_codigo_legacy, v_descricao_legacy, v_unidade_legacy,
              v_match_tipo, v_confianca
            )
            ON CONFLICT (origem, COALESCE(codigo_legacy,''), COALESCE(descricao_normalizada,''))
              DO UPDATE SET ativo = true
            RETURNING id INTO v_pil_id;
          END IF;

          IF v_match_status = 'vinculado' THEN v_vinculados := v_vinculados + 1;
          ELSIF v_match_status = 'duvidoso' THEN v_duvidosos := v_duvidosos + 1;
          ELSE v_nao_vinculados := v_nao_vinculados + 1;
          END IF;

          INSERT INTO notas_fiscais_itens (
            nota_fiscal_id, produto_id, codigo_produto, descricao, quantidade,
            unidade, valor_unitario, valor_total, ncm, cfop, cst,
            icms_valor, ipi_valor, pis_valor, cofins_valor,
            custo_historico_unitario,
            codigo_produto_origem, descricao_produto_origem, unidade_origem,
            quantidade_origem, valor_unitario_origem, valor_total_origem,
            produto_identificador_legacy_id, match_status, origem_migracao
          ) VALUES (
            v_nf_id, v_produto_id,
            v_item->>'codigo_produto', v_descricao_legacy, v_quantidade_orig,
            v_unidade_legacy, v_valor_unit_orig, v_valor_total_orig,
            v_item->>'ncm', v_item->>'cfop', v_item->>'cst',
            NULLIF(v_item->>'icms_valor','')::numeric,
            NULLIF(v_item->>'ipi_valor','')::numeric,
            NULLIF(v_item->>'pis_valor','')::numeric,
            NULLIF(v_item->>'cofins_valor','')::numeric,
            NULLIF(v_item->>'custo_unitario','')::numeric,
            v_codigo_legacy, v_descricao_legacy, v_unidade_legacy,
            v_quantidade_orig, v_valor_unit_orig, v_valor_total_orig,
            v_pil_id, v_match_status, 'faturamento_legacy'
          )
          ON CONFLICT (nota_fiscal_id, codigo_produto_origem, valor_total_origem)
            WHERE origem_migracao = 'faturamento_legacy'
          DO NOTHING;
          v_inseridos_itens := v_inseridos_itens + 1;
        END LOOP;
      END IF;

      UPDATE stg_faturamento SET status='consolidado', erro=NULL WHERE id = rec.id;

    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros + 1;
      UPDATE stg_faturamento SET status='erro', erro=SQLERRM WHERE id = rec.id;
    END;
  END LOOP;

  PERFORM set_config('app.nf_internal_op','0',true);

  UPDATE importacao_lotes
  SET status = CASE WHEN v_erros=0 THEN 'concluido' ELSE 'concluido_com_erros' END,
      registros_sucesso = v_inseridos_nf,
      registros_erro = v_erros,
      resumo = jsonb_build_object(
        'nfs_inseridas', v_inseridos_nf,
        'itens_inseridos', v_inseridos_itens,
        'clientes_criados', v_clientes_criados,
        'vinculados', v_vinculados,
        'duvidosos', v_duvidosos,
        'nao_vinculados', v_nao_vinculados,
        'descontinuados_criados', v_descontinuados_criados,
        'erros', v_erros
      ),
      updated_at = now()
  WHERE id = p_lote_id;

  RETURN jsonb_build_object(
    'nfs_inseridas', v_inseridos_nf,
    'itens_inseridos', v_inseridos_itens,
    'clientes_criados', v_clientes_criados,
    'vinculados', v_vinculados,
    'duvidosos', v_duvidosos,
    'nao_vinculados', v_nao_vinculados,
    'descontinuados_criados', v_descontinuados_criados,
    'erros', v_erros
  );
END;
$function$;

-- ============================================================================
-- 8. NOVA RPC: relatorio_migracao_faturamento
-- ============================================================================
CREATE OR REPLACE FUNCTION public.relatorio_migracao_faturamento(p_lote_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_total int; v_vinculados int; v_duvidosos int; v_nao_vinculados int; v_descontinuados int;
  v_resumo jsonb; v_amostra_nv jsonb; v_amostra_desc jsonb;
BEGIN
  SELECT resumo INTO v_resumo FROM importacao_lotes WHERE id = p_lote_id;

  v_total := COALESCE((v_resumo->>'itens_inseridos')::int, 0);
  v_vinculados := COALESCE((v_resumo->>'vinculados')::int, 0);
  v_duvidosos := COALESCE((v_resumo->>'duvidosos')::int, 0);
  v_nao_vinculados := COALESCE((v_resumo->>'nao_vinculados')::int, 0);
  v_descontinuados := COALESCE((v_resumo->>'descontinuados_criados')::int, 0);

  SELECT COALESCE(jsonb_agg(t),'[]'::jsonb) INTO v_amostra_nv
  FROM (
    SELECT codigo_produto_origem AS codigo,
           descricao_produto_origem AS descricao,
           count(*) AS qtd
      FROM notas_fiscais_itens
     WHERE origem_migracao='faturamento_legacy' AND match_status='nao_vinculado'
     GROUP BY codigo_produto_origem, descricao_produto_origem
     ORDER BY count(*) DESC
     LIMIT 50
  ) t;

  SELECT COALESCE(jsonb_agg(t),'[]'::jsonb) INTO v_amostra_desc
  FROM (
    SELECT id AS produto_id, codigo_legado AS codigo, nome AS descricao, descontinuado_em
      FROM produtos
     WHERE origem='importacao_legacy' AND ativo=false
     ORDER BY descontinuado_em DESC NULLS LAST
     LIMIT 50
  ) t;

  RETURN jsonb_build_object(
    'total_itens', v_total,
    'vinculados', v_vinculados,
    'duvidosos', v_duvidosos,
    'nao_vinculados', v_nao_vinculados,
    'pct_vinculados', CASE WHEN v_total>0 THEN round(v_vinculados::numeric/v_total*100,1) ELSE 0 END,
    'pct_duvidosos', CASE WHEN v_total>0 THEN round(v_duvidosos::numeric/v_total*100,1) ELSE 0 END,
    'pct_nao_vinculados', CASE WHEN v_total>0 THEN round(v_nao_vinculados::numeric/v_total*100,1) ELSE 0 END,
    'produtos_descontinuados_criados', v_descontinuados,
    'amostra_nao_vinculados', v_amostra_nv,
    'amostra_descontinuados', v_amostra_desc
  );
END;
$function$;