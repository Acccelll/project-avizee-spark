-- Exclusão excepcional de NF de teste solicitada manualmente.
-- ID: 7da07f09-c65d-461a-a220-4a84b2c73815 (nº 1, saída, cancelada, nao_enviada)
DO $$
DECLARE
  v_nf_id uuid := '7da07f09-c65d-461a-a220-4a84b2c73815';
BEGIN
  -- Limpa dependências conhecidas
  DELETE FROM public.nota_fiscal_eventos WHERE nota_fiscal_id = v_nf_id;
  DELETE FROM public.nota_fiscal_anexos  WHERE nota_fiscal_id = v_nf_id;
  DELETE FROM public.notas_fiscais_itens WHERE nota_fiscal_id = v_nf_id;

  -- Desabilita temporariamente o trigger de proteção fiscal apenas para esta operação
  ALTER TABLE public.notas_fiscais DISABLE TRIGGER trg_nf_protege_delete;
  DELETE FROM public.notas_fiscais WHERE id = v_nf_id;
  ALTER TABLE public.notas_fiscais ENABLE TRIGGER trg_nf_protege_delete;
END $$;