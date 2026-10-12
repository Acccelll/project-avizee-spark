-- Gatilhos que levam a conta da NF de entrada aos títulos a pagar
-- (funções em 20261013100000_nf_entrada_conta_e_titulos.sql).

SET lock_timeout = '10s';

-- Título a pagar de NF nasce (ou é vinculado à NF) com a conta da NF.
CREATE OR REPLACE FUNCTION public.trg_fin_lanc_conta_da_nf()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tipo = 'pagar' AND NEW.nota_fiscal_id IS NOT NULL AND NEW.conta_contabil_id IS NULL THEN
    NEW.conta_contabil_id := public.conta_nf_entrada(NEW.nota_fiscal_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fin_lanc_conta_da_nf ON public.financeiro_lancamentos;
CREATE TRIGGER trg_fin_lanc_conta_da_nf
  BEFORE INSERT OR UPDATE OF nota_fiscal_id ON public.financeiro_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.trg_fin_lanc_conta_da_nf();

-- Conta informada (ou trocada) na NF vale para os títulos dela que estavam
-- sem conta, com a conta anterior da NF ou com a conta deduzida dos itens.
CREATE OR REPLACE FUNCTION public.trg_nf_conta_para_titulos()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inferida uuid;
BEGIN
  IF NEW.tipo = 'entrada' AND NEW.conta_contabil_id IS NOT NULL
     AND NEW.conta_contabil_id IS DISTINCT FROM OLD.conta_contabil_id THEN
    v_inferida := public.conta_nf_entrada_inferida(NEW.id);
    UPDATE public.financeiro_lancamentos
       SET conta_contabil_id = NEW.conta_contabil_id, updated_at = now()
     WHERE nota_fiscal_id = NEW.id AND tipo = 'pagar'
       AND (conta_contabil_id IS NULL
            OR conta_contabil_id = OLD.conta_contabil_id
            OR conta_contabil_id = v_inferida);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_nf_conta_para_titulos ON public.notas_fiscais;
CREATE TRIGGER trg_nf_conta_para_titulos
  AFTER UPDATE OF conta_contabil_id ON public.notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.trg_nf_conta_para_titulos();

-- Itens que chegam (ou ganham produto) depois do título completam a conta.
CREATE OR REPLACE FUNCTION public.trg_nf_item_conta_para_titulos()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_conta uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.financeiro_lancamentos
              WHERE nota_fiscal_id = NEW.nota_fiscal_id AND tipo = 'pagar' AND conta_contabil_id IS NULL) THEN
    v_conta := public.conta_nf_entrada(NEW.nota_fiscal_id);
    IF v_conta IS NOT NULL THEN
      UPDATE public.financeiro_lancamentos
         SET conta_contabil_id = v_conta, updated_at = now()
       WHERE nota_fiscal_id = NEW.nota_fiscal_id AND tipo = 'pagar' AND conta_contabil_id IS NULL;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_nf_item_conta_para_titulos ON public.notas_fiscais_itens;
CREATE TRIGGER trg_nf_item_conta_para_titulos
  AFTER INSERT OR UPDATE OF produto_id ON public.notas_fiscais_itens
  FOR EACH ROW EXECUTE FUNCTION public.trg_nf_item_conta_para_titulos();
