/**
 * Webhooks de saída — service admin-only.
 *
 * CRUD em `webhooks_endpoints` + leitura de `webhooks_deliveries`.
 * Criação e rotação de segredo passam por RPCs `SECURITY DEFINER` que
 * devolvem o secret em texto puro UMA ÚNICA VEZ; persistimos só o hash.
 */

import { supabase } from "@/integrations/supabase/client";

export type WebhookEventoStatus = "sucesso" | "falha" | "pendente" | "cancelado";

export interface WebhookEndpoint {
  id: string;
  nome: string;
  url: string;
  descricao: string | null;
  eventos: string[];
  ativo: boolean;
  total_sucesso: number;
  total_falha: number;
  ultimo_disparo_em: string | null;
  ultimo_status: WebhookEventoStatus | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  endpoint_id: string;
  evento: string;
  status: WebhookEventoStatus;
  http_status: number | null;
  tentativas: number;
  ultimo_erro: string | null;
  proxima_tentativa_em: string | null;
  enfileirado_em: string;
  finalizado_em: string | null;
  payload: unknown;
}

export interface WebhookMetrics {
  endpoints_ativos: number;
  deliveries_pendentes: number;
  falhas_24h: number;
  fila_total: number;
  fila_oldest_age_seconds: number;
}

/** Catálogo central — referenciado pela UI e validado client-side. */
export const WEBHOOK_EVENTOS = [
  "nota_fiscal.criada",
  "nota_fiscal.emitida",
  "nota_fiscal.autorizada",
  "nota_fiscal.cancelada",
  "nota_fiscal.rejeitada",
  "orcamento.enviado",
  "orcamento.aprovado",
  "orcamento.recusado",
  "orcamento.convertido",
  "ordem_venda.criada",
  "ordem_venda.status_alterado",
  "pedido_compra.criado",
  "pedido_compra.status_alterado",
] as const;

export type WebhookEvento = (typeof WEBHOOK_EVENTOS)[number];

export async function listEndpoints(): Promise<WebhookEndpoint[]> {
  const { data, error } = await supabase
    .from("webhooks_endpoints" as never)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as WebhookEndpoint[];
}

export async function listDeliveries(opts?: { endpointId?: string; status?: WebhookEventoStatus; limit?: number }): Promise<WebhookDelivery[]> {
  let q = supabase
    .from("webhooks_deliveries" as never)
    .select("*")
    .order("enfileirado_em", { ascending: false })
    .limit(opts?.limit ?? 100);
  if (opts?.endpointId) q = q.eq("endpoint_id", opts.endpointId);
  if (opts?.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as WebhookDelivery[];
}

export async function fetchMetrics(): Promise<WebhookMetrics> {
  const { data, error } = await supabase.rpc("webhooks_metrics" as never);
  if (error) throw error;
  return (data ?? {}) as unknown as WebhookMetrics;
}

export async function createEndpoint(input: { nome: string; url: string; eventos: string[]; descricao?: string | null }): Promise<{ id: string; secret: string }> {
  const { data, error } = await supabase.rpc("webhooks_create_endpoint" as never, {
    p_nome: input.nome,
    p_url: input.url,
    p_eventos: input.eventos,
    p_descricao: input.descricao ?? null,
  } as never);
  if (error) throw error;
  return data as unknown as { id: string; secret: string };
}

export async function rotateSecret(endpointId: string): Promise<{ id: string; secret: string }> {
  const { data, error } = await supabase.rpc("webhooks_rotate_secret" as never, { p_endpoint_id: endpointId } as never);
  if (error) throw error;
  return data as unknown as { id: string; secret: string };
}

export async function updateEndpoint(id: string, patch: Partial<Pick<WebhookEndpoint, "nome" | "url" | "descricao" | "eventos" | "ativo">>): Promise<void> {
  const { error } = await supabase.from("webhooks_endpoints" as never).update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function deleteEndpoint(id: string): Promise<void> {
  const { error } = await supabase.from("webhooks_endpoints" as never).delete().eq("id", id);
  if (error) throw error;
}

export async function triggerDispatcher(): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke("webhooks-dispatcher", {
    body: {},
  });
  if (error) throw error;
  return data;
}

/** Reenfileira uma delivery falha para nova tentativa imediata. Admin-only via RPC. */
export async function replayDelivery(deliveryId: string): Promise<{ id: string; status: string }> {
  const { data, error } = await supabase.rpc("webhooks_replay_delivery" as never, {
    p_delivery_id: deliveryId,
  } as never);
  if (error) throw error;
  return data as unknown as { id: string; status: string };
}
