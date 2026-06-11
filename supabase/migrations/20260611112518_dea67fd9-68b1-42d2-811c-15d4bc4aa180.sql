-- Portal Fiscal: view + RPC para consulta unificada de NF-e (estilo TOTVS Processos Fiscais)
-- Não cria tabela. View security_invoker + RPC SECURITY DEFINER que herda filtro via RLS chamando o cliente.

CREATE OR REPLACE VIEW public.v_nfe_portal
WITH (security_invoker = on) AS
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
  d.xml_nfe IS NOT NULL AS tem_xml,
  d.ciencia_automatica_at,
  d.cancelamento_recebido_at,
  d.nota_fiscal_id,
  nf.status AS status_interno,
  nf.status_sefaz AS status_sefaz,
  nf.tipo_operacao AS tipo_operacao,
  d.created_at,
  d.updated_at
FROM public.nfe_distribuicao d
LEFT JOIN public.notas_fiscais nf ON nf.id = d.nota_fiscal_id;

GRANT SELECT ON public.v_nfe_portal TO authenticated;
GRANT SELECT ON public.v_nfe_portal TO service_role;

-- RPC: busca paginada com filtros server-side
CREATE OR REPLACE FUNCTION public.buscar_nfe_portal(
  p_filtros jsonb DEFAULT '{}'::jsonb,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
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
    WHERE (v_data_ini IS NULL OR d.data_emissao >= v_data_ini)
      AND (v_data_fim IS NULL OR d.data_emissao <= v_data_fim)
      AND (v_chave IS NULL OR d.chave_acesso = v_chave)
      AND (v_cnpj_emit = '' OR d.cnpj_emitente ILIKE '%' || v_cnpj_emit || '%')
      AND (v_emitente IS NULL OR d.nome_emitente ILIKE '%' || v_emitente || '%')
      AND (v_uf IS NULL OR d.uf_emitente = v_uf)
      AND (v_serie IS NULL OR d.serie = v_serie)
      AND (v_num_ini IS NULL OR d.numero::int >= v_num_ini)
      AND (v_num_fim IS NULL OR d.numero::int <= v_num_fim)
      AND (v_status IS NULL OR d.status_manifestacao = v_status)
      AND (v_tipo_doc IS NULL OR d.tipo_documento = v_tipo_doc)
  )
  SELECT
    coalesce(jsonb_agg(to_jsonb(t.*) ORDER BY t.data_emissao DESC NULLS LAST), '[]'::jsonb),
    (SELECT count(*) FROM base)
  INTO v_rows, v_total
  FROM (SELECT * FROM base ORDER BY data_emissao DESC NULLS LAST LIMIT p_limit OFFSET p_offset) t;

  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_nfe_portal(jsonb, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_nfe_portal(jsonb, int, int) TO service_role;