-- Títulos a pagar de NF já existentes sem conta recebem a conta pela regra
-- de conta_nf_entrada (20261013100000_nf_entrada_conta_e_titulos.sql).

WITH contas AS (
  SELECT nf.id, public.conta_nf_entrada(nf.id) AS conta
    FROM (SELECT DISTINCT nota_fiscal_id AS id
            FROM public.financeiro_lancamentos
           WHERE tipo = 'pagar' AND nota_fiscal_id IS NOT NULL AND conta_contabil_id IS NULL) nf
)
UPDATE public.financeiro_lancamentos fl
   SET conta_contabil_id = c.conta
  FROM contas c
 WHERE fl.nota_fiscal_id = c.id AND c.conta IS NOT NULL
   AND fl.tipo = 'pagar' AND fl.conta_contabil_id IS NULL;
