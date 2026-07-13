import { supabase } from "@/integrations/supabase/client";
import { autoCandidato } from "./importacaoLote.service";

export interface AutoConciliarResult {
  linhasAvaliadas: number;
  vinculadas: number;
  faturas: number;
}

/**
 * Percorre linhas pendentes das faturas indicadas e tenta auto-vincular
 * cada uma a um lançamento financeiro compatível (valor ±0.01, data ±5d).
 * Reaproveita a heurística usada no import em lote.
 */
export async function autoConciliarFaturas(params: {
  empresa_id: string;
  faturas: { id: string; cartao_id: string }[];
}): Promise<AutoConciliarResult> {
  let linhasAvaliadas = 0;
  let vinculadas = 0;

  for (const f of params.faturas) {
    const { data: linhas, error } = await supabase
      .from("cartao_fatura_lancamentos")
      .select("id, valor, data_compra, status")
      .eq("cartao_fatura_id", f.id)
      .eq("status", "pendente");
    if (error) throw error;

    for (const l of linhas ?? []) {
      linhasAvaliadas++;
      const cand = await autoCandidato({
        empresa_id: params.empresa_id,
        cartao_id: f.cartao_id,
        valor: Number(l.valor),
        data: l.data_compra as string,
      });
      if (!cand) continue;
      const { error: e1 } = await supabase
        .from("cartao_fatura_lancamentos")
        .update({ lancamento_id: cand, status: "aceito" })
        .eq("id", l.id)
        .is("lancamento_id", null);
      if (e1) continue;
      const { error: e2 } = await supabase
        .from("financeiro_lancamentos")
        .update({ cartao_fatura_id: f.id })
        .eq("id", cand)
        .is("cartao_fatura_id", null);
      if (e2) continue;
      vinculadas++;
    }
  }

  return { linhasAvaliadas, vinculadas, faturas: params.faturas.length };
}