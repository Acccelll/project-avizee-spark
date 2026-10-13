import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/services/_lib/fetchAllPages";

/** Relações já existentes no banco; não cria vínculos nem infere por valores. */
export async function listComprasGridVinculos() {
  const [pedidos, cotacoes] = await Promise.all([
    fetchAllPages<{ id: string; numero: string | null; cotacao_compra_id: string | null }>(() =>
      supabase.from("pedidos_compra")
        .select("id, numero, cotacao_compra_id")
        .not("cotacao_compra_id", "is", null)
        .order("id", { ascending: false }) as never,
    ),
    fetchAllPages<{ id: string; numero: string }>(() =>
      supabase.from("cotacoes_compra")
        .select("id, numero")
        .order("created_at", { ascending: false }) as never,
    ),
  ]);
  const numeroCotacaoById: Record<string, string> = {};
  cotacoes.forEach((c) => { numeroCotacaoById[String(c.id)] = c.numero; });
  const pedidosByCotacaoId: Record<string, Array<{ id: string; numero: string }>> = {};
  pedidos.forEach((p) => {
    if (!p.cotacao_compra_id) return;
    const key = String(p.cotacao_compra_id);
    (pedidosByCotacaoId[key] ??= []).push({
      id: String(p.id),
      numero: p.numero || `PC-${p.id}`,
    });
  });
  return { numeroCotacaoById, pedidosByCotacaoId };
}
