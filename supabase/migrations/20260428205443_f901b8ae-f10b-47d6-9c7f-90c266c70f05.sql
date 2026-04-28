-- ============================================================
-- ONDA 2 — Cadastros auxiliares de Faturamento (estilo Sebrae)
-- ============================================================

-- 1) Naturezas de Operação ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.naturezas_operacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  descricao text NOT NULL,
  cfop_dentro_uf text,
  cfop_fora_uf text,
  finalidade text NOT NULL DEFAULT '1',
  tipo_operacao text NOT NULL DEFAULT 'saida',
  movimenta_estoque boolean NOT NULL DEFAULT true,
  gera_financeiro boolean NOT NULL DEFAULT true,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_natop_finalidade CHECK (finalidade IN ('1','2','3','4')),
  CONSTRAINT chk_natop_tipo CHECK (tipo_operacao IN ('saida','entrada'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_natop_codigo ON public.naturezas_operacao (codigo);

ALTER TABLE public.naturezas_operacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "natop_select" ON public.naturezas_operacao;
CREATE POLICY "natop_select" ON public.naturezas_operacao
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "natop_admin_write" ON public.naturezas_operacao;
CREATE POLICY "natop_admin_write" ON public.naturezas_operacao
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_natop_updated_at
  BEFORE UPDATE ON public.naturezas_operacao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed de naturezas comuns
INSERT INTO public.naturezas_operacao (codigo, descricao, cfop_dentro_uf, cfop_fora_uf, finalidade, tipo_operacao)
VALUES
  ('VENDA',     'Venda de mercadoria adquirida ou recebida de terceiros', '5102', '6102', '1', 'saida'),
  ('VENDA_PROD','Venda de produção do estabelecimento',                   '5101', '6101', '1', 'saida'),
  ('DEVOL_VEN', 'Devolução de venda',                                     '1202', '2202', '4', 'entrada'),
  ('REMESSA',   'Remessa para industrialização',                          '5901', '6901', '1', 'saida'),
  ('AMOSTRA',   'Remessa de amostra grátis',                              '5911', '6911', '1', 'saida'),
  ('BRINDE',    'Remessa de brinde ou doação',                            '5910', '6910', '1', 'saida'),
  ('COMPLEM',   'Nota Fiscal Complementar',                               '5949', '6949', '2', 'saida')
ON CONFLICT (codigo) DO NOTHING;

-- 2) Matriz Fiscal ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.matriz_fiscal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  crt text NOT NULL,
  uf_origem text NOT NULL,
  uf_destino text NOT NULL,
  tipo_operacao text NOT NULL DEFAULT 'saida',
  ncm_prefixo text,
  cfop text NOT NULL,
  cst_csosn text NOT NULL,
  origem_mercadoria text NOT NULL DEFAULT '0',
  aliquota_icms numeric(6,2) NOT NULL DEFAULT 0,
  reducao_bc_icms numeric(6,2) NOT NULL DEFAULT 0,
  aliquota_fcp numeric(6,2) NOT NULL DEFAULT 0,
  cst_pis text NOT NULL DEFAULT '49',
  aliquota_pis numeric(6,4) NOT NULL DEFAULT 0,
  cst_cofins text NOT NULL DEFAULT '49',
  aliquota_cofins numeric(6,4) NOT NULL DEFAULT 0,
  cst_ipi text,
  aliquota_ipi numeric(6,4) NOT NULL DEFAULT 0,
  prioridade int NOT NULL DEFAULT 100,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_mf_crt CHECK (crt IN ('1','2','3')),
  CONSTRAINT chk_mf_tipo CHECK (tipo_operacao IN ('saida','entrada')),
  CONSTRAINT chk_mf_uf_origem CHECK (length(uf_origem) = 2),
  CONSTRAINT chk_mf_uf_destino CHECK (length(uf_destino) = 2)
);

CREATE INDEX IF NOT EXISTS idx_matriz_fiscal_lookup
  ON public.matriz_fiscal (crt, uf_origem, uf_destino, tipo_operacao, prioridade)
  WHERE ativo;

