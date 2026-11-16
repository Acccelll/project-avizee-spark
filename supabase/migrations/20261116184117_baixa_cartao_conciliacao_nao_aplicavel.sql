-- Baixa paga no cartão de crédito não passa pelo extrato bancário: o que sai
-- do banco é o pagamento da fatura. Essas baixas ficavam para sempre como
-- "pendente" de conciliação e inflavam a contagem (123 em 16/11/2026).
--
-- Novo status `nao_aplicavel`, atribuído sozinho a baixas de cartão.
-- Baixas de boleto, PIX etc. sem conta bancária continuam `pendente`: o dado
-- que falta é a conta, e esconder seria pior.

SET lock_timeout = '10s';

ALTER TABLE public.financeiro_baixas DROP CONSTRAINT IF EXISTS chk_fin_baixas_concil_status;
ALTER TABLE public.financeiro_baixas
  ADD CONSTRAINT chk_fin_baixas_concil_status
  CHECK (conciliacao_status IN ('pendente','conciliado','divergente','desconciliado','nao_aplicavel'));

CREATE OR REPLACE FUNCTION public.trg_baixa_conciliacao_nao_aplicavel()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.forma_pagamento = 'cartao_credito' AND NEW.conciliacao_status = 'pendente' THEN
    NEW.conciliacao_status := 'nao_aplicavel';
  ELSIF NEW.forma_pagamento IS DISTINCT FROM 'cartao_credito' AND NEW.conciliacao_status = 'nao_aplicavel' THEN
    NEW.conciliacao_status := 'pendente';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_baixa_conciliacao_nao_aplicavel ON public.financeiro_baixas;
CREATE TRIGGER trg_baixa_conciliacao_nao_aplicavel
  BEFORE INSERT OR UPDATE OF forma_pagamento, conciliacao_status ON public.financeiro_baixas
  FOR EACH ROW EXECUTE FUNCTION public.trg_baixa_conciliacao_nao_aplicavel();

-- Baixas de cartão já existentes, ativas e ainda pendentes.
UPDATE public.financeiro_baixas
   SET conciliacao_status = 'nao_aplicavel'
 WHERE forma_pagamento = 'cartao_credito'
   AND conciliacao_status = 'pendente'
   AND estornada_em IS NULL;
