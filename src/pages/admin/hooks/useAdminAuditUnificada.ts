/**
 * useAdminAuditUnificada — consulta a view `v_admin_audit_unified` (UNION de
 * `permission_audit` + `auditoria_logs` filtrada para tabelas administrativas).
 *
 * Esta hook é o ponto único de leitura para a aba Auditoria do módulo Admin.
 */

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminAuditRow {
  id: string;
  created_at: string;
  ator_id: string | null;
  tipo_acao: string;
  entidade: string | null;
  entidade_id: string | null;
  target_user_id: string | null;
  motivo: string | null;
  payload: unknown;
  ip_address: string | null;
  user_agent: string | null;
  origem: "permission_audit" | "auditoria_logs";
}

const PAGE_SIZE = 50;

export function useAdminAuditUnificada(filtros: {
  tipoAcao?: string;
  entidade?: string;
} = {}) {
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["admin", "audit-unificada", filtros, page] as const,
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let q = supabase
        // @ts-expect-error view não tipada em types.ts ainda — rebuild gerará tipo
        .from("v_admin_audit_unified")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (filtros.tipoAcao) q = q.eq("tipo_acao", filtros.tipoAcao);
      if (filtros.entidade) q = q.eq("entidade", filtros.entidade);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as AdminAuditRow[], count: count ?? 0 };
    },
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });

  const totalPages = Math.max(1, Math.ceil((query.data?.count ?? 0) / PAGE_SIZE));

  return {
    rows: query.data?.rows ?? [],
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