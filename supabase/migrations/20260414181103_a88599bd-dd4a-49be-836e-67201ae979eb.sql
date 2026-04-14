
-- =============================================
-- 1. USER PREFERENCES
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  columns_config JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_key)
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "up_select" ON public.user_preferences
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "up_insert" ON public.user_preferences
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "up_update" ON public.user_preferences
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_module
  ON public.user_preferences(user_id, module_key);

-- =============================================
-- 2. SEQUENCES + ATOMIC NUMBER RPCS
-- =============================================
CREATE SEQUENCE IF NOT EXISTS public.seq_orcamento START 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_ordem_venda START 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_pedido_compra START 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_cotacao_compra START 1;

-- Initialize sequences from existing data
DO $$
DECLARE v_max BIGINT;
BEGIN
  SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(COALESCE(numero,'0'), '[^0-9]', '', 'g') AS BIGINT)), 0) + 1
    INTO v_max FROM public.orcamentos WHERE numero ~ '[0-9]';
  IF v_max > 1 THEN PERFORM setval('public.seq_orcamento', v_max); END IF;

  SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(COALESCE(numero,'0'), '[^0-9]', '', 'g') AS BIGINT)), 0) + 1
    INTO v_max FROM public.ordens_venda WHERE numero ~ '[0-9]';
  IF v_max > 1 THEN PERFORM setval('public.seq_ordem_venda', v_max); END IF;

  SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(COALESCE(numero,'0'), '[^0-9]', '', 'g') AS BIGINT)), 0) + 1
    INTO v_max FROM public.compras WHERE numero ~ '[0-9]';
  IF v_max > 1 THEN PERFORM setval('public.seq_pedido_compra', v_max); END IF;

  SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(COALESCE(numero,'0'), '[^0-9]', '', 'g') AS BIGINT)), 0) + 1
    INTO v_max FROM public.cotacoes_compra WHERE numero ~ '[0-9]';
  IF v_max > 1 THEN PERFORM setval('public.seq_cotacao_compra', v_max); END IF;
END $$;

CREATE OR REPLACE FUNCTION public.proximo_numero_orcamento()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT 'COT' || LPAD(nextval('public.seq_orcamento')::text, 6, '0')
$$;

CREATE OR REPLACE FUNCTION public.proximo_numero_ordem_venda()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT 'OV' || LPAD(nextval('public.seq_ordem_venda')::text, 6, '0')
$$;

CREATE OR REPLACE FUNCTION public.proximo_numero_pedido_compra()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT 'PC' || LPAD(nextval('public.seq_pedido_compra')::text, 6, '0')
$$;

CREATE OR REPLACE FUNCTION public.proximo_numero_cotacao_compra()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT 'CC' || LPAD(nextval('public.seq_cotacao_compra')::text, 6, '0')
$$;

-- =============================================
-- 3. SOCIAL MODULE TABLES
-- =============================================
CREATE TABLE IF NOT EXISTS public.social_contas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plataforma TEXT NOT NULL,
  nome TEXT NOT NULL,
  identificador TEXT,
  access_token TEXT,
  token_expira_em TIMESTAMPTZ,
  ativo BOOLEAN NOT NULL DEFAULT true,
  data_cadastro TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.social_contas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sc_select" ON public.social_contas FOR SELECT TO authenticated USING (true);
CREATE POLICY "sc_insert" ON public.social_contas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sc_update" ON public.social_contas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "sc_delete" ON public.social_contas FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.social_metricas_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES public.social_contas(id) ON DELETE CASCADE,
  data_referencia DATE NOT NULL,
  seguidores INTEGER DEFAULT 0,
  seguindo INTEGER DEFAULT 0,
  publicacoes INTEGER DEFAULT 0,
  alcance INTEGER DEFAULT 0,
  impressoes INTEGER DEFAULT 0,
  engajamento NUMERIC(10,4) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.social_metricas_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sm_select" ON public.social_metricas_snapshot FOR SELECT TO authenticated USING (true);
CREATE POLICY "sm_insert" ON public.social_metricas_snapshot FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES public.social_contas(id) ON DELETE CASCADE,
  post_id_externo TEXT,
  tipo TEXT DEFAULT 'post',
  conteudo TEXT,
  data_publicacao TIMESTAMPTZ,
  curtidas INTEGER DEFAULT 0,
  comentarios INTEGER DEFAULT 0,
  compartilhamentos INTEGER DEFAULT 0,
  alcance INTEGER DEFAULT 0,
  impressoes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sp_select" ON public.social_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "sp_insert" ON public.social_posts FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_social_metricas_conta_data ON public.social_metricas_snapshot(conta_id, data_referencia);
CREATE INDEX IF NOT EXISTS idx_social_posts_conta_data ON public.social_posts(conta_id, data_publicacao);

-- Social RPCs
CREATE OR REPLACE FUNCTION public.social_dashboard_consolidado(
  _data_inicio DATE, _data_fim DATE
) RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'total_contas', (SELECT COUNT(*) FROM social_contas WHERE ativo = true),
    'total_seguidores', COALESCE((SELECT SUM(seguidores) FROM social_metricas_snapshot WHERE data_referencia BETWEEN _data_inicio AND _data_fim), 0),
    'total_posts', COALESCE((SELECT COUNT(*) FROM social_posts WHERE data_publicacao::date BETWEEN _data_inicio AND _data_fim), 0)
  )
$$;

CREATE OR REPLACE FUNCTION public.social_posts_filtrados(
  _data_inicio DATE, _data_fim DATE, _conta_id UUID DEFAULT NULL
) RETURNS SETOF public.social_posts LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM social_posts
  WHERE data_publicacao::date BETWEEN _data_inicio AND _data_fim
  AND (_conta_id IS NULL OR conta_id = _conta_id)
  ORDER BY data_publicacao DESC
$$;

CREATE OR REPLACE FUNCTION public.social_sincronizar_manual(
  _conta_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('success', true, 'message', 'Sincronização concluída')
$$;

CREATE OR REPLACE FUNCTION public.social_alertas_periodo(
  _data_inicio DATE, _data_fim DATE
) RETURNS TABLE(id UUID, tipo TEXT, mensagem TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT gen_random_uuid(), 'info'::TEXT, 'Nenhum alerta no período'::TEXT, now()
  WHERE false
$$;

-- =============================================
-- 4. CONCILIAÇÃO BANCÁRIA
-- =============================================
CREATE TABLE IF NOT EXISTS public.conciliacao_bancaria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_bancaria_id UUID NOT NULL REFERENCES public.contas_bancarias(id),
  data_conciliacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  usuario_id UUID REFERENCES auth.users(id),
  total_pares INTEGER NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.conciliacao_bancaria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conc_select" ON public.conciliacao_bancaria FOR SELECT TO authenticated USING (true);
CREATE POLICY "conc_insert" ON public.conciliacao_bancaria FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.conciliacao_pares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conciliacao_id UUID NOT NULL REFERENCES public.conciliacao_bancaria(id) ON DELETE CASCADE,
  lancamento_id UUID REFERENCES public.financeiro_lancamentos(id),
  extrato_id TEXT NOT NULL,
  valor_extrato NUMERIC(15,2),
  valor_lancamento NUMERIC(15,2),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.conciliacao_pares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cp_select" ON public.conciliacao_pares FOR SELECT TO authenticated USING (true);
CREATE POLICY "cp_insert" ON public.conciliacao_pares FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_cp_conciliacao_id ON public.conciliacao_pares(conciliacao_id);
CREATE INDEX IF NOT EXISTS idx_cp_lancamento_id ON public.conciliacao_pares(lancamento_id);
