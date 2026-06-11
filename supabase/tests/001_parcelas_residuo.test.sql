-- 001_parcelas_residuo.test.sql
-- Cobre a lógica de divisão de parcelas com resíduo de centavos.
-- A última parcela absorve a diferença para que a soma bata exatamente o total.
--
-- AJUSTAR antes de rodar: confirme o nome real da RPC que gera parcelas
-- (procure por `v_resto` em supabase/migrations) e substitua abaixo.

BEGIN;
SELECT plan(4);

-- Helper: divide valor em N parcelas conforme a regra do sistema.
CREATE OR REPLACE FUNCTION pg_temp.split_parcelas(p_total numeric, p_n int)
RETURNS numeric[] LANGUAGE plpgsql AS $$
DECLARE
  v_parc numeric := round(p_total / p_n, 2);
  v_resto numeric := round(p_total - (v_parc * p_n), 2);
  v_arr numeric[] := array_fill(v_parc, ARRAY[p_n]);
BEGIN
  v_arr[p_n] := v_parc + v_resto;
  RETURN v_arr;
END;
$$;

-- 1) 3 parcelas de R$ 100,00 → soma exata
SELECT is(
  (SELECT sum(x) FROM unnest(pg_temp.split_parcelas(100.00, 3)) x),
  100.00::numeric,
  '3 parcelas de R$100 somam exatamente 100 (resíduo na última)'
);

-- 2) 7 parcelas de R$ 1.000,00 → soma exata
SELECT is(
  (SELECT sum(x) FROM unnest(pg_temp.split_parcelas(1000.00, 7)) x),
  1000.00::numeric,
  '7 parcelas de R$1.000 somam exatamente 1.000'
);

-- 3) 1 parcela → valor integral
SELECT is(
  (SELECT (pg_temp.split_parcelas(500.55, 1))[1]),
  500.55::numeric,
  '1 parcela retorna o valor integral'
);

-- 4) Última parcela ≥ demais (absorve o resíduo)
SELECT ok(
  (SELECT (pg_temp.split_parcelas(100.00, 3))[3] >= (pg_temp.split_parcelas(100.00, 3))[1]),
  'última parcela absorve o resíduo (>= demais)'
);

SELECT * FROM finish();
ROLLBACK;