import { supabase } from "@/integrations/supabase/client";

export type BudgetCategoria = "receita" | "despesa" | "fopag" | "imposto" | "investimento";

export interface BudgetMensal {
  id: string;
  competencia: string;
  categoria: BudgetCategoria;
  centro_custo_id: string | null;
  valor: number;
  observacoes: string | null;
}

export interface BudgetMensalInput {
  competencia: string; // YYYY-MM-DD
  categoria: BudgetCategoria;
  valor: number;
  observacoes?: string | null;
  centro_custo_id?: string | null;
}

const TABLE = "budgets_mensais";

// budgets_mensais ainda não está nos tipos gerados — encapsulamos o cast aqui
// para que páginas/hooks consumam apenas a API tipada do service.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = () => (supabase as any).from(TABLE);

export async function listBudgetsMensais(): Promise<BudgetMensal[]> {
  const { data, error } = await tbl()
    .select("id, competencia, categoria, centro_custo_id, valor, observacoes")
    .order("competencia", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BudgetMensal[];
}

export async function createBudgetMensal(input: BudgetMensalInput): Promise<void> {
  const { error } = await tbl().insert({
    competencia: input.competencia,
    categoria: input.categoria,
    valor: input.valor,
    observacoes: input.observacoes ?? null,
    centro_custo_id: input.centro_custo_id ?? null,
  });
  if (error) throw error;
}

export async function deleteBudgetMensal(id: string): Promise<void> {
  const { error } = await tbl().delete().eq("id", id);
  if (error) throw error;
}
