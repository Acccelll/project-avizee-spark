/**
 * Suporte (Ajuda, Suporte e Gestão de Chamados) — service.
 *
 * Wrappers tipados em torno das tabelas `suporte_*` e das RPCs do domínio
 * (ver `supabase/migrations/20260909120000_suporte_chamados_core.sql`).
 * Segue o padrão dos outros services: funções puras, throw em erro, sem UX
 * (toast/navegação ficam nos hooks/componentes).
 *
 * Criação, comentários, mudanças de status e o diagnóstico sensível sempre
 * passam pelas RPCs — nunca por INSERT/UPDATE direto — para preservar a
 * timeline automática e a filtragem de campos sensíveis.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type SuporteChamado = Tables<"suporte_chamados">;
export type SuporteEvento = Tables<"suporte_eventos">;
export type SuporteAnexo = Tables<"suporte_anexos">;

export type SuporteTipo = SuporteChamado["tipo"];
export type SuporteStatus = SuporteChamado["status"];
export type SuporteImpacto = SuporteChamado["impacto"];
export type SuporteAbrangencia = SuporteChamado["abrangencia"];
export type SuporteFrequencia = SuporteChamado["frequencia"];
export type SuporteCausa = NonNullable<SuporteChamado["causa_resolucao"]>;

const ANEXOS_BUCKET = "dbavizee";

/** Contexto técnico opcional coletado automaticamente (ver `src/lib/suporte/diagnostico.ts`). */
export interface DiagnosticoContexto {
  url_relativa?: string;
  versao_build?: string;
  ambiente?: string;
  navegador?: string;
  sistema_operacional?: string;
  viewport?: string;
  idioma?: string;
  conectividade?: string;
  contexto_tela?: Record<string, unknown>;
  erro_codigo?: string;
  erro_operacao?: string;
  erro_mensagem_amigavel?: string;
  erro_correlation_id?: string;
  erro_http_status?: number;
  erro_stack_trace?: string;
  erros_recentes?: unknown[];
  requisicoes_rede?: unknown[];
}

export interface CriarChamadoInput {
  tipo: SuporteTipo;
  resumo: string;
  descricao: string;
  impacto: SuporteImpacto;
  abrangencia: SuporteAbrangencia;
  frequencia: SuporteFrequencia;
  rota: string;
  registroRelacionadoTipo?: string;
  registroRelacionadoId?: string;
  diagnostico?: DiagnosticoContexto;
}

