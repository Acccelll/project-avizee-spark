-- B1
CREATE TABLE IF NOT EXISTS public.recebimentos_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_compra_id uuid NOT NULL REFERENCES public.pedidos_compra(id) ON DELETE RESTRICT,
  compra_id uuid REFERENCES public.compras(id) ON DELETE SET NULL,
  numero text,
  data_recebimento date NOT NULL DEFAULT CURRENT_DATE,
  responsavel_id uuid,
  nota_fiscal_id uuid REFERENCES public.notas_fiscais(id) ON DELETE SET NULL,
  tem_divergencia boolean NOT NULL DEFAULT false,
  motivo_divergencia text,
  observacoes text,
  status_logistico text NOT NULL DEFAULT 'recebido',
  usuario_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.recebimentos_compra_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recebimento_id uuid NOT NULL REFERENCES public.recebimentos_compra(id) ON DELETE CASCADE,
  pedido_compra_item_id uuid NOT NULL REFERENCES public.pedidos_compra_itens(id) ON DELETE RESTRICT,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  quantidade_recebida numeric NOT NULL DEFAULT 0,
  quantidade_pedida_snapshot numeric NOT NULL DEFAULT 0,
  tem_divergencia boolean NOT NULL DEFAULT false,
  motivo_divergencia text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recebimentos_pedido ON public.recebimentos_compra(pedido_compra_id);
CREATE INDEX IF NOT EXISTS idx_recebimentos_data ON public.recebimentos_compra(data_recebimento DESC);
CREATE INDEX IF NOT EXISTS idx_recebimentos_itens_rec ON public.recebimentos_compra_itens(recebimento_id);
ALTER TABLE public.recebimentos_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recebimentos_compra_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_full_recebimentos" ON public.recebimentos_compra;
CREATE POLICY "auth_full_recebimentos" ON public.recebimentos_compra FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_full_recebimentos_itens" ON public.recebimentos_compra_itens;
CREATE POLICY "auth_full_recebimentos_itens" ON public.recebimentos_compra_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.recebimentos_compra DROP CONSTRAINT IF EXISTS chk_recebimentos_compra_status_logistico;
ALTER TABLE public.recebimentos_compra ADD CONSTRAINT chk_recebimentos_compra_status_logistico
  CHECK (status_logistico IN ('pedido_emitido','aguardando_envio_fornecedor','em_transito','recebimento_parcial','recebido','recebido_com_divergencia','atrasado','cancelado'));

CREATE OR REPLACE FUNCTION public.get_recebimento_status_efetivo(p_status text, p_previsao date, p_tem_divergencia boolean)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p_status IN ('recebido','cancelado') THEN p_status
    WHEN p_tem_divergencia AND p_status='recebido' THEN 'recebido_com_divergencia'
    WHEN p_previsao IS NOT NULL AND p_previsao < CURRENT_DATE AND p_status NOT IN ('recebido','cancelado','recebido_com_divergencia') THEN 'atrasado'
    ELSE p_status
  END;
$$;

CREATE OR REPLACE FUNCTION public.fn_recebimento_marca_divergencia() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.tem_divergencia := COALESCE(NEW.quantidade_recebida,0) <> COALESCE(NEW.quantidade_pedida_snapshot,0); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_recebimento_marca_divergencia ON public.recebimentos_compra_itens;
CREATE TRIGGER trg_recebimento_marca_divergencia BEFORE INSERT OR UPDATE ON public.recebimentos_compra_itens FOR EACH ROW EXECUTE FUNCTION public.fn_recebimento_marca_divergencia();
DROP TRIGGER IF EXISTS trg_recebimentos_compra_updated_at ON public.recebimentos_compra;
CREATE TRIGGER trg_recebimentos_compra_updated_at BEFORE UPDATE ON public.recebimentos_compra FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- B4 remessa
UPDATE public.remessas SET status_transporte='pendente' WHERE status_transporte IN ('aguardando_separacao','separado') OR status_transporte IS NULL;
UPDATE public.remessas SET status_transporte='postado' WHERE status_transporte='expedido';
ALTER TABLE public.remessas DROP CONSTRAINT IF EXISTS chk_remessas_status_transporte;
ALTER TABLE public.remessas ADD CONSTRAINT chk_remessas_status_transporte
  CHECK (status_transporte IN ('pendente','coletado','postado','em_transito','ocorrencia','entregue','devolvido','cancelado'));
