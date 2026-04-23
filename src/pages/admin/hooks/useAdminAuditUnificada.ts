/**
 * useAdminAuditUnificada — consulta a view `v_admin_audit_unified` (UNION de
 * `permission_audit` + `auditoria_logs` filtrada para tabelas administrativas).
 *
 * Esta hook é o ponto único de leitura para a aba Auditoria do módulo Admin.
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AdminAuditRow =
  Database["public"]["Views"]["v_admin_audit_unified"]["Row"];

export interface AdminAuditFilters {
  /** ISO-8601 — filtro server-side `gte created_at` */
  dateFrom?: string | null;
  origem?: "permission_audit" | "auditoria_logs" | null;
  tipoAcao?: string | null;
  entidade?: string | null;
  atorId?: string | null;
  targetUserId?: string | null;
  ipAddress?: string | null;
  registroId?: string | null;
  /** Página 1-based */
  page?: number;
  pageSize?: number;
}

export const ADMIN_AUDIT_PAGE_SIZE = 50;

/**
 * Hook React Query que lê `v_admin_audit_unified` com filtros server-side,
 * paginação por range e contagem exata.
 */
export function useAdminAuditUnificada(filtros: AdminAuditFilters = {}) {
  const page = filtros.page ?? 1;
  const pageSize = filtros.pageSize ?? ADMIN_AUDIT_PAGE_SIZE;

  const query = useQuery({
    queryKey: ["admin", "audit-unificada", filtros] as const,
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let q = supabase
        .from("v_admin_audit_unified")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (filtros.dateFrom) q = q.gte("created_at", filtros.dateFrom);
      if (filtros.origem) q = q.eq("origem", filtros.origem);
      if (filtros.tipoAcao) q = q.eq("tipo_acao", filtros.tipoAcao);
      if (filtros.entidade) q = q.eq("entidade", filtros.entidade);
      if (filtros.atorId) q = q.eq("ator_id", filtros.atorId);
      if (filtros.targetUserId) q = q.eq("target_user_id", filtros.targetUserId);
      if (filtros.ipAddress) q = q.eq("ip_address", filtros.ipAddress);
      if (filtros.registroId) q = q.eq("entidade_id", filtros.registroId);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as AdminAuditRow[], count: count ?? 0 };
    },
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });

  const totalPages = Math.max(1, Math.ceil((query.data?.count ?? 0) / pageSize));

  return {
    rows: query.data?.rows ?? [],
    totalCount: query.data?.count ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    page,
    pageSize,
    totalPages,
  };
}