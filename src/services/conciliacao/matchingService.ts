/**
 * Serviço de matching da Conciliação v2.
 *
 * Encapsula as RPCs de sugestão 1:1/agrupada, consulta e decisão
 * transacional das sugestões persistidas.
 */
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type { ConciliacaoMatch } from "@/types/domain";

export interface SugerirMatchesInput {
  extratoId: string;
  toleranciaDias?: number;
  minScore?: number;
}

export interface SugerirMatchesResult {
  sugestoes_criadas: number;
  linhas_processadas: number;
}

export async function sugerirMatches(
  input: SugerirMatchesInput,
): Promise<SugerirMatchesResult> {
  const { extratoId, toleranciaDias = 3, minScore = 60 } = input;

  const { data, error } = await supabase.rpc("conciliacao_sugerir_matches", {
    p_extrato_id: extratoId,
    p_tolerancia_dias: toleranciaDias,
    p_min_score: minScore,
  });

  if (error) {
    logger.error("conciliacao.matching.sugerir_falha", { extratoId, error });
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    sugestoes_criadas: Number(row?.sugestoes_criadas ?? 0),
    linhas_processadas: Number(row?.linhas_processadas ?? 0),
  };
}

export async function sugerirMatchesAgrupados(
  input: SugerirMatchesInput,
): Promise<SugerirMatchesResult> {
  const { extratoId, toleranciaDias = 3, minScore = 75 } = input;

  const { data, error } = await supabase.rpc("conciliacao_sugerir_matches_agrupados", {
    p_extrato_id: extratoId,
    p_tolerancia_dias: toleranciaDias,
    p_min_score: minScore,
  });

  if (error) {
    logger.error("conciliacao.matching.sugerir_agrupados_falha", { extratoId, error });
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    sugestoes_criadas: Number(row?.sugestoes_criadas ?? 0),
    linhas_processadas: Number(row?.linhas_processadas ?? 0),
  };
}

export async function listarMatchesDoExtrato(
  extratoId: string,
): Promise<ConciliacaoMatch[]> {
  const { data, error } = await supabase
    .from("conciliacao_matches")
    .select("*, conciliacao_extrato_linhas!inner(extrato_id)")
    .eq("conciliacao_extrato_linhas.extrato_id", extratoId)
    .order("operation_id", { ascending: true })
    .order("score", { ascending: false });

  if (error) {
    logger.error("conciliacao.matching.listar_falha", { extratoId, error });
    throw error;
  }

  return (data ?? []) as unknown as ConciliacaoMatch[];
}

export type DecisaoMatch = "aprovar" | "rejeitar";

export async function decidirMatch(
  matchId: string,
  decisao: DecisaoMatch,
  motivo?: string,
): Promise<ConciliacaoMatch> {
  const { data, error } = await supabase.rpc("conciliacao_decidir_match", {
    p_match_id: matchId,
    p_decisao: decisao,
    p_motivo: motivo ?? null,
  });

  if (error) {
    logger.error("conciliacao.matching.decidir_falha", { matchId, decisao, error });
    throw error;
  }
  return data as unknown as ConciliacaoMatch;
}

export async function decidirMatchesEmLote(
  matchIds: string[],
  decisao: DecisaoMatch,
  motivo?: string,
): Promise<{ ok: number; falhas: Array<{ id: string; erro: string }> }> {
  const results = await Promise.allSettled(
    matchIds.map((id) => decidirMatch(id, decisao, motivo)),
  );
  const falhas = results
    .map((r, i) => ({ r, id: matchIds[i] }))
    .filter((x) => x.r.status === "rejected")
    .map((x) => ({
      id: x.id,
      erro: (x.r as PromiseRejectedResult).reason?.message ?? "erro",
    }));
  return { ok: matchIds.length - falhas.length, falhas };
}