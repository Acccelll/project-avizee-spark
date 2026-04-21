
-- =========================================================
-- Phase 2 — Schema: Centro de Custo + Plano Sintético + Custo Histórico
-- =========================================================

-- 1. centros_custo
CREATE TABLE IF NOT EXISTS public.centros_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  descricao text NOT NULL,
  responsavel text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cc_select_authenticated" ON public.centros_custo
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cc_insert_admin_fin" ON public.centros_custo
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'financeiro'::app_role));

CREATE POLICY "cc_update_admin_fin" ON public.centros_custo
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'financeiro'::app_role));

CREATE POLICY "cc_delete_admin" ON public.centros_custo
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role));

-- 2. contas_contabeis_sinteticas
CREATE TABLE IF NOT EXISTS public.contas_contabeis_sinteticas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  descricao text NOT NULL,
  nivel int,
  conta_pai_codigo text REFERENCES public.contas_contabeis_sinteticas(codigo),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contas_contabeis_sinteticas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ccs_select_authenticated" ON public.contas_contabeis_sinteticas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ccs_insert_admin_fin" ON public.contas_contabeis_sinteticas
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'financeiro'::app_role));

CREATE POLICY "ccs_update_admin_fin" ON public.contas_contabeis_sinteticas
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'financeiro'::app_role));

CREATE POLICY "ccs_delete_admin" ON public.contas_contabeis_sinteticas
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role));

-- 3. Vínculos
ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS centro_custo_id uuid REFERENCES public.centros_custo(id);

CREATE INDEX IF NOT EXISTS idx_fin_lanc_centro_custo ON public.financeiro_lancamentos(centro_custo_id);

ALTER TABLE public.contas_contabeis
  ADD COLUMN IF NOT EXISTS conta_sintetica_codigo text REFERENCES public.contas_contabeis_sinteticas(codigo);

CREATE INDEX IF NOT EXISTS idx_cc_sintetica ON public.contas_contabeis(conta_sintetica_codigo);

-- 4. Custo histórico em itens de NF (Phase 4)
ALTER TABLE public.notas_fiscais_itens
  ADD COLUMN IF NOT EXISTS custo_historico_unitario numeric(15,4);

-- =========================================================
-- Trigger updated_at em centros_custo
-- =========================================================
CREATE TRIGGER update_centros_custo_updated_at
  BEFORE UPDATE ON public.centros_custo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Phase 2 — Atualizar RPC carga_inicial_conciliacao
-- Adiciona processamento de centros de custo e sintéticas
-- =========================================================
CREATE OR REPLACE FUNCTION public.carga_inicial_processar_extras(p_lote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  c_cc int := 0;
  c_sint int := 0;
BEGIN
  -- Centros de Custo
  FOR rec IN SELECT id, dados FROM stg_cadastros
    WHERE lote_id = p_lote_id AND status='pendente' AND dados->>'_tipo'='centro_custo'
  LOOP
    BEGIN
      INSERT INTO centros_custo(codigo, descricao, responsavel)
      VALUES (rec.dados->>'codigo', COALESCE(rec.dados->>'descricao', rec.dados->>'codigo'), rec.dados->>'responsavel')
      ON CONFLICT (codigo) DO UPDATE SET descricao=EXCLUDED.descricao, responsavel=EXCLUDED.responsavel;
      c_cc := c_cc + 1;
      UPDATE stg_cadastros SET status='consolidado' WHERE id=rec.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE stg_cadastros SET status='erro', erro_mensagem=SQLERRM WHERE id=rec.id;
    END;
  END LOOP;

  -- Sintéticas (em ordem por nível para FK self-ref)
  FOR rec IN SELECT id, dados FROM stg_cadastros
    WHERE lote_id = p_lote_id AND status='pendente' AND dados->>'_tipo'='sintetica'
    ORDER BY length(dados->>'codigo')
  LOOP
    BEGIN
      INSERT INTO contas_contabeis_sinteticas(codigo, descricao, nivel, conta_pai_codigo)
      VALUES (
        rec.dados->>'codigo',
        COALESCE(rec.dados->>'descricao', rec.dados->>'codigo'),
        NULLIF(rec.dados->>'nivel','')::int,
        NULLIF(rec.dados->>'conta_pai_codigo','')
      )
      ON CONFLICT (codigo) DO UPDATE SET descricao=EXCLUDED.descricao;
      c_sint := c_sint + 1;
      UPDATE stg_cadastros SET status='consolidado' WHERE id=rec.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE stg_cadastros SET status='erro', erro_mensagem=SQLERRM WHERE id=rec.id;
    END;
  END LOOP;

  RETURN jsonb_build_object('centros_custo', c_cc, 'sinteticas', c_sint);
END;
$$;

-- =========================================================
-- Phase 3 — produtos_fornecedores upsert helper
-- Resolve fornecedor por nome ou codigo legado e linka ao produto
-- =========================================================
CREATE OR REPLACE FUNCTION public.vincular_produto_fornecedor(
  p_produto_id uuid,
  p_fornecedor_nome text,
  p_fornecedor_legado text,
  p_referencia text,
  p_url text,
  p_preco_custo numeric DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_forn_id uuid;
BEGIN
  IF p_produto_id IS NULL THEN RETURN NULL; END IF;

  IF p_fornecedor_legado IS NOT NULL AND p_fornecedor_legado <> '' THEN
    SELECT id INTO v_forn_id FROM fornecedores WHERE codigo_legado = p_fornecedor_legado LIMIT 1;
  END IF;

  IF v_forn_id IS NULL AND p_fornecedor_nome IS NOT NULL AND p_fornecedor_nome <> '' THEN
    SELECT id INTO v_forn_id FROM fornecedores
      WHERE upper(nome_razao_social) = upper(p_fornecedor_nome)
         OR upper(COALESCE(nome_fantasia,'')) = upper(p_fornecedor_nome)
      LIMIT 1;
  END IF;

  IF v_forn_id IS NULL THEN RETURN NULL; END IF;

  INSERT INTO produtos_fornecedores (produto_id, fornecedor_id, referencia_fornecedor, url_produto_fornecedor, preco_custo)
  VALUES (p_produto_id, v_forn_id, p_referencia, p_url, p_preco_custo)
  ON CONFLICT (produto_id, fornecedor_id) DO UPDATE SET
    referencia_fornecedor = COALESCE(EXCLUDED.referencia_fornecedor, produtos_fornecedores.referencia_fornecedor),
    url_produto_fornecedor = COALESCE(EXCLUDED.url_produto_fornecedor, produtos_fornecedores.url_produto_fornecedor),
    preco_custo = COALESCE(EXCLUDED.preco_custo, produtos_fornecedores.preco_custo);

  RETURN v_forn_id;
END;
$$;

-- Garantir constraint UNIQUE para o ON CONFLICT acima
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'produtos_fornecedores_produto_fornecedor_uq'
  ) THEN
    BEGIN
      ALTER TABLE public.produtos_fornecedores
        ADD CONSTRAINT produtos_fornecedores_produto_fornecedor_uq UNIQUE (produto_id, fornecedor_id);
    EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
    END;
  END IF;
END $$;
