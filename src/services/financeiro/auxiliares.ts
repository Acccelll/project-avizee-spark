import { supabase } from "@/integrations/supabase/client";
import type { FinanceiroAuxiliaresState } from "@/pages/financeiro/types";

/** Carrega contas bancárias ativas + contas contábeis lançáveis, em paralelo. */
export async function fetchFinanceiroAuxiliares(): Promise<FinanceiroAuxiliaresState> {
  const [{ data: contas }, { data: contabeis }] = await Promise.all([
    supabase.from("contas_bancarias").select("*, bancos(nome)").eq("ativo", true),
    supabase
      .from("contas_contabeis")
      .select("id, codigo, descricao")
      .eq("ativo", true)
      .eq("aceita_lancamento", true)
      .order("codigo"),
  ]);
  return {
    contasBancarias: contas || [],
    contasContabeis: contabeis || [],
  };
}