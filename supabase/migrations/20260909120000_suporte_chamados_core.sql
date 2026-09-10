-- =============================================================================
-- Ajuda, Suporte e Gestão de Chamados — domínio suporte_*
-- ERP AVIZEE
--
-- Baseado em: Especificação Funcional v0.1 (ERP_AVIZEE_Especificacao_Ajuda_
-- Suporte_Chamados.docx) + handoff de reconciliação técnica (prefixo suporte_,
-- integração com src/lib/permissions.ts).
--
-- Decisões fechadas nesta sessão:
--  - single-tenant, sem empresa_id (segue o padrão da maioria do schema).
--  - anexos no bucket 'dbavizee' já existente, prefixo 'chamados/{chamado_id}/'.
--  - diagnóstico técnico sensível só é exposto ao solicitante via RPC filtrada
--    (obter_diagnostico_suporte), nunca lendo suporte_diagnosticos direto.
--  - comentários e notas internas vivem numa única tabela de timeline
--    (suporte_eventos), diferenciados pela coluna visibilidade.
--  - suporte_dev_links NÃO é criada agora — colunas simples em suporte_chamados
--    cobrem o fluxo 1:1 Chamado→Issue→PR→Deploy da V1 (ver comentário na seção 5).
--
-- Nada neste arquivo foi aplicado ao banco vivo. Aplicar via migration
-- versionada, em branch própria, nunca direto em main.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENUMS
-- -----------------------------------------------------------------------------

CREATE TYPE public.suporte_tipo AS ENUM ('bug', 'problema_operacional', 'duvida', 'sugestao');

CREATE TYPE public.suporte_status AS ENUM (
  'aberto', 'em_triagem', 'em_andamento', 'aguardando_usuario',
  'resolvido', 'fechado', 'cancelado'
);

CREATE TYPE public.suporte_prioridade AS ENUM ('critica', 'alta', 'normal', 'baixa');

CREATE TYPE public.suporte_impacto AS ENUM (
  'incomodo', 'atrapalha_trabalho', 'nao_consigo_concluir', 'indisponivel'
);

CREATE TYPE public.suporte_abrangencia AS ENUM ('so_eu', 'mais_pessoas', 'nao_sei');

CREATE TYPE public.suporte_frequencia AS ENUM (
  'uma_vez', 'mais_de_uma_vez', 'sempre_que_tento', 'nao_sei'
);

CREATE TYPE public.suporte_causa AS ENUM (
  'bug_corrigido', 'configuracao', 'permissao', 'dado_inconsistente',
  'uso_incorreto', 'duplicado', 'melhoria_implementada', 'nao_reproduzido', 'outro'
);

CREATE TYPE public.suporte_decisao_sugestao AS ENUM (
  'em_analise', 'planejada', 'nao_planejada', 'implementada'
);

CREATE TYPE public.suporte_evento_tipo AS ENUM (
  'abertura', 'comentario', 'status_alterado', 'prioridade_alterada',
  'tipo_modulo_alterado', 'responsavel_alterado', 'anexo_adicionado',
  'vinculo_dev', 'resolucao', 'reabertura', 'fechamento', 'cancelamento', 'duplicidade'
);

-- -----------------------------------------------------------------------------
-- 2. NUMERAÇÃO CH-000123 (sequence — evita corrida de concorrência)
-- -----------------------------------------------------------------------------

CREATE SEQUENCE public.suporte_chamados_numero_seq START 1;

CREATE OR REPLACE FUNCTION public.gerar_numero_suporte()
RETURNS text LANGUAGE sql AS $$
  SELECT 'CH-' || lpad(nextval('public.suporte_chamados_numero_seq')::text, 6, '0');
$$;

-- -----------------------------------------------------------------------------
-- 3. TABELA PRINCIPAL — suporte_chamados
-- -----------------------------------------------------------------------------

