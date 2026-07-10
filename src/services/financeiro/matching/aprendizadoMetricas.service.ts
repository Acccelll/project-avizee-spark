/**
 * Onda 11 — Métricas do motor de matching a partir de
 * `financeiro_matching_feedback`. Consulta agregada por período e ação,
 * usada pelo Painel de Aprendizado.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AcaoFeedback } from "./feedback.service";

export interface MatchingMetricasResumo {
  total: number;
  aceita: number;
  rejeitada: number;
  corrigida: number;
  criada_inline: number;
  scoreMedio: number | null;
  acuracia: number | null;
}

export interface MatchingSerieDiaria {
  dia: string;
  aceita: number;
  rejeitada: number;
  corrigida: number;
  criada_inline: number;
}

export interface MatchingMetricas {
  resumo: MatchingMetricasResumo;
  serie: MatchingSerieDiaria[];
}

interface FeedbackRow {
  acao: AcaoFeedback;
  sugestao_score: number | null;
  created_at: string;
}

export async function carregarMetricasMatching(input: {
  empresaId: string;
  dataInicio: string;
  dataFim: string;
}): Promise<MatchingMetricas> {
  const inicioISO = new Date(`${input.dataInicio}T00:00:00`).toISOString();
  const fimISO = new Date(`${input.dataFim}T23:59:59.999`).toISOString();
  const { data, error } = await supabase
    .from("financeiro_matching_feedback")
    .select("acao, sugestao_score, created_at")
    .eq("empresa_id", input.empresaId)
    .gte("created_at", inicioISO)
    .lte("created_at", fimISO)
    .order("created_at", { ascending: true })
    .limit(5000);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as FeedbackRow[];
  const resumo: MatchingMetricasResumo = {
    total: rows.length,
    aceita: 0,
    rejeitada: 0,
    corrigida: 0,
    criada_inline: 0,
    scoreMedio: null,
    acuracia: null,
  };

  const serieMap = new Map<string, MatchingSerieDiaria>();
  let somaScore = 0;
  let countScore = 0;

  for (const row of rows) {
    if (row.acao in resumo) {
      (resumo as unknown as Record<string, number>)[row.acao] += 1;
    }
    if (row.sugestao_score != null) {
      somaScore += Number(row.sugestao_score);
      countScore += 1;
    }
    const dia = row.created_at.slice(0, 10);
    const bucket = serieMap.get(dia) ?? {
      dia, aceita: 0, rejeitada: 0, corrigida: 0, criada_inline: 0,
    };
    if (row.acao in bucket) {
      (bucket as unknown as Record<string, number>)[row.acao] += 1;
    }
    serieMap.set(dia, bucket);
  }

  resumo.scoreMedio = countScore > 0 ? somaScore / countScore : null;
  const denomAcuracia = resumo.aceita + resumo.corrigida + resumo.rejeitada;
  resumo.acuracia = denomAcuracia > 0 ? resumo.aceita / denomAcuracia : null;

  const serie = Array.from(serieMap.values()).sort((a, b) => a.dia.localeCompare(b.dia));
  return { resumo, serie };
}