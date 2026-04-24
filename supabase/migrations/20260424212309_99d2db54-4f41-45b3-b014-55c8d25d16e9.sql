CREATE OR REPLACE FUNCTION public.proximo_numero_orcamento()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_max_existing bigint;
  v_seq_current bigint;
  v_next bigint;
BEGIN
  -- Maior número já usado em orcamentos (formato ORC000123)
  SELECT COALESCE(MAX(NULLIF(regexp_replace(numero, '\D', '', 'g'), '')::bigint), 0)
    INTO v_max_existing
  FROM public.orcamentos
  WHERE numero ~ '^ORC';

  -- Sincroniza a sequence se ela estiver atrasada em relação aos dados
  v_seq_current := COALESCE((SELECT last_value FROM public.seq_orcamento), 0);
  IF v_max_existing >= v_seq_current THEN
    PERFORM setval('public.seq_orcamento', v_max_existing, true);
  END IF;

  v_next := nextval('public.seq_orcamento');
  RETURN 'ORC' || LPAD(v_next::text, 6, '0');
END;
$function$;