CREATE TABLE public.suporte_chamados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE DEFAULT public.gerar_numero_suporte(),

  tipo public.suporte_tipo NOT NULL,
  resumo text NOT NULL,
  descricao text NOT NULL,
  impacto public.suporte_impacto NOT NULL,
  abrangencia public.suporte_abrangencia NOT NULL,
  frequencia public.suporte_frequencia NOT NULL,

  status public.suporte_status NOT NULL DEFAULT 'aberto',
  prioridade public.suporte_prioridade,             -- só definida na triagem (spec §22)
  modulo text,                                       -- idem

  solicitante_id uuid NOT NULL REFERENCES auth.users(id),
  reportado_por_nome text,                            -- "relatado originalmente por..." (spec §34.3)
  responsavel_id uuid REFERENCES auth.users(id),

  registro_relacionado_tipo text,                     -- ex. 'financeiro_lancamento', 'notas_fiscais'
  registro_relacionado_id uuid,

  rota text NOT NULL,

  causa_resolucao public.suporte_causa,
  resumo_resolucao text,
  decisao_sugestao public.suporte_decisao_sugestao,   -- só relevante quando tipo = 'sugestao'
  decisao_observacao text,

  duplicado_de_id uuid REFERENCES public.suporte_chamados(id),

  -- Vínculo de desenvolvimento — 1:1 na V1. Se precisar de múltiplos vínculos
  -- por chamado no futuro, migrar para tabela suporte_dev_links (aditivo, sem
  -- quebrar esta tabela): copiar estas 4 colunas como primeira linha e manter
  -- as colunas aqui como "vínculo primário" por compatibilidade.
  github_issue_url text,
  github_pr_url text,
  github_commit_sha text,
  versao_corrigida text,

  diagnostic_session_id text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  closed_at timestamptz,

  CONSTRAINT suporte_chamados_resolucao_exige_resumo
    CHECK (status <> 'resolvido' OR resumo_resolucao IS NOT NULL),
  CONSTRAINT suporte_chamados_duplicado_nao_autorreferente
    CHECK (duplicado_de_id IS NULL OR duplicado_de_id <> id)
);

COMMENT ON TABLE public.suporte_chamados IS
  'Chamados de Ajuda e Suporte (bug, problema operacional, dúvida, sugestão). Single-tenant, sem empresa_id.';

CREATE INDEX idx_suporte_chamados_solicitante ON public.suporte_chamados (solicitante_id);
CREATE INDEX idx_suporte_chamados_responsavel ON public.suporte_chamados (responsavel_id);
CREATE INDEX idx_suporte_chamados_status ON public.suporte_chamados (status);
CREATE INDEX idx_suporte_chamados_prioridade_created ON public.suporte_chamados (prioridade, created_at);
CREATE INDEX idx_suporte_chamados_registro_relacionado
  ON public.suporte_chamados (registro_relacionado_tipo, registro_relacionado_id);
CREATE INDEX idx_suporte_chamados_duplicado_de ON public.suporte_chamados (duplicado_de_id);

CREATE TRIGGER trg_suporte_chamados_updated_at
  BEFORE UPDATE ON public.suporte_chamados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 4. DIAGNÓSTICO TÉCNICO — suporte_diagnosticos (1:1, sensível, admin-only via RLS)
-- -----------------------------------------------------------------------------