CREATE OR REPLACE FUNCTION public.fn_remessa_status_transicao() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.status_transporte IS DISTINCT FROM NEW.status_transporte THEN
    IF OLD.status_transporte IN ('entregue','devolvido','cancelado') THEN
      RAISE EXCEPTION 'Remessa em status terminal (%) não pode transicionar para %', OLD.status_transporte, NEW.status_transporte;
    END IF;
  END IF; RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_remessa_status_transicao ON public.remessas;
CREATE TRIGGER trg_remessa_status_transicao BEFORE UPDATE ON public.remessas FOR EACH ROW EXECUTE FUNCTION public.fn_remessa_status_transicao();

-- B5/B6 estoque
ALTER TABLE public.estoque_movimentos
  ADD COLUMN IF NOT EXISTS categoria_ajuste text,
  ADD COLUMN IF NOT EXISTS requer_aprovacao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_estruturado text;
ALTER TABLE public.estoque_movimentos DROP CONSTRAINT IF EXISTS chk_estoque_mov_tipo;
ALTER TABLE public.estoque_movimentos ADD CONSTRAINT chk_estoque_mov_tipo
  CHECK (tipo IN ('entrada','saida','ajuste','reserva','liberacao_reserva','estorno','inventario','perda_avaria','transferencia'));
ALTER TABLE public.estoque_movimentos DROP CONSTRAINT IF EXISTS chk_estoque_mov_documento_tipo;
ALTER TABLE public.estoque_movimentos ADD CONSTRAINT chk_estoque_mov_documento_tipo
  CHECK (documento_tipo IS NULL OR documento_tipo IN ('manual','compra','pedido_compra','venda','pedido_venda','nota_fiscal','inventario','transferencia','carga_inicial','estorno_fiscal'));
ALTER TABLE public.estoque_movimentos DROP CONSTRAINT IF EXISTS chk_estoque_mov_categoria_ajuste;
ALTER TABLE public.estoque_movimentos ADD CONSTRAINT chk_estoque_mov_categoria_ajuste
  CHECK (categoria_ajuste IS NULL OR categoria_ajuste IN ('correcao_inventario','perda','avaria','vencimento','furto_extravio','divergencia_recebimento','outro'));

CREATE OR REPLACE FUNCTION public.fn_estoque_mov_validacao_manual() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.documento_tipo = 'manual' THEN
    IF NEW.motivo IS NULL OR length(trim(NEW.motivo)) = 0 THEN RAISE EXCEPTION 'Movimentação manual requer motivo'; END IF;
    IF NEW.tipo IN ('ajuste','perda_avaria','inventario') THEN
      IF NEW.categoria_ajuste IS NULL THEN RAISE EXCEPTION 'Movimentação crítica (%) requer categoria_ajuste', NEW.tipo; END IF;
      IF NEW.motivo_estruturado IS NULL OR length(trim(NEW.motivo_estruturado)) < 10 THEN
        RAISE EXCEPTION 'Movimentação crítica requer motivo_estruturado com pelo menos 10 caracteres';
      END IF;
    END IF;
  END IF; RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_estoque_mov_validacao_manual ON public.estoque_movimentos;
CREATE TRIGGER trg_estoque_mov_validacao_manual BEFORE INSERT OR UPDATE ON public.estoque_movimentos FOR EACH ROW EXECUTE FUNCTION public.fn_estoque_mov_validacao_manual();

