/**
 * Serviço de conciliação bancária.
 *
 * Fornece funções para sugerir e confirmar a conciliação entre transações
 * do extrato bancário (OFX) e lançamentos financeiros do ERP.
 */

import { supabase } from "@/integrations/supabase/client";
import type { TransacaoExtrato } from "./ofxParser.service";

/** Representa um título/lançamento financeiro para fins de conciliação. */
export interface TituloParaConciliacao {
  id: string;
  descricao: string | null;
  valor: number;
  data_vencimento: string;
  tipo: string;
  status: string | null;
}

/** Nível de confiança de uma sugestão automática de conciliação. */
export type NivelConfianca = "alta" | "media" | "baixa";

/** Resultado da sugestão automática de conciliação para uma transação. */
export interface SugestaoConciliacao {
  titulo: TituloParaConciliacao;
  score: number;
  confidence: NivelConfianca;
}

/** Score mínimo para considerar uma sugestão aceitável. */
const SCORE_THRESHOLD_BAIXA = 0.35;
/** Score mínimo para classificar a sugestão como confiança média. */
const SCORE_THRESHOLD_MEDIA = 0.5;
/** Score mínimo para classificar a sugestão como alta confiança. */
const SCORE_THRESHOLD_ALTA = 0.7;

/** Classifica um score numérico em nível de confiança qualitativo. */
function classificarConfianca(score: number): NivelConfianca {
  if (score >= SCORE_THRESHOLD_ALTA) return "alta";
  if (score >= SCORE_THRESHOLD_MEDIA) return "media";
  return "baixa";
}

/**
 * Normaliza uma string para comparação de descrições bancárias.
 *
 * Remove números longos (referências/IDs com 5+ dígitos), pontuação,
 * acentos e múltiplos espaços. Resultado é minúsculo, alfanumérico,
 * adequado para comparação por bigramas.
 */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    // eslint-disable-next-line no-misleading-character-class
    .replace(/[\u0300-\u036f]/g, "") // remove diacríticos
    .replace(/\d{5,}/g, "")           // remove referências numéricas longas
    .replace(/[^\w\s]/g, " ")        // pontuação → espaço
    .replace(/\s+/g, " ")
    .trim();
}

/** Extrai o conjunto de bigramas (pares de caracteres) de uma string. */
function bigrams(s: string): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) {
    set.add(s.slice(i, i + 2));
  }
  return set;
}

/**
 * Calcula a similaridade entre duas descrições bancárias usando o
 * coeficiente de Sørensen-Dice sobre bigramas, com normalização prévia.
 *
 * Mais robusto que bag-of-words para strings curtas e abreviadas
 * típicas de extratos bancários (ex.: "TED CRED 12345", "PIX RECEB").
 *
 * @returns Valor entre 0 (sem similaridade) e 1 (idênticas).
 */