CREATE TABLE public.suporte_diagnosticos (
  chamado_id uuid PRIMARY KEY REFERENCES public.suporte_chamados(id) ON DELETE CASCADE,

  url_relativa text,
  versao_build text,
  ambiente text,
  navegador text,
  sistema_operacional text,
  viewport text,
  idioma text,
  conectividade text,
  contexto_tela jsonb,                 -- aba ativa, filtros, período, busca, ordenação (spec §9)

  erro_codigo text,
  erro_operacao text,
  erro_mensagem_amigavel text,         -- pode ser exposta ao solicitante
  erro_correlation_id text,
  erro_http_status int,
  erro_stack_trace text,               -- admin-only

  erros_recentes jsonb,                -- buffer pequeno (≤10), capturado só no envio — não é log contínuo
  requisicoes_rede jsonb,              -- metadados sanitizados, nunca request/response completos

  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.suporte_diagnosticos IS
  'Contexto técnico do chamado. Acesso direto restrito a admin via RLS — solicitante lê só o subconjunto amigável via obter_diagnostico_suporte().';

-- -----------------------------------------------------------------------------
-- 5. TIMELINE IMUTÁVEL — suporte_eventos (inclui comentários e notas internas)
-- -----------------------------------------------------------------------------

CREATE TABLE public.suporte_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id uuid NOT NULL REFERENCES public.suporte_chamados(id) ON DELETE CASCADE,
  tipo public.suporte_evento_tipo NOT NULL,
  autor_id uuid NOT NULL REFERENCES auth.users(id),
  visibilidade text NOT NULL DEFAULT 'publico' CHECK (visibilidade IN ('publico', 'interno')),
  mensagem text,
  dados_anteriores jsonb,
  dados_novos jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.suporte_eventos IS
  'Timeline imutável do chamado. Comentário público e nota interna são tipo=comentario, diferenciados por visibilidade. Nunca UPDATE/DELETE.';

CREATE INDEX idx_suporte_eventos_chamado_created ON public.suporte_eventos (chamado_id, created_at);

-- -----------------------------------------------------------------------------
-- 6. ANEXOS — suporte_anexos
-- -----------------------------------------------------------------------------

CREATE TABLE public.suporte_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id uuid NOT NULL REFERENCES public.suporte_chamados(id) ON DELETE CASCADE,
  evento_id uuid REFERENCES public.suporte_eventos(id),
  nome_arquivo text NOT NULL,
  tipo_arquivo text NOT NULL,
  caminho_storage text NOT NULL,          -- bucket 'dbavizee', path 'chamados/{chamado_id}/{uuid}-{nome}'
  tamanho bigint NOT NULL DEFAULT 0,
  is_screenshot boolean NOT NULL DEFAULT false,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_suporte_anexos_chamado ON public.suporte_anexos (chamado_id);

-- -----------------------------------------------------------------------------
-- 7. RLS
-- -----------------------------------------------------------------------------

ALTER TABLE public.suporte_chamados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suporte_diagnosticos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suporte_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suporte_anexos ENABLE ROW LEVEL SECURITY;

-- suporte_chamados: solicitante e responsável enxergam o próprio; admin enxerga tudo.
CREATE POLICY suporte_chamados_select ON public.suporte_chamados
FOR SELECT TO authenticated
USING (
  solicitante_id = auth.uid()
  OR responsavel_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Abertura: qualquer autenticado, mas nunca "em nome de outro usuário" (spec §34.3) —
-- reforçado aqui, não só na UI.
CREATE POLICY suporte_chamados_insert ON public.suporte_chamados
FOR INSERT TO authenticated
WITH CHECK (solicitante_id = auth.uid());

-- Update livre de linha é só para admin (triagem, prioridade, responsável, status).
-- Ações do solicitante (confirmar resolução, reabrir) passam pelas RPCs
-- SECURITY DEFINER abaixo, que validam a regra de negócio explicitamente.
CREATE POLICY suporte_chamados_update_admin ON public.suporte_chamados
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Sem DELETE: chamados nunca são excluídos, nem duplicados (spec §32).

-- suporte_diagnosticos: acesso direto só para admin. Solicitante usa
-- obter_diagnostico_suporte() (RPC SECURITY DEFINER, ver seção 8).
CREATE POLICY suporte_diagnosticos_admin_all ON public.suporte_diagnosticos
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- suporte_eventos: admin vê tudo; solicitante vê só visibilidade=publico dos
-- próprios chamados.
CREATE POLICY suporte_eventos_select ON public.suporte_eventos
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    visibilidade = 'publico'
    AND EXISTS (
      SELECT 1 FROM public.suporte_chamados c
      WHERE c.id = chamado_id AND c.solicitante_id = auth.uid()
    )
  )
);

-- Insert direto (fora das RPCs) fica limitado a comentário público do próprio
-- solicitante; admin pode inserir qualquer tipo/visibilidade. Eventos de
-- sistema (status_alterado etc.) são gerados pelas RPCs SECURITY DEFINER.
CREATE POLICY suporte_eventos_insert ON public.suporte_eventos
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    tipo = 'comentario' AND visibilidade = 'publico' AND autor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.suporte_chamados c
      WHERE c.id = chamado_id AND c.solicitante_id = auth.uid()
    )
  )
);

