import { useQuery } from "@tanstack/react-query";
import { fetchProdutosEstoque, type ProdutoRow } from "../services/estoque.service";

export function useEstoque() {
  return useQuery<ProdutoRow[], Error>({
    queryKey: ["estoque-produtos"],
    queryFn: fetchProdutosEstoque,
    staleTime: 2 * 60 * 1000,
  });
}
