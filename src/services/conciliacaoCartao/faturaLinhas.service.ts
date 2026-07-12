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