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

  // Fase 4 — aprendizado contínuo: quando o usuário confirma uma escolha,
  // materializa/reforça um alias `descricao_normalizada → alvo` para acelerar
  // matches futuros. Rejeições não geram alias.
  if (
    (input.acao === "aceito" || input.acao === "trocado" || input.acao === "manual") &&
    input.extrato_id &&
    input.escolha_final_lancamento_id
  ) {
    await aprenderComEscolha({
      empresa_id: input.empresa_id,
      extrato_id: input.extrato_id,
      lancamento_id: input.escolha_final_lancamento_id,
      usuario_id: input.usuario_id ?? null,
    }).catch(() => undefined); // best-effort
  }
}

/** Normaliza a descrição para agrupamento de aliases (idempotente). */
export function normalizarDescricao(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\d{2,}/g, "#")     // colapsa números (datas, valores, boletos)
    .replace(/[^a-z0-9# ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cria (ou reforça) um alias a partir de uma escolha humana confirmada.
 * Upsert em `financeiro_aliases` por `(empresa_id, descricao_normalizada)`.
 */
export async function aprenderComEscolha(params: {
  empresa_id: string;
  extrato_id: string;
  lancamento_id: string;
  usuario_id?: string | null;
}): Promise<void> {
  const { data: ext, error: e1 } = await supabase
    .from("financeiro_extrato_importacoes")
    .select("descricao")
    .eq("id", params.extrato_id)
    .maybeSingle();
  if (e1 || !ext?.descricao) return;

  const { data: lanc, error: e2 } = await supabase
    .from("financeiro_lancamentos")
    .select("fornecedor_id, cliente_id, centro_custo_id, conta_contabil_id")
    .eq("id", params.lancamento_id)
    .maybeSingle();
  if (e2 || !lanc) return;

  const descricao_normalizada = normalizarDescricao(String(ext.descricao));
  if (!descricao_normalizada) return;

  // Precisa de pelo menos um alvo — respeita chk_fin_alias_alvo.
  if (
    !lanc.fornecedor_id &&
    !lanc.cliente_id &&
    !lanc.centro_custo_id &&
    !lanc.conta_contabil_id
  ) {
    return;
  }

  // Se já existir, incrementa hits e atualiza confirmação; senão insere.
  const { data: existente } = await supabase
    .from("financeiro_aliases")
    .select("id, hits")
    .eq("empresa_id", params.empresa_id)
    .eq("descricao_normalizada", descricao_normalizada)
    .maybeSingle();

  if (existente) {
    await supabase
      .from("financeiro_aliases")
      .update({
        fornecedor_id: lanc.fornecedor_id,
        cliente_id: lanc.cliente_id,
        centro_custo_id: lanc.centro_custo_id,
        conta_contabil_id: lanc.conta_contabil_id,
        hits: (existente.hits ?? 0) + 1,
        ultima_confirmacao_em: new Date().toISOString(),
      })
      .eq("id", existente.id as string);
  } else {
    await supabase.from("financeiro_aliases").insert({
      empresa_id: params.empresa_id,
      descricao_normalizada,
      fornecedor_id: lanc.fornecedor_id,
      cliente_id: lanc.cliente_id,
      centro_custo_id: lanc.centro_custo_id,
      conta_contabil_id: lanc.conta_contabil_id,
      hits: 1,
      ultima_confirmacao_em: new Date().toISOString(),
      criado_por: params.usuario_id ?? null,
    });
  }
}