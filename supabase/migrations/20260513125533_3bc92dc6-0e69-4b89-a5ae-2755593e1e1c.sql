-- ============================================================
-- NFS-e, CT-e e cadastro de Serviços
-- ============================================================

-- 1) Tabela servicos -----------------------------------------
CREATE TABLE IF NOT EXISTS public.servicos (
  id                          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id                  uuid NOT NULL DEFAULT current_empresa_id() REFERENCES public.empresas(id),
  codigo                      text,
  descricao                   text NOT NULL,
  unidade                     text NOT NULL DEFAULT 'UN',
  codigo_servico_lc116        text,
  codigo_tributacao_municipio text,
  aliquota_iss                numeric(5,4),
  tipo_tributacao_iss         integer NOT NULL DEFAULT 1,
  retencao_iss                boolean NOT NULL DEFAULT false,
  ativo                       boolean NOT NULL DEFAULT true,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_servicos_tipo_tributacao_iss CHECK (tipo_tributacao_iss BETWEEN 1 AND 6),
  CONSTRAINT chk_servicos_aliquota_iss CHECK (aliquota_iss IS NULL OR (aliquota_iss >= 0 AND aliquota_iss <= 1))
);

COMMENT ON TABLE public.servicos IS
  'Cadastro de servicos para uso em NFS-e e itens de servico em notas fiscais. Lista LC 116/2003.';

CREATE INDEX IF NOT EXISTS idx_servicos_empresa_id ON public.servicos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_servicos_descricao ON public.servicos(descricao);
CREATE INDEX IF NOT EXISTS idx_servicos_codigo_lc116 ON public.servicos(codigo_servico_lc116);
CREATE INDEX IF NOT EXISTS idx_servicos_ativo ON public.servicos(ativo);

ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "servicos_select" ON public.servicos;
DROP POLICY IF EXISTS "servicos_insert" ON public.servicos;
DROP POLICY IF EXISTS "servicos_update" ON public.servicos;
DROP POLICY IF EXISTS "servicos_delete" ON public.servicos;

