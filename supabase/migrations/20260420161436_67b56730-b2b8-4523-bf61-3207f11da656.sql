-- =========================================================
-- REVISÃO ESTRUTURAL DO MÓDULO COMERCIAL (8 etapas)
-- =========================================================

-- ============ 1. PADRONIZAR STATUS DE ORÇAMENTO ============
UPDATE public.orcamentos SET status = 'pendente' WHERE status IN ('confirmado','enviado');

ALTER TABLE public.orcamentos DROP CONSTRAINT IF EXISTS chk_orcamentos_status;
ALTER TABLE public.orcamentos
  ADD CONSTRAINT chk_orcamentos_status
  CHECK (status = ANY (ARRAY['rascunho','pendente','aprovado','convertido','rejeitado','cancelado','expirado']));

-- Trigger de transição válida
CREATE OR REPLACE FUNCTION public.fn_orcamento_transicao_valida()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_terminais text[] := ARRAY['convertido','rejeitado','cancelado','expirado'];
  v_permitidas text[];
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF OLD.status = ANY (v_terminais) THEN
    RAISE EXCEPTION 'Orçamento em estado terminal (%) não pode mudar para %', OLD.status, NEW.status;
  END IF;
  v_permitidas := CASE OLD.status
    WHEN 'rascunho'  THEN ARRAY['pendente','cancelado','expirado']
    WHEN 'pendente'  THEN ARRAY['aprovado','rejeitado','cancelado','expirado','rascunho']
    WHEN 'aprovado'  THEN ARRAY['convertido','cancelado','expirado']
    ELSE ARRAY[]::text[]
  END;
  IF NOT (NEW.status = ANY (v_permitidas)) THEN
    RAISE EXCEPTION 'Transição inválida de % para %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_orcamento_transicao_valida ON public.orcamentos;
CREATE TRIGGER trg_orcamento_transicao_valida
  BEFORE UPDATE OF status ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_orcamento_transicao_valida();

-- RPC: expirar orçamentos vencidos
CREATE OR REPLACE FUNCTION public.expirar_orcamentos_vencidos()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.orcamentos
     SET status='expirado', updated_at=now()
   WHERE status IN ('rascunho','pendente','aprovado')
     AND validade IS NOT NULL
     AND validade < CURRENT_DATE;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

-- ============ 2. PROTEÇÃO DE EXCLUSÃO / CANCELAMENTO ============
CREATE OR REPLACE FUNCTION public.fn_orcamento_protege_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status <> 'rascunho' THEN
    RAISE EXCEPTION 'Somente orçamentos em rascunho podem ser excluídos (status atual: %). Use cancelar_orcamento.', OLD.status;
  END IF;
  IF EXISTS (SELECT 1 FROM public.ordens_venda WHERE cotacao_id = OLD.id) THEN
    RAISE EXCEPTION 'Orçamento possui pedido vinculado — não pode ser excluído.';
  END IF;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_orcamento_protege_delete ON public.orcamentos;
CREATE TRIGGER trg_orcamento_protege_delete
  BEFORE DELETE ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_orcamento_protege_delete();

