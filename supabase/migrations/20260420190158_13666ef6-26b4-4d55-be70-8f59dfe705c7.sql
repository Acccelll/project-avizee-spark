
-- ============================================================
-- 1. fiscal_status_canonico
-- ============================================================

ALTER TABLE public.notas_fiscais DROP CONSTRAINT IF EXISTS chk_notas_fiscais_status;
ALTER TABLE public.notas_fiscais DROP CONSTRAINT IF EXISTS chk_notas_fiscais_status_sefaz;
ALTER TABLE public.notas_fiscais DROP CONSTRAINT IF EXISTS chk_nf_coerencia_sefaz;
ALTER TABLE public.notas_fiscais DROP CONSTRAINT IF EXISTS chk_nf_inutilizacao;
ALTER TABLE public.notas_fiscais DROP CONSTRAINT IF EXISTS chk_nf_importada;
ALTER TABLE public.notas_fiscais DROP CONSTRAINT IF EXISTS chk_nf_origem;
ALTER TABLE public.notas_fiscais DROP CONSTRAINT IF EXISTS chk_nf_devolucao_referencia;

ALTER TABLE public.notas_fiscais
  ADD CONSTRAINT chk_notas_fiscais_status
  CHECK (status IN ('rascunho','pendente','confirmada','importada','cancelada'));

ALTER TABLE public.notas_fiscais
  ADD CONSTRAINT chk_notas_fiscais_status_sefaz
  CHECK (status_sefaz IN ('nao_enviada','em_processamento','autorizada','rejeitada','denegada','cancelada_sefaz','inutilizada','importada_externa'));

ALTER TABLE public.notas_fiscais
  ADD CONSTRAINT chk_nf_coerencia_sefaz
  CHECK (
    status_sefaz NOT IN ('autorizada','em_processamento','cancelada_sefaz')
    OR status = 'confirmada'
  );

ALTER TABLE public.notas_fiscais
  ADD CONSTRAINT chk_nf_inutilizacao
  CHECK (
    status_sefaz <> 'inutilizada' OR status IN ('rascunho','cancelada')
  );

ALTER TABLE public.notas_fiscais
  ADD CONSTRAINT chk_nf_importada
  CHECK (
    status <> 'importada' OR status_sefaz = 'importada_externa'
  );

-- 2. origem canônica
ALTER TABLE public.notas_fiscais
  ADD CONSTRAINT chk_nf_origem
  CHECK (origem IN ('manual','xml_importado','pedido','devolucao','importacao_historica','sefaz_externa'));

UPDATE public.notas_fiscais SET origem = 'manual' WHERE origem IS NULL;

ALTER TABLE public.notas_fiscais
  ADD CONSTRAINT chk_nf_devolucao_referencia
  CHECK (
    tipo_operacao IS DISTINCT FROM 'devolucao' OR nf_referenciada_id IS NOT NULL
  );

-- ============================================================
-- 3. Trigger de transição de status
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_nf_valida_transicao_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_internal_op text := current_setting('app.nf_internal_op', true);
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- RPCs internas podem fazer qualquer transição válida
  IF v_internal_op = '1' THEN
    RETURN NEW;
  END IF;

  -- Bloqueia saídas de estados terminais via UPDATE direto
  IF OLD.status IN ('cancelada','importada') THEN
    RAISE EXCEPTION 'Transição inválida: NF % está em estado terminal (%) e não pode ser alterada via UPDATE direto.', OLD.id, OLD.status
      USING HINT = 'Use RPCs oficiais (cancelar_nota_fiscal / inutilizar_nota_fiscal).';
  END IF;

  -- Sair de "confirmada" só via estornar_nota_fiscal (que seta a flag)
  IF OLD.status = 'confirmada' AND NEW.status <> 'confirmada' THEN
    RAISE EXCEPTION 'Transição inválida: NF confirmada só pode ser revertida via estornar_nota_fiscal.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nf_status_transicao ON public.notas_fiscais;
CREATE TRIGGER trg_nf_status_transicao
  BEFORE UPDATE OF status ON public.notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.trg_nf_valida_transicao_status();

-- ============================================================
-- 4. Proteção contra DELETE
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_nf_protege_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'rascunho' AND OLD.status_sefaz = 'nao_enviada' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'DELETE bloqueado: NF % está em status=% / sefaz=%. Use cancelar_nota_fiscal ou inutilizar_nota_fiscal.', OLD.id, OLD.status, OLD.status_sefaz;
END;
$$;

