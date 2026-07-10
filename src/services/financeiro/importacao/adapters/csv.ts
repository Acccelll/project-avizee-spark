import type { StagedTx } from "../types";

/**
 * Parser CSV mínimo para extratos bancários (formato `data;descricao;valor`
 * ou `data,descricao,valor`). Aceita cabeçalho opcional.
 */
export function adaptCSV(text: string): StagedTx[] {
  const linhas = text.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
  if (!linhas.length) return [];
  const sep = linhas[0].includes(";") ? ";" : ",";
  const temHeader = /data|desc|valor/i.test(linhas[0]);
  const dados = temHeader ? linhas.slice(1) : linhas;
  const out: StagedTx[] = [];
  dados.forEach((linha, i) => {
    const partes = linha.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (partes.length < 3) return;
    const [dataRaw, descricao, valorRaw] = partes;
    const data = normalizarData(dataRaw);
    const valor = normalizarValor(valorRaw);
    if (!data || Number.isNaN(valor)) return;
    out.push({
      id: `csv-${i}-${data}-${valor}`,
      data,
      descricao: descricao || "(sem descrição)",
      valor,
      tipo: valor >= 0 ? "C" : "D",
    });
  });
  return out;
}

function normalizarData(raw: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const br = raw.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : null;
}

function normalizarValor(raw: string): number {
  return Number(raw.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", "."));
}