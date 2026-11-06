-- =====================================================================
-- Integração ERP → site AviZee: matérias da Central de Conteúdos
-- + credenciais de redes sociais fora do alcance do frontend (Vault).
--
-- Decisão D-090 do site (docs/avizee/561-erp-content-integration.md).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Permissão ERP em SQL (espelha requireAnyPermission das Edge Functions)
--    admin global OU override explícito em user_permissions, válido e sem deny.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tem_permissao_erp(_resource text, _action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    NOT EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.resource = _resource AND up.action = _action
        AND up.allowed = false
        AND (up.expires_at IS NULL OR up.expires_at > now())
    )
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.user_permissions up
        WHERE up.user_id = auth.uid()
          AND up.resource = _resource AND up.action = _action
          AND up.allowed = true
          AND (up.expires_at IS NULL OR up.expires_at > now())
      )
    );
$$;

REVOKE ALL ON FUNCTION public.tem_permissao_erp(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tem_permissao_erp(text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. Matérias
-- ---------------------------------------------------------------------
CREATE TABLE public.site_materias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid DEFAULT public.current_empresa_id(),

  -- Conteúdo do site (contrato da API /api/internal/erp/materias)
  titulo text NOT NULL CHECK (char_length(titulo) BETWEEN 5 AND 200),
  subtitulo text CHECK (subtitulo IS NULL OR char_length(subtitulo) <= 300),
  slug text CHECK (slug IS NULL OR slug ~ '^[a-z0-9-]{3,160}$'),
  resumo text CHECK (resumo IS NULL OR char_length(resumo) <= 600),
  categoria_slug text NOT NULL CHECK (categoria_slug ~ '^[a-z0-9-]{3,80}$'),
  blocos jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(blocos) = 'array'),
  seo_titulo text CHECK (seo_titulo IS NULL OR char_length(seo_titulo) <= 120),
  seo_descricao text CHECK (seo_descricao IS NULL OR char_length(seo_descricao) <= 200),
  -- Somente NOMES de fonte; links ficam em notas_verificacao (interno).
  fontes text[] NOT NULL DEFAULT '{}'::text[],
  notas_verificacao text,
  autor_nome text NOT NULL DEFAULT 'Equipe AviZee',
  palavra_chave text,

  -- Post do Instagram (formato: Título / Texto / Fonte)
  instagram_titulo text CHECK (instagram_titulo IS NULL OR char_length(instagram_titulo) <= 80),
  instagram_texto text,
  instagram_fonte text,
  instagram_sugestao_arte text,

  -- Fluxo
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'aprovada', 'publicando', 'publicada', 'erro')),
  origem text NOT NULL DEFAULT 'erp' CHECK (origem IN ('erp', 'claude', 'ia_erp')),
  aprovado_por uuid,
  aprovado_por_nome text,
  aprovado_em timestamptz,

  -- Retorno do site (gravado só pela Edge Function)
  site_artigo_id uuid,
  site_url text,
  site_versao int,
  publicado_em timestamptz,
  ultimo_erro text,

  -- Instagram (gravado só pela Edge Function)
  instagram_status text NOT NULL DEFAULT 'nao_postado'
    CHECK (instagram_status IN ('nao_postado', 'postando', 'postado', 'erro')),
  instagram_post_id uuid REFERENCES public.social_posts(id) ON DELETE SET NULL,
  instagram_url text,

  criado_por uuid DEFAULT auth.uid(),
  atualizado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT site_materias_aprovacao_completa CHECK (
    status NOT IN ('aprovada', 'publicando', 'publicada')
    OR (aprovado_por_nome IS NOT NULL AND aprovado_em IS NOT NULL)
  )
);

CREATE INDEX idx_site_materias_status ON public.site_materias (status, updated_at DESC);
CREATE INDEX idx_site_materias_empresa ON public.site_materias (empresa_id);
CREATE UNIQUE INDEX uq_site_materias_site_artigo
  ON public.site_materias (site_artigo_id) WHERE site_artigo_id IS NOT NULL;

