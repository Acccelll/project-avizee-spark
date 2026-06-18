/**
 * Saúde do sistema — leituras de `v_admin_audit_unified`, `email_send_log`,
 * `email_send_state` + RPCs `webhooks_metrics` e `email_queue_metrics`.
 * Encapsula o I/O usado por `useSaudeSistema` para manter a camada de
 * services como única autoridade (mem://tech/camada-services-unica).
 */
import { supabase } from "@/integrations/supabase/client";

export interface WebhookMetricsRaw {
  endpoints_ativos: number;
  deliveries_pendentes: number;
  falhas_24h: number;
  fila_total: number;
  fila_oldest_age_seconds: number;
}

export interface FilaEmailMetric {
  queue_name: string;
  total_messages: number;
  oldest_msg_age_seconds: number;
}

export async function fetchAuditEntidades(
  desde: string,
): Promise<{ entidade: string | null }[]> {
  const { data, error } = await supabase
    .from("v_admin_audit_unified")
    .select("entidade")
    .gte("created_at", desde);
  if (error) throw error;
  return (data ?? []) as { entidade: string | null }[];
}

export async function fetchEmailStats(desde24h: string): Promise<{
  enviados24h: number;
  erros24h: number;
  backoffAte: string | null;
}> {
  const [enviadosRes, errosRes, stateRes] = await Promise.all([
    supabase
      .from("email_send_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", desde24h),
    supabase
      .from("email_send_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", desde24h)
      .neq("status", "sent"),
    supabase
      .from("email_send_state")
      .select("retry_after_until")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    enviados24h: enviadosRes.count ?? 0,
    erros24h: errosRes.count ?? 0,
    backoffAte: (stateRes.data as { retry_after_until?: string | null } | null)?.retry_after_until ?? null,
  };
}

export async function fetchWebhookMetrics(): Promise<WebhookMetricsRaw> {
  const { data, error } = await supabase.rpc(
    "webhooks_metrics" as never,
  );
  if (error) throw new Error(error.message);
  return (
    (data as unknown as WebhookMetricsRaw | null) ?? {
      endpoints_ativos: 0,
      deliveries_pendentes: 0,
      falhas_24h: 0,
      fila_total: 0,
      fila_oldest_age_seconds: 0,
    }
  );
}

export async function fetchEmailQueueMetrics(): Promise<FilaEmailMetric[]> {
  const { data, error } = await supabase.rpc(
    "email_queue_metrics" as never,
    {} as never,
  );
  if (error) throw new Error(error.message);
  return (data as unknown as FilaEmailMetric[] | null) ?? [];
}