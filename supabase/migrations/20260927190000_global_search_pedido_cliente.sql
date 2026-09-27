-- Busca global: orçamentos também são achados pelo número do pedido do
-- cliente (ou OC), que passou a ser a referência do pedido de venda no lugar
-- da Ordem de Venda. O subtítulo mostra o pedido quando houver.
CREATE OR REPLACE FUNCTION public.global_search(search_term text, max_per_category integer DEFAULT 4)
RETURNS TABLE(category text, entity_id uuid, title text, subtitle text)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
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

  -- Orçamentos (pelo número ou pelo pedido do cliente)
  RETURN QUERY
  SELECT 'orcamento'::text,
         o.id,
         ('Orçamento #' || o.numero)::text,
         CASE
           WHEN o.pedido_cliente IS NOT NULL AND o.pedido_cliente <> o.numero
             THEN ('Pedido ' || o.pedido_cliente || ' · ' || COALESCE(o.status, ''))::text
           ELSE COALESCE(o.status, 'Orçamento')
         END
  FROM public.orcamentos o
  WHERE o.ativo = true
    AND (o.numero ILIKE pattern OR o.pedido_cliente ILIKE pattern)
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
$function$;
