-- ============================================================
-- ONDA 1 SOCIAL — Schema alignment + OAuth-ready + RPCs reais
-- ============================================================

-- 0) Drop view dependente para permitir RENAME
DROP VIEW IF EXISTS public.vw_apresentacao_social_evolucao;

-- ============================================================
-- 1) social_contas
-- ============================================================
ALTER TABLE public.social_contas
  RENAME COLUMN nome TO nome_conta;
ALTER TABLE public.social_contas
  RENAME COLUMN identificador TO identificador_externo;

ALTER TABLE public.social_contas
  ADD COLUMN IF NOT EXISTS status_conexao TEXT NOT NULL DEFAULT 'desconectado',
  ADD COLUMN IF NOT EXISTS url_conta TEXT,
  ADD COLUMN IF NOT EXISTS escopos TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ultima_sincronizacao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS meta_user_id TEXT,
  ADD COLUMN IF NOT EXISTS facebook_page_id TEXT;

ALTER TABLE public.social_contas
  DROP CONSTRAINT IF EXISTS chk_social_contas_status;
ALTER TABLE public.social_contas
  ADD CONSTRAINT chk_social_contas_status
  CHECK (status_conexao IN ('conectado','expirado','erro','desconectado'));

ALTER TABLE public.social_contas
  DROP CONSTRAINT IF EXISTS chk_social_contas_plataforma;
ALTER TABLE public.social_contas
  ADD CONSTRAINT chk_social_contas_plataforma
  CHECK (plataforma IN ('instagram_business','linkedin_page'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_social_contas_plat_ident
  ON public.social_contas(plataforma, identificador_externo);

-- Endurecer RLS: leitura authenticated, escrita admin
DROP POLICY IF EXISTS "sc_select" ON public.social_contas;
DROP POLICY IF EXISTS "sc_insert" ON public.social_contas;
DROP POLICY IF EXISTS "sc_update" ON public.social_contas;
DROP POLICY IF EXISTS "sc_delete" ON public.social_contas;

CREATE POLICY "social_contas_select_auth" ON public.social_contas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "social_contas_insert_admin" ON public.social_contas
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "social_contas_update_admin" ON public.social_contas
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "social_contas_delete_admin" ON public.social_contas
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 2) social_posts
-- ============================================================
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS plataforma TEXT,
  ADD COLUMN IF NOT EXISTS titulo_legenda TEXT,
  ADD COLUMN IF NOT EXISTS url_post TEXT,
  ADD COLUMN IF NOT EXISTS tipo_post TEXT NOT NULL DEFAULT 'feed',
  ADD COLUMN IF NOT EXISTS salvamentos INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cliques INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS destaque BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS campanha_id UUID;

-- Renomear post_id_externo → id_externo_post (alinha com TS)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='social_posts' AND column_name='post_id_externo'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='social_posts' AND column_name='id_externo_post'
  ) THEN
    EXECUTE 'ALTER TABLE public.social_posts RENAME COLUMN post_id_externo TO id_externo_post';
  END IF;
END $$;

ALTER TABLE public.social_posts
  DROP CONSTRAINT IF EXISTS chk_social_posts_tipo;
ALTER TABLE public.social_posts
  ADD CONSTRAINT chk_social_posts_tipo
  CHECK (tipo_post IN ('feed','reels','story','video','artigo','carousel'));

-- Coluna gerada engajamento_total
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='social_posts' AND column_name='engajamento_total'
  ) THEN
    EXECUTE 'ALTER TABLE public.social_posts ADD COLUMN engajamento_total INTEGER GENERATED ALWAYS AS (COALESCE(curtidas,0)+COALESCE(comentarios,0)+COALESCE(compartilhamentos,0)+COALESCE(salvamentos,0)) STORED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='social_posts' AND column_name='taxa_engajamento'
  ) THEN
    EXECUTE 'ALTER TABLE public.social_posts ADD COLUMN taxa_engajamento NUMERIC(8,4) GENERATED ALWAYS AS (CASE WHEN COALESCE(alcance,0)=0 THEN 0 ELSE ((COALESCE(curtidas,0)+COALESCE(comentarios,0)+COALESCE(compartilhamentos,0)+COALESCE(salvamentos,0))::numeric / alcance::numeric) * 100 END) STORED';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_social_posts_conta_extid
  ON public.social_posts(conta_id, id_externo_post);

