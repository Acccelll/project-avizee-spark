-- Backfill de orcamentos_itens.variacao a partir do snapshot atual em produtos.variacoes
UPDATE public.orcamentos_itens AS oi
SET variacao = p.variacoes
FROM public.produtos AS p
WHERE p.id = oi.produto_id
  AND COALESCE(BTRIM(p.variacoes), '') <> ''
  AND COALESCE(BTRIM(oi.variacao), '') = '';

-- Backfill equivalente em ordens_venda_itens, para manter consistência com o mesmo snapshot
UPDATE public.ordens_venda_itens AS ovi
SET variacao = p.variacoes
FROM public.produtos AS p
WHERE p.id = ovi.produto_id
  AND COALESCE(BTRIM(p.variacoes), '') <> ''
  AND COALESCE(BTRIM(ovi.variacao), '') = '';