ALTER TABLE public.matriz_fiscal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mf_select" ON public.matriz_fiscal;
CREATE POLICY "mf_select" ON public.matriz_fiscal
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "mf_admin_write" ON public.matriz_fiscal;
CREATE POLICY "mf_admin_write" ON public.matriz_fiscal
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_mf_updated_at
  BEFORE UPDATE ON public.matriz_fiscal
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) RPC: aplicar matriz fiscal sobre um produto/destino ----------------------
CREATE OR REPLACE FUNCTION public.aplicar_matriz_fiscal(
  p_produto_id uuid,
  p_uf_destino text,
  p_tipo_operacao text DEFAULT 'saida'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_crt text;
  v_uf_origem text;
  v_ncm text;
  v_match record;
  v_result jsonb;
BEGIN
  -- Pega CRT e UF da empresa (single-tenant: primeiro registro)
  SELECT
    COALESCE(crt::text, '3'),
    COALESCE(uf, 'SP')
  INTO v_crt, v_uf_origem
  FROM public.empresa_config
  LIMIT 1;

  -- Pega NCM do produto (se existir)
  SELECT COALESCE(ncm, '') INTO v_ncm
  FROM public.produtos
  WHERE id = p_produto_id;

  -- Procura regra mais específica (NCM > genérico, prioridade asc)
  SELECT *
  INTO v_match
  FROM public.matriz_fiscal mf
  WHERE mf.ativo
    AND mf.crt = v_crt
    AND mf.uf_origem = v_uf_origem
    AND mf.uf_destino = upper(p_uf_destino)
    AND mf.tipo_operacao = p_tipo_operacao
    AND (mf.ncm_prefixo IS NULL OR v_ncm LIKE mf.ncm_prefixo || '%')
  ORDER BY
    (mf.ncm_prefixo IS NOT NULL) DESC,
    length(coalesce(mf.ncm_prefixo,'')) DESC,
    mf.prioridade ASC
  LIMIT 1;

  IF v_match IS NULL THEN
    RETURN jsonb_build_object('matched', false);
  END IF;

  v_result := jsonb_build_object(
    'matched', true,
    'matriz_id', v_match.id,
    'matriz_nome', v_match.nome,
    'cfop', v_match.cfop,
    'cst_csosn', v_match.cst_csosn,
    'origem_mercadoria', v_match.origem_mercadoria,
    'aliquota_icms', v_match.aliquota_icms,
    'reducao_bc_icms', v_match.reducao_bc_icms,
    'aliquota_fcp', v_match.aliquota_fcp,
    'cst_pis', v_match.cst_pis,
    'aliquota_pis', v_match.aliquota_pis,
    'cst_cofins', v_match.cst_cofins,
    'aliquota_cofins', v_match.aliquota_cofins,
    'cst_ipi', v_match.cst_ipi,
    'aliquota_ipi', v_match.aliquota_ipi
  );
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_matriz_fiscal(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.aplicar_matriz_fiscal(uuid, text, text) TO authenticated;

-- 4) Tabela de catálogo IBGE (municípios) -------------------------------------
CREATE TABLE IF NOT EXISTS public.ibge_municipios (
  codigo_ibge text PRIMARY KEY,
  nome text NOT NULL,
  uf text NOT NULL,
  CONSTRAINT chk_ibge_uf CHECK (length(uf) = 2)
);

CREATE INDEX IF NOT EXISTS idx_ibge_uf_nome ON public.ibge_municipios (uf, nome);
CREATE INDEX IF NOT EXISTS idx_ibge_nome_lower ON public.ibge_municipios (lower(nome));

ALTER TABLE public.ibge_municipios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ibge_select" ON public.ibge_municipios;
CREATE POLICY "ibge_select" ON public.ibge_municipios
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ibge_admin_write" ON public.ibge_municipios;
CREATE POLICY "ibge_admin_write" ON public.ibge_municipios
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5) RPC: lookup município IBGE por nome+UF -----------------------------------
CREATE OR REPLACE FUNCTION public.buscar_municipio_ibge(
  p_nome text,
  p_uf text
)
RETURNS TABLE (codigo_ibge text, nome text, uf text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.codigo_ibge, m.nome, m.uf
  FROM public.ibge_municipios m
  WHERE m.uf = upper(p_uf)
    AND lower(unaccent(m.nome)) = lower(unaccent(p_nome))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.buscar_municipio_ibge(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.buscar_municipio_ibge(text, text) TO authenticated;
