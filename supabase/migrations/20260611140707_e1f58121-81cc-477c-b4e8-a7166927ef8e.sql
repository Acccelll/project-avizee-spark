
ALTER TABLE public.nfe_distribuicao
  ADD COLUMN IF NOT EXISTS cnpj_destinatario text,
  ADD COLUMN IF NOT EXISTS nome_destinatario text;

CREATE INDEX IF NOT EXISTS idx_nfe_dist_destinatario
  ON public.nfe_distribuicao(cnpj_destinatario);

-- Backfill: extrai <dest><CNPJ>/<CPF>/<xNome> do xml_nfe e popula as colunas
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
      AND xml_nfe LIKE '%<dest%'
      AND (cnpj_destinatario IS NULL OR nome_destinatario IS NULL)
  LOOP
    -- Captura primeiro CNPJ ou CPF dentro do bloco <dest>...</dest>
    v_cnpj := NULL;
    v_nome := NULL;
    v_cnpj := (regexp_match(
      r.xml_nfe,
      '<dest\b[^>]*>[\s\S]*?<CNPJ>\s*([0-9]{14})\s*</CNPJ>',
      'i'
    ))[1];
    IF v_cnpj IS NULL THEN
      v_cnpj := (regexp_match(
        r.xml_nfe,
        '<dest\b[^>]*>[\s\S]*?<CPF>\s*([0-9]{11})\s*</CPF>',
        'i'
      ))[1];
    END IF;
    v_nome := (regexp_match(
      r.xml_nfe,
      '<dest\b[^>]*>[\s\S]*?<xNome>\s*([^<]+?)\s*</xNome>',
      'i'
    ))[1];

    IF v_cnpj IS NOT NULL OR v_nome IS NOT NULL THEN
      UPDATE public.nfe_distribuicao
         SET cnpj_destinatario = COALESCE(cnpj_destinatario, v_cnpj),
             nome_destinatario = COALESCE(nome_destinatario, v_nome)
       WHERE id = r.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_nfe_distribuicao_destinatario() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.backfill_nfe_distribuicao_destinatario() TO authenticated, service_role;