-- ============================================================
-- 3) social_metricas_snapshot
-- ============================================================
ALTER TABLE public.social_metricas_snapshot
  ADD COLUMN IF NOT EXISTS seguidores_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seguidores_novos INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visitas_perfil INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cliques_link INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engajamento_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxa_engajamento NUMERIC(8,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_posts_periodo INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- Backfill seguidores_total a partir do antigo seguidores
UPDATE public.social_metricas_snapshot
   SET seguidores_total = COALESCE(seguidores, 0)
 WHERE seguidores_total = 0 AND seguidores IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_social_metricas_conta_data
  ON public.social_metricas_snapshot(conta_id, data_referencia);

-- ============================================================
-- 4) social_alertas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.social_alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID REFERENCES public.social_contas(id) ON DELETE CASCADE,
  tipo_alerta TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  severidade TEXT NOT NULL DEFAULT 'media',
  resolvido BOOLEAN NOT NULL DEFAULT false,
  data_referencia DATE,
  data_cadastro TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_social_alertas_severidade CHECK (severidade IN ('baixa','media','alta','critica'))
);
ALTER TABLE public.social_alertas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "social_alertas_select" ON public.social_alertas;
DROP POLICY IF EXISTS "social_alertas_write" ON public.social_alertas;
CREATE POLICY "social_alertas_select" ON public.social_alertas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "social_alertas_write" ON public.social_alertas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_social_alertas_data ON public.social_alertas(data_cadastro DESC);

-- ============================================================
-- 5) social_sync_jobs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.social_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID REFERENCES public.social_contas(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente',
  iniciado_em TIMESTAMPTZ,
  concluido_em TIMESTAMPTZ,
  erro_mensagem TEXT,
  resultado JSONB,
  data_cadastro TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_social_sync_jobs_status CHECK (status IN ('pendente','em_execucao','concluido','erro'))
);
ALTER TABLE public.social_sync_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "social_sync_jobs_select" ON public.social_sync_jobs;
DROP POLICY IF EXISTS "social_sync_jobs_write" ON public.social_sync_jobs;
CREATE POLICY "social_sync_jobs_select" ON public.social_sync_jobs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "social_sync_jobs_write" ON public.social_sync_jobs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_social_sync_jobs_status ON public.social_sync_jobs(status, data_cadastro DESC);

-- ============================================================
-- 6) Recriar view vw_apresentacao_social_evolucao
-- ============================================================
CREATE OR REPLACE VIEW public.vw_apresentacao_social_evolucao AS
SELECT
  to_char(data_referencia, 'YYYY-MM') AS competencia,
  sc.plataforma,
  SUM(sms.seguidores_total)::bigint AS seguidores,
  SUM(sms.alcance)::bigint AS alcance,
  SUM(sms.engajamento_total)::numeric AS engajamento
FROM public.social_metricas_snapshot sms
JOIN public.social_contas sc ON sc.id = sms.conta_id
GROUP BY 1, sc.plataforma
ORDER BY 1, sc.plataforma;
GRANT SELECT ON public.vw_apresentacao_social_evolucao TO authenticated;

-- ============================================================
-- 7) RPCs v2 — payload alinhado com o contrato TS
-- ============================================================
DROP FUNCTION IF EXISTS public.social_dashboard_consolidado(DATE, DATE);
CREATE OR REPLACE FUNCTION public.social_dashboard_consolidado(
  _data_inicio DATE, _data_fim DATE
) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ult AS (
    SELECT DISTINCT ON (sms.conta_id)
      sms.conta_id, sc.plataforma,
      sms.seguidores_novos, sms.engajamento_total, sms.taxa_engajamento,
      sms.impressoes, sms.alcance, sms.quantidade_posts_periodo
    FROM public.social_metricas_snapshot sms
    JOIN public.social_contas sc ON sc.id = sms.conta_id
    WHERE sms.data_referencia BETWEEN _data_inicio AND _data_fim
    ORDER BY sms.conta_id, sms.data_referencia DESC
  ),
  comp AS (
    SELECT
      plataforma,
      COALESCE(SUM(seguidores_novos),0) AS seguidores_novos,
      COALESCE(SUM(engajamento_total),0) AS engajamento_total,
      COALESCE(AVG(NULLIF(taxa_engajamento,0)),0) AS taxa_engajamento_media,
      COALESCE(SUM(impressoes),0) AS impressoes,
      COALESCE(SUM(alcance),0) AS alcance,
      COALESCE(SUM(quantidade_posts_periodo),0) AS quantidade_posts_periodo
    FROM ult GROUP BY plataforma
  )
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object('data_inicio', _data_inicio, 'data_fim', _data_fim),
    'comparativo', COALESCE((SELECT jsonb_agg(to_jsonb(comp)) FROM comp), '[]'::jsonb),
    'totais', jsonb_build_object(
      'seguidores_novos', COALESCE((SELECT SUM(seguidores_novos) FROM comp),0),
      'engajamento_total', COALESCE((SELECT SUM(engajamento_total) FROM comp),0),
      'impressoes', COALESCE((SELECT SUM(impressoes) FROM comp),0),
      'alcance', COALESCE((SELECT SUM(alcance) FROM comp),0)
    )
  );
