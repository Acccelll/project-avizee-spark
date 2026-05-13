DO $$
DECLARE
  v_nf_id uuid := 'ced37974-4de8-4c54-a3fc-55bb10a2a425';
BEGIN
  ALTER TABLE public.notas_fiscais DISABLE TRIGGER USER;
  ALTER TABLE public.notas_fiscais_itens DISABLE TRIGGER USER;

  DELETE FROM public.nota_fiscal_eventos WHERE nota_fiscal_id = v_nf_id;
  DELETE FROM public.nota_fiscal_anexos WHERE nota_fiscal_id = v_nf_id;
  DELETE FROM public.notas_fiscais_itens WHERE nota_fiscal_id = v_nf_id;
  DELETE FROM public.estoque_movimentos
    WHERE documento_id = v_nf_id AND documento_tipo = 'fiscal';
  UPDATE public.financeiro_lancamentos SET nota_fiscal_id = NULL
    WHERE nota_fiscal_id = v_nf_id;
  DELETE FROM public.notas_fiscais WHERE id = v_nf_id;

  ALTER TABLE public.notas_fiscais_itens ENABLE TRIGGER USER;
  ALTER TABLE public.notas_fiscais ENABLE TRIGGER USER;
END $$;