/**
 * Serviço de logs de auditoria — leitura da tabela `auditoria_logs`.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AuditLog = Database["public"]["Tables"]["auditoria_logs"]["Row"];

export interface AuditLogFilters {
  userId?: string;
  tabela?: string;
  acao?: string;
  /** ISO-8601 */
  dataInicio?: string;
  /** ISO-8601 */
  dataFim?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogResult {
  data: AuditLog[];
  count: number;
}

/**
 * Busca logs de auditoria com filtros e paginação.
 * Retorna os dados e o total de registros para paginação no cliente.
 */
export async function fetchAuditLogs(
  filters: AuditLogFilters = {}
): Promise<AuditLogResult> {
  const { userId, tabela, acao, dataInicio, dataFim, page = 1, pageSize = 50 } =
    filters;

  let query = supabase
    .from("auditoria_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (userId) query = query.eq("usuario_id", userId);
  if (tabela) query = query.eq("tabela", tabela);
  if (acao) query = query.eq("acao", acao);
  if (dataInicio) query = query.gte("created_at", dataInicio);
  if (dataFim) query = query.lte("created_at", dataFim);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw error;

  return { data: data ?? [], count: count ?? 0 };
}

/**
 * Registra uma entrada de auditoria via aplicação (para operações que não
 * possuem trigger no banco de dados).
 */
export async function registrarAuditLog(
  entry: Database["public"]["Tables"]["auditoria_logs"]["Insert"]
): Promise<void> {
  const { error } = await supabase.from("auditoria_logs").insert(entry);
  if (error) throw error;
}
