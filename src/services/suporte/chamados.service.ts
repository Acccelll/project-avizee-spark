import { supabase } from "@/integrations/supabase/client";
import type {
  AbrirChamadoInput,
  SuporteCausa,
  SuporteChamado,
  SuportePrioridade,
  SuporteStatus,
  SuporteTipo,
} from "./types";

/**
 * Cria um chamado (RPC `criar_chamado_suporte`). `solicitante_id` é derivado
 * de `auth.uid()` dentro da função — nunca é enviado pelo cliente (regra
 * crítica da especificação, seção 29/42 do handoff original).
 */
export async function abrirChamado(
  input: AbrirChamadoInput,
): Promise<{ id: string; numero: string }> {
  const { data, error } = await supabase.rpc("criar_chamado_suporte", {
    p_tipo: input.tipo,
    p_resumo: input.resumo,
    p_descricao: input.descricao,
    p_impacto: input.impacto,
    p_abrangencia: input.abrangencia,
    p_frequencia: input.frequencia,
    p_rota: input.rota,
    p_registro_relacionado_tipo: input.registroRelacionadoTipo ?? null,
    p_registro_relacionado_id: input.registroRelacionadoId ?? null,
    p_diagnostico: (input.diagnostico as never) ?? null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { id: row.id, numero: row.numero };
}

/** Chamados do próprio usuário — RLS restringe a `solicitante_id = auth.uid()`. */
export async function listMeusChamados(): Promise<SuporteChamado[]> {
  const { data, error } = await supabase
    .from("suporte_chamados")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Fila administrativa — RLS libera para admin ver todos os chamados. */
export async function listFilaChamados(): Promise<SuporteChamado[]> {
  const { data, error } = await supabase
    .from("suporte_chamados")
    .select("*")
    .order("prioridade", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getChamado(id: string): Promise<SuporteChamado | null> {
  const { data, error } = await supabase
    .from("suporte_chamados")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Busca por número de exibição (`CH-000123`) — usado para marcar duplicidade (seção 28). */
export async function getChamadoPorNumero(numero: string): Promise<SuporteChamado | null> {
  const { data, error } = await supabase
    .from("suporte_chamados")
    .select("*")
    .eq("numero", numero.trim())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function assumirChamado(chamadoId: string): Promise<void> {
  const { error } = await supabase.rpc("suporte_assumir_chamado", {
    p_chamado_id: chamadoId,
  });
  if (error) throw error;
}

export async function atribuirResponsavel(
  chamadoId: string,
  responsavelId: string,
): Promise<void> {
  const { error } = await supabase.rpc("suporte_atribuir_responsavel", {
    p_chamado_id: chamadoId,
    p_responsavel_id: responsavelId,
  });
  if (error) throw error;
}

export async function triarChamado(
  chamadoId: string,
  patch: {
    tipo?: SuporteTipo;
    prioridade?: SuportePrioridade;
    modulo?: string;
    status?: SuporteStatus;
  },
): Promise<void> {
  const { error } = await supabase.rpc("suporte_triar_chamado", {
    p_chamado_id: chamadoId,
    p_tipo: patch.tipo ?? null,
    p_prioridade: patch.prioridade ?? null,
    p_modulo: patch.modulo ?? null,
    p_status: patch.status ?? null,
  });
  if (error) throw error;
}

export async function resolverChamado(
  chamadoId: string,
  resumoResolucao: string,
  causa?: SuporteCausa,
): Promise<void> {
  const { error } = await supabase.rpc("suporte_resolver_chamado", {
    p_chamado_id: chamadoId,
    p_resumo_resolucao: resumoResolucao,
    p_causa: causa ?? null,
  });
  if (error) throw error;
}

/**
 * Confirmação do solicitante após "Resolvido" (seção 27): `true` fecha o
 * chamado; `false` reabre para `em_andamento`. Também usada pelo admin.
 */
export async function confirmarResolucao(
  chamadoId: string,
  confirmado: boolean,
): Promise<void> {
  const { error } = await supabase.rpc("suporte_confirmar_resolucao", {
    p_chamado_id: chamadoId,
    p_confirmado: confirmado,
  });
  if (error) throw error;
}

export async function cancelarChamado(
  chamadoId: string,
  motivo?: string,
): Promise<void> {
  const { error } = await supabase.rpc("suporte_cancelar_chamado", {
    p_chamado_id: chamadoId,
    p_motivo: motivo ?? null,
  });
  if (error) throw error;
}

export async function marcarDuplicado(
  chamadoId: string,
  duplicadoDeId: string,
): Promise<void> {
  const { error } = await supabase.rpc("suporte_marcar_duplicado", {
    p_chamado_id: chamadoId,
    p_duplicado_de_id: duplicadoDeId,
  });
  if (error) throw error;
}