-- Sem UPDATE/DELETE: timeline é imutável.

-- suporte_anexos: segue a visibilidade do chamado/evento pai.
CREATE POLICY suporte_anexos_select ON public.suporte_anexos
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    EXISTS (
      SELECT 1 FROM public.suporte_chamados c
      WHERE c.id = chamado_id AND c.solicitante_id = auth.uid()
    )
    AND (
      evento_id IS NULL
      OR EXISTS (SELECT 1 FROM public.suporte_eventos e WHERE e.id = evento_id AND e.visibilidade = 'publico')
    )
  )
);

CREATE POLICY suporte_anexos_insert ON public.suporte_anexos
FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.suporte_chamados c
      WHERE c.id = chamado_id AND c.solicitante_id = auth.uid()
    )
  )
);

-- -----------------------------------------------------------------------------
-- 8. STORAGE — reaproveitando o bucket 'dbavizee', prefixo 'chamados/{chamado_id}/'
--    Políticas ADITIVAS: não altera as 4 policies dbavizee_* já existentes
--    (templates/apresentacoes/workbooks/fiscal/users), só soma um novo prefixo.
-- -----------------------------------------------------------------------------

CREATE POLICY suporte_anexos_storage_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'dbavizee'
  AND (storage.foldername(name))[1] = 'chamados'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.suporte_chamados c
      WHERE c.id::text = (storage.foldername(name))[2] AND c.solicitante_id = auth.uid()
    )
  )
);

CREATE POLICY suporte_anexos_storage_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'dbavizee'
  AND (storage.foldername(name))[1] = 'chamados'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.suporte_chamados c
      WHERE c.id::text = (storage.foldername(name))[2] AND c.solicitante_id = auth.uid()
    )
  )
);

CREATE POLICY suporte_anexos_storage_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'dbavizee'
  AND (storage.foldername(name))[1] = 'chamados'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- -----------------------------------------------------------------------------
-- 9. RPCs — operações canônicas (spec §44: só onde há ganho real de
--    atomicidade/segurança/timeline automática)
-- -----------------------------------------------------------------------------