CREATE POLICY "servicos_select" ON public.servicos
  FOR SELECT TO authenticated
  USING (empresa_id = current_empresa_id() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "servicos_insert" ON public.servicos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = current_empresa_id() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "servicos_update" ON public.servicos
  FOR UPDATE TO authenticated
  USING (empresa_id = current_empresa_id() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "servicos_delete" ON public.servicos
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_servicos_set_empresa ON public.servicos;
CREATE TRIGGER trg_servicos_set_empresa
  BEFORE INSERT ON public.servicos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_default();

DROP TRIGGER IF EXISTS trg_servicos_updated_at ON public.servicos;
CREATE TRIGGER trg_servicos_updated_at
  BEFORE UPDATE ON public.servicos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) notas_fiscais: tipo_documento + campos NFS-e/CT-e --------
ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS tipo_documento text NOT NULL DEFAULT 'nfe';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_notas_fiscais_tipo_documento'
  ) THEN
    ALTER TABLE public.notas_fiscais
      ADD CONSTRAINT chk_notas_fiscais_tipo_documento
      CHECK (tipo_documento IN ('nfe','nfce','nfse','cte','cte_os'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notas_fiscais_tipo_documento
  ON public.notas_fiscais(tipo_documento);

-- NFS-e
ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS nfse_numero_rps              text,
  ADD COLUMN IF NOT EXISTS nfse_serie_rps               text,
  ADD COLUMN IF NOT EXISTS nfse_data_competencia        date,
  ADD COLUMN IF NOT EXISTS nfse_codigo_servico_lc116    text,
  ADD COLUMN IF NOT EXISTS nfse_descricao_servico       text,
  ADD COLUMN IF NOT EXISTS nfse_aliquota_iss            numeric(5,4),
  ADD COLUMN IF NOT EXISTS nfse_valor_servicos          numeric(15,2),
  ADD COLUMN IF NOT EXISTS nfse_valor_deducoes          numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nfse_valor_base_calculo_iss  numeric(15,2),
  ADD COLUMN IF NOT EXISTS nfse_valor_iss               numeric(15,2),
  ADD COLUMN IF NOT EXISTS nfse_iss_retido              boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS nfse_natureza_operacao       integer,
  ADD COLUMN IF NOT EXISTS nfse_municipio_prestacao_cod text,
  ADD COLUMN IF NOT EXISTS nfse_municipio_prestacao     text,
  ADD COLUMN IF NOT EXISTS nfse_optante_simples         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS nfse_incentivador_cultural   boolean DEFAULT false;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_nfse_natureza_operacao'
  ) THEN
    ALTER TABLE public.notas_fiscais
      ADD CONSTRAINT chk_nfse_natureza_operacao
      CHECK (nfse_natureza_operacao IS NULL OR nfse_natureza_operacao BETWEEN 1 AND 6);
  END IF;
END $$;

-- CT-e
ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS cte_modal                    text,
  ADD COLUMN IF NOT EXISTS cte_tipo                     text DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS cte_cfop                     text,
  ADD COLUMN IF NOT EXISTS cte_natureza_operacao        text,
  ADD COLUMN IF NOT EXISTS cte_tomador_tipo             integer,
  ADD COLUMN IF NOT EXISTS cte_remetente_doc            text,
  ADD COLUMN IF NOT EXISTS cte_remetente_razao_social   text,
  ADD COLUMN IF NOT EXISTS cte_remetente_uf             text,
  ADD COLUMN IF NOT EXISTS cte_destinatario_doc         text,
  ADD COLUMN IF NOT EXISTS cte_destinatario_razao_social text,
  ADD COLUMN IF NOT EXISTS cte_destinatario_uf          text,
  ADD COLUMN IF NOT EXISTS cte_expedidor_doc            text,
  ADD COLUMN IF NOT EXISTS cte_expedidor_razao_social   text,
  ADD COLUMN IF NOT EXISTS cte_recebedor_doc            text,
  ADD COLUMN IF NOT EXISTS cte_recebedor_razao_social   text,
  ADD COLUMN IF NOT EXISTS cte_municipio_inicio_cod     text,
  ADD COLUMN IF NOT EXISTS cte_municipio_inicio         text,
  ADD COLUMN IF NOT EXISTS cte_municipio_inicio_uf      text,
  ADD COLUMN IF NOT EXISTS cte_municipio_fim_cod        text,
  ADD COLUMN IF NOT EXISTS cte_municipio_fim            text,
  ADD COLUMN IF NOT EXISTS cte_municipio_fim_uf         text,
  ADD COLUMN IF NOT EXISTS cte_valor_prestacao          numeric(15,2),
  ADD COLUMN IF NOT EXISTS cte_valor_receber            numeric(15,2),
  ADD COLUMN IF NOT EXISTS cte_produto_predominante     text,
  ADD COLUMN IF NOT EXISTS cte_quantidade               numeric(15,4),
  ADD COLUMN IF NOT EXISTS cte_unidade_medida           text,
  ADD COLUMN IF NOT EXISTS cte_chave_nfe_ref            text[],
  ADD COLUMN IF NOT EXISTS cte_dados_extras             jsonb DEFAULT '{}'::jsonb;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_cte_modal'
  ) THEN
    ALTER TABLE public.notas_fiscais
      ADD CONSTRAINT chk_cte_modal
      CHECK (cte_modal IS NULL OR cte_modal IN ('rodoviario','aereo','aquaviario','ferroviario','dutoviario','multimodal'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_cte_tipo'
  ) THEN
    ALTER TABLE public.notas_fiscais
      ADD CONSTRAINT chk_cte_tipo
      CHECK (cte_tipo IS NULL OR cte_tipo IN ('normal','complemento_valores','anulacao','substituto'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_cte_tomador_tipo'
  ) THEN
    ALTER TABLE public.notas_fiscais
      ADD CONSTRAINT chk_cte_tomador_tipo
      CHECK (cte_tomador_tipo IS NULL OR cte_tomador_tipo BETWEEN 0 AND 4);
  END IF;
END $$;

-- 3) notas_fiscais_itens: categoria + servico ----------------
ALTER TABLE public.notas_fiscais_itens
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'produto',
  ADD COLUMN IF NOT EXISTS servico_id uuid REFERENCES public.servicos(id),
  ADD COLUMN IF NOT EXISTS codigo_servico_lc116 text,
  ADD COLUMN IF NOT EXISTS aliquota_iss          numeric(5,4),
  ADD COLUMN IF NOT EXISTS valor_iss             numeric(15,2);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_notas_fiscais_itens_categoria'
  ) THEN
    ALTER TABLE public.notas_fiscais_itens
      ADD CONSTRAINT chk_notas_fiscais_itens_categoria
      CHECK (categoria IN ('produto','insumo','servico','frete'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notas_fiscais_itens_categoria
  ON public.notas_fiscais_itens(categoria);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_itens_servico
  ON public.notas_fiscais_itens(servico_id) WHERE servico_id IS NOT NULL;

COMMENT ON COLUMN public.notas_fiscais_itens.categoria IS
  'produto=mercadoria fisica, insumo=materia-prima, servico=servico (NFS-e), frete=componente CT-e';

-- 4) RPCs financeiras NFS-e e CT-e ---------------------------

CREATE OR REPLACE FUNCTION public.confirmar_nfse(p_nota_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nf            public.notas_fiscais;
  v_fornecedor    text;
  v_valor_liquido numeric(15,2);
  v_lanc_id       uuid;
  v_darf_id       uuid;
  v_data_venc     date;
BEGIN
  SELECT * INTO v_nf FROM public.notas_fiscais WHERE id = p_nota_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nota fiscal % nao encontrada', p_nota_id; END IF;
  IF v_nf.tipo_documento <> 'nfse' THEN
    RAISE EXCEPTION 'Nota % nao e NFS-e (tipo_documento=%)', p_nota_id, v_nf.tipo_documento;
  END IF;

  SELECT nome_razao_social INTO v_fornecedor
    FROM public.fornecedores WHERE id = v_nf.fornecedor_id;

  v_valor_liquido := COALESCE(v_nf.nfse_valor_servicos, v_nf.valor_total, 0)
                     - CASE WHEN COALESCE(v_nf.nfse_iss_retido, false)
                            THEN COALESCE(v_nf.nfse_valor_iss, 0) ELSE 0 END;

  v_data_venc := COALESCE(v_nf.data_vencimento, v_nf.data_emissao + COALESCE(v_nf.intervalo_parcelas_dias, 30));

  IF COALESCE(v_nf.gera_financeiro, true) AND v_valor_liquido > 0 THEN
    INSERT INTO public.financeiro_lancamentos (
      tipo, descricao, valor, data_vencimento, fornecedor_id,
      origem, referencia_id, status
    ) VALUES (
      'pagar',
      'NFS-e ' || COALESCE(v_nf.numero,'s/n') || ' - ' || COALESCE(v_fornecedor,'sem fornecedor'),
      v_valor_liquido, v_data_venc, v_nf.fornecedor_id,
      'nfse', v_nf.id, 'pendente'
    ) RETURNING id INTO v_lanc_id;
  END IF;

  IF COALESCE(v_nf.nfse_iss_retido, false) AND COALESCE(v_nf.nfse_valor_iss, 0) > 0 THEN
    INSERT INTO public.financeiro_lancamentos (
      tipo, descricao, valor, data_vencimento, fornecedor_id,
      origem, referencia_id, status
    ) VALUES (
      'pagar',
      'DARF ISS retido - NFS-e ' || COALESCE(v_nf.numero,'s/n'),
      v_nf.nfse_valor_iss,
      (date_trunc('month', v_nf.data_emissao) + INTERVAL '2 month - 1 day')::date,
      v_nf.fornecedor_id,
      'nfse_iss_retido', v_nf.id, 'pendente'
    ) RETURNING id INTO v_darf_id;
  END IF;

  UPDATE public.notas_fiscais
     SET status = 'confirmada', updated_at = now()
   WHERE id = p_nota_id;

  RETURN v_lanc_id;
END $$;

CREATE OR REPLACE FUNCTION public.confirmar_cte(p_nota_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nf       public.notas_fiscais;
  v_lanc_id  uuid;
  v_chave    text;
  v_total_nfes numeric(15,2);
  v_valor_nfe  numeric(15,2);
  v_rateio     numeric(15,2);
BEGIN
  SELECT * INTO v_nf FROM public.notas_fiscais WHERE id = p_nota_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nota % nao encontrada', p_nota_id; END IF;
  IF v_nf.tipo_documento <> 'cte' THEN
    RAISE EXCEPTION 'Nota % nao e CT-e', p_nota_id;
  END IF;

  IF COALESCE(v_nf.gera_financeiro, true) AND COALESCE(v_nf.cte_valor_receber, 0) > 0 THEN
    INSERT INTO public.financeiro_lancamentos (
      tipo, descricao, valor, data_vencimento, fornecedor_id,
      origem, referencia_id, status
    ) VALUES (
      'pagar',
      'CT-e ' || COALESCE(v_nf.numero,'s/n') || ' - '
        || COALESCE(v_nf.cte_remetente_razao_social,'?')
        || ' -> ' || COALESCE(v_nf.cte_destinatario_razao_social,'?'),
      v_nf.cte_valor_receber,
      COALESCE(v_nf.data_vencimento, v_nf.data_emissao + COALESCE(v_nf.intervalo_parcelas_dias,30)),
      v_nf.fornecedor_id,
      'cte', v_nf.id, 'pendente'
    ) RETURNING id INTO v_lanc_id;
  END IF;

  -- Rateio do valor da prestacao entre NF-e referenciadas (proporcional ao valor_total)
  IF v_nf.cte_chave_nfe_ref IS NOT NULL AND array_length(v_nf.cte_chave_nfe_ref, 1) > 0
     AND COALESCE(v_nf.cte_valor_prestacao, 0) > 0 THEN
    SELECT COALESCE(SUM(valor_total), 0) INTO v_total_nfes
      FROM public.notas_fiscais
     WHERE chave_acesso = ANY(v_nf.cte_chave_nfe_ref);

    IF v_total_nfes > 0 THEN
      FOREACH v_chave IN ARRAY v_nf.cte_chave_nfe_ref LOOP
        SELECT valor_total INTO v_valor_nfe
          FROM public.notas_fiscais
         WHERE chave_acesso = v_chave LIMIT 1;
        IF FOUND AND v_valor_nfe > 0 THEN
          v_rateio := ROUND(v_nf.cte_valor_prestacao * (v_valor_nfe / v_total_nfes), 2);
          UPDATE public.notas_fiscais
             SET frete_valor = COALESCE(frete_valor, 0) + v_rateio,
                 updated_at = now()
           WHERE chave_acesso = v_chave;
        END IF;
      END LOOP;
    END IF;
  END IF;

  UPDATE public.notas_fiscais
     SET status = 'confirmada', updated_at = now()
   WHERE id = p_nota_id;

  RETURN v_lanc_id;
END $$;

GRANT EXECUTE ON FUNCTION public.confirmar_nfse(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_cte(uuid)  TO authenticated;