CREATE OR REPLACE FUNCTION public.ajustar_estoque_manual(
  p_produto_id uuid, p_tipo text, p_quantidade numeric,
  p_motivo text DEFAULT NULL, p_categoria_ajuste text DEFAULT NULL, p_motivo_estruturado text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_saldo_anterior numeric; v_saldo_atual numeric; v_quantidade_mov numeric;
  v_user uuid := auth.uid(); v_mov_id uuid;
  v_critico boolean := p_tipo IN ('ajuste','perda_avaria','inventario');
BEGIN
  IF v_critico THEN
    IF NOT (public.has_role(v_user,'admin') OR public.has_role(v_user,'estoquista')) THEN
      RAISE EXCEPTION 'Permissão negada: ajustes críticos requerem role admin ou estoquista'; END IF;
    IF p_categoria_ajuste IS NULL THEN RAISE EXCEPTION 'Ajustes críticos requerem categoria_ajuste'; END IF;
    IF p_motivo_estruturado IS NULL OR length(trim(p_motivo_estruturado)) < 10 THEN
      RAISE EXCEPTION 'Ajustes críticos requerem motivo_estruturado com >=10 caracteres'; END IF;
  END IF;
  SELECT COALESCE(estoque_atual,0) INTO v_saldo_anterior FROM public.produtos WHERE id = p_produto_id FOR UPDATE;
  IF p_tipo = 'entrada' THEN v_quantidade_mov := abs(p_quantidade); v_saldo_atual := v_saldo_anterior + v_quantidade_mov;
  ELSIF p_tipo IN ('saida','perda_avaria') THEN v_quantidade_mov := -abs(p_quantidade); v_saldo_atual := v_saldo_anterior + v_quantidade_mov;
  ELSIF p_tipo IN ('ajuste','inventario') THEN v_quantidade_mov := p_quantidade - v_saldo_anterior; v_saldo_atual := p_quantidade;
  ELSE RAISE EXCEPTION 'Tipo % não suportado', p_tipo; END IF;
  INSERT INTO public.estoque_movimentos (produto_id, tipo, quantidade, saldo_anterior, saldo_atual, motivo, documento_tipo, usuario_id, categoria_ajuste, motivo_estruturado)
  VALUES (p_produto_id, p_tipo, v_quantidade_mov, v_saldo_anterior, v_saldo_atual, p_motivo, 'manual', v_user, p_categoria_ajuste, p_motivo_estruturado)
  RETURNING id INTO v_mov_id;
  UPDATE public.produtos SET estoque_atual = v_saldo_atual, updated_at = now() WHERE id = p_produto_id;
  IF v_critico THEN
    INSERT INTO public.auditoria_logs (acao, tabela, registro_id, usuario_id, dados_novos)
    VALUES ('ajuste_critico','estoque_movimentos', v_mov_id, v_user,
      jsonb_build_object('produto_id',p_produto_id,'tipo',p_tipo,'quantidade',p_quantidade,'categoria',p_categoria_ajuste,'motivo',p_motivo_estruturado));
  END IF;
  RETURN v_mov_id;
END; $$;

-- B7
CREATE INDEX IF NOT EXISTS idx_remessas_ordem_venda_id ON public.remessas(ordem_venda_id);
CREATE INDEX IF NOT EXISTS idx_remessa_eventos_remessa ON public.remessa_eventos(remessa_id);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_documento ON public.estoque_movimentos(documento_tipo, documento_id);

DROP VIEW IF EXISTS public.vw_entregas_consolidadas CASCADE;
CREATE VIEW public.vw_entregas_consolidadas WITH (security_invoker = true) AS
WITH r_agg AS (
  SELECT r.ordem_venda_id,
    COUNT(*) FILTER (WHERE r.ativo) AS total_remessas,
    COALESCE(SUM(r.volumes) FILTER (WHERE r.ativo),0) AS total_volumes,
    COALESCE(SUM(r.peso) FILTER (WHERE r.ativo),0) AS peso_total_remessas,
    MIN(r.previsao_entrega) FILTER (WHERE r.ativo) AS previsao_entrega_min,
    MIN(r.data_postagem) FILTER (WHERE r.ativo) AS data_postagem_min,
    MAX(r.data_entrega_real) FILTER (WHERE r.ativo) AS data_entrega_max,
    bool_and(r.status_transporte = 'entregue') FILTER (WHERE r.ativo) AS todas_entregues,
    bool_or(r.status_transporte = 'entregue') FILTER (WHERE r.ativo) AS alguma_entregue,
    bool_or(r.status_transporte = 'em_transito') FILTER (WHERE r.ativo) AS alguma_transito,
    bool_or(r.status_transporte = 'ocorrencia') FILTER (WHERE r.ativo) AS alguma_ocorrencia,
    bool_or(r.status_transporte = 'cancelado') FILTER (WHERE r.ativo) AS alguma_cancelada,
    bool_or(r.status_transporte IN ('postado','coletado')) FILTER (WHERE r.ativo) AS alguma_postada
  FROM public.remessas r WHERE r.ordem_venda_id IS NOT NULL GROUP BY r.ordem_venda_id
),
r_principal AS (
  SELECT DISTINCT ON (r.ordem_venda_id) r.ordem_venda_id, r.transportadora_id
  FROM public.remessas r WHERE r.ativo AND r.ordem_venda_id IS NOT NULL
  ORDER BY r.ordem_venda_id, r.peso DESC NULLS LAST, r.created_at ASC
),
itens_agg AS (
  SELECT ordem_venda_id, COALESCE(SUM(quantidade),0) AS qtd_pedida, COALESCE(SUM(peso_total),0) AS peso_pedido
  FROM public.ordens_venda_itens GROUP BY ordem_venda_id
)
SELECT ov.id AS ordem_venda_id, ov.numero AS numero_pedido, ov.cliente_id,
  c.nome_razao_social AS cliente, c.cidade, c.uf,
  ov.data_prometida_despacho AS previsao_envio,
  COALESCE(ra.total_remessas,0) AS total_remessas,
  COALESCE(ra.total_volumes,0) AS total_volumes,
  COALESCE(ra.peso_total_remessas, ia.peso_pedido, 0) AS peso_total,
  ra.previsao_entrega_min AS previsao_entrega,
  ra.data_postagem_min AS data_expedicao,
  ra.data_entrega_max AS data_entrega,
  rp.transportadora_id AS transportadora_principal_id,
  t.nome_razao_social AS transportadora,
  CASE
    WHEN COALESCE(ra.total_remessas,0) = 0 THEN 'aguardando_separacao'
    WHEN ra.alguma_cancelada AND NOT ra.alguma_entregue AND NOT ra.alguma_transito THEN 'cancelado'
    WHEN ra.alguma_ocorrencia THEN 'ocorrencia'
    WHEN ra.todas_entregues THEN 'entregue'
    WHEN ra.alguma_entregue THEN 'entrega_parcial'
    WHEN ra.alguma_transito THEN 'em_transporte'
    WHEN ra.alguma_postada THEN 'aguardando_expedicao'
    ELSE 'aguardando_separacao'
  END AS status_consolidado,
  (ra.peso_total_remessas IS NOT NULL AND ia.peso_pedido IS NOT NULL
   AND abs(ra.peso_total_remessas - ia.peso_pedido) > 0.01) AS tem_divergencia_quantidade
FROM public.ordens_venda ov
LEFT JOIN public.clientes c ON c.id = ov.cliente_id
LEFT JOIN r_agg ra ON ra.ordem_venda_id = ov.id
LEFT JOIN r_principal rp ON rp.ordem_venda_id = ov.id
LEFT JOIN public.transportadoras t ON t.id = rp.transportadora_id
LEFT JOIN itens_agg ia ON ia.ordem_venda_id = ov.id
WHERE ov.ativo;

DROP VIEW IF EXISTS public.vw_recebimentos_consolidado CASCADE;
CREATE VIEW public.vw_recebimentos_consolidado WITH (security_invoker = true) AS
WITH itens_agg AS (
  SELECT pedido_compra_id, COALESCE(SUM(quantidade),0) AS qtd_pedida, COALESCE(SUM(quantidade_recebida),0) AS qtd_recebida
  FROM public.pedidos_compra_itens GROUP BY pedido_compra_id
),
rec_agg AS (
  SELECT pedido_compra_id, COUNT(*) AS total_recebimentos, MAX(data_recebimento) AS ultima_data_recebimento,
    bool_or(tem_divergencia) AS alguma_divergencia, MAX(nota_fiscal_id::text) AS nota_fiscal_id_str
  FROM public.recebimentos_compra GROUP BY pedido_compra_id
),
status_map AS (
  SELECT 'rascunho'::text AS pc, 'pedido_emitido'::text AS lg UNION ALL
  SELECT 'aguardando_aprovacao','pedido_emitido' UNION ALL
  SELECT 'aprovado','pedido_emitido' UNION ALL
  SELECT 'enviado_ao_fornecedor','aguardando_envio_fornecedor' UNION ALL
  SELECT 'aguardando_recebimento','em_transito' UNION ALL
  SELECT 'parcialmente_recebido','recebimento_parcial' UNION ALL
  SELECT 'recebido','recebido' UNION ALL
  SELECT 'cancelado','cancelado'
)
SELECT pc.id AS pedido_compra_id, pc.numero AS numero_compra, pc.fornecedor_id,
  f.nome_razao_social AS fornecedor, pc.data_entrega_prevista AS previsao_entrega,
  COALESCE(ra.ultima_data_recebimento, pc.data_entrega_real) AS data_recebimento,
  COALESCE(ia.qtd_pedida,0) AS quantidade_pedida,
  COALESCE(ia.qtd_recebida,0) AS quantidade_recebida,
  GREATEST(COALESCE(ia.qtd_pedida,0) - COALESCE(ia.qtd_recebida,0), 0) AS pendencia,
  public.get_recebimento_status_efetivo(COALESCE(sm.lg,'pedido_emitido'), pc.data_entrega_prevista, COALESCE(ra.alguma_divergencia,false)) AS status_logistico,
  ra.nota_fiscal_id_str AS nf_vinculada,
  COALESCE(ra.total_recebimentos,0) > 0 AS tem_consolidacao_real,
  COALESCE(ra.alguma_divergencia,false) AS tem_divergencia,
  COALESCE(ra.total_recebimentos,0) AS total_recebimentos
FROM public.pedidos_compra pc
LEFT JOIN public.fornecedores f ON f.id = pc.fornecedor_id
LEFT JOIN itens_agg ia ON ia.pedido_compra_id = pc.id
LEFT JOIN rec_agg ra ON ra.pedido_compra_id = pc.id
LEFT JOIN status_map sm ON sm.pc = pc.status
WHERE pc.ativo;

DROP VIEW IF EXISTS public.v_trilha_logistica CASCADE;
CREATE VIEW public.v_trilha_logistica WITH (security_invoker = true) AS
SELECT 'venda'::text AS origem, ov.id AS ordem_venda_id, ov.numero AS ordem_venda_numero,
  r.id AS remessa_id, r.codigo_rastreio, r.status_transporte,
  NULL::uuid AS pedido_compra_id, NULL::text AS pedido_compra_numero,
  NULL::uuid AS recebimento_id, NULL::uuid AS compra_id
FROM public.ordens_venda ov
LEFT JOIN public.remessas r ON r.ordem_venda_id = ov.id AND r.ativo
WHERE ov.ativo
UNION ALL
SELECT 'compra'::text, NULL::uuid, NULL::text, NULL::uuid, NULL::text, NULL::text,
  pc.id, pc.numero, rc.id, rc.compra_id
FROM public.pedidos_compra pc
LEFT JOIN public.recebimentos_compra rc ON rc.pedido_compra_id = pc.id
WHERE pc.ativo;

CREATE OR REPLACE FUNCTION public.registrar_recebimento_compra(
  p_pedido_compra_id uuid, p_data_recebimento date, p_itens jsonb,
  p_observacoes text DEFAULT NULL, p_nota_fiscal_id uuid DEFAULT NULL, p_compra_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rec_id uuid; v_user uuid := auth.uid(); v_item jsonb; v_pedido_item RECORD;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_pedido_compra_id::text));
  INSERT INTO public.recebimentos_compra (pedido_compra_id, compra_id, numero, data_recebimento, responsavel_id, nota_fiscal_id, observacoes, status_logistico, usuario_id)
  VALUES (p_pedido_compra_id, p_compra_id, 'REC-' || to_char(now(),'YYYYMMDDHH24MISS'), COALESCE(p_data_recebimento, CURRENT_DATE), v_user, p_nota_fiscal_id, p_observacoes, 'recebido', v_user)
  RETURNING id INTO v_rec_id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_itens,'[]'::jsonb)) LOOP
    SELECT id, produto_id, quantidade INTO v_pedido_item FROM public.pedidos_compra_itens WHERE id = (v_item->>'pedido_item_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    INSERT INTO public.recebimentos_compra_itens (recebimento_id, pedido_compra_item_id, produto_id, quantidade_recebida, quantidade_pedida_snapshot)
    VALUES (v_rec_id, v_pedido_item.id, v_pedido_item.produto_id, COALESCE((v_item->>'qtd_recebida')::numeric,0), v_pedido_item.quantidade);
  END LOOP;
  UPDATE public.recebimentos_compra SET tem_divergencia = EXISTS (SELECT 1 FROM public.recebimentos_compra_itens WHERE recebimento_id = v_rec_id AND tem_divergencia) WHERE id = v_rec_id;
  RETURN v_rec_id;
END; $$;