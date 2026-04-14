
-- =============================================
-- 1. Restrict user_permissions SELECT to own user or admin
-- =============================================
DROP POLICY IF EXISTS user_permissions_select ON public.user_permissions;
CREATE POLICY user_permissions_select ON public.user_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 2. Restrict DELETE on cadastro tables to admin only
-- =============================================

-- clientes
DROP POLICY IF EXISTS clientes_delete ON public.clientes;
CREATE POLICY clientes_delete ON public.clientes
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- fornecedores
DROP POLICY IF EXISTS fornecedores_delete ON public.fornecedores;
CREATE POLICY fornecedores_delete ON public.fornecedores
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- produtos
DROP POLICY IF EXISTS produtos_delete ON public.produtos;
CREATE POLICY produtos_delete ON public.produtos
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- grupos_produto
DROP POLICY IF EXISTS gp_delete ON public.grupos_produto;
CREATE POLICY gp_delete ON public.grupos_produto
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- contas_contabeis
DROP POLICY IF EXISTS cc_delete ON public.contas_contabeis;
CREATE POLICY cc_delete ON public.contas_contabeis
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- formas_pagamento
DROP POLICY IF EXISTS fp_delete ON public.formas_pagamento;
CREATE POLICY fp_delete ON public.formas_pagamento
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- bancos (no existing delete policy, add one)
CREATE POLICY bancos_delete ON public.bancos
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 3. Fix search_path on email queue functions
-- =============================================
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$function$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
 RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$function$;

-- =============================================
-- 4. Storage policies for dbavizee bucket (ownership-based)
-- =============================================
-- Drop existing permissive policies if any
DROP POLICY IF EXISTS "dbavizee_select" ON storage.objects;
DROP POLICY IF EXISTS "dbavizee_insert" ON storage.objects;
DROP POLICY IF EXISTS "dbavizee_update" ON storage.objects;
DROP POLICY IF EXISTS "dbavizee_delete" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;

-- Users can only access files in their own folder (auth.uid()::text prefix)
-- Admins can access all files
CREATE POLICY dbavizee_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'dbavizee' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  ));

CREATE POLICY dbavizee_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dbavizee' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  ));

CREATE POLICY dbavizee_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'dbavizee' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  ));

CREATE POLICY dbavizee_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'dbavizee' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  ));

