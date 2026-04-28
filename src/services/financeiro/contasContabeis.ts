/**
 * Helpers para a tabela `contas_contabeis` — começando com a contagem
 * de vínculos exibida no `ContaContabilDrawer`.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ContaContabilVinculos {
  lancamentos: number;
  notas_fiscais: number;
  grupos_produto: number;
}

export async function fetchContaContabilVinculos(
  contaContabilId: string,
): Promise<ContaContabilVinculos> {
  const [lanc, nf, gp] = await Promise.all([
    supabase
      .from("financeiro_lancamentos")
      .select("id", { count: "exact", head: true })
      .eq("conta_contabil_id", contaContabilId)
      .eq("ativo", true),
    supabase
      .from("notas_fiscais")
      .select("id", { count: "exact", head: true })
      .eq("conta_contabil_id", contaContabilId)
      .eq("ativo", true),
    supabase
      .from("grupos_produto")
      .select("id", { count: "exact", head: true })
      .eq("conta_contabil_id", contaContabilId),
  ]);
  return {
    lancamentos: lanc.count ?? 0,
    notas_fiscais: nf.count ?? 0,
    grupos_produto: gp.count ?? 0,
  };
}
