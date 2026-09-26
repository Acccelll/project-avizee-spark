-- ============================================================================
-- Pedidos pelo Orçamento — Etapa 1: registrar o pedido do cliente no orçamento
-- ============================================================================
-- O orçamento passa a ser o pedido quando o cliente envia o número do pedido
-- (ou OC). A Ordem de Venda deixa de ser o passo intermediário: as NFs são
-- emitidas fora do ERP (Sebrae) e ligadas depois pelo número que vem no XML.
--
-- Status: `aprovado` passa a significar "Pedido". Quem edita o orçamento
-- registra o pedido direto do rascunho, sem etapa de aprovação.
-- ============================================================================

-- 1. Dados do pedido no orçamento -------------------------------------------
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS pedido_cliente text,
  ADD COLUMN IF NOT EXISTS data_pedido_cliente date,
  ADD COLUMN IF NOT EXISTS previsao_despacho date,
  ADD COLUMN IF NOT EXISTS pedido_anexo_path text,
  ADD COLUMN IF NOT EXISTS pedido_registrado_em timestamptz,
  ADD COLUMN IF NOT EXISTS pedido_registrado_por uuid,
  ADD COLUMN IF NOT EXISTS faturamento_status text;

ALTER TABLE public.orcamentos DROP CONSTRAINT IF EXISTS chk_orcamentos_faturamento_status;
ALTER TABLE public.orcamentos ADD CONSTRAINT chk_orcamentos_faturamento_status
  CHECK (faturamento_status IS NULL OR faturamento_status IN ('aberto', 'parcial', 'faturado', 'encerrado'));

COMMENT ON COLUMN public.orcamentos.pedido_cliente IS
  'Número do pedido do cliente ou OC. Sem número, recebe o próprio número do orçamento.';
COMMENT ON COLUMN public.orcamentos.faturamento_status IS
  'Situação de faturamento do pedido: aberto | parcial | faturado | encerrado (saldo encerrado à mão).';

CREATE INDEX IF NOT EXISTS idx_orcamentos_pedido_cliente
  ON public.orcamentos (cliente_id, pedido_cliente)
  WHERE pedido_cliente IS NOT NULL;

-- 2. Rascunho pode virar Pedido direto --------------------------------------
CREATE OR REPLACE FUNCTION public.fn_orcamento_transicao_valida()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_terminais text[] := ARRAY['convertido','rejeitado','cancelado','expirado','historico'];
  v_permitidas text[];
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF OLD.status = ANY (v_terminais) THEN
    RAISE EXCEPTION 'Orçamento em estado terminal (%) não pode mudar para %', OLD.status, NEW.status;
  END IF;
  v_permitidas := CASE OLD.status
    WHEN 'rascunho'  THEN ARRAY['pendente','aprovado','cancelado','expirado']
    WHEN 'pendente'  THEN ARRAY['aprovado','rejeitado','cancelado','expirado','rascunho']
    WHEN 'aprovado'  THEN ARRAY['convertido','cancelado','expirado']
    ELSE ARRAY[]::text[]
  END;
  IF NOT (NEW.status = ANY (v_permitidas)) THEN
    RAISE EXCEPTION 'Transição inválida de % para %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END; $function$;

