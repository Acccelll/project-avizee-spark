/**
 * Motor de matching por pesos — Fase 2 do Motor Inteligente de Importação.
 * Ver docs/financeiro-motor-importacao-ofx.md § "Matching & Confidence Score".
 *
 * Puro: recebe um par (transacaoExtrato, candidato) e devolve
 * `{ score: 0..1, motivos: string[] }`. Sem I/O.
 *
 * Pesos totalizam 1.0:
 *   • valor              0.40 — tolerância R$ 0,05
 *   • data               0.25 — Δ ≤ 3d cheio; decai até 10d
 *   • favorecido/doc     0.25 — documento bate = cheio; nome fuzzy
 *   • forma_pagamento    0.10 — mesma forma canônica
 */

export interface ExtratoInput {
  data: string;                   // ISO YYYY-MM-DD
  valor: number;                  // sinal preservado
  favorecido?: string | null;
  favorecido_documento?: string | null;
  forma_pagamento?: string | null;
  documento?: string | null;
}

export interface CandidatoInput {
  id: string;
  tipo: "pagar" | "receber";
  valor: number;                  // sempre positivo
  data_vencimento: string;
  fornecedor_nome?: string | null;
  fornecedor_documento?: string | null;
  cliente_nome?: string | null;
  cliente_documento?: string | null;
  forma_pagamento?: string | null;
  titulo?: string | null;
}

export interface MatchScore {
  score: number;
  motivos: string[];
}

export const TOLERANCIA_VALOR = 0.05;

function scoreValor(extrato: number, candidato: number, tipo: CandidatoInput["tipo"]): number {
  // Extrato débito (< 0) casa com "pagar"; crédito (> 0) casa com "receber".
  const esperadoPositivo = tipo === "receber";
  if (esperadoPositivo !== extrato >= 0) return 0;
  const diff = Math.abs(Math.abs(extrato) - candidato);
  if (diff <= TOLERANCIA_VALOR) return 1;
  if (diff <= 1) return 0.6;
  if (diff <= 5) return 0.3;
  return 0;
}

function scoreData(a: string, b: string): number {
  const diffDias = Math.abs(
    (new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) /
      86_400_000,
  );
  if (diffDias <= 3) return 1;
  if (diffDias <= 10) return 1 - (diffDias - 3) / 7;
  return 0;
}

function normalizarNome(s?: string | null): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): Set<string> {
  return new Set(s.split(" ").filter((t) => t.length >= 3));
}

function jaccard(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  ta.forEach((t) => tb.has(t) && inter++);
  return inter / (ta.size + tb.size - inter);
}

function scoreFavorecido(
  ex: ExtratoInput,
  cand: CandidatoInput,
): { score: number; motivo?: string } {
  const docExtrato = ex.favorecido_documento?.replace(/\D/g, "") ?? "";
  const docCand = (cand.tipo === "pagar" ? cand.fornecedor_documento : cand.cliente_documento)
    ?.replace(/\D/g, "") ?? "";

  if (docExtrato && docCand && docExtrato === docCand) {
    return { score: 1, motivo: "documento bate" };
  }

  const nomeCand = cand.tipo === "pagar" ? cand.fornecedor_nome : cand.cliente_nome;
  const sim = jaccard(normalizarNome(ex.favorecido), normalizarNome(nomeCand));
  if (sim >= 0.6) return { score: sim, motivo: `nome semelhante (${sim.toFixed(2)})` };
  return { score: 0 };
}

function scoreForma(a?: string | null, b?: string | null): number {
  if (!a || !b) return 0;
  return a.trim().toLowerCase() === b.trim().toLowerCase() ? 1 : 0;
}

export function scoreMatch(extrato: ExtratoInput, candidato: CandidatoInput): MatchScore {
  const motivos: string[] = [];

  const sv = scoreValor(extrato.valor, candidato.valor, candidato.tipo);
  if (sv >= 1) motivos.push("valor idêntico");
  else if (sv > 0) motivos.push(`valor próximo (${sv.toFixed(2)})`);

  const sd = scoreData(extrato.data, candidato.data_vencimento);
  if (sd >= 1) motivos.push("data ≤ 3 dias");
  else if (sd > 0) motivos.push(`data próxima (${sd.toFixed(2)})`);

  const sf = scoreFavorecido(extrato, candidato);
  if (sf.motivo) motivos.push(sf.motivo);

  const sp = scoreForma(extrato.forma_pagamento, candidato.forma_pagamento);
  if (sp) motivos.push("mesma forma de pagamento");

  const score = sv * 0.4 + sd * 0.25 + sf.score * 0.25 + sp * 0.1;
  return { score: Number(score.toFixed(3)), motivos };
}