-- Sprint 4 — Correção da escala de pontuação do matching

ALTER TABLE public.conciliacao_matches
  ALTER COLUMN score TYPE numeric(5,2) USING score::numeric(5,2);