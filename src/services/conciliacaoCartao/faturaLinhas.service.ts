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

/** Vincula várias linhas ao mesmo lançamento (N:1). */
export async function vincularLinhasEmLote(ids: string[], lancamentoId: string): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase
    .from("cartao_fatura_lancamentos")
    .update({ lancamento_id: lancamentoId, status: "vinculada" } as never)
    .in("id", ids);
  if (error) throw error;
}

/** Desfaz a vinculação de uma linha (volta a "pendente"). */
export async function desvincularLinha(id: string): Promise<void> {
  const { error } = await supabase
    .from("cartao_fatura_lancamentos")
    .update({ lancamento_id: null, status: "pendente" } as never)
    .eq("id", id);
  if (error) throw error;
}

/**
 * Candidatos ERP para conciliação de uma fatura: lançamentos "a pagar" abertos
 * (ou parciais) do mesmo cartão OU dentro da janela de vencimento da fatura.
 */
export async function listLancamentosCandidatosDaFatura(params: {
  empresa_id: string;
  cartao_id: string;
  data_fechamento: string | null;
  data_vencimento: string | null;
  janelaDias?: number;
}): Promise<CandidatoLancamento[]> {
  const janela = params.janelaDias ?? 45;
  const ref = params.data_vencimento ?? params.data_fechamento;
  let min: string | null = null;
  let max: string | null = null;
  if (ref) {
    const d = new Date(`${ref}T00:00:00Z`);
    const dMin = new Date(d); dMin.setUTCDate(dMin.getUTCDate() - janela);
    const dMax = new Date(d); dMax.setUTCDate(dMax.getUTCDate() + janela);
    min = dMin.toISOString().slice(0, 10);
    max = dMax.toISOString().slice(0, 10);
  }
  let q = supabase
    .from("financeiro_lancamentos")
    .select("id, descricao, valor, data_vencimento, status, parcela_numero, parcela_total, fornecedores(nome_razao_social)")
    .eq("empresa_id", params.empresa_id)
    .eq("tipo", "pagar")
    .eq("ativo", true)
    .is("cartao_fatura_id", null)
    .in("status", ["aberto", "parcial"])
    .order("data_vencimento", { ascending: true })
    .limit(500);
  if (min && max) q = q.gte("data_vencimento", min).lte("data_vencimento", max);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as CandidatoLancamento[];
}

export interface CandidatoLancamento {
  id: string;
  descricao: string | null;
  valor: number;
  data_vencimento: string;
  status: string | null;
  parcela_numero?: number | null;
  parcela_total?: number | null;
  fornecedores?: { nome_razao_social: string | null } | null;
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
      origem_tipo: "cartao_fatura",
    } as never)
    .select("id")
    .single();
  if (error) throw error;
  const lancId = (data as { id: string }).id;
  await vincularLinha(params.linha_id, lancId);
  return lancId;
}

/**
 * Exclui uma fatura de cartão. Bloqueia se estiver paga.
 * `cartao_fatura_lancamentos` cascateia; `financeiro_lancamentos.cartao_fatura_id`
 * fica `NULL` (o título permanece para não perder rastro contábil).
 */
export async function excluirFatura(faturaId: string): Promise<void> {
  const { data: fatura, error: err1 } = await supabase
    .from("cartao_faturas")
    .select("id, status")
    .eq("id", faturaId)
    .maybeSingle();
  if (err1) throw err1;
  if (!fatura) throw new Error("Fatura não encontrada");
  if (fatura.status === "paga") {
    throw new Error("Fatura já paga — estorne a baixa antes de excluir");
  }
  const { error } = await supabase.from("cartao_faturas").delete().eq("id", faturaId);
  if (error) throw error;
}