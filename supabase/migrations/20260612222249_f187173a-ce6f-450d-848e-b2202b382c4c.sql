
WITH parsed AS (
  SELECT
    id,
    substring(xml_nfe FROM '<emit>(.*?)</emit>')           AS emit,
    substring(xml_nfe FROM '<dest>(.*?)</dest>')           AS dest,
    substring(xml_nfe FROM '<ide>(.*?)</ide>')             AS ide,
    substring(xml_nfe FROM '<ICMSTot>(.*?)</ICMSTot>')     AS tot
  FROM public.nfe_distribuicao
  WHERE xml_nfe IS NOT NULL
    AND (numero IS NULL OR valor_total IS NULL OR cnpj_emitente IS NULL OR nome_emitente IS NULL)
),
fields AS (
  SELECT
    id,
    substring(emit FROM '<CNPJ>([^<]+)</CNPJ>')       AS cnpj_e,
    substring(emit FROM '<xNome>([^<]+)</xNome>')     AS nome_e,
    substring(emit FROM '<UF>([^<]+)</UF>')           AS uf_e,
    coalesce(
      substring(dest FROM '<CNPJ>([^<]+)</CNPJ>'),
      substring(dest FROM '<CPF>([^<]+)</CPF>')
    )                                                  AS cnpj_d,
    substring(dest FROM '<xNome>([^<]+)</xNome>')     AS nome_d,
    substring(ide  FROM '<nNF>([^<]+)</nNF>')         AS num_,
    substring(ide  FROM '<serie>([^<]+)</serie>')     AS ser_,
    substring(ide  FROM '<dhEmi>([^<]+)</dhEmi>')     AS dh_,
    substring(ide  FROM '<natOp>([^<]+)</natOp>')     AS nat_,
    substring(tot  FROM '<vNF>([^<]+)</vNF>')         AS vnf_,
    substring(tot  FROM '<vICMS>([^<]+)</vICMS>')     AS vicms_,
    substring(tot  FROM '<vIPI>([^<]+)</vIPI>')       AS vipi_
  FROM parsed
)
UPDATE public.nfe_distribuicao n
SET
  cnpj_emitente     = coalesce(n.cnpj_emitente, nullif(btrim(f.cnpj_e), '')),
  nome_emitente     = coalesce(n.nome_emitente, nullif(btrim(f.nome_e), '')),
  uf_emitente       = coalesce(n.uf_emitente,   nullif(btrim(f.uf_e),   '')),
  cnpj_destinatario = coalesce(n.cnpj_destinatario, nullif(btrim(f.cnpj_d), '')),
  nome_destinatario = coalesce(n.nome_destinatario, nullif(btrim(f.nome_d), '')),
  numero            = coalesce(n.numero, nullif(btrim(f.num_), '')),
  serie             = coalesce(n.serie,  nullif(btrim(f.ser_), '')),
  data_emissao      = coalesce(n.data_emissao, (nullif(btrim(f.dh_), ''))::timestamptz),
  natureza_operacao = coalesce(n.natureza_operacao, nullif(btrim(f.nat_), '')),
  valor_total       = coalesce(n.valor_total, nullif(btrim(f.vnf_), '')::numeric),
  valor_icms        = coalesce(n.valor_icms,  nullif(btrim(f.vicms_), '')::numeric),
  valor_ipi         = coalesce(n.valor_ipi,   nullif(btrim(f.vipi_), '')::numeric),
  tipo_documento    = coalesce(n.tipo_documento, 'procNFe')
FROM fields f
WHERE n.id = f.id;
