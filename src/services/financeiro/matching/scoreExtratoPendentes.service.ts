/**
 * Escora sugestões para transações de extrato pendentes de conciliação.
 * Fase 2 do Motor Inteligente — invocado logo após a importação (ou sob
 * demanda pela UI) para popular `sugestao_lancamento_id`, `sugestao_score`
 * e `sugestao_motivos` em `financeiro_extrato_importacoes`.
 *
 * Segurança: só atualiza linhas com `status = 'pendente'` (nunca sobrescreve
 * conciliações confirmadas). O melhor candidato acima do limiar mínimo é
 * gravado; se nenhum atinge o mínimo, os campos ficam nulos.
 */
import { supabase } from "@/integrations/supabase/client";
import { buscarCandidatos } from "./candidatesMatcher.service";

export interface ScorePendentesParams {
  empresa_id: string;
  documento_importacao_id?: string;   // limita a um lote específico
  conta_bancaria_id?: string;         // ou a uma conta
  minScore?: number;                  // padrão 0.6
}

export interface ScorePendentesResumo {
  processadas: number;
  com_sugestao: number;
}

export async function scoreExtratoPendentes(
  params: ScorePendentesParams,
): Promise<ScorePendentesResumo> {
  const { empresa_id, documento_importacao_id, conta_bancaria_id, minScore = 0.6 } = params;

  let q = supabase
    .from("financeiro_extrato_importacoes")
    .select("id, data, valor, forma_pagamento, favorecido, favorecido_documento, documento")
    .eq("status", "pendente");
  if (documento_importacao_id) q = q.eq("documento_importacao_id", documento_importacao_id);
  if (conta_bancaria_id) q = q.eq("conta_bancaria_id", conta_bancaria_id);

  const { data, error } = await q.limit(1000);
  if (error) throw new Error(error.message);

  let comSugestao = 0;
  for (const row of data ?? []) {
    const [best] = await buscarCandidatos({
      empresa_id,
      extrato: {
        data: row.data as string,
        valor: Number(row.valor),
        favorecido: row.favorecido as string | null,
        favorecido_documento: row.favorecido_documento as string | null,
        forma_pagamento: row.forma_pagamento as string | null,
        documento: row.documento as string | null,
      },
      minScore,
      topN: 1,
    });

    const update = best
      ? {
          sugestao_lancamento_id: best.lancamento_id,
          sugestao_score: best.score,
          sugestao_motivos: best.motivos,
        }
      : { sugestao_lancamento_id: null, sugestao_score: null, sugestao_motivos: null };

    const { error: upErr } = await supabase
      .from("financeiro_extrato_importacoes")
      .update(update)
      .eq("id", row.id as string);
    if (upErr) throw new Error(upErr.message);
    if (best) comSugestao++;
  }

  return { processadas: data?.length ?? 0, com_sugestao: comSugestao };
}