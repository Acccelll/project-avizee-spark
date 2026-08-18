-- Roadmap fiscal CT-e / NFS-e
-- Integração segura: importação/recebimento não confirma documentos automaticamente.

ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS cte_tomador_outros_doc text,
  ADD COLUMN IF NOT EXISTS cte_tomador_outros_razao_social text,
  ADD COLUMN IF NOT EXISTS cte_icms_cst text,
  ADD COLUMN IF NOT EXISTS cte_icms_base numeric(15,2),
  ADD COLUMN IF NOT EXISTS cte_icms_aliquota numeric(9,6),
  ADD COLUMN IF NOT EXISTS cte_icms_valor numeric(15,2),
  ADD COLUMN IF NOT EXISTS nfse_nbs text,
  ADD COLUMN IF NOT EXISTS nfse_dados_extras jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS nfse_layout_origem text,
  ADD COLUMN IF NOT EXISTS nfse_versao_layout text,
  ADD COLUMN IF NOT EXISTS nfse_provedor_origem text,
  ADD COLUMN IF NOT EXISTS nfse_valor_iss_informado numeric(15,2),
  ADD COLUMN IF NOT EXISTS nfse_valor_iss_calculado numeric(15,2),
  ADD COLUMN IF NOT EXISTS nfse_ibscbs_dados jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.nfse_retencoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_fiscal_id uuid NOT NULL REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
  tributo text NOT NULL,
  base_calculo numeric(15,2) NOT NULL DEFAULT 0,
  aliquota numeric(9,6),
  valor numeric(15,2) NOT NULL DEFAULT 0,
  retido boolean NOT NULL DEFAULT true,
  reduz_valor_fornecedor boolean NOT NULL DEFAULT true,
  responsavel_recolhimento text NOT NULL DEFAULT 'empresa',
  beneficiario_tipo text,
  beneficiario_identificador text,
  municipio_codigo text,
  vencimento date,
  status text NOT NULL DEFAULT 'rascunho',
  origem text NOT NULL DEFAULT 'manual',
  documento_complementar jsonb NOT NULL DEFAULT '{}'::jsonb,
  empresa_id uuid NOT NULL DEFAULT current_empresa_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_nfse_retencao_tributo CHECK (tributo IN ('ISS','INSS','IRRF','PIS','COFINS','CSLL','IBS','CBS','OUTRO')),
  CONSTRAINT chk_nfse_retencao_status CHECK (status IN ('rascunho','confirmada','estornada','cancelada')),
  CONSTRAINT chk_nfse_retencao_responsavel CHECK (responsavel_recolhimento IN ('empresa','fornecedor','terceiro','nao_aplicavel')),
  CONSTRAINT chk_nfse_retencao_valores CHECK (base_calculo >= 0 AND valor >= 0 AND (aliquota IS NULL OR aliquota >= 0))
);
CREATE INDEX IF NOT EXISTS idx_nfse_retencoes_nota ON public.nfse_retencoes(nota_fiscal_id);
CREATE INDEX IF NOT EXISTS idx_nfse_retencoes_empresa_status ON public.nfse_retencoes(empresa_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_nfse_retencao_ativa
  ON public.nfse_retencoes(nota_fiscal_id, tributo, COALESCE(beneficiario_identificador,''))
  WHERE status IN ('rascunho','confirmada');
ALTER TABLE public.nfse_retencoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nfse_retencoes_empresa_select ON public.nfse_retencoes;
DROP POLICY IF EXISTS nfse_retencoes_empresa_insert ON public.nfse_retencoes;
DROP POLICY IF EXISTS nfse_retencoes_empresa_update ON public.nfse_retencoes;
DROP POLICY IF EXISTS nfse_retencoes_empresa_delete ON public.nfse_retencoes;
CREATE POLICY nfse_retencoes_empresa_select ON public.nfse_retencoes FOR SELECT TO authenticated
  USING (empresa_id = current_empresa_id());
CREATE POLICY nfse_retencoes_empresa_insert ON public.nfse_retencoes FOR INSERT TO authenticated
  WITH CHECK (empresa_id = current_empresa_id());
CREATE POLICY nfse_retencoes_empresa_update ON public.nfse_retencoes FOR UPDATE TO authenticated
  USING (empresa_id = current_empresa_id()) WITH CHECK (empresa_id = current_empresa_id());
CREATE POLICY nfse_retencoes_empresa_delete ON public.nfse_retencoes FOR DELETE TO authenticated
  USING (empresa_id = current_empresa_id());

CREATE TABLE IF NOT EXISTS public.cte_nfe_referencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cte_id uuid NOT NULL REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
  nfe_chave text NOT NULL,
  nfe_id uuid REFERENCES public.notas_fiscais(id) ON DELETE SET NULL,
  status_vinculo text NOT NULL DEFAULT 'nao_localizada',
  origem text NOT NULL DEFAULT 'documento',
  empresa_id uuid NOT NULL DEFAULT current_empresa_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_cte_ref_status CHECK (status_vinculo IN ('localizada','nao_localizada','divergente')),
  CONSTRAINT chk_cte_ref_chave CHECK (nfe_chave ~ '^[0-9]{44}$'),
  CONSTRAINT uq_cte_ref UNIQUE (cte_id, nfe_chave)
);
CREATE INDEX IF NOT EXISTS idx_cte_ref_chave ON public.cte_nfe_referencias(nfe_chave);
CREATE INDEX IF NOT EXISTS idx_cte_ref_nfe ON public.cte_nfe_referencias(nfe_id);
CREATE INDEX IF NOT EXISTS idx_cte_ref_pendente ON public.cte_nfe_referencias(empresa_id, status_vinculo)
  WHERE status_vinculo <> 'localizada';