$$;

DROP FUNCTION IF EXISTS public.social_metricas_periodo(UUID, DATE, DATE);
CREATE OR REPLACE FUNCTION public.social_metricas_periodo(
  _conta_id UUID, _data_inicio DATE, _data_fim DATE
) RETURNS SETOF public.social_metricas_snapshot
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.social_metricas_snapshot
   WHERE conta_id = _conta_id
     AND data_referencia BETWEEN _data_inicio AND _data_fim
   ORDER BY data_referencia ASC;
$$;

DROP FUNCTION IF EXISTS public.social_alertas_periodo(DATE, DATE);
CREATE OR REPLACE FUNCTION public.social_alertas_periodo(
  _data_inicio DATE, _data_fim DATE
) RETURNS SETOF public.social_alertas
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.social_alertas
   WHERE data_cadastro::date BETWEEN _data_inicio AND _data_fim
   ORDER BY data_cadastro DESC;
$$;

DROP FUNCTION IF EXISTS public.social_posts_filtrados(DATE, DATE, UUID);
CREATE OR REPLACE FUNCTION public.social_posts_filtrados(
  _data_inicio DATE, _data_fim DATE, _conta_id UUID DEFAULT NULL
) RETURNS TABLE (
  id UUID, conta_id UUID, plataforma TEXT, nome_conta TEXT,
  id_externo_post TEXT, data_publicacao TIMESTAMPTZ, titulo_legenda TEXT,
  url_post TEXT, tipo_post TEXT, campanha_id UUID,
  impressoes INTEGER, alcance INTEGER, curtidas INTEGER, comentarios INTEGER,
  compartilhamentos INTEGER, salvamentos INTEGER, cliques INTEGER,
  engajamento_total INTEGER, taxa_engajamento NUMERIC, destaque BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    sp.id, sp.conta_id,
    COALESCE(sp.plataforma, sc.plataforma) AS plataforma,
    sc.nome_conta,
    sp.id_externo_post, sp.data_publicacao, sp.titulo_legenda,
    sp.url_post, sp.tipo_post, sp.campanha_id,
    COALESCE(sp.impressoes,0), COALESCE(sp.alcance,0),
    COALESCE(sp.curtidas,0), COALESCE(sp.comentarios,0),
    COALESCE(sp.compartilhamentos,0), COALESCE(sp.salvamentos,0),
    COALESCE(sp.cliques,0), COALESCE(sp.engajamento_total,0),
    COALESCE(sp.taxa_engajamento,0), COALESCE(sp.destaque,false)
  FROM public.social_posts sp
  JOIN public.social_contas sc ON sc.id = sp.conta_id
  WHERE sp.data_publicacao::date BETWEEN _data_inicio AND _data_fim
    AND (_conta_id IS NULL OR sp.conta_id = _conta_id)
  ORDER BY sp.data_publicacao DESC;
$$;

DROP FUNCTION IF EXISTS public.social_sincronizar_manual(UUID);
CREATE OR REPLACE FUNCTION public.social_sincronizar_manual(
  _conta_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_job_id UUID;
BEGIN
  INSERT INTO public.social_sync_jobs (conta_id, status)
  VALUES (_conta_id, 'pendente')
  RETURNING id INTO v_job_id;
  RETURN jsonb_build_object('success', true, 'message', 'Job de sincronização enfileirado', 'job_id', v_job_id);
END;
$$;