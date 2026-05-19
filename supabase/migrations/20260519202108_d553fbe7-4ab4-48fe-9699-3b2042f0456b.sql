-- Relaxa triggers de proteção da NF para incluir o papel Financeiro
-- e permitir override em NFs de saída (até então só entrada).

CREATE OR REPLACE FUNCTION public.trg_nf_protege_edicao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_internal_op text := current_setting('app.nf_internal_op', true);
BEGIN
  IF v_internal_op = '1' THEN
    RETURN NEW;
  END IF;

  -- Bypass privilegiado: Admin OU Financeiro editam qualquer NF (entrada/saída)
  -- mesmo em status confirmada/importada/cancelada. NFs com SEFAZ
  -- cancelada/inutilizada não chegam aqui sem internal_op (UI bloqueia) — caso
  -- cheguem, ainda assim seguem o bypass (a auditoria preserva o histórico).
  IF public.can_edit_financeiro_avancado(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('confirmada','importada','cancelada') THEN
    IF NEW.valor_total IS DISTINCT FROM OLD.valor_total
       OR NEW.chave_acesso IS DISTINCT FROM OLD.chave_acesso
       OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id
       OR NEW.fornecedor_id IS DISTINCT FROM OLD.fornecedor_id
       OR NEW.numero IS DISTINCT FROM OLD.numero
       OR NEW.serie IS DISTINCT FROM OLD.serie
       OR NEW.modelo_documento IS DISTINCT FROM OLD.modelo_documento
       OR NEW.tipo IS DISTINCT FROM OLD.tipo
       OR NEW.tipo_operacao IS DISTINCT FROM OLD.tipo_operacao
    THEN
      RAISE EXCEPTION 'NF % está bloqueada para edição estrutural (status=%). Use estorno/cancelamento.', OLD.id, OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_nf_itens_protege_edicao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_internal_op text := current_setting('app.nf_internal_op', true);
  v_status text;
BEGIN
  IF current_setting('app.hard_delete', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF v_internal_op = '1' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Bypass privilegiado: Admin OU Financeiro podem ajustar itens de NFs
  -- (entrada/saída) mesmo após confirmação/importação/cancelamento.
  IF public.can_edit_financeiro_avancado(auth.uid()) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT status INTO v_status FROM public.notas_fiscais
    WHERE id = COALESCE(NEW.nota_fiscal_id, OLD.nota_fiscal_id);

  IF v_status IN ('confirmada','importada','cancelada') THEN
    RAISE EXCEPTION 'Itens da NF estão bloqueados para edição (status=%).', v_status
      USING HINT = 'Use estorno (estornar_nota_fiscal) para liberar alterações.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;