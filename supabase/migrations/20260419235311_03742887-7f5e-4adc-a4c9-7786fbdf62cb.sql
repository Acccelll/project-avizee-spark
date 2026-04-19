CREATE OR REPLACE FUNCTION public.count_estoque_baixo()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)
  FROM produtos
  WHERE ativo = true
    AND estoque_minimo > 0
    AND estoque_atual <= estoque_minimo;
$$;

GRANT EXECUTE ON FUNCTION public.count_estoque_baixo() TO authenticated;