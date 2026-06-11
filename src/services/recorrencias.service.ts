/**
 * Cobranças Recorrentes — service.
 *
 * Templates que materializam lançamentos no Financeiro a cada ciclo.
 * A geração é feita pela RPC `gerar_lancamentos_recorrentes` (cron diário) ou
 * pontualmente via `gerar_lancamento_recorrencia_agora(id)`.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Recorrencia = Tables<"financeiro_recorrencias"> & {
  clientes?: { nome_razao_social: string } | null;
  fornecedores?: { nome_razao_social: string } | null;
  cartoes_credito?: { nome: string; ultimos4: string | null } | null;
  contas_bancarias?: { descricao: string } | null;
};

export type RecorrenciaInsert = TablesInsert<"financeiro_recorrencias">;
export type RecorrenciaUpdate = TablesUpdate<"financeiro_recorrencias">;

const SELECT_FULL =
  "*, clientes(nome_razao_social), fornecedores(nome_razao_social), cartoes_credito:cartao_id(nome, ultimos4), contas_bancarias(descricao)";

export async function listRecorrencias(): Promise<Recorrencia[]> {
  const { data, error } = await supabase
    .from("financeiro_recorrencias")
    .select(SELECT_FULL)
    .order("proxima_geracao", { ascending: true })
    .limit(1000); // TODO(paginação): migrar para serverPagination quando volume justificar
  if (error) throw error;
  return (data || []) as Recorrencia[];
}

export async function getRecorrencia(id: string): Promise<Recorrencia | null> {
  const { data, error } = await supabase
    .from("financeiro_recorrencias")
    .select(SELECT_FULL)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Recorrencia) || null;
}

export async function createRecorrencia(payload: RecorrenciaInsert): Promise<Recorrencia> {
  const { data, error } = await supabase
    .from("financeiro_recorrencias")
    .insert(payload)
    .select(SELECT_FULL)
    .single();
  if (error) throw error;
  return data as Recorrencia;
}

export async function updateRecorrencia(
  id: string,
  payload: RecorrenciaUpdate,
): Promise<Recorrencia> {
  const { data, error } = await supabase
    .from("financeiro_recorrencias")
    .update(payload)
    .eq("id", id)
    .select(SELECT_FULL)
    .single();
  if (error) throw error;
  return data as Recorrencia;
}

export async function setRecorrenciaStatus(
  id: string,
  status: "ativa" | "pausada" | "encerrada" | "cancelada",
  motivo?: string,
): Promise<void> {
  const patch: RecorrenciaUpdate = { status };
  if (motivo && (status === "encerrada" || status === "cancelada")) {
    patch.motivo_encerramento = motivo;
  }
  const { error } = await supabase
    .from("financeiro_recorrencias")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteRecorrencia(id: string): Promise<void> {
  const { error } = await supabase.from("financeiro_recorrencias").delete().eq("id", id);
  if (error) throw error;
}

/** Dispara a RPC pontualmente — gera 1 ciclo imediato. */
export async function gerarRecorrenciaAgora(id: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("gerar_lancamento_recorrencia_agora", {
    p_recorrencia_id: id,
  });
  if (error) throw error;
  return (data as string) || null;
}

/**
 * Cria uma recorrência atrelada a uma NF-e (origem = 'nfe') e vincula a
 * coluna `recorrencia_id` da própria NF-e. Em seguida materializa o
 * primeiro ciclo via `gerar_lancamento_recorrencia_agora`.
 */
export async function criarRecorrenciaParaNfe(input: {
  nfeId: string;
  payload: Omit<RecorrenciaInsert, "origem" | "origem_id">;
}): Promise<Recorrencia> {
  const rec = await createRecorrencia({
    ...input.payload,
    origem: "nfe",
    origem_id: input.nfeId,
  } as RecorrenciaInsert);
  const { error: upErr } = await supabase
    .from("notas_fiscais")
    .update({ recorrencia_id: rec.id })
    .eq("id", input.nfeId);
  if (upErr) throw upErr;
  try {
    await gerarRecorrenciaAgora(rec.id);
  } catch {
    // primeira geração é best-effort; o cron diário cobre.
  }
  return rec;
}

export async function getRecorrenciaDaNfe(nfeId: string): Promise<Recorrencia | null> {
  const { data, error } = await supabase
    .from("financeiro_recorrencias")
    .select(SELECT_FULL)
    .eq("origem", "nfe")
    .eq("origem_id", nfeId)
    .maybeSingle();
  if (error) throw error;
  return (data as Recorrencia) || null;
}

/** Lista os lançamentos materializados por uma recorrência. */
export async function listLancamentosDaRecorrencia(id: string) {
  const { data, error } = await supabase
    .from("financeiro_lancamentos")
    .select("id, descricao, valor, data_vencimento, status, recorrencia_ciclo")
    .eq("recorrencia_id", id)
    .order("recorrencia_ciclo", { ascending: false });
  if (error) throw error;
  return data || [];
}

// ── Helpers de UI ──────────────────────────────────────────────────────────

export const PERIODICIDADE_OPTIONS = [
  { value: "mensal", label: "Mensal" },
  { value: "bimestral", label: "Bimestral" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
] as const;

export type Periodicidade = (typeof PERIODICIDADE_OPTIONS)[number]["value"];

export function periodicidadeLabel(p: string | null | undefined): string {
  return PERIODICIDADE_OPTIONS.find((o) => o.value === p)?.label ?? p ?? "—";
}