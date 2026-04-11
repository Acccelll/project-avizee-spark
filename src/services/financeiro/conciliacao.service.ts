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

/**
 * Calcula a similaridade entre duas strings usando distância de Jaro-Winkler
 * simplificada (coeficiente de caracteres em comum).
 *
 * @returns Valor entre 0 (sem similaridade) e 1 (idênticas).
 */
function calcularSimilaridade(a: string, b: string): number {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (na === nb) return 1;
  if (!na || !nb) return 0;

  const setA = new Set(na.split(" ").filter(Boolean));
  const setB = new Set(nb.split(" ").filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;

  let comuns = 0;
  setA.forEach((w) => { if (setB.has(w)) comuns++; });

  return (2 * comuns) / (setA.size + setB.size);
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
 * Heurística de matching (em ordem de prioridade):
 * 1. Valor idêntico (diferença < R$ 0,01).
 * 2. Data próxima (até 3 dias de diferença).
 * 3. Similaridade de descrição (coeficiente ≥ 0,3 como bônus de desempate).
 *
 * @param transacao   Transação do extrato bancário.
 * @param titulos     Lista de lançamentos pendentes do ERP.
 * @returns           Melhor candidato ou `null` se não houver match aceitável.
 */
export function sugerirConciliacao(
  transacao: TransacaoExtrato,
  titulos: TituloParaConciliacao[],
): TituloParaConciliacao | null {
  const candidatos = titulos.filter((t) => {
    const valorMatch =
      Math.abs(Math.abs(t.valor) - transacao.valor) < 0.01;
    if (!valorMatch) return false;

    const dataExtrato = new Date(transacao.data);
    const dataLanc = new Date(t.data_vencimento);
    const diffDias = Math.abs(
      (dataExtrato.getTime() - dataLanc.getTime()) / (1000 * 60 * 60 * 24),
    );
    return diffDias <= 3;
  });

  if (candidatos.length === 0) return null;
  if (candidatos.length === 1) return candidatos[0];

  // Desempate por similaridade de descrição
  return candidatos.reduce<TituloParaConciliacao | null>((melhor, candidato) => {
    const simAtual = calcularSimilaridade(
      transacao.descricao,
      candidato.descricao ?? "",
    );
    const simMelhor = melhor
      ? calcularSimilaridade(transacao.descricao, melhor.descricao ?? "")
      : -1;
    return simAtual >= simMelhor ? candidato : melhor;
  }, null);
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

  const { error } = await supabase
    .from("financeiro_lancamentos")
    .update({
      status: "pago",
      data_pagamento: transacaoExtrato.data,
      conta_bancaria_id: contaId,
    })
    .eq("id", tituloId);

  if (error) throw new Error(error.message);
}