-- 3. Registrar pedido -------------------------------------------------------
-- Aceita rascunho, enviado (pendente) ou aprovado pelo link público sem dados
-- de pedido. Numa revisão, encerra (cancela) a versão anterior que já era
-- pedido, porque a nova versão a substitui.
CREATE OR REPLACE FUNCTION public.registrar_pedido_orcamento(
  p_id uuid,
  p_pedido_cliente text DEFAULT NULL,
  p_data_pedido date DEFAULT NULL,
  p_previsao_despacho date DEFAULT NULL,
  p_anexo_path text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orc record;
  v_user uuid := auth.uid();
  v_pedido text;
  v_itens int;
  v_root uuid;
  v_substituidos text[];
BEGIN
  SELECT id, numero, status, empresa_id, orcamento_pai_id, pedido_registrado_em
    INTO v_orc
    FROM public.orcamentos
   WHERE id = p_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (v_orc.empresa_id = public.current_empresa_id() OR public.has_role(v_user, 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para alterar este orçamento' USING ERRCODE = '42501';
  END IF;

  IF NOT (v_orc.status IN ('rascunho', 'pendente')
          OR (v_orc.status = 'aprovado' AND v_orc.pedido_registrado_em IS NULL)) THEN
    RAISE EXCEPTION 'Só orçamentos em rascunho ou enviados podem virar pedido (status atual: %)', v_orc.status
      USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_itens FROM public.orcamentos_itens WHERE orcamento_id = p_id;
  IF v_itens = 0 THEN
    RAISE EXCEPTION 'O orçamento precisa ter pelo menos um item para virar pedido' USING ERRCODE = 'P0001';
  END IF;

  v_pedido := COALESCE(NULLIF(btrim(p_pedido_cliente), ''), v_orc.numero);

  UPDATE public.orcamentos
     SET status = 'aprovado',
         pedido_cliente = v_pedido,
         data_pedido_cliente = COALESCE(p_data_pedido, CURRENT_DATE),
         previsao_despacho = p_previsao_despacho,
         pedido_anexo_path = NULLIF(btrim(p_anexo_path), ''),
         pedido_registrado_em = now(),
         pedido_registrado_por = v_user,
         faturamento_status = 'aberto',
         updated_at = now()
   WHERE id = p_id;

  v_root := COALESCE(v_orc.orcamento_pai_id, v_orc.id);
  WITH encerrados AS (
    UPDATE public.orcamentos
       SET status = 'cancelado', updated_at = now()
     WHERE id <> p_id
       AND (id = v_root OR orcamento_pai_id = v_root)
       AND status = 'aprovado'
    RETURNING numero
  )
  SELECT array_agg(numero ORDER BY numero) INTO v_substituidos FROM encerrados;

  INSERT INTO public.auditoria_logs (tabela, registro_id, acao, dados_anteriores, dados_novos, usuario_id)
  VALUES (
    'orcamentos',
    p_id,
    'registrar_pedido',
    jsonb_build_object('status', v_orc.status),
    jsonb_build_object(
      'numero', v_orc.numero,
      'status', 'aprovado',
      'pedido_cliente', v_pedido,
      'previsao_despacho', p_previsao_despacho,
      'versoes_substituidas', COALESCE(to_jsonb(v_substituidos), '[]'::jsonb)
    ),
    v_user
  );

  RETURN jsonb_build_object(
    'id', p_id,
    'numero', v_orc.numero,
    'status', 'aprovado',
    'pedido_cliente', v_pedido,
    'versoes_substituidas', COALESCE(to_jsonb(v_substituidos), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_pedido_orcamento(uuid, text, date, date, text) TO authenticated;

-- 4. Editar dados do pedido (sem mexer nos itens) ----------------------------
CREATE OR REPLACE FUNCTION public.atualizar_pedido_orcamento(
  p_id uuid,
  p_pedido_cliente text DEFAULT NULL,
  p_data_pedido date DEFAULT NULL,
  p_previsao_despacho date DEFAULT NULL,
  p_anexo_path text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orc record;
  v_user uuid := auth.uid();
  v_pedido text;
BEGIN
  SELECT id, numero, status, empresa_id, pedido_cliente, data_pedido_cliente, previsao_despacho, pedido_anexo_path
    INTO v_orc
    FROM public.orcamentos
   WHERE id = p_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (v_orc.empresa_id = public.current_empresa_id() OR public.has_role(v_user, 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para alterar este orçamento' USING ERRCODE = '42501';
  END IF;

  IF v_orc.status <> 'aprovado' THEN
    RAISE EXCEPTION 'Só é possível editar os dados de um pedido (status atual: %)', v_orc.status
      USING ERRCODE = 'P0001';
  END IF;

  v_pedido := COALESCE(NULLIF(btrim(p_pedido_cliente), ''), v_orc.numero);

  UPDATE public.orcamentos
     SET pedido_cliente = v_pedido,
         data_pedido_cliente = COALESCE(p_data_pedido, data_pedido_cliente, CURRENT_DATE),
         previsao_despacho = p_previsao_despacho,
         pedido_anexo_path = COALESCE(NULLIF(btrim(p_anexo_path), ''), pedido_anexo_path),
         pedido_registrado_em = COALESCE(pedido_registrado_em, now()),
         pedido_registrado_por = COALESCE(pedido_registrado_por, v_user),
         faturamento_status = COALESCE(faturamento_status, 'aberto'),
         updated_at = now()
   WHERE id = p_id;

  INSERT INTO public.auditoria_logs (tabela, registro_id, acao, dados_anteriores, dados_novos, usuario_id)
  VALUES (
    'orcamentos',
    p_id,
    'atualizar_pedido',
    jsonb_build_object(
      'pedido_cliente', v_orc.pedido_cliente,
      'data_pedido_cliente', v_orc.data_pedido_cliente,
      'previsao_despacho', v_orc.previsao_despacho
    ),
    jsonb_build_object(
      'pedido_cliente', v_pedido,
      'data_pedido_cliente', p_data_pedido,
      'previsao_despacho', p_previsao_despacho
    ),
    v_user
  );

  RETURN jsonb_build_object('id', p_id, 'numero', v_orc.numero, 'pedido_cliente', v_pedido);
END;
$$;

GRANT EXECUTE ON FUNCTION public.atualizar_pedido_orcamento(uuid, text, date, date, text) TO authenticated;