CREATE OR REPLACE FUNCTION public.cancelar_orcamento(p_id uuid, p_motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_orc record;
BEGIN
  SELECT * INTO v_orc FROM public.orcamentos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado'; END IF;
  IF v_orc.status IN ('convertido','cancelado','rejeitado','expirado') THEN
    RAISE EXCEPTION 'Orçamento em estado % não pode ser cancelado', v_orc.status;
  END IF;
  UPDATE public.orcamentos
     SET status='cancelado',
         observacoes_internas = COALESCE(observacoes_internas || E'\n', '') || '[CANCELAMENTO ' || to_char(now(),'YYYY-MM-DD HH24:MI') || ']: ' || COALESCE(p_motivo,'sem motivo'),
         updated_at = now()
   WHERE id = p_id;
  INSERT INTO public.auditoria_logs (tabela, registro_id, acao, dados_anteriores, dados_novos, usuario_id)
    VALUES ('orcamentos', p_id, 'cancelar',
            jsonb_build_object('status', v_orc.status),
            jsonb_build_object('status','cancelado','motivo',p_motivo),
            auth.uid());
  RETURN jsonb_build_object('id', p_id, 'status','cancelado');
END; $$;

-- ============ 3. PEDIDO — STATUS INTEGRIDADE ============
ALTER TABLE public.ordens_venda DROP CONSTRAINT IF EXISTS chk_ordens_venda_status_fat;

ALTER TABLE public.ordens_venda DROP CONSTRAINT IF EXISTS chk_ordens_venda_matriz_status;
ALTER TABLE public.ordens_venda
  ADD CONSTRAINT chk_ordens_venda_matriz_status CHECK (
    (status IN ('rascunho','pendente','aprovada') AND status_faturamento = 'aguardando')
    OR (status = 'em_separacao' AND status_faturamento IN ('aguardando','parcial'))
    OR (status = 'faturada_parcial' AND status_faturamento = 'parcial')
    OR (status = 'faturada' AND status_faturamento = 'faturado')
    OR (status = 'cancelada')
  );

-- ============ 4. RPC converter_orcamento_em_ov v2 ============
CREATE UNIQUE INDEX IF NOT EXISTS ux_ordens_venda_cotacao_id
  ON public.ordens_venda(cotacao_id) WHERE cotacao_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.converter_orcamento_em_ov(
  p_orcamento_id uuid,
  p_po_number text DEFAULT NULL,
  p_data_po date DEFAULT NULL,
  p_forcar boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_orc record;
  v_ov_id uuid;
  v_ov_numero text;
  v_existing uuid;
BEGIN
  SELECT * INTO v_orc FROM public.orcamentos WHERE id = p_orcamento_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado'; END IF;

  SELECT id INTO v_existing FROM public.ordens_venda WHERE cotacao_id = p_orcamento_id LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Orçamento já convertido em pedido (id=%)', v_existing;
  END IF;

  IF NOT p_forcar AND v_orc.status <> 'aprovado' THEN
    RAISE EXCEPTION 'Somente orçamentos aprovados podem ser convertidos (status atual: %)', v_orc.status;
  END IF;
  IF v_orc.status IN ('convertido','cancelado','rejeitado','expirado') THEN
    RAISE EXCEPTION 'Orçamento em estado % não pode ser convertido', v_orc.status;
  END IF;

  v_ov_numero := public.proximo_numero_ordem_venda();
  v_ov_id := gen_random_uuid();

  INSERT INTO public.ordens_venda (
    id, numero, data_emissao, cliente_id, cotacao_id, vendedor_id,
    status, status_faturamento, valor_total, observacoes,
    po_number, data_po_cliente,
    frete_valor, frete_tipo, modalidade, transportadora_id, frete_simulacao_id,
    origem_frete, servico_frete, peso_total, prazo_entrega_dias, volumes
  ) VALUES (
    v_ov_id, v_ov_numero, CURRENT_DATE, v_orc.cliente_id, v_orc.id, v_orc.vendedor_id,
    'aprovada', 'aguardando', v_orc.valor_total, v_orc.observacoes,
    p_po_number, p_data_po,
    v_orc.frete_valor, v_orc.frete_tipo, v_orc.modalidade, v_orc.transportadora_id, v_orc.frete_simulacao_id,
    v_orc.origem_frete, v_orc.servico_frete, v_orc.peso_total, v_orc.prazo_entrega_dias, v_orc.volumes
  );

  INSERT INTO public.ordens_venda_itens (
    ordem_venda_id, produto_id, codigo_snapshot, descricao_snapshot, variacao,
    quantidade, unidade, valor_unitario, valor_total, peso_unitario, peso_total,
    quantidade_faturada
  )
  SELECT
    v_ov_id, oi.produto_id, oi.codigo_snapshot, oi.descricao_snapshot, oi.variacao,
    oi.quantidade, oi.unidade, oi.valor_unitario, oi.valor_total, oi.peso_unitario, oi.peso_total,
    0
  FROM public.orcamentos_itens oi
  WHERE oi.orcamento_id = p_orcamento_id;

  UPDATE public.orcamentos SET status = 'convertido', updated_at = now() WHERE id = p_orcamento_id;

  INSERT INTO public.auditoria_logs (tabela, registro_id, acao, dados_anteriores, dados_novos, usuario_id)
    VALUES ('orcamentos', p_orcamento_id, 'converter',
            jsonb_build_object('status', v_orc.status),
            jsonb_build_object('status','convertido','ov_id',v_ov_id,'ov_numero',v_ov_numero,'forcado',p_forcar),
            auth.uid());

  RETURN jsonb_build_object('ov_id', v_ov_id, 'ov_numero', v_ov_numero, 'orcamento_id', p_orcamento_id);
END; $$;

-- ============ 5. RPC gerar_nf_de_pedido v2 ============
CREATE OR REPLACE FUNCTION public.gerar_nf_de_pedido(p_pedido_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ped record;
  v_nf_id uuid;
  v_nf_numero text;
  v_total numeric := 0;
  v_peso_bruto numeric := 0;
  v_peso_liq numeric := 0;
  v_total_q numeric := 0;
  v_total_f numeric := 0;
  v_new_fat text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_pedido_id::text));

  SELECT * INTO v_ped FROM public.ordens_venda WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_ped.status IN ('rascunho','pendente','cancelada') THEN
    RAISE EXCEPTION 'Pedido em status % não pode ser faturado', v_ped.status;
  END IF;
  IF v_ped.status_faturamento = 'faturado' THEN
    RAISE EXCEPTION 'Pedido já totalmente faturado';
  END IF;

  v_nf_numero := public.proximo_numero_nf();
  v_nf_id := gen_random_uuid();

  SELECT
    COALESCE(SUM(oi.valor_total),0),
    COALESCE(SUM(COALESCE(p.peso_bruto,0) * oi.quantidade),0),
    COALESCE(SUM(COALESCE(p.peso_liquido,0) * oi.quantidade),0)
  INTO v_total, v_peso_bruto, v_peso_liq
  FROM public.ordens_venda_itens oi
  LEFT JOIN public.produtos p ON p.id = oi.produto_id
  WHERE oi.ordem_venda_id = p_pedido_id;

  INSERT INTO public.notas_fiscais (
    id, numero, tipo, data_emissao, cliente_id, ordem_venda_id,
    valor_total, valor_produtos, status, movimenta_estoque, gera_financeiro,
    origem, natureza_operacao, peso_bruto, peso_liquido, observacoes
  ) VALUES (
    v_nf_id, v_nf_numero, 'saida', CURRENT_DATE, v_ped.cliente_id, p_pedido_id,
    v_total, v_total, 'pendente', true, true,
    'pedido', 'Venda de mercadoria', v_peso_bruto, v_peso_liq,
    'Gerada a partir do Pedido ' || v_ped.numero
  );

  INSERT INTO public.notas_fiscais_itens (
    nota_fiscal_id, produto_id, quantidade, valor_unitario,
    ncm, cfop, cst, origem_mercadoria, unidade, codigo_produto
  )
  SELECT
    v_nf_id, oi.produto_id, oi.quantidade, oi.valor_unitario,
    p.ncm, p.cfop_padrao, p.cst, COALESCE(p.origem_mercadoria,'0'), COALESCE(p.unidade_medida,'UN'), p.sku
  FROM public.ordens_venda_itens oi
  LEFT JOIN public.produtos p ON p.id = oi.produto_id
  WHERE oi.ordem_venda_id = p_pedido_id;

  UPDATE public.ordens_venda_itens
     SET quantidade_faturada = quantidade
   WHERE ordem_venda_id = p_pedido_id;

  SELECT COALESCE(SUM(quantidade),0), COALESCE(SUM(quantidade_faturada),0)
    INTO v_total_q, v_total_f
    FROM public.ordens_venda_itens WHERE ordem_venda_id = p_pedido_id;

  v_new_fat := CASE
    WHEN v_total_f >= v_total_q THEN 'faturado'
    WHEN v_total_f > 0 THEN 'parcial'
    ELSE 'aguardando'
  END;

  UPDATE public.ordens_venda
     SET status_faturamento = v_new_fat,
         status = CASE WHEN v_new_fat='faturado' THEN 'faturada'
                       WHEN v_new_fat='parcial' THEN 'faturada_parcial'
                       ELSE status END,
         updated_at = now()
   WHERE id = p_pedido_id;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='nf_eventos_fiscais') THEN
    INSERT INTO public.nf_eventos_fiscais (nota_fiscal_id, tipo_evento, status_novo, descricao, payload_resumido)
    VALUES (v_nf_id, 'criacao', 'pendente',
      'NF ' || v_nf_numero || ' gerada a partir do Pedido ' || v_ped.numero,
      jsonb_build_object('valor_total', v_total, 'pedido_numero', v_ped.numero));
  END IF;

  INSERT INTO public.auditoria_logs (tabela, registro_id, acao, dados_novos, usuario_id)
    VALUES ('ordens_venda', p_pedido_id, 'faturar',
            jsonb_build_object('nf_id',v_nf_id,'nf_numero',v_nf_numero,'status_faturamento_novo',v_new_fat),
            auth.uid());

  RETURN jsonb_build_object(
    'nf_id', v_nf_id,
    'nf_numero', v_nf_numero,
    'status_faturamento_novo', v_new_fat
  );