-- 9.1 Criação transacional: chamado + diagnóstico + evento inicial (spec §45).
CREATE OR REPLACE FUNCTION public.criar_chamado_suporte(
  p_tipo public.suporte_tipo,
  p_resumo text,
  p_descricao text,
  p_impacto public.suporte_impacto,
  p_abrangencia public.suporte_abrangencia,
  p_frequencia public.suporte_frequencia,
  p_rota text,
  p_registro_relacionado_tipo text DEFAULT NULL,
  p_registro_relacionado_id uuid DEFAULT NULL,
  p_diagnostico jsonb DEFAULT NULL
)
RETURNS TABLE(id uuid, numero text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_solicitante uuid := auth.uid();
  v_id uuid;
  v_numero text;
BEGIN
  IF v_solicitante IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  INSERT INTO public.suporte_chamados (
    tipo, resumo, descricao, impacto, abrangencia, frequencia,
    solicitante_id, rota, registro_relacionado_tipo, registro_relacionado_id
  ) VALUES (
    p_tipo, p_resumo, p_descricao, p_impacto, p_abrangencia, p_frequencia,
    v_solicitante, p_rota, p_registro_relacionado_tipo, p_registro_relacionado_id
  )
  RETURNING suporte_chamados.id, suporte_chamados.numero INTO v_id, v_numero;

  IF p_diagnostico IS NOT NULL THEN
    INSERT INTO public.suporte_diagnosticos (
      chamado_id, url_relativa, versao_build, ambiente, navegador, sistema_operacional,
      viewport, idioma, conectividade, contexto_tela,
      erro_codigo, erro_operacao, erro_mensagem_amigavel, erro_correlation_id,
      erro_http_status, erro_stack_trace, erros_recentes, requisicoes_rede
    ) VALUES (
      v_id,
      p_diagnostico->>'url_relativa', p_diagnostico->>'versao_build', p_diagnostico->>'ambiente',
      p_diagnostico->>'navegador', p_diagnostico->>'sistema_operacional', p_diagnostico->>'viewport',
      p_diagnostico->>'idioma', p_diagnostico->>'conectividade', p_diagnostico->'contexto_tela',
      p_diagnostico->>'erro_codigo', p_diagnostico->>'erro_operacao', p_diagnostico->>'erro_mensagem_amigavel',
      p_diagnostico->>'erro_correlation_id',
      NULLIF(p_diagnostico->>'erro_http_status', '')::int,
      p_diagnostico->>'erro_stack_trace', p_diagnostico->'erros_recentes', p_diagnostico->'requisicoes_rede'
    );
  END IF;

  INSERT INTO public.suporte_eventos (chamado_id, tipo, autor_id, visibilidade, dados_novos)
  VALUES (v_id, 'abertura', v_solicitante, 'publico', jsonb_build_object('status', 'aberto'));

  RETURN QUERY SELECT v_id, v_numero;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.criar_chamado_suporte(
  public.suporte_tipo, text, text, public.suporte_impacto, public.suporte_abrangencia,
  public.suporte_frequencia, text, text, uuid, jsonb
) TO authenticated;

-- 9.2 Comentário público (qualquer autor no próprio chamado) ou nota interna (admin).
CREATE OR REPLACE FUNCTION public.registrar_comentario_suporte(
  p_chamado_id uuid,
  p_mensagem text,
  p_visibilidade text DEFAULT 'publico'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_autor uuid := auth.uid();
  v_is_admin boolean;
  v_is_owner boolean;
  v_evento_id uuid;
BEGIN
  IF v_autor IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;
  IF p_visibilidade NOT IN ('publico', 'interno') THEN
    RAISE EXCEPTION 'Visibilidade inválida: %', p_visibilidade;
  END IF;

  SELECT public.has_role(v_autor, 'admin'::app_role) INTO v_is_admin;
  SELECT EXISTS(
    SELECT 1 FROM public.suporte_chamados WHERE id = p_chamado_id AND solicitante_id = v_autor
  ) INTO v_is_owner;

  IF p_visibilidade = 'interno' AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem registrar notas internas.';
  END IF;
  IF NOT v_is_admin AND NOT v_is_owner THEN
    RAISE EXCEPTION 'Sem permissão para comentar neste chamado.';
  END IF;

  INSERT INTO public.suporte_eventos (chamado_id, tipo, autor_id, visibilidade, mensagem)
  VALUES (p_chamado_id, 'comentario', v_autor, p_visibilidade, p_mensagem)
  RETURNING suporte_eventos.id INTO v_evento_id;

  UPDATE public.suporte_chamados SET updated_at = now() WHERE id = p_chamado_id;

  RETURN v_evento_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.registrar_comentario_suporte(uuid, text, text) TO authenticated;

-- 9.3 Assumir chamado (admin) — spec §23.
CREATE OR REPLACE FUNCTION public.suporte_assumir_chamado(p_chamado_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_admin uuid := auth.uid();
  v_chamado public.suporte_chamados%ROWTYPE;
BEGIN
  IF NOT public.has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem assumir chamados.';
  END IF;

  SELECT * INTO v_chamado FROM public.suporte_chamados WHERE id = p_chamado_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado % não encontrado.', p_chamado_id;
  END IF;

  UPDATE public.suporte_chamados
     SET responsavel_id = v_admin,
         status = CASE WHEN status IN ('aberto', 'em_triagem') THEN 'em_andamento'::public.suporte_status ELSE status END
   WHERE id = p_chamado_id;

  INSERT INTO public.suporte_eventos (chamado_id, tipo, autor_id, dados_anteriores, dados_novos)
  VALUES (p_chamado_id, 'responsavel_alterado', v_admin,
          jsonb_build_object('responsavel_id', v_chamado.responsavel_id),
          jsonb_build_object('responsavel_id', v_admin));

  IF v_chamado.status IN ('aberto', 'em_triagem') THEN
    INSERT INTO public.suporte_eventos (chamado_id, tipo, autor_id, dados_anteriores, dados_novos)
    VALUES (p_chamado_id, 'status_alterado', v_admin,
            jsonb_build_object('status', v_chamado.status),
            jsonb_build_object('status', 'em_andamento'));
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.suporte_assumir_chamado(uuid) TO authenticated;

-- 9.4 Atribuir responsável (admin) — spec §22.
CREATE OR REPLACE FUNCTION public.suporte_atribuir_responsavel(p_chamado_id uuid, p_responsavel_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_admin uuid := auth.uid();
  v_anterior uuid;
BEGIN
  IF NOT public.has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem atribuir responsável.';
  END IF;

  SELECT responsavel_id INTO v_anterior FROM public.suporte_chamados WHERE id = p_chamado_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado % não encontrado.', p_chamado_id;
  END IF;

  UPDATE public.suporte_chamados SET responsavel_id = p_responsavel_id WHERE id = p_chamado_id;

  INSERT INTO public.suporte_eventos (chamado_id, tipo, autor_id, dados_anteriores, dados_novos)
  VALUES (p_chamado_id, 'responsavel_alterado', v_admin,
          jsonb_build_object('responsavel_id', v_anterior),
          jsonb_build_object('responsavel_id', p_responsavel_id));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.suporte_atribuir_responsavel(uuid, uuid) TO authenticated;

-- 9.5 Triagem (admin) — reclassifica tipo/prioridade/módulo/status sem recriar
-- o chamado (spec §23). Só altera os campos não-nulos passados.
CREATE OR REPLACE FUNCTION public.suporte_triar_chamado(
  p_chamado_id uuid,
  p_tipo public.suporte_tipo DEFAULT NULL,
  p_prioridade public.suporte_prioridade DEFAULT NULL,
  p_modulo text DEFAULT NULL,
  p_status public.suporte_status DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_admin uuid := auth.uid();
  v_antes public.suporte_chamados%ROWTYPE;
BEGIN
  IF NOT public.has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem triar chamados.';
  END IF;

  SELECT * INTO v_antes FROM public.suporte_chamados WHERE id = p_chamado_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado % não encontrado.', p_chamado_id;
  END IF;

  UPDATE public.suporte_chamados SET
    tipo = COALESCE(p_tipo, tipo),
    prioridade = COALESCE(p_prioridade, prioridade),
    modulo = COALESCE(p_modulo, modulo),
    status = COALESCE(p_status, status)
  WHERE id = p_chamado_id;

  IF p_tipo IS NOT NULL AND p_tipo IS DISTINCT FROM v_antes.tipo THEN
    INSERT INTO public.suporte_eventos (chamado_id, tipo, autor_id, dados_anteriores, dados_novos)
    VALUES (p_chamado_id, 'tipo_modulo_alterado', v_admin,
            jsonb_build_object('tipo', v_antes.tipo), jsonb_build_object('tipo', p_tipo));
  END IF;
  IF p_modulo IS NOT NULL AND p_modulo IS DISTINCT FROM v_antes.modulo THEN
    INSERT INTO public.suporte_eventos (chamado_id, tipo, autor_id, dados_anteriores, dados_novos)
    VALUES (p_chamado_id, 'tipo_modulo_alterado', v_admin,
            jsonb_build_object('modulo', v_antes.modulo), jsonb_build_object('modulo', p_modulo));
  END IF;
  IF p_prioridade IS NOT NULL AND p_prioridade IS DISTINCT FROM v_antes.prioridade THEN
    INSERT INTO public.suporte_eventos (chamado_id, tipo, autor_id, dados_anteriores, dados_novos)
    VALUES (p_chamado_id, 'prioridade_alterada', v_admin,
            jsonb_build_object('prioridade', v_antes.prioridade), jsonb_build_object('prioridade', p_prioridade));
  END IF;
  IF p_status IS NOT NULL AND p_status IS DISTINCT FROM v_antes.status THEN
    INSERT INTO public.suporte_eventos (chamado_id, tipo, autor_id, dados_anteriores, dados_novos)
    VALUES (p_chamado_id, 'status_alterado', v_admin,
            jsonb_build_object('status', v_antes.status), jsonb_build_object('status', p_status));
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.suporte_triar_chamado(
  uuid, public.suporte_tipo, public.suporte_prioridade, text, public.suporte_status
) TO authenticated;

-- 9.6 Resolver (admin) — só exige resumo curto (spec §27.1).
CREATE OR REPLACE FUNCTION public.suporte_resolver_chamado(
  p_chamado_id uuid,
  p_resumo_resolucao text,
  p_causa public.suporte_causa DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_admin uuid := auth.uid();
  v_status_anterior public.suporte_status;
BEGIN
  IF NOT public.has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem resolver chamados.';
  END IF;
  IF p_resumo_resolucao IS NULL OR btrim(p_resumo_resolucao) = '' THEN
    RAISE EXCEPTION 'Resumo da resolução é obrigatório.';
  END IF;

  SELECT status INTO v_status_anterior FROM public.suporte_chamados WHERE id = p_chamado_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado % não encontrado.', p_chamado_id;
  END IF;

  UPDATE public.suporte_chamados SET
    status = 'resolvido',
    resumo_resolucao = p_resumo_resolucao,
    causa_resolucao = p_causa,
    resolved_at = now()
  WHERE id = p_chamado_id;

  INSERT INTO public.suporte_eventos (chamado_id, tipo, autor_id, mensagem, dados_anteriores, dados_novos)
  VALUES (p_chamado_id, 'resolucao', v_admin, p_resumo_resolucao,
          jsonb_build_object('status', v_status_anterior), jsonb_build_object('status', 'resolvido'));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.suporte_resolver_chamado(uuid, text, public.suporte_causa) TO authenticated;

-- 9.7 Confirmação pelo usuário (spec §27.3) — "Sim, resolvido" fecha;
-- "Ainda tenho problema" reabre para Em andamento. Só o solicitante do
-- próprio chamado (ou admin) pode chamar.
CREATE OR REPLACE FUNCTION public.suporte_confirmar_resolucao(p_chamado_id uuid, p_confirmado boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_chamado public.suporte_chamados%ROWTYPE;
BEGIN
  SELECT * INTO v_chamado FROM public.suporte_chamados WHERE id = p_chamado_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado % não encontrado.', p_chamado_id;
  END IF;
  IF v_chamado.solicitante_id <> v_user AND NOT public.has_role(v_user, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Sem permissão para confirmar este chamado.';
  END IF;
  IF v_chamado.status <> 'resolvido' THEN
    RAISE EXCEPTION 'Chamado não está em estado Resolvido.';
  END IF;

  IF p_confirmado THEN
    UPDATE public.suporte_chamados SET status = 'fechado', closed_at = now() WHERE id = p_chamado_id;
    INSERT INTO public.suporte_eventos (chamado_id, tipo, autor_id, dados_anteriores, dados_novos)
    VALUES (p_chamado_id, 'fechamento', v_user,
            jsonb_build_object('status', 'resolvido'), jsonb_build_object('status', 'fechado'));
  ELSE
    UPDATE public.suporte_chamados SET status = 'em_andamento' WHERE id = p_chamado_id;
    INSERT INTO public.suporte_eventos (chamado_id, tipo, autor_id, dados_anteriores, dados_novos)
    VALUES (p_chamado_id, 'reabertura', v_user,
            jsonb_build_object('status', 'resolvido'), jsonb_build_object('status', 'em_andamento'));
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.suporte_confirmar_resolucao(uuid, boolean) TO authenticated;

-- 9.8 Cancelar (admin).
CREATE OR REPLACE FUNCTION public.suporte_cancelar_chamado(p_chamado_id uuid, p_motivo text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_admin uuid := auth.uid();
  v_status_anterior public.suporte_status;
BEGIN
  IF NOT public.has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem cancelar chamados.';
  END IF;

  SELECT status INTO v_status_anterior FROM public.suporte_chamados WHERE id = p_chamado_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado % não encontrado.', p_chamado_id;
  END IF;

  UPDATE public.suporte_chamados SET status = 'cancelado' WHERE id = p_chamado_id;

  INSERT INTO public.suporte_eventos (chamado_id, tipo, autor_id, mensagem, dados_anteriores, dados_novos)
  VALUES (p_chamado_id, 'cancelamento', v_admin, p_motivo,
          jsonb_build_object('status', v_status_anterior), jsonb_build_object('status', 'cancelado'));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.suporte_cancelar_chamado(uuid, text) TO authenticated;

-- 9.9 Marcar duplicidade (admin) — preserva o registro, nunca exclui (spec §32).
CREATE OR REPLACE FUNCTION public.suporte_marcar_duplicado(p_chamado_id uuid, p_duplicado_de_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_admin uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem marcar duplicidade.';
  END IF;
  IF p_chamado_id = p_duplicado_de_id THEN
    RAISE EXCEPTION 'Um chamado não pode ser duplicado dele mesmo.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suporte_chamados WHERE id = p_duplicado_de_id) THEN
    RAISE EXCEPTION 'Chamado principal % não encontrado.', p_duplicado_de_id;
  END IF;

  UPDATE public.suporte_chamados SET duplicado_de_id = p_duplicado_de_id WHERE id = p_chamado_id;

  INSERT INTO public.suporte_eventos (chamado_id, tipo, autor_id, dados_novos)
  VALUES (p_chamado_id, 'duplicidade', v_admin, jsonb_build_object('duplicado_de_id', p_duplicado_de_id));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.suporte_marcar_duplicado(uuid, uuid) TO authenticated;

-- 9.10 Diagnóstico filtrado — o solicitante só recebe os campos amigáveis;
-- campos sensíveis (stack trace, correlation id, http status, erros recentes,
-- requisições de rede, código/operação internos) só vêm preenchidos para admin.
CREATE OR REPLACE FUNCTION public.obter_diagnostico_suporte(p_chamado_id uuid)
RETURNS TABLE(
  url_relativa text, versao_build text, ambiente text, navegador text,
  sistema_operacional text, viewport text, idioma text, conectividade text,
  contexto_tela jsonb, erro_mensagem_amigavel text,
  erro_codigo text, erro_operacao text, erro_correlation_id text,
  erro_http_status int, erro_stack_trace text, erros_recentes jsonb, requisicoes_rede jsonb
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_is_admin boolean;
  v_is_owner boolean;
BEGIN
  SELECT public.has_role(v_user, 'admin'::app_role) INTO v_is_admin;
  SELECT EXISTS(
    SELECT 1 FROM public.suporte_chamados WHERE id = p_chamado_id AND solicitante_id = v_user
  ) INTO v_is_owner;

  IF NOT (v_is_admin OR v_is_owner) THEN
    RAISE EXCEPTION 'Sem permissão para ver o diagnóstico deste chamado.';
  END IF;

  RETURN QUERY
  SELECT
    d.url_relativa, d.versao_build, d.ambiente, d.navegador, d.sistema_operacional,
    d.viewport, d.idioma, d.conectividade, d.contexto_tela, d.erro_mensagem_amigavel,
    CASE WHEN v_is_admin THEN d.erro_codigo END,
    CASE WHEN v_is_admin THEN d.erro_operacao END,
    CASE WHEN v_is_admin THEN d.erro_correlation_id END,
    CASE WHEN v_is_admin THEN d.erro_http_status END,
    CASE WHEN v_is_admin THEN d.erro_stack_trace END,
    CASE WHEN v_is_admin THEN d.erros_recentes END,
    CASE WHEN v_is_admin THEN d.requisicoes_rede END
  FROM public.suporte_diagnosticos d
  WHERE d.chamado_id = p_chamado_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.obter_diagnostico_suporte(uuid) TO authenticated;

-- =============================================================================
-- Fim da migration.
-- =============================================================================