/** Abertura transacional (chamado + diagnóstico + evento de abertura) via RPC. */
export async function criarChamadoSuporte(
  input: CriarChamadoInput,
): Promise<{ id: string; numero: string }> {
  const { data, error } = await supabase.rpc("criar_chamado_suporte", {
    p_tipo: input.tipo,
    p_resumo: input.resumo,
    p_descricao: input.descricao,
    p_impacto: input.impacto,
    p_abrangencia: input.abrangencia,
    p_frequencia: input.frequencia,
    p_rota: input.rota,
    p_registro_relacionado_tipo: input.registroRelacionadoTipo,
    p_registro_relacionado_id: input.registroRelacionadoId,
    p_diagnostico: input.diagnostico as never,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error("Chamado não foi criado.");
  return row;
}

/** Chamados visíveis ao usuário atual (RLS: solicitante, responsável ou admin). */
export async function listarMeusChamados(): Promise<SuporteChamado[]> {
  const { data, error } = await supabase
    .from("suporte_chamados")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
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

/** Timeline do chamado — RLS já filtra notas internas para não-admin. */
export async function listarEventosChamado(chamadoId: string): Promise<SuporteEvento[]> {
  const { data, error } = await supabase
    .from("suporte_eventos")
    .select("*")
    .eq("chamado_id", chamadoId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listarAnexosChamado(chamadoId: string): Promise<SuporteAnexo[]> {
  const { data, error } = await supabase
    .from("suporte_anexos")
    .select("*")
    .eq("chamado_id", chamadoId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** URL assinada de curta duração — bucket é privado, RLS controla quem chega até aqui. */
export async function getAnexoSignedUrl(caminhoStorage: string, expiresInSec = 300): Promise<string> {
  const { data, error } = await supabase.storage
    .from(ANEXOS_BUCKET)
    .createSignedUrl(caminhoStorage, expiresInSec);
  if (error) throw error;
  return data.signedUrl;
}

/** Upload de anexo (arquivo já escolhido pelo usuário — nunca captura automática). */
export async function uploadAnexoChamado(
  chamadoId: string,
  file: File,
  opts?: { isScreenshot?: boolean; eventoId?: string },
): Promise<SuporteAnexo> {
  const path = `chamados/${chamadoId}/${crypto.randomUUID()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from(ANEXOS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined });
  if (uploadError) throw uploadError;

  const { data: userData } = await supabase.auth.getUser();
  const uploadedBy = userData.user?.id;
  if (!uploadedBy) throw new Error("Usuário não autenticado.");

  const insert: TablesInsert<"suporte_anexos"> = {
    chamado_id: chamadoId,
    evento_id: opts?.eventoId,
    nome_arquivo: file.name,
    tipo_arquivo: file.type || "application/octet-stream",
    caminho_storage: path,
    tamanho: file.size,
    is_screenshot: opts?.isScreenshot ?? false,
    uploaded_by: uploadedBy,
  };
  const { data, error } = await supabase
    .from("suporte_anexos")
    .insert(insert)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Comentário público (qualquer autor no próprio chamado) ou nota interna (admin). */
export async function registrarComentarioSuporte(
  chamadoId: string,
  mensagem: string,
  visibilidade: "publico" | "interno" = "publico",
): Promise<string> {
  const { data, error } = await supabase.rpc("registrar_comentario_suporte", {
    p_chamado_id: chamadoId,
    p_mensagem: mensagem,
    p_visibilidade: visibilidade,
  });
  if (error) throw error;
  return data;
}

/** "Sim, resolvido" (confirmado=true, fecha) ou "Ainda tenho problema" (reabre). */
export async function confirmarResolucaoSuporte(chamadoId: string, confirmado: boolean): Promise<void> {
  const { error } = await supabase.rpc("suporte_confirmar_resolucao", {
    p_chamado_id: chamadoId,
    p_confirmado: confirmado,
  });
  if (error) throw error;
}

/** Diagnóstico técnico filtrado — sensível: use sempre esta RPC, nunca leia `suporte_diagnosticos` direto. */
export async function obterDiagnosticoSuporte(chamadoId: string) {
  const { data, error } = await supabase.rpc("obter_diagnostico_suporte", {
    p_chamado_id: chamadoId,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

// ---------------------------------------------------------------------------
// Ações administrativas (Gestão de chamados — recurso `suporte`, admin-only).
// ---------------------------------------------------------------------------

export interface AdminOption {
  id: string;
  nome: string;
}

/** Lista de admins para o seletor de "responsável" na triagem. */
export async function listarAdmins(): Promise<AdminOption[]> {
  const { data: rolesData, error: rolesError } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  if (rolesError) throw rolesError;
  const ids = (rolesData ?? []).map((r) => r.user_id);
  if (!ids.length) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, nome")
    .in("id", ids)
    .order("nome");
  if (profilesError) throw profilesError;
  return (profiles ?? []).map((p) => ({ id: p.id, nome: p.nome ?? p.id }));
}

/** Todos os usuários com perfil — usado para exibir/filtrar por solicitante na fila administrativa. */
export async function listarUsuarios(): Promise<AdminOption[]> {
  const { data, error } = await supabase.from("profiles").select("id, nome").order("nome");
  if (error) throw error;
  return (data ?? []).map((p) => ({ id: p.id, nome: p.nome ?? p.id }));
}

export async function listarFilaChamados(): Promise<SuporteChamado[]> {
  const { data, error } = await supabase
    .from("suporte_chamados")
    .select("*")
    .order("prioridade", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

export async function assumirChamado(chamadoId: string): Promise<void> {
  const { error } = await supabase.rpc("suporte_assumir_chamado", { p_chamado_id: chamadoId });
  if (error) throw error;
}

export async function atribuirResponsavelChamado(chamadoId: string, responsavelId: string): Promise<void> {
  const { error } = await supabase.rpc("suporte_atribuir_responsavel", {
    p_chamado_id: chamadoId,
    p_responsavel_id: responsavelId,
  });
  if (error) throw error;
}

export interface TriarChamadoInput {
  tipo?: SuporteTipo;
  prioridade?: NonNullable<SuporteChamado["prioridade"]>;
  modulo?: string;
  status?: SuporteStatus;
}

export async function triarChamado(chamadoId: string, input: TriarChamadoInput): Promise<void> {
  const { error } = await supabase.rpc("suporte_triar_chamado", {
    p_chamado_id: chamadoId,
    p_tipo: input.tipo,
    p_prioridade: input.prioridade,
    p_modulo: input.modulo,
    p_status: input.status,
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
    p_causa: causa,
  });
  if (error) throw error;
}

export async function cancelarChamado(chamadoId: string, motivo?: string): Promise<void> {
  const { error } = await supabase.rpc("suporte_cancelar_chamado", {
    p_chamado_id: chamadoId,
    p_motivo: motivo,
  });
  if (error) throw error;
}

export async function marcarChamadoDuplicado(chamadoId: string, duplicadoDeId: string): Promise<void> {
  const { error } = await supabase.rpc("suporte_marcar_duplicado", {
    p_chamado_id: chamadoId,
    p_duplicado_de_id: duplicadoDeId,
  });
  if (error) throw error;
}
