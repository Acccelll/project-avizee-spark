import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { computeValorTotalEstoque, filterEstoqueBaixo } from "@/lib/dashboard/aggregations";
import type { ProdRow } from "./types";

interface EstoqueData {
  produtos: number;
  estoqueBaixo: ProdRow[];
  valorEstoque: number;
}

export function useDashboardEstoqueData() {
  const loadEstoqueData = useCallback(async (): Promise<EstoqueData> => {
    try {
      const [produtosResult, estMinResult, valorResult] = await Promise.all([
        supabase.from("produtos").select("*", { count: "exact", head: true }).eq("ativo", true),
        // Fetches up to 100 products with a defined minimum stock for client-side
        // comparison. The resulting count is a preview (not a guaranteed total).
        supabase
          .from("produtos")
          .select("id, nome, codigo_interno, estoque_atual, estoque_minimo, unidade_medida")
          .eq("ativo", true)
          .not("estoque_minimo", "is", null)
          .limit(100),
        supabase.from("produtos").select("estoque_atual, preco_custo").eq("ativo", true),
      ]);

      if (produtosResult.error) console.error("[dashboard:estoque] produtos:", produtosResult.error.message);
      if (estMinResult.error) console.error("[dashboard:estoque] estMinimo:", estMinResult.error.message);
      if (valorResult.error) console.error("[dashboard:estoque] valor:", valorResult.error.message);

      return {
        produtos: produtosResult.count ?? 0,
        estoqueBaixo: filterEstoqueBaixo((estMinResult.data ?? []) as ProdRow[]),
        valorEstoque: computeValorTotalEstoque(
          (valorResult.data ?? []) as Array<{ estoque_atual: number | null; preco_custo: number | null }>,
        ),
      };
    } catch (error) {
      console.error("[dashboard:estoque] erro inesperado:", error);
      return { produtos: 0, estoqueBaixo: [], valorEstoque: 0 };
    }
  }, []);

  return { loadEstoqueData };
}
