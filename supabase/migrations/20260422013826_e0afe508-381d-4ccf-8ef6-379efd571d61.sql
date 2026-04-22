ALTER TABLE notas_fiscais DISABLE TRIGGER trg_nf_protege_edicao;
ALTER TABLE notas_fiscais DISABLE TRIGGER trg_nf_status_transicao;

WITH match AS (
  SELECT nf.id as nf_id, f.id as f_id
  FROM notas_fiscais nf
  JOIN fornecedores f 
    ON regexp_replace(coalesce(f.cpf_cnpj,''),'\D','','g') = SUBSTRING(nf.chave_acesso, 7, 14)
  WHERE nf.origem='importacao_historica' 
    AND nf.fornecedor_id IS NULL
    AND nf.chave_acesso IS NOT NULL
    AND length(nf.chave_acesso)=44
)
UPDATE notas_fiscais nf SET fornecedor_id = m.f_id
FROM match m WHERE nf.id = m.nf_id;

ALTER TABLE notas_fiscais ENABLE TRIGGER trg_nf_protege_edicao;
ALTER TABLE notas_fiscais ENABLE TRIGGER trg_nf_status_transicao;