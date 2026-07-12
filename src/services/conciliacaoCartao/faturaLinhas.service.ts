/**
 * Serviço de linhas cruas da fatura de cartão (importadas do PDF/OFX).
 * Item 2 do backlog de Conciliação de Cartão — leitura e manutenção de
 * `cartao_fatura_lancamentos` (a vinculação a `financeiro_lancamentos`
 * será entregue em iteração dedicada, mas o schema já suporta).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type FaturaLinha = Tables<"cartao_fatura_lancamentos">;

export type FaturaLinhaStatus = "pendente" | "vinculada" | "criada" | "ignorada";

export async function listLinhasDaFatura(faturaId: string): Promise<FaturaLinha[]> {
  const { data, error } = await supabase
    .from("cartao_fatura_lancamentos")
    .select("*")
    .eq("cartao_fatura_id", faturaId)
    .order("data_compra", { ascending: true })
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as FaturaLinha[];
}

export async function setLinhaStatus(id: string, status: FaturaLinhaStatus): Promise<void> {
  const patch: Partial<FaturaLinha> = { status };
  if (status === "pendente" || status === "ignorada") {
    patch.lancamento_id = null;
  }
  const { error } = await supabase
    .from("cartao_fatura_lancamentos")
    .update(patch as never)
    .eq("id", id);
  if (error) throw error;
}

export async function vincularLinha(id: string, lancamentoId: string): Promise<void> {
  const { error } = await supabase
    .from("cartao_fatura_lancamentos")
    .update({ lancamento_id: lancamentoId, status: "vinculada" } as never)
    .eq("id", id);
  if (error) throw error;
}

export interface CandidatoLancamento {
  id: string;
  descricao: string | null;
  valor: number;
  data_vencimento: string;
  status: string | null;
}

/** Busca lançamentos "a pagar" abertos compatíveis para vincular a uma linha. */
export async function buscarLancamentosParaVincular(params: {
  empresa_id: string;
  valor: number;
  data: string;
  termo?: string;
  janelaDias?: number;
}): Promise<CandidatoLancamento[]> {
  const janela = params.janelaDias ?? 30;
  const d = new Date(`${params.data}T00:00:00Z`);
  const min = new Date(d); min.setUTCDate(min.getUTCDate() - janela);
  const max = new Date(d); max.setUTCDate(max.getUTCDate() + janela);
  const valorAbs = Math.abs(params.valor);

  let q = supabase
    .from("financeiro_lancamentos")
    .select("id, descricao, valor, data_vencimento, status")
    .eq("empresa_id", params.empresa_id)
    .eq("tipo", "pagar")
    .eq("ativo", true)
    .is("cartao_fatura_id", null)
    .gte("data_vencimento", min.toISOString().slice(0, 10))
    .lte("data_vencimento", max.toISOString().slice(0, 10))
    .gte("valor", valorAbs - 1)
    .lte("valor", valorAbs + 1)
    .limit(20);

  if (params.termo && params.termo.trim()) {
    q = q.ilike("descricao", `%${params.termo.trim()}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as CandidatoLancamento[];
}

/** Cria um lançamento "a pagar" a partir de uma linha da fatura e já vincula. */
export async function criarLancamentoDaLinha(params: {
  empresa_id: string;
  linha_id: string;
  cartao_id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from("financeiro_lancamentos")
    .insert({
      empresa_id: params.empresa_id,
      tipo: "pagar",
      descricao: params.descricao,
      valor: Math.abs(params.valor),
      data_vencimento: params.data_vencimento,
      status: "aberto",
      cartao_id: params.cartao_id,
      origem_tipo: "cartao_fatura_linha",
    } as never)
    .select("id")
    .single();
  if (error) throw error;
  const lancId = (data as { id: string }).id;
  await vincularLinha(params.linha_id, lancId);
  return lancId;
}