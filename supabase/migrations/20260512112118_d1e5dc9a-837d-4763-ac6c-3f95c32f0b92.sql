CREATE OR REPLACE FUNCTION public.peek_proximo_numero_orcamento()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_existing bigint;
  v_seq_current  bigint;
  v_next         bigint;
BEGIN
  SELECT COALESCE(MAX(SUBSTRING(numero FROM 4)::bigint), 0)
    INTO v_max_existing
    FROM public.orcamentos
   WHERE numero ~ '^ORC[0-9]+$';

  SELECT COALESCE(last_value, 0) INTO v_seq_current FROM public.seq_orcamento;

  v_next := GREATEST(v_max_existing, v_seq_current) + 1;
  RETURN 'ORC' || LPAD(v_next::text, 6, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.peek_proximo_numero_orcamento() TO authenticated;