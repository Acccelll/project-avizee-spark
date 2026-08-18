import { supabase } from "@/integrations/supabase/client";
import type { TituloParaConciliacao } from "@/services/financeiro/conciliacao.service";

/** Busca eventos financeiros pendentes via view consolidada `vw_conciliacao_eventos_financeiros`. */
export async function listLancamentosParaConciliacao(input: {
  contaId: string;
  dataInicio: string;
  dataFim: string;
}): Promise<TituloParaConciliacao[]> {
  const { contaId, dataInicio, dataFim } = input;
  if (!contaId) return [];

  const { data, error } = await supabase
    .from("vw_conciliacao_eventos_financeiros")
    .select("lancamento_id, lancamento_descricao, valor_pago, data_baixa, lancamento_tipo, conciliacao_status")
    .eq("conta_bancaria_id", contaId)
    .gte("data_baixa", dataInicio)
    .lte("data_baixa", dataFim)
    .in("conciliacao_status", ["pendente", "divergente", "desconciliado"])
    .order("data_baixa", { ascending: true })
    .limit(5000); // período pode ser amplo; teto de segurança
  if (error) throw new Error(error.message);
  return ((data as unknown as Array<Record<string, unknown>>) ?? []).map((item) => ({
    id: String(item.lancamento_id),
    descricao: (item.lancamento_descricao as string | null) ?? null,
    valor: Number(item.valor_pago ?? 0),
    // O contrato legado chama o eixo de data de `data_vencimento`, mas a
    // conciliação canônica opera sobre a data real da baixa.
    data_vencimento: String(item.data_baixa),
    data_baixa: String(item.data_baixa),
    tipo: String(item.lancamento_tipo ?? ""),
    // A view consolidada atual não expõe status persistido do título.
    // Não inventamos um status financeiro a partir do status de conciliação.
    status: null,
  }));
}

export interface SugestaoConciliacaoExtratoItem {
  id: string;
  valor: number;
  data: string;
  descricao: string;
}

export interface SugestaoConciliacaoRanked {
  extrato_id: string;
  lancamento_id: string;
  score: number;
}

/** Chama a RPC `sugerir_conciliacao_bancaria` (pg_trgm). */
export async function sugerirConciliacaoBancariaRpc(input: {
  contaId: string;
  extrato: SugestaoConciliacaoExtratoItem[];
}): Promise<SugestaoConciliacaoRanked[]> {
  const { data, error } = await supabase.rpc("sugerir_conciliacao_bancaria", {
    p_conta_id: input.contaId,
    p_extrato: input.extrato as unknown as never,
  });
  if (error) throw error;
  return (data || []) as SugestaoConciliacaoRanked[];
}