DROP TRIGGER IF EXISTS trg_nf_protege_delete ON public.notas_fiscais;
CREATE TRIGGER trg_nf_protege_delete
  BEFORE DELETE ON public.notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.trg_nf_protege_delete();

-- ============================================================
-- 5. Proteção de edição estrutural pós-confirmação
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_nf_protege_edicao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_internal_op text := current_setting('app.nf_internal_op', true);
BEGIN
  IF v_internal_op = '1' THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('confirmada','importada','cancelada') THEN
    -- Permite mudança de status (governada pelo outro trigger) e flags de comunicação
    IF NEW.valor_total IS DISTINCT FROM OLD.valor_total
       OR NEW.chave_acesso IS DISTINCT FROM OLD.chave_acesso
       OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id
       OR NEW.fornecedor_id IS DISTINCT FROM OLD.fornecedor_id
       OR NEW.numero IS DISTINCT FROM OLD.numero
       OR NEW.serie IS DISTINCT FROM OLD.serie
       OR NEW.modelo_documento IS DISTINCT FROM OLD.modelo_documento
       OR NEW.tipo IS DISTINCT FROM OLD.tipo
       OR NEW.tipo_operacao IS DISTINCT FROM OLD.tipo_operacao
    THEN
      RAISE EXCEPTION 'NF % está bloqueada para edição estrutural (status=%). Use estorno/cancelamento.', OLD.id, OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nf_protege_edicao ON public.notas_fiscais;
CREATE TRIGGER trg_nf_protege_edicao
  BEFORE UPDATE ON public.notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.trg_nf_protege_edicao();

CREATE OR REPLACE FUNCTION public.trg_nf_itens_protege_edicao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_internal_op text := current_setting('app.nf_internal_op', true);
  v_status text;
BEGIN
  IF v_internal_op = '1' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT status INTO v_status FROM public.notas_fiscais
    WHERE id = COALESCE(NEW.nota_fiscal_id, OLD.nota_fiscal_id);

  IF v_status IN ('confirmada','importada','cancelada') THEN
    RAISE EXCEPTION 'Itens da NF estão bloqueados para edição (status=%).', v_status
      USING HINT = 'Use estorno (estornar_nota_fiscal) para liberar alterações.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_nf_itens_protege_edicao ON public.notas_fiscais_itens;
CREATE TRIGGER trg_nf_itens_protege_edicao
  BEFORE INSERT OR UPDATE OR DELETE ON public.notas_fiscais_itens
  FOR EACH ROW EXECUTE FUNCTION public.trg_nf_itens_protege_edicao();

-- ============================================================
-- 6. Unicidade fiscal
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS ux_nf_chave_acesso
  ON public.notas_fiscais (chave_acesso)
  WHERE chave_acesso IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_nf_modelo_serie_numero_tipo
  ON public.notas_fiscais (modelo_documento, serie, numero, tipo)
  WHERE numero IS NOT NULL AND ativo = true;

