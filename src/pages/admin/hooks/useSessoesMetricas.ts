/**
 * useSessoesMetricas — métricas reais de sessão derivadas de `auth.users`
 * via edge function `admin-sessions` (action='metrics').
 *
 * Substitui as antigas métricas baseadas em `auditoria_logs` que mediam
 * "logins antigos" (semântica enganosa: contava eventos, não sessões).
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SessoesMetricas {
  ativas: number;
  inativasMais30d: number;
  totalUsuarios: number;
}

async function fetchSessoesMetricas(): Promise<SessoesMetricas> {
  const { data, error } = await supabase.functions.invoke<SessoesMetricas>(
    "admin-sessions",
    { body: { action: "metrics" } }
  );
  if (error) throw error;
  if (!data) return { ativas: 0, inativasMais30d: 0, totalUsuarios: 0 };
  return data;
}

export function useSessoesMetricas() {
  return useQuery<SessoesMetricas, Error>({
    queryKey: ["admin", "security", "sessoes-metricas"],
    queryFn: fetchSessoesMetricas,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}