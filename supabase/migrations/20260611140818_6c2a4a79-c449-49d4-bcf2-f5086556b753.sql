
CREATE OR REPLACE FUNCTION public.backfill_nfe_distribuicao_destinatario()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_cnpj text;
  v_nome text;
  r record;
BEGIN
  FOR r IN
    SELECT id, xml_nfe
    FROM public.nfe_distribuicao
    WHERE xml_nfe IS NOT NULL
      AND position('<dest' in xml_nfe) > 0
      AND (cnpj_destinatario IS NULL OR nome_destinatario IS NULL)
  LOOP
    v_cnpj := (regexp_match(
      r.xml_nfe,
      '<dest[^>]*>.*?<CNPJ>([0-9]{14})</CNPJ>'
    ))[1];
    IF v_cnpj IS NULL THEN
      v_cnpj := (regexp_match(
        r.xml_nfe,
        '<dest[^>]*>.*?<CPF>([0-9]{11})</CPF>'
      ))[1];
    END IF;
    v_nome := (regexp_match(
      r.xml_nfe,
      '<dest[^>]*>.*?<xNome>([^<]+)</xNome>'
    ))[1];

    IF v_cnpj IS NOT NULL OR v_nome IS NOT NULL THEN
      UPDATE public.nfe_distribuicao
         SET cnpj_destinatario = COALESCE(cnpj_destinatario, v_cnpj),
             nome_destinatario = COALESCE(nome_destinatario, btrim(v_nome))
       WHERE id = r.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;
