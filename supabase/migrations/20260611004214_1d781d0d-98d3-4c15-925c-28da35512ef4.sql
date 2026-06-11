ALTER TABLE public.nfe_distribuicao
  DROP CONSTRAINT IF EXISTS chk_nfe_dist_status;

ALTER TABLE public.nfe_distribuicao
  ADD CONSTRAINT chk_nfe_dist_status CHECK (status_manifestacao IN (
    'sem_manifestacao',
    'ciencia',
    'ciencia_operacao',
    'confirmada',
    'desconhecida',
    'nao_realizada'
  ));