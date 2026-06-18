
-- =====================================================================
-- ETAPA 3.1/3.2 — Endurecimento de RLS em tabelas sensíveis
-- =====================================================================

-- Staging (admin-only SELECT)
DROP POLICY IF EXISTS stg_cad_select ON public.stg_cadastros;
CREATE POLICY stg_cad_select ON public.stg_cadastros
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS scx_select ON public.stg_compras_xml;
CREATE POLICY scx_select ON public.stg_compras_xml
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS sei_select ON public.stg_estoque_inicial;
CREATE POLICY sei_select ON public.stg_estoque_inicial
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS sf_select ON public.stg_faturamento;
CREATE POLICY sf_select ON public.stg_faturamento
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS sfa_select ON public.stg_financeiro_aberto;
CREATE POLICY sfa_select ON public.stg_financeiro_aberto
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Apresentação (admin ou financeiro)
DROP POLICY IF EXISTS ac_select ON public.apresentacao_comentarios;
CREATE POLICY ac_select ON public.apresentacao_comentarios
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS ac_update ON public.apresentacao_comentarios;
CREATE POLICY ac_update ON public.apresentacao_comentarios
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS ag_select ON public.apresentacao_geracoes;
CREATE POLICY ag_select ON public.apresentacao_geracoes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS at_select ON public.apresentacao_templates;
CREATE POLICY at_select ON public.apresentacao_templates
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "Authenticated users can read telemetry" ON public.apresentacao_slide_telemetria;
CREATE POLICY "Read telemetry admin or financeiro" ON public.apresentacao_slide_telemetria
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role));

-- PII de clientes (admin, vendedor ou financeiro)
DROP POLICY IF EXISTS crc_select ON public.cliente_registros_comunicacao;
CREATE POLICY crc_select ON public.cliente_registros_comunicacao
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'vendedor'::app_role)
    OR public.has_role(auth.uid(), 'financeiro'::app_role)
  );

DROP POLICY IF EXISTS cee_select ON public.clientes_enderecos_entrega;
CREATE POLICY cee_select ON public.clientes_enderecos_entrega
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'vendedor'::app_role)
    OR public.has_role(auth.uid(), 'financeiro'::app_role)
  );

-- NFe DFE sync (admin/financeiro)
DROP POLICY IF EXISTS "Distdfe sync select autenticados" ON public.nfe_distdfe_sync;
CREATE POLICY "Distdfe sync select admin financeiro" ON public.nfe_distdfe_sync
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role));

-- Importacao: dedupe policies (mantém a admin)
DROP POLICY IF EXISTS ilog_select ON public.importacao_logs;
DROP POLICY IF EXISTS il_select ON public.importacao_lotes;

-- =====================================================================
-- ETAPA 3.5 — Base LGPD
-- =====================================================================

-- Consentimento (nullable, sem default — mantém histórico sem migração de dados)
ALTER TABLE public.clientes      ADD COLUMN IF NOT EXISTS consentimento_lgpd_em timestamptz;
ALTER TABLE public.fornecedores  ADD COLUMN IF NOT EXISTS consentimento_lgpd_em timestamptz;
ALTER TABLE public.funcionarios  ADD COLUMN IF NOT EXISTS consentimento_lgpd_em timestamptz;

-- Tabela de solicitações
CREATE TABLE IF NOT EXISTS public.lgpd_solicitacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titular_tipo text NOT NULL,
  titular_id uuid NOT NULL,
  titular_descricao text,
  tipo text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  motivo text,
  payload jsonb,
  solicitado_por uuid REFERENCES auth.users(id),
  concluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_lgpd_titular_tipo CHECK (titular_tipo IN ('cliente','fornecedor','funcionario')),
  CONSTRAINT chk_lgpd_tipo CHECK (tipo IN ('exportar','anonimizar')),
  CONSTRAINT chk_lgpd_status CHECK (status IN ('pendente','concluida','erro','cancelada'))
);

