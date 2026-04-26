/**
 * RH service — operações de folha de pagamento e geração financeira para
 * `pages/Funcionarios.tsx`.
 *
 * O CRUD da entidade `funcionarios` continua usando `useSupabaseCrud`;
 * este service cobre as operações específicas da folha (criação e
 * geração dos lançamentos financeiros via RPC).
 */
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

export interface GerarFinanceiroFolhaResult {
  ok?: boolean;
  erro?: string;
  data_pagamento?: string;
  data_fgts?: string;
}

export async function createFolhaPagamento(
  payload: TablesInsert<"folha_pagamento">,
): Promise<void> {
  const { error } = await supabase.from("folha_pagamento").insert(payload);
  if (error) throw error;
}

export async function gerarFinanceiroFolha(
  folhaId: string,
): Promise<GerarFinanceiroFolhaResult> {
  const { data, error } = await supabase.rpc("gerar_financeiro_folha", {
    p_folha_id: folhaId,
  });
  if (error) throw error;
  return (data || {}) as GerarFinanceiroFolhaResult;
}