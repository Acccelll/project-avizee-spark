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
    const [{ count: produtosCount }, { data: estMinRows }, { data: valorRows }] = await Promise.all([
      supabase.from("produtos").select("*", { count: "exact", head: true }).eq("ativo", true),
      supabase
        .from("produtos")
        .select("id, nome, codigo_interno, estoque_atual, estoque_minimo, unidade_medida")
        .eq("ativo", true)
        .not("estoque_minimo", "is", null)
        .limit(100),
      supabase.from("produtos").select("estoque_atual, preco_custo").eq("ativo", true),
    ]);

    return {
      produtos: produtosCount ?? 0,
      estoqueBaixo: filterEstoqueBaixo((estMinRows ?? []) as ProdRow[]),
      valorEstoque: computeValorTotalEstoque(
        (valorRows ?? []) as Array<{ estoque_atual: number | null; preco_custo: number | null }>,
      ),
    };
  }, []);

  return { loadEstoqueData };
}