export function calcularSimilaridade(a: string, b: string): number {
  const na = normalizar(a);
  const nb = normalizar(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const ba = bigrams(na);
  const bb = bigrams(nb);
  if (ba.size === 0 || bb.size === 0) return 0;

  let intersect = 0;
  ba.forEach((bg) => {
    if (bb.has(bg)) intersect++;
  });

  return (2 * intersect) / (ba.size + bb.size);
}

/**
 * Calcula o score de matching entre uma transação do extrato e um título.
 *
 * Critérios (pesos):
 * - Valor deve ser idêntico (diferença < R$ 0,01) — obrigatório.
 * - Data próxima (até 3 dias): contribui até 0,6 ao score.
 * - Similaridade de descrição: contribui até 0,4 ao score.
 *
 * @returns Score de 0 a 1. Retorna 0 se o valor não corresponder.
 */
export function calcularScoreConciliacao(
  transacao: TransacaoExtrato,
  titulo: TituloParaConciliacao,
): number {
  const valorMatch = Math.abs(Math.abs(titulo.valor) - transacao.valor) < 0.01;
  if (!valorMatch) return 0;

  const dataExtrato = new Date(transacao.data);
  const dataLanc = new Date(titulo.data_vencimento);
  const diffDias = Math.abs(
    (dataExtrato.getTime() - dataLanc.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDias > 3) return 0;

  const scoreData = 1 - (diffDias / 3) * 0.2; // 1.0 (mesmo dia) → 0.8 (3 dias)
  const simDesc = calcularSimilaridade(
    transacao.descricao,
    titulo.descricao ?? "",
  );

  return scoreData * 0.6 + simDesc * 0.4;
}

/**
 * Sugere o melhor lançamento para conciliar com uma transação do extrato.
 *
 * Heurística: maximiza o score combinado (valor, data, similaridade de
 * descrição). Sugestões com score abaixo de `SCORE_THRESHOLD_BAIXA` são
 * descartadas como ruído.
 *
 * @param transacao   Transação do extrato bancário.
 * @param titulos     Lista de lançamentos pendentes do ERP.
 * @returns           Sugestão com `titulo`, `score` e `confidence`,
 *                    ou `null` se nenhum candidato atingir o threshold.
 */
export function sugerirConciliacao(
  transacao: TransacaoExtrato,
  titulos: TituloParaConciliacao[],
): SugestaoConciliacao | null {
  let melhor: { titulo: TituloParaConciliacao; score: number } | null = null;

  for (const titulo of titulos) {
    const score = calcularScoreConciliacao(transacao, titulo);
    if (score < SCORE_THRESHOLD_BAIXA) continue;
    if (!melhor || score > melhor.score) {
      melhor = { titulo, score };
    }
  }

  if (!melhor) return null;
  return {
    titulo: melhor.titulo,
    score: melhor.score,
    confidence: classificarConfianca(melhor.score),
  };
}

/**
 * Registra a conciliação entre uma transação do extrato e um lançamento ERP.
 *
 * Quando `tituloId` é fornecido, marca o lançamento como conciliado.
 * Quando omitido, registra apenas a transação do extrato como "sem par".
 *
 * @param contaId           ID da conta bancária.
 * @param transacaoExtrato  Transação do extrato a ser conciliada.
 * @param tituloId          ID do lançamento ERP (opcional).
 */
export async function conciliarTransacao(
  contaId: string,
  transacaoExtrato: TransacaoExtrato,
  tituloId?: string,
): Promise<void> {
  if (!tituloId) return; // Sem par — nada a persistir por ora

  const { data: lanc, error: fetchError } = await supabase
    .from("financeiro_lancamentos")
    .select("id, valor, saldo_restante")
    .eq("id", tituloId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!lanc?.id) throw new Error("Lançamento não encontrado para conciliação.");

  const saldoAtual = lanc.saldo_restante != null
    ? Number(lanc.saldo_restante)
    : Number(lanc.valor);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: baixaError } = await (supabase.from as any)("financeiro_baixas").insert({
    lancamento_id: tituloId,
    valor_pago: saldoAtual,
    data_baixa: transacaoExtrato.data,
    forma_pagamento: null,
    conta_bancaria_id: contaId,
  });

  if (baixaError) throw new Error(baixaError.message);

  const { error } = await supabase
    .from("financeiro_lancamentos")
    .update({
      status: "pago",
      data_pagamento: transacaoExtrato.data,
      conta_bancaria_id: contaId,
      valor_pago: Number(lanc.valor) - 0,
      saldo_restante: 0,
    })
    .eq("id", tituloId);

  if (error) throw new Error(error.message);
}

/**
 * Persiste um lote de conciliação bancária (header + pares) no banco de dados.
 */
export async function confirmarConciliacao(payload: {
  conta_bancaria_id: string;
  data_conciliacao: string;
  pares: Array<{
    extrato_id: string;
    lancamento_id: string;
    valor_extrato: number | null;
    valor_lancamento: number | null;
  }>;
  usuario_id?: string;
}): Promise<string> {
  const { data: conc, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('conciliacao_bancaria' as any)
    .insert({
      conta_bancaria_id: payload.conta_bancaria_id,
      data_conciliacao: payload.data_conciliacao,
      total_pares: payload.pares.length,
      usuario_id: payload.usuario_id ?? null,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  if (payload.pares.length > 0) {
    const { error: paresError } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('conciliacao_pares' as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(payload.pares.map(p => ({ ...p, conciliacao_id: (conc as any).id })));
    if (paresError) throw new Error(paresError.message);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (conc as any).id;
}
