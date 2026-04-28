/**
 * empresas.service.ts — CRUD da tabela `empresas` e gestão dos vínculos
 * `user_empresas` (modelo 1:1 da Onda 1 do multi-tenant).
 *
 * Admin-only: chamadas dependem de RLS server-side. A UI já gateia via
 * `useIsAdmin`; aqui apenas tipamos as operações.
 */

import { supabase } from "@/integrations/supabase/client";

export interface Empresa {
  id: string;
  nome: string;
  cnpj: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmpresaUserBinding {
  user_id: string;
  empresa_id: string;
  email: string | null;
  nome: string | null;
  empresa_nome: string | null;
}

export interface UnboundUser {
  user_id: string;
  email: string | null;
  nome: string | null;
}

/* ----------------------------- empresas ----------------------------- */

export async function listEmpresas(): Promise<Empresa[]> {
  const { data, error } = await supabase
    .from("empresas")
    .select("id, nome, cnpj, ativo, created_at, updated_at")
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Empresa[];
}

export async function createEmpresa(input: { nome: string; cnpj?: string | null }): Promise<Empresa> {
  const { data, error } = await supabase
    .from("empresas")
    .insert({ nome: input.nome.trim(), cnpj: input.cnpj?.trim() || null })
    .select("id, nome, cnpj, ativo, created_at, updated_at")
    .single();
  if (error) throw error;
  return data as Empresa;
}

export async function updateEmpresa(
  id: string,
  patch: Partial<Pick<Empresa, "nome" | "cnpj" | "ativo">>,
): Promise<Empresa> {
  const next: { nome?: string; cnpj?: string | null; ativo?: boolean } = {};
  if (patch.nome !== undefined) next.nome = patch.nome.trim();
  if (patch.cnpj !== undefined) next.cnpj = patch.cnpj?.trim() || null;
  if (patch.ativo !== undefined) next.ativo = patch.ativo;
  const { data, error } = await supabase
    .from("empresas")
    .update(next)
    .eq("id", id)
    .select("id, nome, cnpj, ativo, created_at, updated_at")
    .single();
  if (error) throw error;
  return data as Empresa;
}

export async function deleteEmpresa(id: string): Promise<void> {
  // ON DELETE RESTRICT em user_empresas e nas FKs de cadastros impede a remoção
  // quando houver dependentes — o erro é propagado para a UI exibir motivo claro.
  const { error } = await supabase.from("empresas").delete().eq("id", id);
  if (error) throw error;
}

/* ------------------------ vínculos user → empresa ------------------------ */

/**
 * Lista todos os vínculos atuais com nome da empresa e dados do usuário
 * (via join em `profiles`, que é a fonte canônica de email/nome).
 */
export async function listEmpresaBindings(): Promise<EmpresaUserBinding[]> {
  const { data, error } = await supabase
    .from("user_empresas")
    .select("user_id, empresa_id, empresas:empresa_id ( nome ), profiles!user_empresas_user_id_fkey ( email, nome )");
  if (error) {
    // Fallback sem o join nomeado (caso a FK não esteja exposta em profiles):
    // busca user_empresas + profiles + empresas em queries paralelas.
    return await listEmpresaBindingsFallback();
  }
  type Row = {
    user_id: string;
    empresa_id: string;
    empresas: { nome: string | null } | null;
    profiles: { email: string | null; nome: string | null } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    user_id: r.user_id,
    empresa_id: r.empresa_id,
    empresa_nome: r.empresas?.nome ?? null,
    email: r.profiles?.email ?? null,
    nome: r.profiles?.nome ?? null,
  }));
}

async function listEmpresaBindingsFallback(): Promise<EmpresaUserBinding[]> {
  const [bindingsRes, empresasRes, profilesRes] = await Promise.all([
    supabase.from("user_empresas").select("user_id, empresa_id"),
    supabase.from("empresas").select("id, nome"),
    supabase.from("profiles").select("id, email, nome"),
  ]);
  if (bindingsRes.error) throw bindingsRes.error;
  const empresasById = new Map((empresasRes.data ?? []).map((e: { id: string; nome: string }) => [e.id, e.nome]));
  const profilesById = new Map(
    (profilesRes.data ?? []).map((p: { id: string; email: string | null; nome: string | null }) => [p.id, p]),
  );
  return (bindingsRes.data ?? []).map((b: { user_id: string; empresa_id: string }) => ({
    user_id: b.user_id,
    empresa_id: b.empresa_id,
    empresa_nome: empresasById.get(b.empresa_id) ?? null,
    email: profilesById.get(b.user_id)?.email ?? null,
    nome: profilesById.get(b.user_id)?.nome ?? null,
  }));
}

/**
 * Lista usuários com profile mas sem vínculo em `user_empresas`.
 * Útil para corrigir órfãos (signups novos que não rodam o backfill).
 */
export async function listUnboundUsers(): Promise<UnboundUser[]> {
  const [profilesRes, bindingsRes] = await Promise.all([
    supabase.from("profiles").select("id, email, nome"),
    supabase.from("user_empresas").select("user_id"),
  ]);
  if (profilesRes.error) throw profilesRes.error;
  if (bindingsRes.error) throw bindingsRes.error;
  const bound = new Set((bindingsRes.data ?? []).map((b: { user_id: string }) => b.user_id));
  return (profilesRes.data ?? [])
    .filter((p: { id: string }) => !bound.has(p.id))
    .map((p: { id: string; email: string | null; nome: string | null }) => ({
      user_id: p.id,
      email: p.email,
      nome: p.nome,
    }));
}

/** Cria ou atualiza o vínculo user → empresa (upsert por user_id). */
export async function setUserEmpresa(userId: string, empresaId: string): Promise<void> {
  const { error } = await supabase
    .from("user_empresas")
    .upsert({ user_id: userId, empresa_id: empresaId }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function removeUserEmpresa(userId: string): Promise<void> {
  const { error } = await supabase.from("user_empresas").delete().eq("user_id", userId);
  if (error) throw error;
}