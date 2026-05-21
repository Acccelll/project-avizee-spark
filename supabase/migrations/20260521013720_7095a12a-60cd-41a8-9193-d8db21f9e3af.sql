ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS confirmada_em timestamptz;

UPDATE public.notas_fiscais
   SET confirmada_em = updated_at
 WHERE status = 'confirmada'
   AND confirmada_em IS NULL;