-- Add origem column to orcamentos for historical imports
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'sistema';

-- Expand status CHECK to include 'historico'
ALTER TABLE public.orcamentos DROP CONSTRAINT IF EXISTS chk_orcamentos_status;
ALTER TABLE public.orcamentos ADD CONSTRAINT chk_orcamentos_status
  CHECK (status = ANY (ARRAY['rascunho','pendente','aprovado','convertido','rejeitado','cancelado','expirado','historico']));

-- Update transition trigger: 'historico' is terminal & read-only
CREATE OR REPLACE FUNCTION public.fn_orcamento_transicao_valida()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_terminais text[] := ARRAY['convertido','rejeitado','cancelado','expirado','historico'];
  v_permitidas text[];
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF OLD.status = ANY (v_terminais) THEN
    RAISE EXCEPTION 'Orçamento em estado terminal (%) não pode mudar para %', OLD.status, NEW.status;
  END IF;
  v_permitidas := CASE OLD.status
    WHEN 'rascunho'  THEN ARRAY['pendente','cancelado','expirado']
    WHEN 'pendente'  THEN ARRAY['aprovado','rejeitado','cancelado','expirado','rascunho']
    WHEN 'aprovado'  THEN ARRAY['convertido','cancelado','expirado']
    ELSE ARRAY[]::text[]
  END;
  IF NOT (NEW.status = ANY (v_permitidas)) THEN
    RAISE EXCEPTION 'Transição inválida de % para %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END; $function$;

-- Update delete protection: allow deleting 'historico' rows when origem='importacao_historica' (admin reimport / cleanup)
CREATE OR REPLACE FUNCTION public.fn_orcamento_protege_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status = 'historico' AND OLD.origem = 'importacao_historica' THEN
    RETURN OLD;
  END IF;
  IF OLD.status <> 'rascunho' THEN
    RAISE EXCEPTION 'Somente orçamentos em rascunho podem ser excluídos (status atual: %). Use cancelar_orcamento.', OLD.status;
  END IF;
  IF EXISTS (SELECT 1 FROM public.ordens_venda WHERE cotacao_id = OLD.id) THEN
    RAISE EXCEPTION 'Orçamento possui pedido vinculado — não pode ser excluído.';
  END IF;
  RETURN OLD;
END; $function$;

CREATE INDEX IF NOT EXISTS idx_orcamentos_origem ON public.orcamentos(origem);