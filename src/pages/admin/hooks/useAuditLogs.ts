/**
 * Hook de logs de auditoria — encapsula React Query para buscar e paginar
 * registros da tabela `auditoria_logs`.
 */

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  fetchAuditLogs,
  type AuditLogFilters,
  type AuditLogResult,
} from "@/services/admin/audit.service";

const PAGE_SIZE = 50;

export interface UseAuditLogsFilters
  extends Omit<AuditLogFilters, "page" | "pageSize"> {}

export function useAuditLogs(filters: UseAuditLogsFilters = {}) {
  const [page, setPage] = useState(1);

  const queryKey = ["admin", "audit-logs", filters, page] as const;

  const query = useQuery<AuditLogResult, Error>({
    queryKey,
    queryFn: () =>
      fetchAuditLogs({ ...filters, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });

  const totalPages = Math.max(
    1,
    Math.ceil((query.data?.count ?? 0) / PAGE_SIZE)
  );

  return {
    logs: query.data?.data ?? [],
    totalCount: query.data?.count ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    page,
    totalPages,
    setPage,
  };
}
