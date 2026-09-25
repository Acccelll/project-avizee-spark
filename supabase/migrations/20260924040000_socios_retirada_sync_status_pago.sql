-- A retirada de sócio nunca chegava a 'pago': gerar_financeiro_retirada leva a
-- retirada a 'financeiro_gerado', mas a baixa acontece no financeiro
-- (financeiro_baixas -> trg_sync_financeiro_saldo atualiza financeiro_lancamentos)
-- e nada propagava o pagamento de volta. Este trigger espelha o status do
-- lançamento na retirada: 'pago' ao quitar, volta a 'financeiro_gerado' se a
-- baixa for estornada. Cancelamento continua sendo tratado por
-- cancelar_retirada_socio.
CREATE OR REPLACE FUNCTION public.trg_sync_retirada_socio_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'pago' THEN
    UPDATE public.socios_retiradas
       SET status = 'pago',
           data_pagamento = NEW.data_pagamento
     WHERE financeiro_lancamento_id = NEW.id
       AND status = 'financeiro_gerado';
  ELSIF OLD.status = 'pago' AND NEW.status IN ('aberto', 'parcial') THEN
    UPDATE public.socios_retiradas
       SET status = 'financeiro_gerado',
           data_pagamento = NULL
     WHERE financeiro_lancamento_id = NEW.id
       AND status = 'pago';
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_retirada_socio_status ON public.financeiro_lancamentos;

CREATE TRIGGER trg_sync_retirada_socio_status
AFTER UPDATE OF status ON public.financeiro_lancamentos
FOR EACH ROW
WHEN (
  NEW.origem_tabela = 'socios_retiradas'
  AND OLD.status IS DISTINCT FROM NEW.status
  AND (NEW.status = 'pago' OR OLD.status = 'pago')
)
EXECUTE FUNCTION public.trg_sync_retirada_socio_status();

UPDATE public.socios_retiradas r
   SET status = 'pago',
       data_pagamento = fl.data_pagamento
  FROM public.financeiro_lancamentos fl
 WHERE fl.id = r.financeiro_lancamento_id
   AND fl.status = 'pago'
   AND r.status = 'financeiro_gerado';