CREATE TABLE public.site_materias_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  materia_id uuid NOT NULL REFERENCES public.site_materias(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  de_status text,
  para_status text,
  detalhe jsonb NOT NULL DEFAULT '{}'::jsonb,
  ator uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_site_materias_eventos_materia ON public.site_materias_eventos (materia_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 3. Regras do fluxo (trigger)
--    - campos de retorno do site/Instagram só mudam via service_role;
--    - 'publicando'/'publicada' só via service_role;
--    - aprovar exige conteudo:publicar e registra quem aprovou;
--    - editar conteúdo de matéria aprovada/publicada invalida a aprovação.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.site_materias_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_service boolean := coalesce(auth.role(), '') = 'service_role';
  conteudo_mudou boolean;
  nome text;
BEGIN
  NEW.updated_at := now();
  IF NOT is_service THEN
    NEW.atualizado_por := auth.uid();
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT is_service THEN
      IF NEW.status NOT IN ('rascunho', 'aprovada') THEN
        RAISE EXCEPTION 'Status inicial inválido: %', NEW.status USING ERRCODE = '42501';
      END IF;
      NEW.site_artigo_id := NULL; NEW.site_url := NULL; NEW.site_versao := NULL;
      NEW.publicado_em := NULL; NEW.ultimo_erro := NULL;
      NEW.instagram_status := 'nao_postado'; NEW.instagram_post_id := NULL; NEW.instagram_url := NULL;
      NEW.criado_por := auth.uid();
      NEW.aprovado_por := NULL; NEW.aprovado_em := NULL;
      IF NEW.status = 'aprovada' THEN
        IF NOT public.tem_permissao_erp('conteudo', 'publicar') THEN
          RAISE EXCEPTION 'Sem permissão para aprovar matérias' USING ERRCODE = '42501';
        END IF;
        NEW.aprovado_por := auth.uid();
        NEW.aprovado_em := now();
        IF NEW.aprovado_por_nome IS NULL THEN
          RAISE EXCEPTION 'Informe o nome de quem aprovou' USING ERRCODE = '23514';
        END IF;
      ELSE
        NEW.aprovado_por_nome := NULL;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NOT is_service THEN
    -- Retorno do site e do Instagram é imutável para o cliente.
    NEW.site_artigo_id := OLD.site_artigo_id; NEW.site_url := OLD.site_url;
    NEW.site_versao := OLD.site_versao; NEW.publicado_em := OLD.publicado_em;
    NEW.ultimo_erro := OLD.ultimo_erro;
    NEW.instagram_status := OLD.instagram_status; NEW.instagram_post_id := OLD.instagram_post_id;
    NEW.instagram_url := OLD.instagram_url;
    NEW.criado_por := OLD.criado_por; NEW.origem := OLD.origem; NEW.empresa_id := OLD.empresa_id;

    IF NEW.status IN ('publicando', 'publicada') AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'A publicação é feita pela função de publicação' USING ERRCODE = '42501';
    END IF;
    IF OLD.status = 'publicando' THEN
      RAISE EXCEPTION 'Matéria em publicação; aguarde' USING ERRCODE = '55P03';
    END IF;

    conteudo_mudou := (
      NEW.titulo, NEW.subtitulo, NEW.slug, NEW.resumo, NEW.categoria_slug, NEW.blocos,
      NEW.seo_titulo, NEW.seo_descricao, NEW.fontes, NEW.autor_nome,
      NEW.instagram_titulo, NEW.instagram_texto, NEW.instagram_fonte
    ) IS DISTINCT FROM (
      OLD.titulo, OLD.subtitulo, OLD.slug, OLD.resumo, OLD.categoria_slug, OLD.blocos,
      OLD.seo_titulo, OLD.seo_descricao, OLD.fontes, OLD.autor_nome,
      OLD.instagram_titulo, OLD.instagram_texto, OLD.instagram_fonte
    );

    IF NEW.status = 'aprovada' AND OLD.status <> 'aprovada' THEN
      -- Aprovação explícita (mudança de status): registra quem aprovou esta versão.
      IF NOT public.tem_permissao_erp('conteudo', 'publicar') THEN
        RAISE EXCEPTION 'Sem permissão para aprovar matérias' USING ERRCODE = '42501';
      END IF;
      nome := coalesce(NEW.aprovado_por_nome, OLD.aprovado_por_nome);
      IF nome IS NULL THEN
        RAISE EXCEPTION 'Informe o nome de quem aprovou' USING ERRCODE = '23514';
      END IF;
      NEW.aprovado_por := auth.uid();
      NEW.aprovado_por_nome := nome;
      NEW.aprovado_em := now();
    ELSIF conteudo_mudou AND OLD.status IN ('aprovada', 'publicada', 'erro') THEN
      -- Aprovação vale só para a versão aprovada.
      NEW.status := 'rascunho';
      NEW.aprovado_por := NULL; NEW.aprovado_por_nome := NULL; NEW.aprovado_em := NULL;
    ELSIF NEW.status = 'rascunho' THEN
      NEW.aprovado_por := NULL; NEW.aprovado_por_nome := NULL; NEW.aprovado_em := NULL;
    ELSE
      NEW.aprovado_por := OLD.aprovado_por; NEW.aprovado_por_nome := OLD.aprovado_por_nome;
      NEW.aprovado_em := OLD.aprovado_em;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER site_materias_guard
  BEFORE INSERT OR UPDATE ON public.site_materias
  FOR EACH ROW EXECUTE FUNCTION public.site_materias_guard();

CREATE OR REPLACE FUNCTION public.site_materias_log_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.site_materias_eventos (materia_id, tipo, para_status, ator, detalhe)
    VALUES (NEW.id, 'criada', NEW.status, auth.uid(), jsonb_build_object('origem', NEW.origem));
  ELSIF NEW.status IS DISTINCT FROM OLD.status OR NEW.aprovado_em IS DISTINCT FROM OLD.aprovado_em THEN
    INSERT INTO public.site_materias_eventos (materia_id, tipo, de_status, para_status, ator, detalhe)
    VALUES (
      NEW.id, 'status', OLD.status, NEW.status, auth.uid(),
      jsonb_strip_nulls(jsonb_build_object(
        'aprovado_por_nome', NEW.aprovado_por_nome,
        'site_url', NEW.site_url,
        'erro', CASE WHEN NEW.status = 'erro' THEN NEW.ultimo_erro END
      ))
    );
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER site_materias_log_status
  AFTER INSERT OR UPDATE ON public.site_materias
  FOR EACH ROW EXECUTE FUNCTION public.site_materias_log_status();

-- ---------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------
ALTER TABLE public.site_materias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_materias_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY site_materias_select ON public.site_materias
  FOR SELECT TO authenticated
  USING (
    public.tem_permissao_erp('conteudo', 'visualizar')
    AND (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  );

CREATE POLICY site_materias_insert ON public.site_materias
  FOR INSERT TO authenticated
  WITH CHECK (public.tem_permissao_erp('conteudo', 'criar'));

CREATE POLICY site_materias_update ON public.site_materias
  FOR UPDATE TO authenticated
  USING (
    public.tem_permissao_erp('conteudo', 'editar')
    AND (empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  )
  WITH CHECK (public.tem_permissao_erp('conteudo', 'editar'));

CREATE POLICY site_materias_delete ON public.site_materias
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND site_artigo_id IS NULL
  );

CREATE POLICY site_materias_eventos_select ON public.site_materias_eventos
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.site_materias m WHERE m.id = materia_id)
  );

REVOKE ALL ON public.site_materias, public.site_materias_eventos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_materias TO authenticated;
GRANT SELECT ON public.site_materias_eventos TO authenticated;
GRANT ALL ON public.site_materias, public.site_materias_eventos TO service_role;

-- ---------------------------------------------------------------------
-- 5. Credenciais de redes sociais no Vault
--    O frontend lê social_contas com SELECT '*'; os tokens saem dessa tabela
--    e passam a viver em vault.secrets, acessíveis só ao service_role.
-- ---------------------------------------------------------------------
CREATE TABLE public.social_contas_credenciais (
  conta_id uuid PRIMARY KEY REFERENCES public.social_contas(id) ON DELETE CASCADE,
  access_token_secret_id uuid,
  refresh_token_secret_id uuid,
  token_expira_em timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.social_contas_credenciais ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy: só service_role (que ignora RLS) acessa.
REVOKE ALL ON public.social_contas_credenciais FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.social_contas_credenciais TO service_role;

CREATE OR REPLACE FUNCTION public.social_salvar_credenciais(
  _conta_id uuid,
  _access_token text,
  _refresh_token text DEFAULT NULL,
  _expira_em timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  atual public.social_contas_credenciais%ROWTYPE;
  access_id uuid;
  refresh_id uuid;
BEGIN
  SELECT * INTO atual FROM public.social_contas_credenciais WHERE conta_id = _conta_id;

  IF _access_token IS NOT NULL THEN
    IF atual.access_token_secret_id IS NOT NULL THEN
      PERFORM vault.update_secret(atual.access_token_secret_id, _access_token);
      access_id := atual.access_token_secret_id;
    ELSE
      access_id := vault.create_secret(_access_token, 'social_access_' || _conta_id::text);
    END IF;
  ELSE
    access_id := atual.access_token_secret_id;
  END IF;

  IF _refresh_token IS NOT NULL THEN
    IF atual.refresh_token_secret_id IS NOT NULL THEN
      PERFORM vault.update_secret(atual.refresh_token_secret_id, _refresh_token);
      refresh_id := atual.refresh_token_secret_id;
    ELSE
      refresh_id := vault.create_secret(_refresh_token, 'social_refresh_' || _conta_id::text);
    END IF;
  ELSE
    refresh_id := atual.refresh_token_secret_id;
  END IF;

  INSERT INTO public.social_contas_credenciais AS c
    (conta_id, access_token_secret_id, refresh_token_secret_id, token_expira_em, updated_at)
  VALUES (_conta_id, access_id, refresh_id, _expira_em, now())
  ON CONFLICT (conta_id) DO UPDATE SET
    access_token_secret_id = EXCLUDED.access_token_secret_id,
    refresh_token_secret_id = EXCLUDED.refresh_token_secret_id,
    token_expira_em = coalesce(EXCLUDED.token_expira_em, c.token_expira_em),
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.social_obter_credenciais(_conta_id uuid)
RETURNS TABLE (access_token text, refresh_token text, token_expira_em timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT
    (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.id = c.access_token_secret_id),
    (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.id = c.refresh_token_secret_id),
    c.token_expira_em
  FROM public.social_contas_credenciais c
  WHERE c.conta_id = _conta_id;
$$;

REVOKE ALL ON FUNCTION public.social_salvar_credenciais(uuid, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.social_obter_credenciais(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.social_salvar_credenciais(uuid, text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.social_obter_credenciais(uuid) TO service_role;

-- Migra tokens que existirem e proíbe gravá-los de novo em texto puro.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, access_token, refresh_token, token_expira_em FROM public.social_contas
           WHERE access_token IS NOT NULL OR refresh_token IS NOT NULL LOOP
    PERFORM public.social_salvar_credenciais(r.id, r.access_token, r.refresh_token, r.token_expira_em);
  END LOOP;
END $$;

UPDATE public.social_contas SET access_token = NULL, refresh_token = NULL
WHERE access_token IS NOT NULL OR refresh_token IS NOT NULL;

ALTER TABLE public.social_contas
  ADD CONSTRAINT social_contas_sem_token_em_texto
  CHECK (access_token IS NULL AND refresh_token IS NULL);

COMMENT ON COLUMN public.social_contas.access_token IS
  'Obsoleta: tokens ficam no Vault (social_salvar_credenciais). Sempre NULL.';
COMMENT ON COLUMN public.social_contas.refresh_token IS
  'Obsoleta: tokens ficam no Vault (social_salvar_credenciais). Sempre NULL.';
