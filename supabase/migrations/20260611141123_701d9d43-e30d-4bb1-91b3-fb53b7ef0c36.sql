
CREATE OR REPLACE VIEW public.v_nfe_portal AS
SELECT
  d.id,
  d.chave_acesso,
  d.nsu,
  d.tipo_documento,
  d.numero,
  d.serie,
  d.data_emissao,
  d.cnpj_emitente,
  d.nome_emitente,
  d.uf_emitente,
  d.valor_total,
  d.status_manifestacao,
  d.processado,
  d.xml_importado,
  (d.xml_nfe IS NOT NULL) AS tem_xml,
  d.ciencia_automatica_at,
  d.cancelamento_recebido_at,
  d.nota_fiscal_id,
  nf.status AS status_interno,
  nf.status_sefaz,
  nf.tipo_operacao,
  d.created_at,
  d.updated_at,
  d.cnpj_destinatario,
  d.nome_destinatario
FROM public.nfe_distribuicao d
LEFT JOIN public.notas_fiscais nf ON nf.id = d.nota_fiscal_id;

CREATE OR REPLACE FUNCTION public.buscar_nfe_portal(
  p_filtros jsonb DEFAULT '{}'::jsonb,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_data_ini timestamptz := nullif(p_filtros->>'data_inicio','')::timestamptz;
  v_data_fim timestamptz := nullif(p_filtros->>'data_fim','')::timestamptz;
  v_chave text := nullif(p_filtros->>'chave','');
  v_cnpj_emit text := regexp_replace(coalesce(p_filtros->>'cnpj_emitente',''), '[^0-9]', '', 'g');
  v_emitente text := nullif(p_filtros->>'emitente','');
  v_uf text := nullif(p_filtros->>'uf','');
  v_serie text := nullif(p_filtros->>'serie','');
  v_num_ini int := nullif(p_filtros->>'numero_ini','')::int;
  v_num_fim int := nullif(p_filtros->>'numero_fim','')::int;
  v_status text := nullif(p_filtros->>'status_manifestacao','');
  v_tipo_doc text := nullif(p_filtros->>'tipo_documento','');
  v_incluir_outros boolean := coalesce((p_filtros->>'incluir_outros_destinatarios')::boolean, false);
  v_cnpj_empresa text;
  v_rows jsonb;
  v_total bigint;
BEGIN
  SELECT regexp_replace(coalesce(cnpj,''), '[^0-9]', '', 'g')
    INTO v_cnpj_empresa
    FROM public.empresa_config
    LIMIT 1;
  IF v_cnpj_empresa = '' THEN v_cnpj_empresa := NULL; END IF;

  WITH base AS (
    SELECT * FROM public.v_nfe_portal d
    WHERE (v_data_ini IS NULL OR coalesce(d.data_emissao, d.created_at) >= v_data_ini)
      AND (v_data_fim IS NULL OR coalesce(d.data_emissao, d.created_at) <= v_data_fim)
      AND (v_chave IS NULL OR d.chave_acesso = v_chave)
      AND (v_cnpj_emit = '' OR d.cnpj_emitente ILIKE '%' || v_cnpj_emit || '%')
      AND (v_emitente IS NULL OR d.nome_emitente ILIKE '%' || v_emitente || '%')
      AND (v_uf IS NULL OR d.uf_emitente = v_uf)
      AND (v_serie IS NULL OR d.serie = v_serie)
      AND (v_num_ini IS NULL OR d.numero::int >= v_num_ini)
      AND (v_num_fim IS NULL OR d.numero::int <= v_num_fim)
      AND (v_status IS NULL OR d.status_manifestacao = v_status)
      AND (
        (v_tipo_doc IS NOT NULL AND d.tipo_documento = v_tipo_doc)
        OR (
          v_tipo_doc IS NULL
          AND (d.tipo_documento IS NULL OR d.tipo_documento NOT IN ('resEvento','procEventoNFe'))
        )
      )
      AND (
        v_incluir_outros
        OR v_cnpj_empresa IS NULL
        OR d.cnpj_destinatario IS NULL
        OR d.cnpj_destinatario = v_cnpj_empresa
      )
  )
  SELECT
    coalesce(jsonb_agg(to_jsonb(t.*) ORDER BY coalesce(t.data_emissao, t.created_at) DESC NULLS LAST), '[]'::jsonb),
    (SELECT count(*) FROM base)
  INTO v_rows, v_total
  FROM (
    SELECT * FROM base
    ORDER BY coalesce(data_emissao, created_at) DESC NULLS LAST
    LIMIT p_limit OFFSET p_offset
  ) t;

  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END;
$function$;

CREATE OR REPLACE FUNCTION public.excluir_nfe_distribuicao_alheias()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cnpj_empresa text;
  v_count integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores podem executar esta limpeza.';
  END IF;

  SELECT regexp_replace(coalesce(cnpj,''), '[^0-9]', '', 'g')
    INTO v_cnpj_empresa
    FROM public.empresa_config
    LIMIT 1;
  IF v_cnpj_empresa IS NULL OR v_cnpj_empresa = '' THEN
    RAISE EXCEPTION 'CNPJ da empresa não configurado em empresa_config.';
  END IF;

  WITH del AS (
    DELETE FROM public.nfe_distribuicao
     WHERE cnpj_destinatario IS NOT NULL
       AND cnpj_destinatario <> v_cnpj_empresa
       AND nota_fiscal_id IS NULL
       AND financeiro_lancamento_id IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM del;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.excluir_nfe_distribuicao_alheias() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.excluir_nfe_distribuicao_alheias() TO authenticated, service_role;
