/**
 * Serviço de matching da Conciliação v2 (Sprint 2).
 *
 * Encapsula a RPC `conciliacao_sugerir_matches`, que gera sugestões
 * determinísticas 1:1 entre linhas de extrato e lançamentos financeiros
 * em aberto, e a consulta das sugestões já persistidas.
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

export async function listarMatchesDoExtrato(
  extratoId: string,
): Promise<ConciliacaoMatch[]> {
  const { data, error } = await supabase
    .from("conciliacao_matches")
    .select("*, conciliacao_extrato_linhas!inner(extrato_id)")
    .eq("conciliacao_extrato_linhas.extrato_id", extratoId)
    .order("score", { ascending: false });

  if (error) {
    logger.error("conciliacao.matching.listar_falha", { extratoId, error });
    throw error;
  }

  return (data ?? []) as unknown as ConciliacaoMatch[];
}