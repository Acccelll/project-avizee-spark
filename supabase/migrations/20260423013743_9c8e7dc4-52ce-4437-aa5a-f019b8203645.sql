
-- Tipo de retorno padronizado para a busca global.
CREATE OR REPLACE FUNCTION public.global_search(search_term text, max_per_category int DEFAULT 4)
RETURNS TABLE (
  category text,
  entity_id uuid,
  title text,
  subtitle text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  pattern text;
BEGIN
  IF search_term IS NULL OR length(trim(search_term)) < 2 THEN
    RETURN;
  END IF;

  pattern := '%' || trim(search_term) || '%';

  -- Clientes (RLS aplicada)
  RETURN QUERY
  SELECT 'cliente'::text,
         c.id,
         c.nome_razao_social,
         COALESCE(c.cpf_cnpj, 'Cliente')
  FROM public.clientes c
  WHERE c.ativo = true
    AND c.deleted_at IS NULL
    AND c.nome_razao_social ILIKE pattern
  ORDER BY c.nome_razao_social
  LIMIT max_per_category;

  -- Produtos
  RETURN QUERY
  SELECT 'produto'::text,
         p.id,
         p.nome,
         COALESCE(p.codigo_interno, p.sku, 'Produto')
  FROM public.produtos p
  WHERE p.ativo = true
    AND p.nome ILIKE pattern
  ORDER BY p.nome
  LIMIT max_per_category;

  -- Orçamentos
  RETURN QUERY
  SELECT 'orcamento'::text,
         o.id,
         ('Orçamento #' || o.numero)::text,
         COALESCE(o.status, 'Orçamento')
  FROM public.orcamentos o
  WHERE o.ativo = true
    AND o.numero ILIKE pattern
  ORDER BY o.numero DESC
  LIMIT max_per_category;

  -- Notas Fiscais
  RETURN QUERY
  SELECT 'nota_fiscal'::text,
         n.id,
         ('NF #' || n.numero)::text,
         (COALESCE(n.tipo, 'nota') || ' · ' || COALESCE(n.status, ''))::text
  FROM public.notas_fiscais n
  WHERE n.ativo = true
    AND n.numero ILIKE pattern
  ORDER BY n.numero DESC
  LIMIT max_per_category;
END;
$$;

GRANT EXECUTE ON FUNCTION public.global_search(text, int) TO authenticated;

COMMENT ON FUNCTION public.global_search(text, int) IS
  'Busca global unificada respeitando RLS de cada tabela. Retorna até max_per_category entidades por categoria (cliente/produto/orcamento/nota_fiscal).';