ALTER TABLE public.cte_nfe_referencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cte_ref_empresa_select ON public.cte_nfe_referencias;
DROP POLICY IF EXISTS cte_ref_empresa_write ON public.cte_nfe_referencias;
CREATE POLICY cte_ref_empresa_select ON public.cte_nfe_referencias FOR SELECT TO authenticated
  USING (empresa_id = current_empresa_id());
CREATE POLICY cte_ref_empresa_write ON public.cte_nfe_referencias FOR ALL TO authenticated
  USING (empresa_id = current_empresa_id()) WITH CHECK (empresa_id = current_empresa_id());

CREATE TABLE IF NOT EXISTS public.cte_rateios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cte_id uuid NOT NULL REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
  nfe_id uuid NOT NULL REFERENCES public.notas_fiscais(id) ON DELETE RESTRICT,
  referencia_id uuid REFERENCES public.cte_nfe_referencias(id) ON DELETE SET NULL,
  valor_base_nfe numeric(15,2) NOT NULL DEFAULT 0,
  valor_total_rateio numeric(15,2) NOT NULL DEFAULT 0,
  percentual_rateio numeric(18,10) NOT NULL DEFAULT 0,
  valor_rateado numeric(15,2) NOT NULL DEFAULT 0,
  criterio text NOT NULL DEFAULT 'valor_documento',
  status text NOT NULL DEFAULT 'ativo',
  confirmado_em timestamptz NOT NULL DEFAULT now(),
  estornado_em timestamptz,
  empresa_id uuid NOT NULL DEFAULT current_empresa_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_cte_rateio_status CHECK (status IN ('ativo','estornado','cancelado')),
  CONSTRAINT chk_cte_rateio_criterio CHECK (criterio IN ('valor_documento','peso','quantidade','manual')),
  CONSTRAINT chk_cte_rateio_valores CHECK (valor_base_nfe >= 0 AND valor_total_rateio >= 0 AND percentual_rateio >= 0 AND valor_rateado >= 0)
);
CREATE INDEX IF NOT EXISTS idx_cte_rateios_cte ON public.cte_rateios(cte_id);
CREATE INDEX IF NOT EXISTS idx_cte_rateios_nfe ON public.cte_rateios(nfe_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cte_rateio_ativo_nfe ON public.cte_rateios(cte_id, nfe_id) WHERE status = 'ativo';
ALTER TABLE public.cte_rateios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cte_rateios_empresa_select ON public.cte_rateios;
DROP POLICY IF EXISTS cte_rateios_empresa_write ON public.cte_rateios;
CREATE POLICY cte_rateios_empresa_select ON public.cte_rateios FOR SELECT TO authenticated
  USING (empresa_id = current_empresa_id());
CREATE POLICY cte_rateios_empresa_write ON public.cte_rateios FOR ALL TO authenticated
  USING (empresa_id = current_empresa_id()) WITH CHECK (empresa_id = current_empresa_id());

-- Caixa de entrada e cursor próprios do CT-e: nunca compartilham NSU com NF-e.
CREATE TABLE IF NOT EXISTS public.cte_distribuicao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nsu text,
  chave_acesso text NOT NULL,
  schema_documento text,
  xml_path text,
  resumo jsonb NOT NULL DEFAULT '{}'::jsonb,
  status_processamento text NOT NULL DEFAULT 'recebido',
  nota_fiscal_id uuid REFERENCES public.notas_fiscais(id) ON DELETE SET NULL,
  erro text,
  ambiente text NOT NULL DEFAULT '1',
  empresa_id uuid NOT NULL DEFAULT current_empresa_id(),
  recebido_em timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_cte_dist_status CHECK (status_processamento IN ('recebido','processado','divergente','erro','ignorado')),
  CONSTRAINT chk_cte_dist_ambiente CHECK (ambiente IN ('1','2')),
  CONSTRAINT chk_cte_dist_chave CHECK (chave_acesso ~ '^[0-9]{44}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cte_distribuicao_empresa_chave ON public.cte_distribuicao(empresa_id, chave_acesso);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cte_distribuicao_empresa_nsu ON public.cte_distribuicao(empresa_id, ambiente, nsu) WHERE nsu IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cte_distribuicao_status ON public.cte_distribuicao(empresa_id, status_processamento, recebido_em DESC);
ALTER TABLE public.cte_distribuicao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cte_dist_empresa_select ON public.cte_distribuicao;
DROP POLICY IF EXISTS cte_dist_empresa_write ON public.cte_distribuicao;
CREATE POLICY cte_dist_empresa_select ON public.cte_distribuicao FOR SELECT TO authenticated
  USING (empresa_id = current_empresa_id());
CREATE POLICY cte_dist_empresa_write ON public.cte_distribuicao FOR ALL TO authenticated
  USING (empresa_id = current_empresa_id()) WITH CHECK (empresa_id = current_empresa_id());

CREATE TABLE IF NOT EXISTS public.cte_distdfe_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT current_empresa_id(),
  ambiente text NOT NULL DEFAULT '1',
  ultimo_nsu text NOT NULL DEFAULT '0',
  max_nsu text NOT NULL DEFAULT '0',
  ultima_sincronizacao timestamptz,
  bloqueado_ate timestamptz,
  ultimo_cstat text,
  ultimo_motivo text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_cte_sync_ambiente CHECK (ambiente IN ('1','2')),
  CONSTRAINT uq_cte_sync_empresa_amb UNIQUE (empresa_id, ambiente)
);
ALTER TABLE public.cte_distdfe_sync ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cte_sync_empresa_select ON public.cte_distdfe_sync;
DROP POLICY IF EXISTS cte_sync_empresa_write ON public.cte_distdfe_sync;
CREATE POLICY cte_sync_empresa_select ON public.cte_distdfe_sync FOR SELECT TO authenticated
  USING (empresa_id = current_empresa_id());
CREATE POLICY cte_sync_empresa_write ON public.cte_distdfe_sync FOR ALL TO authenticated
  USING (empresa_id = current_empresa_id()) WITH CHECK (empresa_id = current_empresa_id());

CREATE OR REPLACE FUNCTION public.sincronizar_cte_nfe_referencias(p_cte_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_nf public.notas_fiscais%ROWTYPE;
  v_chave text;
  v_nfe_id uuid;
  v_count integer := 0;
BEGIN
  SELECT * INTO v_nf FROM public.notas_fiscais WHERE id = p_cte_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento % não encontrado', p_cte_id; END IF;
  IF v_nf.tipo_documento NOT IN ('cte','cte_os') THEN RETURN 0; END IF;

  IF v_nf.cte_chave_nfe_ref IS NULL OR array_length(v_nf.cte_chave_nfe_ref,1) IS NULL THEN
    DELETE FROM public.cte_nfe_referencias r
      WHERE r.cte_id = p_cte_id
        AND NOT EXISTS (SELECT 1 FROM public.cte_rateios cr WHERE cr.referencia_id = r.id AND cr.status = 'ativo');
    RETURN 0;
  END IF;

  DELETE FROM public.cte_nfe_referencias r
    WHERE r.cte_id = p_cte_id
      AND NOT (r.nfe_chave = ANY(v_nf.cte_chave_nfe_ref))
      AND NOT EXISTS (SELECT 1 FROM public.cte_rateios cr WHERE cr.referencia_id = r.id AND cr.status = 'ativo');

  FOREACH v_chave IN ARRAY v_nf.cte_chave_nfe_ref LOOP
    v_chave := regexp_replace(COALESCE(v_chave,''),'\D','','g');
    IF length(v_chave) <> 44 THEN CONTINUE; END IF;
    SELECT n.id INTO v_nfe_id
      FROM public.notas_fiscais n
     WHERE n.chave_acesso = v_chave
       AND n.empresa_id = v_nf.empresa_id
       AND n.tipo_documento IN ('nfe','nfce')
     ORDER BY n.created_at DESC LIMIT 1;

    INSERT INTO public.cte_nfe_referencias(cte_id,nfe_chave,nfe_id,status_vinculo,origem,empresa_id,updated_at)
    VALUES(p_cte_id,v_chave,v_nfe_id,CASE WHEN v_nfe_id IS NULL THEN 'nao_localizada' ELSE 'localizada' END,'documento',v_nf.empresa_id,now())
    ON CONFLICT(cte_id,nfe_chave) DO UPDATE SET
      nfe_id = EXCLUDED.nfe_id,
      status_vinculo = EXCLUDED.status_vinculo,
      updated_at = now();
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.aplicar_rateio_cte(p_cte_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_cte public.notas_fiscais%ROWTYPE;
  v_ref record;
  v_total_base numeric(18,2) := 0;
  v_total_rateio numeric(18,2) := 0;
  v_acumulado numeric(18,2) := 0;
  v_qtd integer := 0;
  v_idx integer := 0;
  v_valor numeric(18,2);
  v_percentual numeric(18,10);
BEGIN
  SELECT * INTO v_cte FROM public.notas_fiscais WHERE id = p_cte_id FOR UPDATE;
  IF NOT FOUND OR v_cte.tipo_documento NOT IN ('cte','cte_os') THEN RETURN 0; END IF;

  IF EXISTS(SELECT 1 FROM public.cte_rateios WHERE cte_id = p_cte_id AND status = 'ativo') THEN
    SELECT count(*) INTO v_qtd FROM public.cte_rateios WHERE cte_id = p_cte_id AND status = 'ativo';
    RETURN v_qtd;
  END IF;

  PERFORM public.sincronizar_cte_nfe_referencias(p_cte_id);
  -- Fail closed: nunca redistribui a parcela de uma NF-e ainda não localizada.
  IF EXISTS(SELECT 1 FROM public.cte_nfe_referencias WHERE cte_id = p_cte_id AND status_vinculo <> 'localizada') THEN
    RETURN 0;
  END IF;

  SELECT count(*), COALESCE(sum(COALESCE(n.valor_total,0)),0)
    INTO v_qtd, v_total_base
    FROM public.cte_nfe_referencias r
    JOIN public.notas_fiscais n ON n.id = r.nfe_id
   WHERE r.cte_id = p_cte_id AND r.status_vinculo = 'localizada';
  IF v_qtd = 0 OR v_total_base <= 0 THEN RETURN 0; END IF;

  v_total_rateio := COALESCE(v_cte.cte_valor_prestacao,v_cte.valor_total,0);
  IF v_total_rateio <= 0 THEN RETURN 0; END IF;

  FOR v_ref IN
    SELECT r.id AS referencia_id,r.nfe_id,n.valor_total
      FROM public.cte_nfe_referencias r
      JOIN public.notas_fiscais n ON n.id = r.nfe_id
     WHERE r.cte_id = p_cte_id AND r.status_vinculo = 'localizada'
     ORDER BY r.id
  LOOP
    v_idx := v_idx + 1;
    v_percentual := COALESCE(v_ref.valor_total,0) / v_total_base;
    IF v_idx = v_qtd THEN
      v_valor := round(v_total_rateio - v_acumulado,2);
    ELSE
      v_valor := round(v_total_rateio * v_percentual,2);
      v_acumulado := v_acumulado + v_valor;
    END IF;

    INSERT INTO public.cte_rateios(cte_id,nfe_id,referencia_id,valor_base_nfe,valor_total_rateio,percentual_rateio,valor_rateado,criterio,status,empresa_id)
    VALUES(p_cte_id,v_ref.nfe_id,v_ref.referencia_id,COALESCE(v_ref.valor_total,0),v_total_rateio,v_percentual,v_valor,'valor_documento','ativo',v_cte.empresa_id);
    UPDATE public.notas_fiscais
       SET frete_valor = COALESCE(frete_valor,0) + v_valor, updated_at = now()
     WHERE id = v_ref.nfe_id;
  END LOOP;
  RETURN v_qtd;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reprocessar_cte_referencias_por_chave(p_chave text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_chave text := regexp_replace(COALESCE(p_chave,''),'\D','','g');
  v_ref record;
  v_nfe_id uuid;
  v_count integer := 0;
BEGIN
  IF length(v_chave) <> 44 THEN RETURN 0; END IF;
  SELECT id INTO v_nfe_id FROM public.notas_fiscais
   WHERE chave_acesso = v_chave AND tipo_documento IN ('nfe','nfce')
   ORDER BY created_at DESC LIMIT 1;
  IF v_nfe_id IS NULL THEN RETURN 0; END IF;

  FOR v_ref IN
    UPDATE public.cte_nfe_referencias
       SET nfe_id = v_nfe_id, status_vinculo = 'localizada', updated_at = now()
     WHERE nfe_chave = v_chave AND (nfe_id IS NULL OR status_vinculo <> 'localizada')
     RETURNING cte_id
  LOOP
    v_count := v_count + 1;
    IF EXISTS(SELECT 1 FROM public.notas_fiscais WHERE id = v_ref.cte_id AND status = 'confirmada') THEN
      PERFORM public.aplicar_rateio_cte(v_ref.cte_id);
    END IF;
  END LOOP;
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_reprocessar_cte_ref_nfe()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.tipo_documento IN ('nfe','nfce') AND NEW.chave_acesso IS NOT NULL
     AND length(regexp_replace(NEW.chave_acesso,'\D','','g')) = 44 THEN
    PERFORM public.reprocessar_cte_referencias_por_chave(NEW.chave_acesso);
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS trg_reprocessar_cte_ref_nfe ON public.notas_fiscais;
CREATE TRIGGER trg_reprocessar_cte_ref_nfe
  AFTER INSERT OR UPDATE OF chave_acesso,tipo_documento ON public.notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.trg_reprocessar_cte_ref_nfe();

-- Extensão transacional do salvar_nota_fiscal existente. Payloads complexos via JSON-string
-- evitam acoplar o estado do formulário aos tipos gerados antes da migration.
CREATE OR REPLACE FUNCTION public.salvar_metadados_documento_fiscal(p_nf_id uuid,p_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_nf public.notas_fiscais%ROWTYPE;
  v_ret jsonb;
  v_retencoes jsonb;
BEGIN
  SELECT * INTO v_nf FROM public.notas_fiscais WHERE id = p_nf_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento fiscal % não encontrado',p_nf_id; END IF;

  UPDATE public.notas_fiscais SET
    cte_tomador_outros_doc = CASE WHEN p_payload?'cte_tomador_outros_doc' THEN NULLIF(p_payload->>'cte_tomador_outros_doc','') ELSE cte_tomador_outros_doc END,
    cte_tomador_outros_razao_social = CASE WHEN p_payload?'cte_tomador_outros_razao_social' THEN NULLIF(p_payload->>'cte_tomador_outros_razao_social','') ELSE cte_tomador_outros_razao_social END,
    cte_icms_cst = CASE WHEN p_payload?'cte_icms_cst' THEN NULLIF(p_payload->>'cte_icms_cst','') ELSE cte_icms_cst END,
    cte_icms_base = CASE WHEN p_payload?'cte_icms_base' THEN NULLIF(p_payload->>'cte_icms_base','')::numeric ELSE cte_icms_base END,
    cte_icms_aliquota = CASE WHEN p_payload?'cte_icms_aliquota' THEN NULLIF(p_payload->>'cte_icms_aliquota','')::numeric ELSE cte_icms_aliquota END,
    cte_icms_valor = CASE WHEN p_payload?'cte_icms_valor' THEN NULLIF(p_payload->>'cte_icms_valor','')::numeric ELSE cte_icms_valor END,
    cte_dados_extras = CASE WHEN p_payload?'cte_dados_extras_json' THEN COALESCE(NULLIF(p_payload->>'cte_dados_extras_json','')::jsonb,'{}'::jsonb) ELSE cte_dados_extras END,
    nfse_nbs = CASE WHEN p_payload?'nfse_nbs' THEN NULLIF(p_payload->>'nfse_nbs','') ELSE nfse_nbs END,
    nfse_dados_extras = CASE WHEN p_payload?'nfse_dados_extras_json' THEN COALESCE(NULLIF(p_payload->>'nfse_dados_extras_json','')::jsonb,'{}'::jsonb) ELSE nfse_dados_extras END,
    nfse_layout_origem = CASE WHEN p_payload?'nfse_layout_origem' THEN NULLIF(p_payload->>'nfse_layout_origem','') ELSE nfse_layout_origem END,
    nfse_versao_layout = CASE WHEN p_payload?'nfse_versao_layout' THEN NULLIF(p_payload->>'nfse_versao_layout','') ELSE nfse_versao_layout END,
    nfse_provedor_origem = CASE WHEN p_payload?'nfse_provedor_origem' THEN NULLIF(p_payload->>'nfse_provedor_origem','') ELSE nfse_provedor_origem END,
    nfse_valor_iss_informado = CASE WHEN p_payload?'nfse_valor_iss_informado' THEN NULLIF(p_payload->>'nfse_valor_iss_informado','')::numeric ELSE nfse_valor_iss_informado END,
    nfse_valor_iss_calculado = CASE WHEN p_payload?'nfse_valor_iss_calculado' THEN NULLIF(p_payload->>'nfse_valor_iss_calculado','')::numeric ELSE nfse_valor_iss_calculado END,
    nfse_ibscbs_dados = CASE WHEN p_payload?'nfse_ibscbs_json' THEN COALESCE(NULLIF(p_payload->>'nfse_ibscbs_json','')::jsonb,'{}'::jsonb) ELSE nfse_ibscbs_dados END,
    updated_at = now()
  WHERE id = p_nf_id;

  IF v_nf.tipo_documento IN ('cte','cte_os') THEN
    PERFORM public.sincronizar_cte_nfe_referencias(p_nf_id);
  END IF;

  IF v_nf.tipo_documento = 'nfse' AND p_payload?'nfse_retencoes_json' THEN
    IF v_nf.status = 'confirmada' THEN
      RAISE EXCEPTION 'Retenções de NFS-e confirmada não podem ser substituídas sem estorno';
    END IF;
    v_retencoes := COALESCE(NULLIF(p_payload->>'nfse_retencoes_json','')::jsonb,'[]'::jsonb);
    IF jsonb_typeof(v_retencoes) <> 'array' THEN RAISE EXCEPTION 'nfse_retencoes_json deve ser um array JSON'; END IF;
    DELETE FROM public.nfse_retencoes WHERE nota_fiscal_id = p_nf_id AND status = 'rascunho';

    FOR v_ret IN SELECT value FROM jsonb_array_elements(v_retencoes) LOOP
      IF COALESCE(NULLIF(upper(v_ret->>'tributo'),''),'') = '' THEN CONTINUE; END IF;
      INSERT INTO public.nfse_retencoes(
        nota_fiscal_id,tributo,base_calculo,aliquota,valor,retido,reduz_valor_fornecedor,
        responsavel_recolhimento,beneficiario_tipo,beneficiario_identificador,municipio_codigo,
        vencimento,status,origem,documento_complementar,empresa_id
      ) VALUES(
        p_nf_id,upper(v_ret->>'tributo'),COALESCE(NULLIF(v_ret->>'base_calculo','')::numeric,0),
        NULLIF(v_ret->>'aliquota','')::numeric,COALESCE(NULLIF(v_ret->>'valor','')::numeric,0),
        COALESCE((v_ret->>'retido')::boolean,true),COALESCE((v_ret->>'reduz_valor_fornecedor')::boolean,true),
        COALESCE(NULLIF(v_ret->>'responsavel_recolhimento',''),'empresa'),NULLIF(v_ret->>'beneficiario_tipo',''),
        NULLIF(v_ret->>'beneficiario_identificador',''),NULLIF(v_ret->>'municipio_codigo',''),
        NULLIF(v_ret->>'vencimento','')::date,'rascunho',
        COALESCE(NULLIF(v_ret->>'origem',''),CASE WHEN v_nf.origem='xml_importado' THEN 'xml' ELSE 'manual' END),
        COALESCE(v_ret->'documento_complementar','{}'::jsonb),v_nf.empresa_id
      );
    END LOOP;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.salvar_documento_fiscal_completo(p_nf_id uuid,p_payload jsonb,p_itens jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_id uuid;
BEGIN
  v_id := public.salvar_nota_fiscal(p_nf_id,p_payload,p_itens);
  PERFORM public.salvar_metadados_documento_fiscal(v_id,p_payload);
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.listar_nfse_retencoes(p_nota_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',id,'tributo',tributo,'base_calculo',base_calculo,'aliquota',aliquota,'valor',valor,
    'retido',retido,'reduz_valor_fornecedor',reduz_valor_fornecedor,
    'responsavel_recolhimento',responsavel_recolhimento,'beneficiario_tipo',beneficiario_tipo,
    'beneficiario_identificador',beneficiario_identificador,'municipio_codigo',municipio_codigo,
    'vencimento',vencimento,'status',status,'origem',origem
  ) ORDER BY created_at),'[]'::jsonb)
  FROM public.nfse_retencoes WHERE nota_fiscal_id = p_nota_id AND status <> 'cancelada';
$function$;

CREATE OR REPLACE FUNCTION public.listar_cte_referencias(p_cte_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',r.id,'chave',r.nfe_chave,'status',r.status_vinculo,'nfe_id',r.nfe_id,
    'numero',n.numero,'serie',n.serie,'valor_total',n.valor_total,'frete_valor',n.frete_valor
  ) ORDER BY r.created_at),'[]'::jsonb)
  FROM public.cte_nfe_referencias r
  LEFT JOIN public.notas_fiscais n ON n.id = r.nfe_id
  WHERE r.cte_id = p_cte_id;
$function$;

CREATE OR REPLACE FUNCTION public.confirmar_nfse(p_nota_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_nf public.notas_fiscais%ROWTYPE;
  v_fornecedor text;
  v_bruto numeric(15,2);
  v_reducoes numeric(15,2);
  v_liquido numeric(15,2);
  v_lanc_id uuid;
  v_data_venc date;
  v_ret record;
  v_ret_fin uuid;
BEGIN
  SELECT * INTO v_nf FROM public.notas_fiscais WHERE id = p_nota_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nota fiscal % não encontrada',p_nota_id; END IF;
  IF v_nf.tipo_documento <> 'nfse' THEN RAISE EXCEPTION 'Nota % não é NFS-e (tipo_documento=%)',p_nota_id,v_nf.tipo_documento; END IF;

  IF v_nf.status = 'confirmada' THEN
    SELECT id INTO v_lanc_id FROM public.financeiro_lancamentos
     WHERE nota_fiscal_id = p_nota_id AND origem_tabela = 'notas_fiscais'
       AND ativo = true AND status <> 'cancelado' ORDER BY created_at LIMIT 1;
    RETURN v_lanc_id;
  END IF;

  PERFORM set_config('app.nf_internal_op','1',true);
  SELECT nome_razao_social INTO v_fornecedor FROM public.fornecedores WHERE id = v_nf.fornecedor_id;
  v_bruto := COALESCE(v_nf.nfse_valor_servicos,v_nf.valor_total,0);
  v_data_venc := COALESCE(v_nf.data_vencimento,COALESCE(v_nf.data_emissao,CURRENT_DATE)+COALESCE(v_nf.intervalo_parcelas_dias,30));

  -- Reconfirmação preserva o histórico estornado e recria o conjunto operacional.
  IF NOT EXISTS(SELECT 1 FROM public.nfse_retencoes WHERE nota_fiscal_id=p_nota_id AND status IN ('rascunho','confirmada'))
     AND EXISTS(SELECT 1 FROM public.nfse_retencoes WHERE nota_fiscal_id=p_nota_id AND status='estornada') THEN
    INSERT INTO public.nfse_retencoes(
      nota_fiscal_id,tributo,base_calculo,aliquota,valor,retido,reduz_valor_fornecedor,
      responsavel_recolhimento,beneficiario_tipo,beneficiario_identificador,municipio_codigo,
      vencimento,status,origem,documento_complementar,empresa_id
    )
    SELECT r.nota_fiscal_id,r.tributo,r.base_calculo,r.aliquota,r.valor,r.retido,r.reduz_valor_fornecedor,
      r.responsavel_recolhimento,r.beneficiario_tipo,r.beneficiario_identificador,r.municipio_codigo,
      r.vencimento,'rascunho','reconfirmacao',r.documento_complementar,r.empresa_id
      FROM public.nfse_retencoes r
     WHERE r.nota_fiscal_id=p_nota_id AND r.status='estornada'
       AND r.created_at=(SELECT max(r2.created_at) FROM public.nfse_retencoes r2
         WHERE r2.nota_fiscal_id=r.nota_fiscal_id AND r2.tributo=r.tributo AND r2.status='estornada');
  END IF;

  -- Compatibilidade com NFS-e legada ainda sem ledger de retenções.
  IF COALESCE(v_nf.nfse_iss_retido,false) AND COALESCE(v_nf.nfse_valor_iss,0)>0
     AND NOT EXISTS(SELECT 1 FROM public.nfse_retencoes WHERE nota_fiscal_id=p_nota_id AND tributo='ISS' AND status IN ('rascunho','confirmada')) THEN
    INSERT INTO public.nfse_retencoes(
      nota_fiscal_id,tributo,base_calculo,aliquota,valor,retido,reduz_valor_fornecedor,
      responsavel_recolhimento,municipio_codigo,status,origem,empresa_id
    ) VALUES(
      p_nota_id,'ISS',COALESCE(v_nf.nfse_valor_base_calculo_iss,v_bruto),v_nf.nfse_aliquota_iss,
      v_nf.nfse_valor_iss,true,true,'empresa',v_nf.nfse_municipio_prestacao_cod,'rascunho','legado',v_nf.empresa_id
    );
  END IF;

  SELECT COALESCE(sum(valor),0) INTO v_reducoes
    FROM public.nfse_retencoes
   WHERE nota_fiscal_id=p_nota_id AND status='rascunho' AND retido=true AND reduz_valor_fornecedor=true;
  v_liquido := GREATEST(v_bruto-v_reducoes,0);

  IF COALESCE(v_nf.gera_financeiro,true) AND v_liquido>0 THEN
    SELECT id INTO v_lanc_id FROM public.financeiro_lancamentos
     WHERE nota_fiscal_id=p_nota_id AND origem_tabela='notas_fiscais'
       AND ativo=true AND status<>'cancelado' ORDER BY created_at LIMIT 1;
    IF v_lanc_id IS NULL THEN
      INSERT INTO public.financeiro_lancamentos(
        tipo,descricao,valor,valor_pago,saldo_restante,data_emissao,data_vencimento,status,
        forma_pagamento,fornecedor_id,nota_fiscal_id,origem_tipo,origem_tabela,origem_id,
        origem_descricao,empresa_id,ativo
      ) VALUES(
        'pagar','NFS-e '||COALESCE(v_nf.numero,'s/n')||' - '||COALESCE(v_fornecedor,'sem fornecedor'),
        v_liquido,0,v_liquido,COALESCE(v_nf.data_emissao,CURRENT_DATE),v_data_venc,'aberto',
        v_nf.forma_pagamento,v_nf.fornecedor_id,v_nf.id,'fiscal_nota','notas_fiscais',v_nf.id,
        'NFS-e '||COALESCE(v_nf.numero,'s/n')||' - líquido do fornecedor',v_nf.empresa_id,true
      ) RETURNING id INTO v_lanc_id;
    END IF;
  END IF;

  FOR v_ret IN SELECT * FROM public.nfse_retencoes WHERE nota_fiscal_id=p_nota_id AND status='rascunho' LOOP
    -- Não inventa vencimento fiscal: obrigação só vira título quando a data é conhecida.
    IF v_ret.retido AND v_ret.responsavel_recolhimento='empresa' AND v_ret.valor>0 AND v_ret.vencimento IS NOT NULL THEN
      SELECT id INTO v_ret_fin FROM public.financeiro_lancamentos
       WHERE nota_fiscal_id=p_nota_id AND origem_tabela='nfse_retencoes' AND origem_id=v_ret.id
         AND ativo=true AND status<>'cancelado' ORDER BY created_at LIMIT 1;
      IF v_ret_fin IS NULL THEN
        INSERT INTO public.financeiro_lancamentos(
          tipo,descricao,valor,valor_pago,saldo_restante,data_emissao,data_vencimento,status,
          nota_fiscal_id,origem_tipo,origem_tabela,origem_id,origem_descricao,empresa_id,ativo
        ) VALUES(
          'pagar',v_ret.tributo||' retido - NFS-e '||COALESCE(v_nf.numero,'s/n'),v_ret.valor,0,v_ret.valor,
          COALESCE(v_nf.data_emissao,CURRENT_DATE),v_ret.vencimento,'aberto',v_nf.id,'fiscal_nota',
          'nfse_retencoes',v_ret.id,'Obrigação '||v_ret.tributo||' da NFS-e '||COALESCE(v_nf.numero,'s/n'),
          v_nf.empresa_id,true
        );
      END IF;
    END IF;
    UPDATE public.nfse_retencoes SET status='confirmada',updated_at=now() WHERE id=v_ret.id;
  END LOOP;

  UPDATE public.notas_fiscais SET status='confirmada',confirmada_em=COALESCE(confirmada_em,now()),updated_at=now()
   WHERE id=p_nota_id;
  INSERT INTO public.nota_fiscal_eventos(
    nota_fiscal_id,tipo_evento,status_anterior,status_novo,descricao,payload_resumido,usuario_id
  ) VALUES(
    p_nota_id,'confirmacao',v_nf.status,'confirmada','NFS-e confirmada com financeiro líquido e retenções rastreáveis',
    jsonb_build_object('valor_bruto',v_bruto,'retencoes',v_reducoes,'valor_liquido',v_liquido),auth.uid()
  );
  PERFORM set_config('app.nf_internal_op','',true);
  RETURN v_lanc_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.confirmar_cte(p_nota_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_nf public.notas_fiscais%ROWTYPE;
  v_lanc_id uuid;
  v_data_venc date;
  v_rateios integer;
BEGIN
  SELECT * INTO v_nf FROM public.notas_fiscais WHERE id=p_nota_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nota % não encontrada',p_nota_id; END IF;
  IF v_nf.tipo_documento NOT IN ('cte','cte_os') THEN RAISE EXCEPTION 'Nota % não é CT-e/CT-e OS',p_nota_id; END IF;

  IF v_nf.status='confirmada' THEN
    SELECT id INTO v_lanc_id FROM public.financeiro_lancamentos
     WHERE nota_fiscal_id=p_nota_id AND origem_tabela='notas_fiscais'
       AND ativo=true AND status<>'cancelado' ORDER BY created_at DESC LIMIT 1;
    RETURN v_lanc_id;
  END IF;

  PERFORM set_config('app.nf_internal_op','1',true);
  v_data_venc:=COALESCE(v_nf.data_vencimento,COALESCE(v_nf.data_emissao,CURRENT_DATE)+COALESCE(v_nf.intervalo_parcelas_dias,30));

  IF COALESCE(v_nf.gera_financeiro,true)
     AND COALESCE(v_nf.cte_valor_receber,v_nf.cte_valor_prestacao,v_nf.valor_total,0)>0 THEN
    SELECT id INTO v_lanc_id FROM public.financeiro_lancamentos
     WHERE nota_fiscal_id=p_nota_id AND origem_tabela='notas_fiscais'
       AND ativo=true AND status<>'cancelado' ORDER BY created_at DESC LIMIT 1;
    IF v_lanc_id IS NULL THEN
      INSERT INTO public.financeiro_lancamentos(
        tipo,descricao,valor,valor_pago,saldo_restante,data_emissao,data_vencimento,status,
        forma_pagamento,fornecedor_id,nota_fiscal_id,origem_tipo,origem_tabela,origem_id,
        origem_descricao,empresa_id,ativo
      ) VALUES(
        'pagar',(CASE WHEN v_nf.tipo_documento='cte_os' THEN 'CT-e OS ' ELSE 'CT-e ' END)||COALESCE(v_nf.numero,'s/n'),
        COALESCE(v_nf.cte_valor_receber,v_nf.cte_valor_prestacao,v_nf.valor_total),0,
        COALESCE(v_nf.cte_valor_receber,v_nf.cte_valor_prestacao,v_nf.valor_total),
        COALESCE(v_nf.data_emissao,CURRENT_DATE),v_data_venc,'aberto',v_nf.forma_pagamento,
        v_nf.fornecedor_id,v_nf.id,'fiscal_nota','notas_fiscais',v_nf.id,
        (CASE WHEN v_nf.tipo_documento='cte_os' THEN 'CT-e OS ' ELSE 'CT-e ' END)||COALESCE(v_nf.numero,'s/n'),
        v_nf.empresa_id,true
      ) RETURNING id INTO v_lanc_id;
    END IF;
  END IF;

  PERFORM public.sincronizar_cte_nfe_referencias(p_nota_id);
  UPDATE public.notas_fiscais SET status='confirmada',confirmada_em=COALESCE(confirmada_em,now()),updated_at=now()
   WHERE id=p_nota_id;
  v_rateios:=public.aplicar_rateio_cte(p_nota_id);

  INSERT INTO public.nota_fiscal_eventos(
    nota_fiscal_id,tipo_evento,status_anterior,status_novo,descricao,payload_resumido,usuario_id
  ) VALUES(
    p_nota_id,'confirmacao',v_nf.status,'confirmada','CT-e confirmado com financeiro e rateio auditável',
    jsonb_build_object(
      'referencias',(SELECT count(*) FROM public.cte_nfe_referencias WHERE cte_id=p_nota_id),
      'referencias_pendentes',(SELECT count(*) FROM public.cte_nfe_referencias WHERE cte_id=p_nota_id AND status_vinculo<>'localizada'),
      'rateios_aplicados',v_rateios
    ),auth.uid()
  );
  PERFORM set_config('app.nf_internal_op','',true);
  RETURN v_lanc_id;
END;
$function$;

-- Estorno genérico preserva o comportamento NF-e e acrescenta CT-e/NFS-e.
CREATE OR REPLACE FUNCTION public.estornar_nota_fiscal(p_nf_id uuid,p_motivo text DEFAULT NULL::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_nf public.notas_fiscais%ROWTYPE;
  v_lanc record;
  v_rateio record;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('nf:'||p_nf_id::text));
  SELECT * INTO v_nf FROM public.notas_fiscais WHERE id=p_nf_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NF % não encontrada.',p_nf_id; END IF;
  IF v_nf.status<>'confirmada' THEN RAISE EXCEPTION 'Só é possível estornar NF confirmada (status atual=%).',v_nf.status; END IF;
  IF v_nf.status_sefaz IN ('autorizada','em_processamento') THEN
    RAISE EXCEPTION 'NF autorizada na SEFAZ. Cancele via cancelar_nota_fiscal_sefaz primeiro.';
  END IF;

  -- Verificação antes de qualquer efeito: estorno deve ser atômico.
  IF EXISTS(
    SELECT 1 FROM public.financeiro_lancamentos fl
    JOIN public.financeiro_baixas fb ON fb.lancamento_id=fl.id
    WHERE fl.nota_fiscal_id=v_nf.id AND fl.status<>'cancelado' AND fb.estornada_em IS NULL
  ) THEN
    RAISE EXCEPTION 'Estorne as baixas financeiras ativas antes de estornar o documento fiscal.';
  END IF;

  PERFORM set_config('app.nf_internal_op','1',true);

  IF v_nf.tipo_documento IN ('cte','cte_os') THEN
    FOR v_rateio IN SELECT * FROM public.cte_rateios WHERE cte_id=v_nf.id AND status='ativo' FOR UPDATE LOOP
      UPDATE public.notas_fiscais
         SET frete_valor=GREATEST(COALESCE(frete_valor,0)-v_rateio.valor_rateado,0),updated_at=now()
       WHERE id=v_rateio.nfe_id;
      UPDATE public.cte_rateios SET status='estornado',estornado_em=now(),updated_at=now() WHERE id=v_rateio.id;
    END LOOP;
  END IF;

  IF v_nf.tipo_documento='nfse' THEN
    UPDATE public.nfse_retencoes SET status='estornada',updated_at=now()
     WHERE nota_fiscal_id=v_nf.id AND status='confirmada';
  END IF;

  IF COALESCE(v_nf.movimenta_estoque,false) THEN
    INSERT INTO public.estoque_movimentos(produto_id,tipo,quantidade,documento_tipo,documento_id,motivo,usuario_id)
    SELECT i.produto_id,CASE WHEN v_nf.tipo='saida' THEN 'entrada' ELSE 'saida' END,i.quantidade,
      'fiscal_estorno',v_nf.id,'Estorno NF '||COALESCE(v_nf.numero,v_nf.id::text)||COALESCE(' — '||p_motivo,''),auth.uid()
      FROM public.notas_fiscais_itens i
     WHERE i.nota_fiscal_id=v_nf.id
       AND NOT EXISTS(SELECT 1 FROM public.estoque_movimentos m
         WHERE m.documento_tipo='fiscal_estorno' AND m.documento_id=v_nf.id AND m.produto_id=i.produto_id);
  END IF;

  FOR v_lanc IN SELECT id FROM public.financeiro_lancamentos
    WHERE nota_fiscal_id=v_nf.id AND status NOT IN ('cancelado') LOOP
    PERFORM public.financeiro_cancelar_lancamento(
      v_lanc.id,COALESCE(NULLIF(trim(p_motivo),''),'Estorno documento fiscal '||COALESCE(v_nf.numero,'s/n'))
    );
  END LOOP;

  IF v_nf.ordem_venda_id IS NOT NULL THEN
    UPDATE public.ordens_venda_itens ovi
       SET quantidade_faturada=GREATEST(COALESCE(ovi.quantidade_faturada,0)-nfi.quantidade,0)
      FROM public.notas_fiscais_itens nfi
     WHERE nfi.nota_fiscal_id=v_nf.id AND ovi.ordem_venda_id=v_nf.ordem_venda_id AND ovi.produto_id=nfi.produto_id;
  END IF;

  UPDATE public.notas_fiscais SET status='pendente',confirmada_em=NULL,updated_at=now() WHERE id=v_nf.id;
  INSERT INTO public.nota_fiscal_eventos(nota_fiscal_id,tipo_evento,status_anterior,status_novo,descricao,usuario_id)
  VALUES(v_nf.id,'estorno','confirmada','pendente',COALESCE(p_motivo,'Estorno de NF'),auth.uid());
  INSERT INTO public.auditoria_logs(acao,tabela,registro_id,usuario_id,dados_novos)
  VALUES('estornar_nf','notas_fiscais',v_nf.id,auth.uid(),jsonb_build_object('motivo',p_motivo,'tipo_documento',v_nf.tipo_documento));
  PERFORM set_config('app.nf_internal_op','',true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.salvar_documento_fiscal_completo(uuid,jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_nfse_retencoes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_cte_referencias(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sincronizar_cte_nfe_referencias(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reprocessar_cte_referencias_por_chave(text) TO authenticated;
