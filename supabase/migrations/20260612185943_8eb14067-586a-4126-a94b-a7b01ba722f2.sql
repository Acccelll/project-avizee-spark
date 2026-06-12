UPDATE public.nfe_distdfe_sync
SET ultimo_nsu = '000000000000137',
    ultima_resposta_cstat = '656',
    ultima_resposta_xmotivo = 'Cursor ajustado: AN confirmou entrega até NSU 137 (resposta 656 de 12/06/2026 18:57 UTC)',
    ultima_sync_at = now()
WHERE cnpj = '53078538000185'
  AND ambiente = '1'
  AND ultimo_nsu::bigint < 137;