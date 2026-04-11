
-- =============================================
-- 1. Expand notas_fiscais
-- =============================================
ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS natureza_operacao text,
  ADD COLUMN IF NOT EXISTS finalidade_nfe text DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS ambiente_emissao text DEFAULT 'homologacao',
  ADD COLUMN IF NOT EXISTS status_sefaz text DEFAULT 'nao_enviada',
  ADD COLUMN IF NOT EXISTS protocolo_autorizacao text,
  ADD COLUMN IF NOT EXISTS recibo text,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao text,
  ADD COLUMN IF NOT EXISTS xml_gerado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pdf_gerado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS caminho_xml text,
  ADD COLUMN IF NOT EXISTS caminho_pdf text,
  ADD COLUMN IF NOT EXISTS enviado_email boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS valor_produtos numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_seguro numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS peso_bruto numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS peso_liquido numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_volumes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS especie_volumes text,
  ADD COLUMN IF NOT EXISTS marca_volumes text,
  ADD COLUMN IF NOT EXISTS numeracao_volumes text,
  ADD COLUMN IF NOT EXISTS frete_modalidade text DEFAULT '0',
  ADD COLUMN IF NOT EXISTS transportadora_id uuid,
  ADD COLUMN IF NOT EXISTS origem text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS data_saida_entrada date,
  ADD COLUMN IF NOT EXISTS usuario_criacao_id uuid,
  ADD COLUMN IF NOT EXISTS usuario_ultima_modificacao_id uuid;

-- =============================================
-- 2. Expand notas_fiscais_itens
-- =============================================
ALTER TABLE public.notas_fiscais_itens
  ADD COLUMN IF NOT EXISTS codigo_produto text,
  ADD COLUMN IF NOT EXISTS cest text,
  ADD COLUMN IF NOT EXISTS origem_mercadoria text DEFAULT '0',
  ADD COLUMN IF NOT EXISTS csosn text,
  ADD COLUMN IF NOT EXISTS cst_pis text,
  ADD COLUMN IF NOT EXISTS cst_cofins text,
  ADD COLUMN IF NOT EXISTS cst_ipi text,
  ADD COLUMN IF NOT EXISTS unidade_tributavel text,
  ADD COLUMN IF NOT EXISTS desconto numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frete_rateado numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seguro_rateado numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outras_despesas_rateadas numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_st numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_st numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_ipi numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_pis numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_cofins numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observacoes text;

-- =============================================
-- 3. Create nota_fiscal_eventos
-- =============================================
CREATE TABLE IF NOT EXISTS public.nota_fiscal_eventos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nota_fiscal_id uuid NOT NULL REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
  tipo_evento text NOT NULL,
  status_anterior text,
  status_novo text,
  descricao text,
  payload_resumido jsonb,
  data_evento timestamptz NOT NULL DEFAULT now(),
  usuario_id uuid
);

ALTER TABLE public.nota_fiscal_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nfe_select" ON public.nota_fiscal_eventos FOR SELECT TO authenticated USING (true);
CREATE POLICY "nfe_insert" ON public.nota_fiscal_eventos FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================
-- 4. Create nota_fiscal_anexos
-- =============================================
CREATE TABLE IF NOT EXISTS public.nota_fiscal_anexos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nota_fiscal_id uuid NOT NULL REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
  tipo_arquivo text NOT NULL,
  nome_arquivo text,
  caminho_storage text,
  tamanho bigint DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nota_fiscal_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nfa_select" ON public.nota_fiscal_anexos FOR SELECT TO authenticated USING (true);
CREATE POLICY "nfa_insert" ON public.nota_fiscal_anexos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "nfa_delete" ON public.nota_fiscal_anexos FOR DELETE TO authenticated USING (true);

-- =============================================
-- 5. Expand empresa_config
-- =============================================
ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS crt text DEFAULT '1',
  ADD COLUMN IF NOT EXISTS cnae text,
  ADD COLUMN IF NOT EXISTS regime_tributario text DEFAULT 'simples_nacional',
  ADD COLUMN IF NOT EXISTS codigo_ibge_municipio text,
  ADD COLUMN IF NOT EXISTS email_fiscal text,
  ADD COLUMN IF NOT EXISTS serie_padrao_nfe text DEFAULT '1',
  ADD COLUMN IF NOT EXISTS proximo_numero_nfe integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ambiente_padrao text DEFAULT 'homologacao';

-- =============================================
-- 6. Expand produtos
-- =============================================
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS gtin text,
  ADD COLUMN IF NOT EXISTS cest text,
  ADD COLUMN IF NOT EXISTS origem_mercadoria text DEFAULT '0',
  ADD COLUMN IF NOT EXISTS unidade_tributavel text,
  ADD COLUMN IF NOT EXISTS peso_bruto numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS peso_liquido numeric DEFAULT 0;

-- =============================================
-- 7. Indexes for performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_nf_eventos_nota_id ON public.nota_fiscal_eventos(nota_fiscal_id);
CREATE INDEX IF NOT EXISTS idx_nf_anexos_nota_id ON public.nota_fiscal_anexos(nota_fiscal_id);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_status_sefaz ON public.notas_fiscais(status_sefaz);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_origem ON public.notas_fiscais(origem);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_chave_acesso ON public.notas_fiscais(chave_acesso);