END; $$;

-- ============ 6. TRILHA COMERCIAL — FK/ÍNDICES/VIEW ============
ALTER TABLE public.ordens_venda DROP CONSTRAINT IF EXISTS ordens_venda_cotacao_id_fkey;
ALTER TABLE public.ordens_venda
  ADD CONSTRAINT ordens_venda_cotacao_id_fkey
  FOREIGN KEY (cotacao_id) REFERENCES public.orcamentos(id) ON DELETE RESTRICT;

ALTER TABLE public.notas_fiscais DROP CONSTRAINT IF EXISTS notas_fiscais_ordem_venda_id_fkey;
ALTER TABLE public.notas_fiscais
  ADD CONSTRAINT notas_fiscais_ordem_venda_id_fkey
  FOREIGN KEY (ordem_venda_id) REFERENCES public.ordens_venda(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_ordens_venda_cotacao_id ON public.ordens_venda(cotacao_id);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_ordem_venda_id ON public.notas_fiscais(ordem_venda_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente_status ON public.orcamentos(cliente_id, status);

DROP VIEW IF EXISTS public.v_trilha_comercial;
CREATE VIEW public.v_trilha_comercial AS
SELECT
  o.id AS orcamento_id, o.numero AS orcamento_numero, o.status AS orcamento_status,
  o.cliente_id, c.nome_razao_social AS cliente_nome,
  ov.id AS pedido_id, ov.numero AS pedido_numero, ov.status AS pedido_status, ov.status_faturamento,
  nf.id AS nf_id, nf.numero AS nf_numero, nf.status AS nf_status,
  o.valor_total AS valor_orcamento, ov.valor_total AS valor_pedido, nf.valor_total AS valor_nf,
  o.created_at AS criado_em
FROM public.orcamentos o
LEFT JOIN public.clientes c ON c.id = o.cliente_id
LEFT JOIN public.ordens_venda ov ON ov.cotacao_id = o.id
LEFT JOIN public.notas_fiscais nf ON nf.ordem_venda_id = ov.id;

-- ============ 7. CONDIÇÕES COMERCIAIS (CHECKS + FK frete) ============
ALTER TABLE public.orcamentos DROP CONSTRAINT IF EXISTS chk_orcamento_frete_tipo;
ALTER TABLE public.orcamentos
  ADD CONSTRAINT chk_orcamento_frete_tipo
  CHECK (frete_tipo IS NULL OR frete_tipo IN ('CIF','FOB','sem_frete'));

ALTER TABLE public.orcamentos DROP CONSTRAINT IF EXISTS chk_orcamento_modalidade;
ALTER TABLE public.orcamentos
  ADD CONSTRAINT chk_orcamento_modalidade
  CHECK (modalidade IS NULL OR modalidade IN ('CIF','FOB'));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='orcamentos_transportadora_id_fkey' AND conrelid='public.orcamentos'::regclass) THEN
    ALTER TABLE public.orcamentos DROP CONSTRAINT orcamentos_transportadora_id_fkey;
  END IF;
END $$;
ALTER TABLE public.orcamentos
  ADD CONSTRAINT orcamentos_transportadora_id_fkey
  FOREIGN KEY (transportadora_id) REFERENCES public.transportadoras(id) ON DELETE SET NULL;

-- ============ 8. AUDITORIA DE STATUS DE ORÇAMENTO ============
CREATE OR REPLACE FUNCTION public.fn_auditoria_orcamento_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.auditoria_logs (tabela, registro_id, acao, dados_anteriores, dados_novos, usuario_id)
      VALUES ('orcamentos', NEW.id, 'status_change',
              jsonb_build_object('status', OLD.status),
              jsonb_build_object('status', NEW.status, 'numero', NEW.numero),
              auth.uid());
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_auditoria_orcamento_status ON public.orcamentos;
CREATE TRIGGER trg_auditoria_orcamento_status
  AFTER UPDATE OF status ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria_orcamento_status();