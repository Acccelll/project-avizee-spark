import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type LancamentoInsert =
  Database["public"]["Tables"]["financeiro_lancamentos"]["Insert"];

/**
 * Insert simples em `financeiro_lancamentos`.
 *
 * Para fluxos transacionais (parcelamento, baixa, estorno) use os
 * RPCs/serviços dedicados (`gerarParcelas`, `processarBaixaLote`, etc).
 * Esta função cobre apenas o lançamento manual avulso.
 */
export async function createLancamento(payload: LancamentoInsert): Promise<void> {
  const { error } = await supabase
    .from("financeiro_lancamentos")
    .insert({ ativo: true, ...payload });
  if (error) throw new Error(error.message);
}
