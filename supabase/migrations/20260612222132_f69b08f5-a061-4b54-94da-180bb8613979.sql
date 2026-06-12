
-- Backfill metadata of nfe_distribuicao rows that have xml_nfe but missing
-- basic fields (numero / valor_total). Extracts inside the canonical blocks
-- (<emit>, <dest>, <ide>, <ICMSTot>) so we don't grab values from
-- <infRespTec> by mistake.
WITH parsed AS (
  SELECT
    id,
    substring(xml_nfe FROM '<emit\b[^>]*>([\s\S]*?)</emit>')      AS emit,
    substring(xml_nfe FROM '<dest\b[^>]*>([\s\S]*?)</dest>')      AS dest,
    substring(xml_nfe FROM '<ide\b[^>]*>([\s\S]*?)</ide>')        AS ide,
    substring(xml_nfe FROM '<ICMSTot\b[^>]*>([\s\S]*?)</ICMSTot>') AS tot
  FROM public.nfe_distribuicao
  WHERE xml_nfe IS NOT NULL
    AND (numero IS NULL OR valor_total IS NULL OR cnpj_emitente IS NULL)
),
fields AS (
  SELECT
    id,
    substring(emit FROM '<CNPJ[^>]*>([\s\S]*?)</CNPJ>')       AS cnpj_e,
    substring(emit FROM '<xNome[^>]*>([\s\S]*?)</xNome>')     AS nome_e,
    substring(emit FROM '<UF[^>]*>([\s\S]*?)</UF>')           AS uf_e,
    coalesce(
      substring(dest FROM '<CNPJ[^>]*>([\s\S]*?)</CNPJ>'),
      substring(dest FROM '<CPF[^>]*>([\s\S]*?)</CPF>')
    )                                                          AS cnpj_d,
    substring(dest FROM '<xNome[^>]*>([\s\S]*?)</xNome>')     AS nome_d,
    substring(ide  FROM '<nNF[^>]*>([\s\S]*?)</nNF>')         AS num_,
    substring(ide  FROM '<serie[^>]*>([\s\S]*?)</serie>')     AS ser_,
    substring(ide  FROM '<dhEmi[^>]*>([\s\S]*?)</dhEmi>')     AS dh_,
    substring(ide  FROM '<natOp[^>]*>([\s\S]*?)</natOp>')     AS nat_,
    substring(tot  FROM '<vNF[^>]*>([\s\S]*?)</vNF>')         AS vnf_,
    substring(tot  FROM '<vICMS[^>]*>([\s\S]*?)</vICMS>')     AS vicms_,
    substring(tot  FROM '<vIPI[^>]*>([\s\S]*?)</vIPI>')       AS vipi_
  FROM parsed
)
UPDATE public.nfe_distribuicao n
SET
  cnpj_emitente     = coalesce(n.cnpj_emitente, nullif(trim(f.cnpj_e), '')),
  nome_emitente     = coalesce(n.nome_emitente, nullif(trim(f.nome_e), '')),
  uf_emitente       = coalesce(n.uf_emitente,   nullif(trim(f.uf_e), '')),
  cnpj_destinatario = coalesce(n.cnpj_destinatario, nullif(trim(f.cnpj_d), '')),
  nome_destinatario = coalesce(n.nome_destinatario, nullif(trim(f.nome_d), '')),
  numero            = coalesce(n.numero, nullif(trim(f.num_), '')),
  serie             = coalesce(n.serie,  nullif(trim(f.ser_), '')),
  data_emissao      = coalesce(n.data_emissao, (nullif(trim(f.dh_), ''))::timestamptz),
  natureza_operacao = coalesce(n.natureza_operacao, nullif(trim(f.nat_), '')),
  valor_total       = coalesce(n.valor_total, nullif(trim(f.vnf_), '')::numeric),
  valor_icms        = coalesce(n.valor_icms,  nullif(trim(f.vicms_), '')::numeric),
  valor_ipi         = coalesce(n.valor_ipi,   nullif(trim(f.vipi_), '')::numeric),
  tipo_documento    = coalesce(n.tipo_documento, 'procNFe')
FROM fields f
WHERE n.id = f.id;
