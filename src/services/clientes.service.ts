/**
 * Clientes service — thin abstraction over Supabase queries for the
 * customer domain. Exists primarily as a **template** for the broader
 * services-migration roadmap (see `docs/services-migration-plan.md`).
 *
 * UI components and hooks should import from this module instead of
 * calling `supabase.from(...)` directly. Centralising queries here:
 *  - Keeps schema-coupling in one place (a column rename only edits one file).
 *  - Lets us add caching / retries / telemetry uniformly.
 *  - Makes the data-access surface easy to mock in tests.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type EnderecoEntrega = Tables<"clientes_enderecos_entrega">;
export type RegistroComunicacao = Tables<"cliente_registros_comunicacao">;
export type ClienteTransportadoraVinculo = Tables<"cliente_transportadoras">;

// ── Endereços de entrega ───────────────────────────────────────────────────

export async function listEnderecosEntrega(clienteId: string): Promise<EnderecoEntrega[]> {
  const { data, error } = await supabase
    .from("clientes_enderecos_entrega")
    .select("*")
    .eq("cliente_id", clienteId)
    .eq("ativo", true)
    .order("principal", { ascending: false });
  if (error) throw error;
  return (data || []) as EnderecoEntrega[];
}

export async function createEnderecoEntrega(
  payload: TablesInsert<"clientes_enderecos_entrega">,
): Promise<void> {
  if (payload.principal) {
    await clearPrincipal(payload.cliente_id);
  }
  const { error } = await supabase
    .from("clientes_enderecos_entrega")
    .insert(payload);
  if (error) throw error;
}

export async function updateEnderecoEntrega(
  enderecoId: string,
  patch: TablesUpdate<"clientes_enderecos_entrega">,
): Promise<void> {
  if (patch.principal && patch.cliente_id) {
    await supabase
      .from("clientes_enderecos_entrega")
      .update({ principal: false })
      .eq("cliente_id", patch.cliente_id)
      .neq("id", enderecoId);
  }
  const { error } = await supabase
    .from("clientes_enderecos_entrega")
    .update(patch)
    .eq("id", enderecoId);
  if (error) throw error;
}

export async function softDeleteEnderecoEntrega(enderecoId: string): Promise<void> {
  const { error } = await supabase
    .from("clientes_enderecos_entrega")
    .update({ ativo: false })
    .eq("id", enderecoId);
  if (error) throw error;
}

export async function setEnderecoPrincipal(
  clienteId: string,
  enderecoId: string,
): Promise<void> {
  const { error } = await supabase.rpc("set_principal_endereco" as never, {
    p_cliente_id: clienteId,
    p_endereco_id: enderecoId,
  } as never);
  if (error) throw error;
}

async function clearPrincipal(clienteId: string): Promise<void> {
  await supabase
    .from("clientes_enderecos_entrega")
    .update({ principal: false })
    .eq("cliente_id", clienteId);
}

// ── Registros de comunicação ───────────────────────────────────────────────

export async function listRegistrosComunicacao(
  clienteId: string,
  limit = 50,
): Promise<RegistroComunicacao[]> {
  const { data, error } = await supabase
    .from("cliente_registros_comunicacao")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("data_registro", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as RegistroComunicacao[];
}

export async function createRegistroComunicacao(
  payload: TablesInsert<"cliente_registros_comunicacao">,
): Promise<void> {
  const { error } = await supabase
    .from("cliente_registros_comunicacao")
    .insert(payload);
  if (error) throw error;
}

// ── Transportadoras preferenciais ──────────────────────────────────────────

export interface TransportadoraVinculoView {
  id: string;
  transportadora_id: string;
  transportadora_nome: string;
  prioridade: number | null;
  modalidade: string | null;
  prazo_medio: string | null;
}

export async function listTransportadorasVinculadas(
  clienteId: string,
): Promise<TransportadoraVinculoView[]> {
  const { data, error } = await supabase
    .from("cliente_transportadoras")
    .select("id, transportadora_id, prioridade, modalidade, prazo_medio, transportadoras(nome_razao_social)")
    .eq("cliente_id", clienteId)
    .eq("ativo", true)
    .order("prioridade");
  if (error) throw error;

  type Row = ClienteTransportadoraVinculo & {
    transportadoras?: { nome_razao_social: string } | null;
  };

  return ((data || []) as Row[]).map((ct) => ({
    id: ct.id,
    transportadora_id: ct.transportadora_id,
    transportadora_nome: ct.transportadoras?.nome_razao_social || "—",
    prioridade: ct.prioridade,
    modalidade: ct.modalidade,
    prazo_medio: ct.prazo_medio,
  }));
}

export async function vincularTransportadora(
  clienteId: string,
  transportadoraId: string,
  prioridade: number,
): Promise<void> {
  const { error } = await supabase.from("cliente_transportadoras").insert({
    cliente_id: clienteId,
    transportadora_id: transportadoraId,
    prioridade,
    ativo: true,
  });
  if (error) throw error;
}

export async function desvincularTransportadora(vinculoId: string): Promise<void> {
  const { error } = await supabase
    .from("cliente_transportadoras")
    .update({ ativo: false })
    .eq("id", vinculoId);
  if (error) throw error;
}

export async function listTransportadorasAtivas() {
  const { data, error } = await supabase
    .from("transportadoras")
    .select("id, nome_razao_social")
    .eq("ativo", true)
    .order("nome_razao_social");
  if (error) throw error;
  return (data || []) as Array<{ id: string; nome_razao_social: string }>;
}

// ── Lookups auxiliares (listas combo) ──────────────────────────────────────

export async function listGruposEconomicosAtivos() {
  const { data, error } = await supabase
    .from("grupos_economicos")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return (data || []) as Array<{ id: string; nome: string }>;
}

export async function listFormasPagamentoAtivas() {
  const { data, error } = await supabase
    .from("formas_pagamento")
    .select("id, descricao")
    .eq("ativo", true)
    .order("descricao");
  if (error) throw error;
  return (data || []) as Array<{ id: string; descricao: string }>;
}

export async function deleteCliente(id: string): Promise<void> {
  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) throw error;
}
