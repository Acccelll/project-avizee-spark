/**
 * useEventosAdminTimeline — agrega `permission_audit` por dia (últimos 7 dias)
 * e por entidade. Alimenta a sparkline e o "último evento por entidade" no
 * Dashboard de Segurança.
 *
 * Implementação client-side: busca todos os eventos dos últimos 7 dias
 * (volume baixo — costuma ficar < 200 linhas/dia) e agrupa em memória.
 * Não há agregação SQL para evitar criar uma view dedicada.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EventoAdminBucket {
  /** YYYY-MM-DD */
  dia: string;
  total: number;
}

export interface UltimoEventoEntidade {
  entidade: string;
  tipo_acao: string | null;
  created_at: string;
}

export interface EventosAdminTimeline {
  buckets: EventoAdminBucket[];
  ultimoPorEntidade: UltimoEventoEntidade[];
  total7d: number;
}

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchTimeline(): Promise<EventosAdminTimeline> {
  const since = new Date(Date.now() - SETE_DIAS_MS).toISOString();
  const { data, error } = await supabase
    .from("permission_audit")
    .select("entidade, tipo_acao, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) throw error;

  const rows = (data ?? []) as UltimoEventoEntidade[];

  // Buckets: 7 dias incluindo hoje, ordem cronológica.
  const bucketMap = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    bucketMap.set(ymd(new Date(Date.now() - i * 24 * 60 * 60 * 1000)), 0);
  }
  for (const r of rows) {
    const key = ymd(new Date(r.created_at));
    if (bucketMap.has(key)) bucketMap.set(key, (bucketMap.get(key) ?? 0) + 1);
  }

  // Último evento por entidade (rows já vem desc).
  const seen = new Set<string>();
  const ultimoPorEntidade: UltimoEventoEntidade[] = [];
  for (const r of rows) {
    if (!r.entidade || seen.has(r.entidade)) continue;
    seen.add(r.entidade);
    ultimoPorEntidade.push(r);
  }

  return {
    buckets: Array.from(bucketMap, ([dia, total]) => ({ dia, total })),
    ultimoPorEntidade: ultimoPorEntidade.slice(0, 6),
    total7d: rows.length,
  };
}

export function useEventosAdminTimeline() {
  return useQuery<EventosAdminTimeline, Error>({
    queryKey: ["admin", "security", "eventos-timeline-7d"],
    queryFn: fetchTimeline,
    staleTime: 60 * 1000,
    retry: 1,
  });
}