-- ============================================================
-- 7. FK transportadora
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.notas_fiscais'::regclass
      AND conname='notas_fiscais_transportadora_id_fkey'
  ) THEN
    ALTER TABLE public.notas_fiscais
      ADD CONSTRAINT notas_fiscais_transportadora_id_fkey
      FOREIGN KEY (transportadora_id) REFERENCES public.transportadoras(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 8. CHECK em tipos de evento
-- ============================================================
ALTER TABLE public.nota_fiscal_eventos DROP CONSTRAINT IF EXISTS chk_nf_eventos_tipo;
ALTER TABLE public.nota_fiscal_eventos
  ADD CONSTRAINT chk_nf_eventos_tipo
  CHECK (tipo_evento IN (
    'criacao','edicao','confirmacao','estorno',
    'autorizacao_sefaz','rejeicao_sefaz',
    'cancelamento','cancelamento_sefaz','inutilizacao',
    'criacao_devolucao','importacao_xml','anexo_adicionado'
  ));

-- Trigger de auditoria automática de status
CREATE OR REPLACE FUNCTION public.trg_nf_audita_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_tipo := CASE NEW.status
      WHEN 'confirmada' THEN 'confirmacao'
      WHEN 'cancelada' THEN 'cancelamento'
      WHEN 'pendente' THEN 'edicao'
      ELSE 'edicao'
    END;
    INSERT INTO public.nota_fiscal_eventos (nota_fiscal_id, tipo_evento, status_anterior, status_novo, descricao, usuario_id)
    VALUES (NEW.id, v_tipo, OLD.status, NEW.status, 'Mudança automática de status interno', auth.uid());
  END IF;

  IF NEW.status_sefaz IS DISTINCT FROM OLD.status_sefaz THEN
    v_tipo := CASE NEW.status_sefaz
      WHEN 'autorizada' THEN 'autorizacao_sefaz'
      WHEN 'rejeitada' THEN 'rejeicao_sefaz'
      WHEN 'cancelada_sefaz' THEN 'cancelamento_sefaz'
      WHEN 'inutilizada' THEN 'inutilizacao'
      ELSE 'edicao'
    END;
    INSERT INTO public.nota_fiscal_eventos (nota_fiscal_id, tipo_evento, status_anterior, status_novo, descricao, usuario_id)
    VALUES (NEW.id, v_tipo, OLD.status_sefaz, NEW.status_sefaz, 'Mudança automática de status SEFAZ', auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nf_audita_status ON public.notas_fiscais;
CREATE TRIGGER trg_nf_audita_status
  AFTER UPDATE OF status, status_sefaz ON public.notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.trg_nf_audita_status();

-- ============================================================
-- 9. RPCs v2
-- ============================================================

-- 9.1 confirmar_nota_fiscal (CREATE OR REPLACE preservando assinatura)
CREATE OR REPLACE FUNCTION public.confirmar_nota_fiscal(p_nf_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nf public.notas_fiscais%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('nf:'||p_nf_id::text));

  SELECT * INTO v_nf FROM public.notas_fiscais WHERE id = p_nf_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NF % não encontrada.', p_nf_id;
  END IF;

  IF v_nf.status NOT IN ('rascunho','pendente') THEN
    RAISE EXCEPTION 'NF % não pode ser confirmada (status atual=%).', p_nf_id, v_nf.status;
  END IF;

  PERFORM set_config('app.nf_internal_op','1',true);

  -- Movimentação de estoque (idempotente)
  IF COALESCE(v_nf.movimenta_estoque,false) THEN
    INSERT INTO public.estoque_movimentos (produto_id, tipo, quantidade, documento_tipo, documento_id, motivo, usuario_id)
    SELECT i.produto_id,
           CASE WHEN v_nf.tipo='saida' THEN 'saida' ELSE 'entrada' END,
           i.quantidade,
           'fiscal',
           v_nf.id,
           'Confirmação NF '||COALESCE(v_nf.numero,v_nf.id::text),
           auth.uid()
      FROM public.notas_fiscais_itens i
     WHERE i.nota_fiscal_id = v_nf.id
       AND NOT EXISTS (
         SELECT 1 FROM public.estoque_movimentos m
          WHERE m.documento_tipo='fiscal' AND m.documento_id=v_nf.id AND m.produto_id=i.produto_id
       );
  END IF;

  -- Financeiro (idempotente — só se não houver lançamento ativo da NF)
  IF COALESCE(v_nf.gera_financeiro,false) AND NOT EXISTS (
    SELECT 1 FROM public.financeiro_lancamentos
     WHERE nota_fiscal_id = v_nf.id AND status <> 'cancelado'
  ) THEN
    INSERT INTO public.financeiro_lancamentos
      (tipo, valor, data_vencimento, data_emissao, descricao,
       cliente_id, fornecedor_id, nota_fiscal_id,
       origem_tipo, origem_tabela, origem_id, origem_descricao,
       status, parcela_numero, parcela_total)
    VALUES (
       CASE WHEN v_nf.tipo='saida' THEN 'receber' ELSE 'pagar' END,
       v_nf.valor_total,
       COALESCE(v_nf.data_emissao, CURRENT_DATE),
       COALESCE(v_nf.data_emissao, CURRENT_DATE),
       'NF '||COALESCE(v_nf.numero,v_nf.id::text),
       v_nf.cliente_id, v_nf.fornecedor_id, v_nf.id,
       'fiscal_nota','notas_fiscais',v_nf.id,'Lançamento gerado por confirmação de NF',
       'aberto', 1, 1
    );
  END IF;

  -- Atualizar status da NF
  UPDATE public.notas_fiscais SET status='confirmada', updated_at=now() WHERE id = v_nf.id;

  -- Atualizar faturamento da OV vinculada
  IF v_nf.ordem_venda_id IS NOT NULL THEN
    UPDATE public.ordens_venda_itens ovi
       SET quantidade_faturada = COALESCE(ovi.quantidade_faturada,0) + nfi.quantidade
      FROM public.notas_fiscais_itens nfi
     WHERE nfi.nota_fiscal_id = v_nf.id
       AND ovi.ordem_venda_id = v_nf.ordem_venda_id
       AND ovi.produto_id = nfi.produto_id;
  END IF;

  INSERT INTO public.auditoria_logs (acao, tabela, registro_id, usuario_id, dados_novos)
  VALUES ('confirmar_nf','notas_fiscais', v_nf.id, auth.uid(),
          jsonb_build_object('numero', v_nf.numero, 'valor_total', v_nf.valor_total));

  PERFORM set_config('app.nf_internal_op','',true);
END;
$$;

-- 9.2 estornar_nota_fiscal — preserva trilha financeira e reverte OV
CREATE OR REPLACE FUNCTION public.estornar_nota_fiscal(p_nf_id uuid, p_motivo text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nf public.notas_fiscais%ROWTYPE;
  v_lanc record;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('nf:'||p_nf_id::text));

  SELECT * INTO v_nf FROM public.notas_fiscais WHERE id=p_nf_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NF % não encontrada.', p_nf_id;
  END IF;
  IF v_nf.status <> 'confirmada' THEN
    RAISE EXCEPTION 'Só é possível estornar NF confirmada (status atual=%).', v_nf.status;
  END IF;
  IF v_nf.status_sefaz IN ('autorizada','em_processamento') THEN
    RAISE EXCEPTION 'NF autorizada na SEFAZ. Cancele via cancelar_nota_fiscal_sefaz primeiro.';
  END IF;

  PERFORM set_config('app.nf_internal_op','1',true);

  -- Reverter estoque com movimento oposto (idempotente)
  IF COALESCE(v_nf.movimenta_estoque,false) THEN
    INSERT INTO public.estoque_movimentos (produto_id, tipo, quantidade, documento_tipo, documento_id, motivo, usuario_id)
    SELECT i.produto_id,
           CASE WHEN v_nf.tipo='saida' THEN 'entrada' ELSE 'saida' END,
           i.quantidade,
           'fiscal_estorno', v_nf.id,
           'Estorno NF '||COALESCE(v_nf.numero,v_nf.id::text)||COALESCE(' — '||p_motivo,''),
           auth.uid()
      FROM public.notas_fiscais_itens i
     WHERE i.nota_fiscal_id = v_nf.id
       AND NOT EXISTS (
         SELECT 1 FROM public.estoque_movimentos m
          WHERE m.documento_tipo='fiscal_estorno' AND m.documento_id=v_nf.id AND m.produto_id=i.produto_id
       );
  END IF;

  -- Cancelar lançamentos financeiros via RPC oficial (preserva trilha)
  FOR v_lanc IN
    SELECT id FROM public.financeiro_lancamentos
     WHERE nota_fiscal_id = v_nf.id AND status NOT IN ('cancelado')
  LOOP
    BEGIN
      PERFORM public.financeiro_cancelar_lancamento(v_lanc.id, COALESCE(p_motivo,'Estorno de NF '||COALESCE(v_nf.numero,'')));
    EXCEPTION WHEN OTHERS THEN
      -- já tem baixa ativa: deixa marca em auditoria e segue
      INSERT INTO public.auditoria_logs (acao, tabela, registro_id, usuario_id, dados_novos)
      VALUES ('estorno_nf_lancamento_bloqueado','financeiro_lancamentos', v_lanc.id, auth.uid(),
              jsonb_build_object('motivo', SQLERRM, 'nf_id', v_nf.id));
    END;
  END LOOP;

  -- Reverter faturamento da OV
  IF v_nf.ordem_venda_id IS NOT NULL THEN
    UPDATE public.ordens_venda_itens ovi
       SET quantidade_faturada = GREATEST(COALESCE(ovi.quantidade_faturada,0) - nfi.quantidade, 0)
      FROM public.notas_fiscais_itens nfi
     WHERE nfi.nota_fiscal_id = v_nf.id
       AND ovi.ordem_venda_id = v_nf.ordem_venda_id
       AND ovi.produto_id = nfi.produto_id;
  END IF;

  -- Voltar status para pendente (rascunho de revisão)
  UPDATE public.notas_fiscais SET status='pendente', updated_at=now() WHERE id=v_nf.id;

  INSERT INTO public.nota_fiscal_eventos (nota_fiscal_id, tipo_evento, status_anterior, status_novo, descricao, usuario_id)
  VALUES (v_nf.id,'estorno','confirmada','pendente', COALESCE(p_motivo,'Estorno de NF'), auth.uid());

  INSERT INTO public.auditoria_logs (acao, tabela, registro_id, usuario_id, dados_novos)
  VALUES ('estornar_nf','notas_fiscais', v_nf.id, auth.uid(), jsonb_build_object('motivo', p_motivo));

  PERFORM set_config('app.nf_internal_op','',true);
END;
$$;

-- 9.3 gerar_devolucao_nota_fiscal — adiciona validação de saldo devolvível
CREATE OR REPLACE FUNCTION public.gerar_devolucao_nota_fiscal(p_nf_origem_id uuid, p_itens jsonb DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origem public.notas_fiscais%ROWTYPE;
  v_nova_id uuid;
  v_item jsonb;
  v_qtd_origem numeric;
  v_qtd_devolvida numeric;
  v_qtd_solicitada numeric;
BEGIN
  SELECT * INTO v_origem FROM public.notas_fiscais WHERE id=p_nf_origem_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NF origem % não encontrada.', p_nf_origem_id;
  END IF;
  IF v_origem.status <> 'confirmada' THEN
    RAISE EXCEPTION 'NF origem deve estar confirmada (status atual=%).', v_origem.status;
  END IF;

  -- Validação de saldo devolvível (quando p_itens informado)
  IF p_itens IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
      SELECT COALESCE(SUM(quantidade),0) INTO v_qtd_origem
        FROM public.notas_fiscais_itens
       WHERE nota_fiscal_id = p_nf_origem_id
         AND produto_id = (v_item->>'produto_id')::uuid;

      SELECT COALESCE(SUM(nfi.quantidade),0) INTO v_qtd_devolvida
        FROM public.notas_fiscais_itens nfi
        JOIN public.notas_fiscais nf ON nf.id = nfi.nota_fiscal_id
       WHERE nf.nf_referenciada_id = p_nf_origem_id
         AND nf.tipo_operacao = 'devolucao'
         AND nf.status <> 'cancelada'
         AND nfi.produto_id = (v_item->>'produto_id')::uuid;

      v_qtd_solicitada := (v_item->>'quantidade')::numeric;

      IF v_qtd_devolvida + v_qtd_solicitada > v_qtd_origem THEN
        RAISE EXCEPTION 'Quantidade devolvida (% + % solicitada) excede a NF origem (%) para produto %.',
          v_qtd_devolvida, v_qtd_solicitada, v_qtd_origem, v_item->>'produto_id';
      END IF;
    END LOOP;
  END IF;

  PERFORM set_config('app.nf_internal_op','1',true);

  INSERT INTO public.notas_fiscais
    (tipo, tipo_operacao, nf_referenciada_id, cliente_id, fornecedor_id,
     ordem_venda_id, status, status_sefaz, origem,
     valor_total, modelo_documento, serie, data_emissao,
     movimenta_estoque, gera_financeiro, observacoes)
  VALUES (
     CASE WHEN v_origem.tipo='saida' THEN 'entrada' ELSE 'saida' END,
     'devolucao', v_origem.id,
     v_origem.cliente_id, v_origem.fornecedor_id,
     v_origem.ordem_venda_id, 'rascunho','nao_enviada','devolucao',
     0, v_origem.modelo_documento, v_origem.serie, CURRENT_DATE,
     true, true, 'Devolução referente à NF '||COALESCE(v_origem.numero,'')
  )
  RETURNING id INTO v_nova_id;

  IF p_itens IS NOT NULL THEN
    INSERT INTO public.notas_fiscais_itens (nota_fiscal_id, produto_id, quantidade, valor_unitario)
    SELECT v_nova_id,
           (item->>'produto_id')::uuid,
           (item->>'quantidade')::numeric,
           COALESCE((item->>'valor_unitario')::numeric, 0)
      FROM jsonb_array_elements(p_itens) AS item;
  ELSE
    -- Devolução total
    INSERT INTO public.notas_fiscais_itens (nota_fiscal_id, produto_id, quantidade, valor_unitario)
    SELECT v_nova_id, produto_id, quantidade, valor_unitario
      FROM public.notas_fiscais_itens WHERE nota_fiscal_id = p_nf_origem_id;
  END IF;

  -- Atualiza valor_total
  UPDATE public.notas_fiscais
     SET valor_total = COALESCE((SELECT SUM(quantidade*valor_unitario) FROM public.notas_fiscais_itens WHERE nota_fiscal_id=v_nova_id),0)
   WHERE id = v_nova_id;

  INSERT INTO public.nota_fiscal_eventos (nota_fiscal_id, tipo_evento, status_novo, descricao, usuario_id)
  VALUES (v_nova_id,'criacao_devolucao','rascunho','Devolução gerada a partir da NF '||COALESCE(v_origem.numero,''), auth.uid());

  INSERT INTO public.auditoria_logs (acao, tabela, registro_id, usuario_id, dados_novos)
  VALUES ('gerar_devolucao','notas_fiscais', v_nova_id, auth.uid(), jsonb_build_object('nf_origem', p_nf_origem_id));

  PERFORM set_config('app.nf_internal_op','',true);
  RETURN v_nova_id;
END;
$$;

-- 9.4 Nova RPC: cancelar_nota_fiscal (interno)
CREATE OR REPLACE FUNCTION public.cancelar_nota_fiscal(p_nf_id uuid, p_motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nf public.notas_fiscais%ROWTYPE;
BEGIN
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'Motivo de cancelamento obrigatório (mínimo 5 caracteres).';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('nf:'||p_nf_id::text));
  SELECT * INTO v_nf FROM public.notas_fiscais WHERE id=p_nf_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NF % não encontrada.', p_nf_id;
  END IF;

  IF v_nf.status_sefaz = 'autorizada' THEN
    RAISE EXCEPTION 'NF autorizada na SEFAZ deve ser cancelada via cancelar_nota_fiscal_sefaz.';
  END IF;
  IF v_nf.status = 'cancelada' THEN
    RAISE EXCEPTION 'NF já está cancelada.';
  END IF;
  IF v_nf.status = 'importada' THEN
    RAISE EXCEPTION 'NF importada não pode ser cancelada (apenas estornada se aplicável).';
  END IF;

  -- Se confirmada, estorna efeitos primeiro
  IF v_nf.status = 'confirmada' THEN
    PERFORM public.estornar_nota_fiscal(p_nf_id, 'Cancelamento: '||p_motivo);
  END IF;

  PERFORM set_config('app.nf_internal_op','1',true);
  UPDATE public.notas_fiscais SET status='cancelada', updated_at=now() WHERE id=p_nf_id;

  INSERT INTO public.nota_fiscal_eventos (nota_fiscal_id, tipo_evento, status_novo, descricao, usuario_id)
  VALUES (p_nf_id,'cancelamento','cancelada', p_motivo, auth.uid());

  INSERT INTO public.auditoria_logs (acao, tabela, registro_id, usuario_id, dados_novos)
  VALUES ('cancelar_nf','notas_fiscais', p_nf_id, auth.uid(), jsonb_build_object('motivo', p_motivo));

  PERFORM set_config('app.nf_internal_op','',true);
END;
$$;

-- 9.5 Nova RPC: cancelar_nota_fiscal_sefaz
CREATE OR REPLACE FUNCTION public.cancelar_nota_fiscal_sefaz(p_nf_id uuid, p_protocolo text, p_motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nf public.notas_fiscais%ROWTYPE;
BEGIN
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 15 THEN
    RAISE EXCEPTION 'Motivo de cancelamento SEFAZ exige mínimo 15 caracteres.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('nf:'||p_nf_id::text));
  SELECT * INTO v_nf FROM public.notas_fiscais WHERE id=p_nf_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NF % não encontrada.', p_nf_id;
  END IF;
  IF v_nf.status_sefaz <> 'autorizada' THEN
    RAISE EXCEPTION 'Cancelamento SEFAZ só permitido em NFs autorizadas (atual=%).', v_nf.status_sefaz;
  END IF;

  PERFORM set_config('app.nf_internal_op','1',true);
  UPDATE public.notas_fiscais
     SET status_sefaz='cancelada_sefaz',
         protocolo_autorizacao = COALESCE(p_protocolo, protocolo_autorizacao),
         updated_at = now()
   WHERE id = p_nf_id;

  INSERT INTO public.nota_fiscal_eventos (nota_fiscal_id, tipo_evento, status_novo, descricao, payload_resumido, usuario_id)
  VALUES (p_nf_id,'cancelamento_sefaz','cancelada_sefaz', p_motivo,
          jsonb_build_object('protocolo', p_protocolo), auth.uid());

  INSERT INTO public.auditoria_logs (acao, tabela, registro_id, usuario_id, dados_novos)
  VALUES ('cancelar_nf_sefaz','notas_fiscais', p_nf_id, auth.uid(),
          jsonb_build_object('motivo', p_motivo, 'protocolo', p_protocolo));

  PERFORM set_config('app.nf_internal_op','',true);
END;
$$;

-- 9.6 Nova RPC: inutilizar_nota_fiscal
CREATE OR REPLACE FUNCTION public.inutilizar_nota_fiscal(p_nf_id uuid, p_protocolo text, p_motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nf public.notas_fiscais%ROWTYPE;
BEGIN
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 15 THEN
    RAISE EXCEPTION 'Motivo de inutilização exige mínimo 15 caracteres.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('nf:'||p_nf_id::text));
  SELECT * INTO v_nf FROM public.notas_fiscais WHERE id=p_nf_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NF % não encontrada.', p_nf_id;
  END IF;
  IF v_nf.status_sefaz <> 'nao_enviada' THEN
    RAISE EXCEPTION 'Inutilização só permitida com status_sefaz=nao_enviada (atual=%).', v_nf.status_sefaz;
  END IF;
  IF v_nf.status NOT IN ('rascunho','cancelada') THEN
    RAISE EXCEPTION 'Inutilização só permitida em NFs rascunho ou canceladas (atual=%).', v_nf.status;
  END IF;

  PERFORM set_config('app.nf_internal_op','1',true);
  UPDATE public.notas_fiscais
     SET status_sefaz='inutilizada',
         protocolo_autorizacao = COALESCE(p_protocolo, protocolo_autorizacao),
         updated_at=now()
   WHERE id=p_nf_id;

  INSERT INTO public.nota_fiscal_eventos (nota_fiscal_id, tipo_evento, status_novo, descricao, payload_resumido, usuario_id)
  VALUES (p_nf_id,'inutilizacao','inutilizada', p_motivo,
          jsonb_build_object('protocolo', p_protocolo), auth.uid());

  INSERT INTO public.auditoria_logs (acao, tabela, registro_id, usuario_id, dados_novos)
  VALUES ('inutilizar_nf','notas_fiscais', p_nf_id, auth.uid(),
          jsonb_build_object('motivo', p_motivo, 'protocolo', p_protocolo));

  PERFORM set_config('app.nf_internal_op','',true);
END;
$$;

-- ============================================================
-- 10. View v_trilha_fiscal
-- ============================================================
DROP VIEW IF EXISTS public.v_trilha_fiscal;
CREATE VIEW public.v_trilha_fiscal
WITH (security_invoker = true) AS
SELECT
  nf.id AS nf_id,
  nf.numero,
  nf.tipo,
  nf.tipo_operacao,
  nf.status,
  nf.status_sefaz,
  nf.origem,
  nf.ordem_venda_id,
  nf.nf_referenciada_id,
  nf.data_emissao,
  nf.valor_total,
  COALESCE((SELECT array_agg(id) FROM public.financeiro_lancamentos WHERE nota_fiscal_id=nf.id), '{}'::uuid[]) AS financeiro_lancamento_ids,
  COALESCE((SELECT array_agg(id) FROM public.estoque_movimentos WHERE documento_id=nf.id AND documento_tipo IN ('fiscal','fiscal_estorno')), '{}'::uuid[]) AS estoque_movimento_ids,
  COALESCE((SELECT array_agg(id) FROM public.notas_fiscais d WHERE d.nf_referenciada_id=nf.id AND d.tipo_operacao='devolucao'), '{}'::uuid[]) AS devolucoes_ids,
  (SELECT count(*) FROM public.nota_fiscal_eventos WHERE nota_fiscal_id=nf.id) AS eventos_count
FROM public.notas_fiscais nf;
