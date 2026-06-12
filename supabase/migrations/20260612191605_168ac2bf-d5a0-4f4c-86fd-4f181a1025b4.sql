UPDATE public.nfe_distdfe_sync
   SET ultimo_nsu = '000000000000000',
       ultima_resposta_cstat = NULL,
       ultima_resposta_xmotivo = 'Cursor resetado para recuperar docs perdidos por avanço indevido no 656',
       updated_at = now()
 WHERE cnpj = '53078538000185' AND ambiente = '1';

DELETE FROM public.app_configuracoes
 WHERE chave = 'distdfe_circuit_break_until_1';