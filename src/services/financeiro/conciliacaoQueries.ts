import { supabase } from "@/integrations/supabase/client";
import type { TituloParaConciliacao } from "@/services/financeiro/conciliacao.service";

/** Busca lançamentos pendentes via view consolidada `vw_conciliacao_eventos_financeiros`. */
export async function listLancamentosParaConciliacao(input: {
  contaId: string;
  dataInicio: string;
  dataFim: string;
}): Promise<TituloParaConciliacao[]> {
  const { contaId, dataInicio, dataFim } = input;
  if (!contaId) return [];

  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("vw_conciliacao_eventos_financeiros" as any)
    .select("lancamento_id, descricao, valor_movimento, data_movimento, tipo, status_titulo, conciliacao_status")
    .eq("conta_bancaria_id", contaId)
    .gte("data_movimento", dataInicio)
    .lte("data_movimento", dataFim)
    .in("conciliacao_status", ["pendente", "divergente", "desconciliado"])
    .order("data_movimento", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data as unknown as Array<Record<string, unknown>>) ?? []).map((item) => ({
    id: String(item.lancamento_id),
    descricao: (item.descricao as string | null) ?? null,
    valor: Number(item.valor_movimento ?? 0),
    data_vencimento: String(item.data_movimento),
    tipo: String(item.tipo ?? ""),
    status: String(item.status_titulo ?? "aberto"),
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