CREATE INDEX IF NOT EXISTS idx_lgpd_solicitacoes_titular ON public.lgpd_solicitacoes(titular_tipo, titular_id);
CREATE INDEX IF NOT EXISTS idx_lgpd_solicitacoes_created ON public.lgpd_solicitacoes(created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.lgpd_solicitacoes TO authenticated;
GRANT ALL ON public.lgpd_solicitacoes TO service_role;

ALTER TABLE public.lgpd_solicitacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY lgpd_select_admin ON public.lgpd_solicitacoes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY lgpd_insert_admin ON public.lgpd_solicitacoes
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY lgpd_update_admin ON public.lgpd_solicitacoes
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_lgpd_solicitacoes_updated_at
  BEFORE UPDATE ON public.lgpd_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- RPC: exportar_dados_titular
-- =====================================================================
CREATE OR REPLACE FUNCTION public.exportar_dados_titular(_tipo text, _id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_cad jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'acesso_negado';
  END IF;
  IF _tipo NOT IN ('cliente','fornecedor','funcionario') THEN
    RAISE EXCEPTION 'tipo_invalido';
  END IF;

  IF _tipo = 'cliente' THEN
    SELECT to_jsonb(c.*) INTO v_cad FROM public.clientes c WHERE c.id = _id;
    v_result := jsonb_build_object(
      'titular', v_cad,
      'enderecos_entrega', COALESCE((SELECT jsonb_agg(to_jsonb(e.*)) FROM public.clientes_enderecos_entrega e WHERE e.cliente_id = _id), '[]'::jsonb),
      'comunicacoes', COALESCE((SELECT jsonb_agg(to_jsonb(r.*)) FROM public.cliente_registros_comunicacao r WHERE r.cliente_id = _id), '[]'::jsonb),
      'orcamentos', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', o.id, 'numero', o.numero, 'status', o.status, 'valor_total', o.valor_total, 'created_at', o.created_at)) FROM public.orcamentos o WHERE o.cliente_id = _id), '[]'::jsonb),
      'ordens_venda', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', ov.id, 'numero', ov.numero, 'status', ov.status, 'valor_total', ov.valor_total, 'created_at', ov.created_at)) FROM public.ordens_venda ov WHERE ov.cliente_id = _id), '[]'::jsonb),
      'notas_fiscais', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', nf.id, 'numero', nf.numero, 'status', nf.status, 'valor_total', nf.valor_total, 'data_emissao', nf.data_emissao)) FROM public.notas_fiscais nf WHERE nf.destinatario_cliente_id = _id), '[]'::jsonb)
    );
  ELSIF _tipo = 'fornecedor' THEN
    SELECT to_jsonb(f.*) INTO v_cad FROM public.fornecedores f WHERE f.id = _id;
    v_result := jsonb_build_object(
      'titular', v_cad,
      'pedidos_compra', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'numero', p.numero, 'status', p.status, 'valor_total', p.valor_total, 'created_at', p.created_at)) FROM public.pedidos_compra p WHERE p.fornecedor_id = _id), '[]'::jsonb),
      'compras', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'numero', c.numero, 'status', c.status, 'valor_total', c.valor_total)) FROM public.compras c WHERE c.fornecedor_id = _id), '[]'::jsonb),
      'financeiro_lancamentos', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', l.id, 'tipo', l.tipo, 'valor', l.valor, 'status', l.status, 'data_vencimento', l.data_vencimento)) FROM public.financeiro_lancamentos l WHERE l.fornecedor_id = _id), '[]'::jsonb)
    );
  ELSE -- funcionario
    SELECT to_jsonb(f.*) INTO v_cad FROM public.funcionarios f WHERE f.id = _id;
    v_result := jsonb_build_object('titular', v_cad);
  END IF;

  INSERT INTO public.lgpd_solicitacoes(titular_tipo, titular_id, tipo, status, payload, solicitado_por, concluido_em)
  VALUES (_tipo, _id, 'exportar', 'concluida', v_result, auth.uid(), now());

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.exportar_dados_titular(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exportar_dados_titular(text, uuid) TO authenticated;

-- =====================================================================
-- RPC: anonimizar_titular  (preserva NFs autorizadas e histórico financeiro)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.anonimizar_titular(_tipo text, _id uuid, _motivo text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_marker text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'acesso_negado';
  END IF;
  IF _tipo NOT IN ('cliente','fornecedor','funcionario') THEN
    RAISE EXCEPTION 'tipo_invalido';
  END IF;

  v_hash   := encode(digest(_tipo || '|' || _id::text, 'sha256'), 'hex');
  v_marker := '[ANONIMIZADO #' || substr(v_hash, 1, 8) || ']';

  IF _tipo = 'cliente' THEN
    UPDATE public.clientes
       SET nome_razao_social   = v_marker,
           nome_fantasia       = NULL,
           cpf_cnpj            = substr(v_hash, 1, 14),
           email               = NULL,
           telefone            = NULL,
           celular             = NULL,
           logradouro          = NULL,
           numero              = NULL,
           complemento         = NULL,
           bairro              = NULL,
           cep                 = NULL,
           inscricao_estadual  = NULL,
           ativo               = false,
           updated_at          = now()
     WHERE id = _id;

    UPDATE public.clientes_enderecos_entrega
       SET logradouro = NULL, numero = NULL, complemento = NULL,
           bairro = NULL, cep = NULL, updated_at = now()
     WHERE cliente_id = _id;

    UPDATE public.cliente_registros_comunicacao
       SET conteudo = v_marker, updated_at = now()
     WHERE cliente_id = _id;

  ELSIF _tipo = 'fornecedor' THEN
    UPDATE public.fornecedores
       SET nome_razao_social   = v_marker,
           nome_fantasia       = NULL,
           cpf_cnpj            = substr(v_hash, 1, 14),
           email               = NULL,
           telefone            = NULL,
           celular             = NULL,
           logradouro          = NULL,
           numero              = NULL,
           complemento         = NULL,
           bairro              = NULL,
           cep                 = NULL,
           inscricao_estadual  = NULL,
           ativo               = false,
           updated_at          = now()
     WHERE id = _id;

  ELSE -- funcionario
    UPDATE public.funcionarios
       SET nome  = v_marker,
           cpf   = substr(v_hash, 1, 11),
           ativo = false,
           updated_at = now()
     WHERE id = _id;
  END IF;

  INSERT INTO public.lgpd_solicitacoes(titular_tipo, titular_id, tipo, status, motivo, solicitado_por, concluido_em)
  VALUES (_tipo, _id, 'anonimizar', 'concluida', _motivo, auth.uid(), now());

  -- Trilha em auditoria_logs (best effort; ignora se schema diverge)
  BEGIN
    INSERT INTO public.auditoria_logs(user_id, acao, tabela, registro_id, dados_novos)
    VALUES (auth.uid(), 'lgpd_anonimizar', _tipo, _id, jsonb_build_object('motivo', _motivo, 'marker', v_marker));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('ok', true, 'marker', v_marker);
END;
$$;

REVOKE ALL ON FUNCTION public.anonimizar_titular(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.anonimizar_titular(text, uuid, text) TO authenticated;

COMMENT ON FUNCTION public.exportar_dados_titular(text, uuid) IS 'LGPD: exporta dados de um titular (cliente/fornecedor/funcionário). Admin-only.';
COMMENT ON FUNCTION public.anonimizar_titular(text, uuid, text) IS 'LGPD: anonimiza PII de um titular preservando NFs autorizadas e histórico financeiro. Admin-only.';
COMMENT ON TABLE public.lgpd_solicitacoes IS 'LGPD: registro de solicitações de exportação/anonimização. Admin-only via RLS.';