-- =============================================
-- 5. RPC: consolidar_lote_enriquecimento (transactional)
-- =============================================
CREATE OR REPLACE FUNCTION public.consolidar_lote_enriquecimento(p_lote_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  rec RECORD;
  v_inseridos int := 0;
  v_atualizados int := 0;
  v_erros int := 0;
  v_dados jsonb;
  v_tipo text;
  v_produto_id uuid;
  v_fornecedor_id uuid;
  v_banco_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM importacao_lotes WHERE id = p_lote_id AND status IN ('staging', 'pronto_para_consolidar', 'validado')) THEN
    RETURN jsonb_build_object('erro', 'Lote não encontrado ou não está em staging');
  END IF;

  UPDATE importacao_lotes SET status = 'consolidando' WHERE id = p_lote_id;

  FOR rec IN SELECT id, dados, status FROM stg_cadastros WHERE lote_id = p_lote_id AND status = 'pendente'
  LOOP
    BEGIN
      v_dados := rec.dados;
      v_tipo := v_dados->>'_tipo_enriquecimento';

      IF v_tipo = 'produtos_fornecedores' THEN
        -- Resolve produto
        v_produto_id := NULL;
        IF v_dados->>'codigo_legado_produto' IS NOT NULL AND v_dados->>'codigo_legado_produto' != '' THEN
          SELECT id INTO v_produto_id FROM produtos WHERE codigo_legado = v_dados->>'codigo_legado_produto' LIMIT 1;
        END IF;
        IF v_produto_id IS NULL AND v_dados->>'codigo_produto' IS NOT NULL AND v_dados->>'codigo_produto' != '' THEN
          SELECT id INTO v_produto_id FROM produtos WHERE codigo_interno = v_dados->>'codigo_produto' LIMIT 1;
        END IF;

        -- Resolve fornecedor
        v_fornecedor_id := NULL;
        IF v_dados->>'codigo_legado_fornecedor' IS NOT NULL AND v_dados->>'codigo_legado_fornecedor' != '' THEN
          SELECT id INTO v_fornecedor_id FROM fornecedores WHERE codigo_legado = v_dados->>'codigo_legado_fornecedor' LIMIT 1;
        END IF;
        IF v_fornecedor_id IS NULL AND v_dados->>'cpf_cnpj_fornecedor' IS NOT NULL AND v_dados->>'cpf_cnpj_fornecedor' != '' THEN
          SELECT id INTO v_fornecedor_id FROM fornecedores WHERE cpf_cnpj = v_dados->>'cpf_cnpj_fornecedor' LIMIT 1;
        END IF;

        IF v_produto_id IS NULL OR v_fornecedor_id IS NULL THEN
          UPDATE stg_cadastros SET status = 'erro', erro = 'Produto ou fornecedor não encontrado' WHERE id = rec.id;
          v_erros := v_erros + 1;
          CONTINUE;
        END IF;

        INSERT INTO produtos_fornecedores (produto_id, fornecedor_id, eh_principal, referencia_fornecedor, descricao_fornecedor, preco_compra, unidade_fornecedor, lead_time_dias)
        VALUES (
          v_produto_id, v_fornecedor_id,
          COALESCE((v_dados->>'eh_principal')::boolean, false),
          NULLIF(v_dados->>'referencia_fornecedor',''),
          NULLIF(v_dados->>'descricao_fornecedor',''),
          (v_dados->>'preco_compra')::numeric,
          NULLIF(v_dados->>'unidade_fornecedor',''),
          (v_dados->>'lead_time_dias')::int
        )
        ON CONFLICT (produto_id, fornecedor_id) DO UPDATE SET
          eh_principal = EXCLUDED.eh_principal,
          referencia_fornecedor = COALESCE(EXCLUDED.referencia_fornecedor, produtos_fornecedores.referencia_fornecedor),
          descricao_fornecedor = COALESCE(EXCLUDED.descricao_fornecedor, produtos_fornecedores.descricao_fornecedor),
          preco_compra = COALESCE(EXCLUDED.preco_compra, produtos_fornecedores.preco_compra),
          unidade_fornecedor = COALESCE(EXCLUDED.unidade_fornecedor, produtos_fornecedores.unidade_fornecedor),
          lead_time_dias = COALESCE(EXCLUDED.lead_time_dias, produtos_fornecedores.lead_time_dias);

        v_inseridos := v_inseridos + 1;

      ELSIF v_tipo = 'formas_pagamento' THEN
        INSERT INTO formas_pagamento (descricao, tipo, parcelas, prazo_dias, gera_financeiro)
        VALUES (
          v_dados->>'descricao',
          NULLIF(v_dados->>'tipo',''),
          COALESCE((v_dados->>'parcelas')::int, 1),
          COALESCE((v_dados->>'prazo_dias')::int, 0),
          COALESCE((v_dados->>'gera_financeiro')::boolean, true)
        );
        v_inseridos := v_inseridos + 1;

      ELSIF v_tipo = 'contas_contabeis' THEN
        INSERT INTO contas_contabeis (codigo, descricao, natureza, aceita_lancamento)
        VALUES (
          v_dados->>'codigo',
          v_dados->>'descricao',
          NULLIF(v_dados->>'natureza',''),
          COALESCE((v_dados->>'aceita_lancamento')::boolean, true)
        )
        ON CONFLICT (codigo) DO UPDATE SET
          descricao = EXCLUDED.descricao,
          natureza = COALESCE(EXCLUDED.natureza, contas_contabeis.natureza),
          aceita_lancamento = EXCLUDED.aceita_lancamento;
        v_inseridos := v_inseridos + 1;

      ELSIF v_tipo = 'contas_bancarias' THEN
        v_banco_id := NULL;
        IF v_dados->>'banco_nome' IS NOT NULL AND v_dados->>'banco_nome' != '' THEN
          SELECT id INTO v_banco_id FROM bancos WHERE nome = v_dados->>'banco_nome' LIMIT 1;
          IF v_banco_id IS NULL THEN
            INSERT INTO bancos (nome) VALUES (v_dados->>'banco_nome') RETURNING id INTO v_banco_id;
          END IF;
        END IF;

        INSERT INTO contas_bancarias (descricao, banco_id, agencia, conta, titular, saldo_atual)
        VALUES (
          v_dados->>'descricao',
          v_banco_id,
          NULLIF(v_dados->>'agencia',''),
          NULLIF(v_dados->>'conta',''),
          NULLIF(v_dados->>'titular',''),
          COALESCE((v_dados->>'saldo_atual')::numeric, 0)
        );
        v_inseridos := v_inseridos + 1;

      ELSE
        UPDATE stg_cadastros SET status = 'erro', erro = 'Tipo de enriquecimento desconhecido: ' || COALESCE(v_tipo, 'NULL') WHERE id = rec.id;
        v_erros := v_erros + 1;
        CONTINUE;
      END IF;

      UPDATE stg_cadastros SET status = 'consolidado' WHERE id = rec.id;

    EXCEPTION WHEN OTHERS THEN
      UPDATE stg_cadastros SET status = 'erro', erro = SQLERRM WHERE id = rec.id;
      v_erros := v_erros + 1;
    END;
  END LOOP;

  UPDATE importacao_lotes SET
    status = CASE WHEN v_erros = 0 THEN 'concluido' WHEN v_inseridos > 0 THEN 'parcial' ELSE 'erro' END,
    registros_sucesso = v_inseridos,
    registros_erro = v_erros,
    registros_atualizados = v_atualizados,
    resumo = jsonb_build_object('inseridos', v_inseridos, 'atualizados', v_atualizados, 'erros', v_erros),
    updated_at = now()
  WHERE id = p_lote_id;

  RETURN jsonb_build_object('inseridos', v_inseridos, 'atualizados', v_atualizados, 'erros', v_erros);
END;
$function$;
