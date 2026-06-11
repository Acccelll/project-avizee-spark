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
  v_rows jsonb;
  v_total bigint;
BEGIN
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