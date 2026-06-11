import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CronHealthRow {
  job_name: string;
  last_run_at: string;
  last_status: "ok" | "error";
  last_error: string | null;
  runs_count: number;
}

/**
 * Intervalo esperado (em segundos) entre execuções de cada cron.
 * Usado para detectar jobs "atrasados" (last_run_at mais antigo que 2x o intervalo).
 * Mantido sincronizado com os agendamentos em pg_cron.
 */
export const CRON_EXPECTED_INTERVAL_SECONDS: Record<string, number> = {
  "process-email-queue": 60,
  "webhooks-dispatcher": 60,
  "process-distdfe-cron": 60 * 60,
  "process-nfe-retry-cron": 5 * 60,
};

export function useCronHealth() {
  return useQuery<CronHealthRow[]>({
    queryKey: ["cron-health"],
    queryFn: async () => {
      const { data, error } = await (
        supabase as unknown as {
          from: (t: string) => {
            select: (cols: string) => {
              order: (col: string) => Promise<{ data: CronHealthRow[] | null; error: unknown }>;
            };
          };
        }
      )
        .from("cron_health")
        .select("job_name, last_run_at, last_status, last_error, runs_count")
        .order("job_name");
      if (error) throw new Error((error as Error).message ?? "Erro ao carregar cron_health");
      return data ?? [];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function isCronOverdue(row: CronHealthRow): boolean {
  const expected = CRON_EXPECTED_INTERVAL_SECONDS[row.job_name];
  if (!expected) return false;
  const ageSeconds = (Date.now() - new Date(row.last_run_at).getTime()) / 1000;
  return ageSeconds > expected * 2;
}