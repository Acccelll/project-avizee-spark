WITH parsed AS (
  SELECT
    d.id,
    (regexp_match(d.xml_nfe, '<emit[^>]*>([\s\S]*?)</emit>'))[1] AS emit_block,
    (regexp_match(d.xml_nfe, '<ide[^>]*>([\s\S]*?)</ide>'))[1]   AS ide_block,
    (regexp_match(d.xml_nfe, '<ICMSTot[^>]*>([\s\S]*?)</ICMSTot>'))[1] AS tot_block
  FROM public.nfe_distribuicao d
  WHERE d.xml_nfe IS NOT NULL
    AND d.xml_nfe LIKE '%<infNFe%'
    AND (d.data_emissao IS NULL OR d.nome_emitente IS NULL OR d.numero IS NULL)
)
UPDATE public.nfe_distribuicao d
SET
  tipo_documento = 'procNFe',
  cnpj_emitente = coalesce(d.cnpj_emitente, (regexp_match(p.emit_block, '<CNPJ>(\d+)</CNPJ>'))[1]),
  nome_emitente = coalesce(d.nome_emitente, (regexp_match(p.emit_block, '<xNome>([^<]+)</xNome>'))[1]),
  uf_emitente   = coalesce(d.uf_emitente,   (regexp_match(p.emit_block, '<UF>([A-Z]{2})</UF>'))[1]),
  numero        = coalesce(d.numero,        (regexp_match(p.ide_block,  '<nNF>(\d+)</nNF>'))[1]),
  serie         = coalesce(d.serie,         (regexp_match(p.ide_block,  '<serie>(\d+)</serie>'))[1]),
  data_emissao  = coalesce(d.data_emissao,  nullif((regexp_match(p.ide_block, '<dhEmi>([^<]+)</dhEmi>'))[1], '')::timestamptz),
  valor_total   = coalesce(d.valor_total,   nullif((regexp_match(p.tot_block, '<vNF>([0-9.]+)</vNF>'))[1], '')::numeric)
FROM parsed p
WHERE p.id = d.id;