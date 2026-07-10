/**
 * Trilha de aprendizado do motor de matching (Épico B).
 *
 * Cada correção humana (aceitar/rejeitar/trocar sugestão) é registrada
 * em `financeiro_matching_feedback`. A partir dessa tabela dá para
 * medir a acurácia do motor e alimentar futuros ajustes de peso.
 */

import { supabase } from "@/integrations/supabase/client";

export type AcaoFeedback = "aceito" | "rejeitado" | "trocado" | "manual";

export interface FeedbackMatchingInput {
  empresa_id: string;
  extrato_id?: string | null;
  sugestao_lancamento_id?: string | null;
  sugestao_score?: number | null;
  escolha_final_lancamento_id?: string | null;
  acao: AcaoFeedback;
  motivo?: string | null;
  usuario_id?: string | null;
}

export async function registrarFeedbackMatching(input: FeedbackMatchingInput): Promise<void> {
  const { error } = await supabase.from("financeiro_matching_feedback").insert({
    empresa_id: input.empresa_id,
    extrato_id: input.extrato_id ?? null,
    sugestao_lancamento_id: input.sugestao_lancamento_id ?? null,
    sugestao_score: input.sugestao_score ?? null,
    escolha_final_lancamento_id: input.escolha_final_lancamento_id ?? null,
    acao: input.acao,
    motivo: input.motivo ?? null,
    usuario_id: input.usuario_id ?? null,
  });
  if (error) throw new Error(error.message);
}