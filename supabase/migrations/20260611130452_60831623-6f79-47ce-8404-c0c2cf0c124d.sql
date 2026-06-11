-- Reextrai campos básicos do xml_nfe quando o registro está como resNFe mas
-- contém um XML completo (procNFe). Cobre os documentos importados via
-- consChNFe/consultadanfe que ficaram com colunas vazias no Portal.
WITH parsed AS (
  SELECT
    d.id,
    substring(d.xml_nfe from '<emit\b[^>]*>[\s\S]*?<CNPJ>(\d+)</CNPJ>[\s\S]*?</emit>') AS cnpj_emit,
    substring(d.xml_nfe from '<emit\b[^>]*>[\s\S]*?<xNome>([^<]+)</xNome>[\s\S]*?</emit>') AS nome_emit,
    substring(d.xml_nfe from '<emit\b[^>]*>[\s\S]*?<UF>([A-Z]{2})</UF>[\s\S]*?</emit>') AS uf_emit,
    substring(d.xml_nfe from '<ide\b[^>]*>[\s\S]*?<nNF>(\d+)</nNF>[\s\S]*?</ide>') AS nNF,
    substring(d.xml_nfe from '<ide\b[^>]*>[\s\S]*?<serie>(\d+)</serie>[\s\S]*?</ide>') AS serie,
    substring(d.xml_nfe from '<ide\b[^>]*>[\s\S]*?<dhEmi>([^<]+)</dhEmi>[\s\S]*?</ide>') AS dhEmi,
    substring(d.xml_nfe from '<ICMSTot\b[^>]*>[\s\S]*?<vNF>([\d.]+)</vNF>[\s\S]*?</ICMSTot>') AS vNF
  FROM public.nfe_distribuicao d
  WHERE d.xml_nfe IS NOT NULL
    AND d.xml_nfe LIKE '%<infNFe%'
    AND (
      d.tipo_documento <> 'procNFe'
      OR d.data_emissao IS NULL
      OR d.nome_emitente IS NULL
      OR d.numero IS NULL
    )
)
UPDATE public.nfe_distribuicao d
SET
  tipo_documento = 'procNFe',
  cnpj_emitente = coalesce(d.cnpj_emitente, p.cnpj_emit),
  nome_emitente = coalesce(d.nome_emitente, p.nome_emit),
  uf_emitente   = coalesce(d.uf_emitente, p.uf_emit),
  numero        = coalesce(d.numero, p.nNF),
  serie         = coalesce(d.serie, p.serie),
  data_emissao  = coalesce(d.data_emissao, nullif(p.dhEmi,'')::timestamptz),
  valor_total   = coalesce(d.valor_total, nullif(p.vNF,'')::numeric)
FROM parsed p
WHERE p.id = d.id;