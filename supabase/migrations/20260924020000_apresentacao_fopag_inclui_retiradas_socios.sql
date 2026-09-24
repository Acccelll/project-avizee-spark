-- FOPAG na Apresentação Gerencial deve refletir a realidade da empresa: não há
-- funcionários (folha_pagamento vazia), o "FOPAG" real é a retirada de sócios
-- (módulo socios_retiradas). A view antiga só somava folha_pagamento e por isso
-- o slide "FOPAG" sempre ficava indisponível. Agora soma os dois — funciona
-- tanto hoje (só sócios) quanto se a empresa vier a ter funcionários no futuro.
DROP VIEW IF EXISTS public.vw_apresentacao_fopag;

CREATE VIEW public.vw_apresentacao_fopag AS
WITH funcionarios_pg AS (
  SELECT
    to_char(fp.competencia::date, 'YYYY-MM') AS competencia,
    COUNT(*) AS qtd,
    SUM(COALESCE(fp.valor_liquido, 0)) AS valor
  FROM public.folha_pagamento fp
  GROUP BY 1
),
socios_pg AS (
  SELECT
    to_char(fl.data_pagamento, 'YYYY-MM') AS competencia,
    COUNT(DISTINCT sr.socio_id) AS qtd,
    SUM(COALESCE(fl.valor_pago, fl.valor, 0)) AS valor
  FROM public.socios_retiradas sr
  JOIN public.financeiro_lancamentos fl ON fl.id = sr.financeiro_lancamento_id
  WHERE fl.status = 'pago'
  GROUP BY 1
)
SELECT
  COALESCE(f.competencia, s.competencia) AS competencia,
  COALESCE(f.qtd, 0) + COALESCE(s.qtd, 0) AS funcionarios,
  COALESCE(f.valor, 0) + COALESCE(s.valor, 0) AS valor_atual,
  COALESCE(f.valor, 0) AS folha_pagamento,
  COALESCE(s.valor, 0) AS retiradas_socios
FROM funcionarios_pg f
FULL OUTER JOIN socios_pg s ON s.competencia = f.competencia;

ALTER VIEW public.vw_apresentacao_fopag SET (security_invoker = true);
