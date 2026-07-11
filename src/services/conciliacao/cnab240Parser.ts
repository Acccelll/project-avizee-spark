/**
 * Parser CNAB 240 — extrato bancário (segmento E do lote tipo 3).
 * Layout FEBRABAN posições 1-based. Extrai apenas movimentos com valor não nulo.
 */
import type { LinhaExtratoNormalizadaInput } from "./importService";

function slice1(line: string, from: number, to: number): string {
  return line.slice(from - 1, to);
}

function parseValor(raw: string, decimals = 2): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return n / 10 ** decimals;
}

function parseData(raw: string): string | null {
  if (!/^\d{8}$/.test(raw)) return null;
  const d = raw.slice(0, 2);
  const m = raw.slice(2, 4);
  const y = raw.slice(4, 8);
  return `${y}-${m}-${d}`;
}

export interface Cnab240ParseResult {
  linhas: LinhaExtratoNormalizadaInput[];
  periodo_inicio: string | null;
  periodo_fim: string | null;
}

export function parseCnab240(content: string): Cnab240ParseResult {
  const lines = content.replace(/\r/g, "").split("\n").filter((l) => l.length >= 200);
  const linhas: LinhaExtratoNormalizadaInput[] = [];
  let ini: string | null = null;
  let fim: string | null = null;

  for (const line of lines) {
    const tipoReg = slice1(line, 8, 8);
    const segmento = slice1(line, 14, 14);
    if (tipoReg !== "3" || segmento !== "E") continue;

    const dataMov = parseData(slice1(line, 155, 162));
    const valorRaw = slice1(line, 163, 180); // 15,2 na maioria dos layouts extrato
    const debitoCredito = slice1(line, 181, 181).toUpperCase(); // 'D' | 'C'
    const descricao = slice1(line, 200, 239).trim() || slice1(line, 182, 199).trim();
    const documento = slice1(line, 183, 188).trim();

    if (!dataMov) continue;
    const bruto = parseValor(valorRaw, 2);
    if (bruto === 0) continue;
    const valor = debitoCredito === "D" ? -bruto : bruto;

    linhas.push({
      data_movimento: dataMov,
      valor,
      descricao,
      documento: documento || null,
    });

    if (!ini || dataMov < ini) ini = dataMov;
    if (!fim || dataMov > fim) fim = dataMov;
  }

  return { linhas, periodo_inicio: ini, periodo_fim: fim };
}

export function detectarFormato(fileName: string): "ofx" | "cnab240" | null {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (ext === "ofx") return "ofx";
  if (["ret", "rem", "cnab", "txt"].includes(ext)) return "cnab240";
  return null;
}