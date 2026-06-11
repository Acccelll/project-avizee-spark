
-- =====================================================================
-- PART 1: Orçamento público via RPC por token (fecha enumeração anônima)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_orcamento_publico(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orc jsonb;
  v_itens jsonb;
  v_empresa jsonb;
  v_orc_id uuid;
BEGIN
  SELECT to_jsonb(t), t.id INTO v_orc, v_orc_id
  FROM (
    SELECT
      id, numero, data_orcamento, validade, valor_total,
      observacoes, status, prazo_entrega, prazo_pagamento,
      frete_tipo, cliente_snapshot, public_token, ativo,
      desconto, imposto_st, imposto_ipi, frete_valor, outras_despesas,
      modalidade, servico_frete, peso_total, quantidade_total,
      pagamento
    FROM public.orcamentos
    WHERE public_token = p_token AND ativo = true
    LIMIT 1
  ) t;

  IF v_orc IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY i.id), '[]'::jsonb) INTO v_itens
  FROM (
    SELECT
      oi.id, oi.orcamento_id, oi.descricao_snapshot, oi.codigo_snapshot,
      oi.quantidade, oi.unidade, oi.valor_unitario, oi.valor_total,
      oi.variacao, oi.peso_unitario, oi.peso_total
    FROM public.orcamentos_itens oi
    WHERE oi.orcamento_id = v_orc_id
  ) i;

  SELECT to_jsonb(e) INTO v_empresa
  FROM (
    SELECT
      razao_social, nome_fantasia, cnpj, inscricao_estadual,
      inscricao_municipal, telefone, whatsapp, email, site,
      logradouro, numero, complemento, bairro, cidade, uf, cep,
      logo_url, marca_texto
    FROM public.empresa_config
    LIMIT 1
  ) e;

  RETURN jsonb_build_object(
    'orcamento', v_orc,
    'itens', v_itens,
    'empresa', v_empresa
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_orcamento_publico(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_orcamento_publico(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.get_orcamento_publico(uuid) IS
  'Acesso público a orçamento compartilhado SOMENTE via token exato. Substitui o acesso direto às views públicas (fechadas por enumeração anônima).';

REVOKE SELECT ON public.orcamentos_public_view FROM anon;
REVOKE SELECT ON public.orcamentos_itens_public_view FROM anon;
REVOKE SELECT ON public.empresa_config_public_view FROM anon;

COMMENT ON VIEW public.orcamentos_public_view IS
  'DEPRECATED para anon: usar RPC get_orcamento_publico(p_token). GRANT anon removido (enumeração).';
COMMENT ON VIEW public.orcamentos_itens_public_view IS
  'DEPRECATED para anon: usar RPC get_orcamento_publico(p_token).';
COMMENT ON VIEW public.empresa_config_public_view IS
  'DEPRECATED para anon: dados públicos da empresa agora vêm via RPC get_orcamento_publico(p_token).';

-- =====================================================================
-- PART 3: Guard de estoque negativo em ajustar_estoque_manual
-- =====================================================================

CREATE OR REPLACE FUNCTION public.ajustar_estoque_manual(
  p_produto_id uuid,
  p_tipo text,
  p_quantidade numeric,
  p_motivo text DEFAULT NULL::text,
  p_categoria_ajuste text DEFAULT NULL::text,
  p_motivo_estruturado text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_saldo_anterior numeric; v_saldo_atual numeric; v_quantidade_mov numeric; v_quantidade_abs numeric;
  v_user uuid := auth.uid(); v_mov_id uuid;
  v_critico boolean := p_tipo IN ('ajuste','perda_avaria','inventario');
BEGIN
  IF v_critico THEN
    IF NOT (public.has_role(v_user,'admin') OR public.has_role(v_user,'estoquista')) THEN
      RAISE EXCEPTION 'Permissão negada: ajustes críticos requerem role admin ou estoquista';
    END IF;
    IF p_categoria_ajuste IS NULL THEN
      RAISE EXCEPTION 'Ajustes críticos requerem categoria_ajuste';
    END IF;
  END IF;
  SELECT COALESCE(estoque_atual,0) INTO v_saldo_anterior FROM public.produtos WHERE id = p_produto_id FOR UPDATE;
  IF p_tipo = 'entrada' THEN
    v_quantidade_mov := abs(p_quantidade);
    v_saldo_atual := v_saldo_anterior + v_quantidade_mov;
  ELSIF p_tipo IN ('saida','perda_avaria') THEN
    v_quantidade_mov := abs(p_quantidade);
    v_saldo_atual := v_saldo_anterior - v_quantidade_mov;
  ELSIF p_tipo IN ('ajuste','inventario') THEN
    v_quantidade_mov := abs(p_quantidade - v_saldo_anterior);
    v_saldo_atual := p_quantidade;
  ELSE
    RAISE EXCEPTION 'Tipo % não suportado', p_tipo;
  END IF;

  -- Guard: saída/perda não pode deixar saldo negativo.
  IF v_saldo_atual < 0 THEN
    RAISE EXCEPTION
      'Saldo insuficiente: produto % tem % em estoque; operação % de % deixaria saldo em %',
      p_produto_id, v_saldo_anterior, p_tipo, v_quantidade_mov, v_saldo_atual
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_quantidade_mov = 0 THEN
    RETURN NULL;
  END IF;

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
END;
$function$;

-- =====================================================================
-- PART 4: Restringir SELECT em user_roles
-- =====================================================================

DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
CREATE POLICY "user_roles_select" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- =====================================================================
-- PART 2 (apoio): tabela de dedupe para notify-admin-new-signup
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.signup_notify_dedupe (
  email text PRIMARY KEY,
  last_sent_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.signup_notify_dedupe TO service_role;

ALTER TABLE public.signup_notify_dedupe ENABLE ROW LEVEL SECURITY;

-- Sem policies = acesso apenas via service_role (Edge Function).
COMMENT ON TABLE public.signup_notify_dedupe IS
  'Dedupe de notificações de novo cadastro (1 por e-mail a cada 10min). Acessado apenas pela Edge Function notify-admin-new-signup via service role.';
