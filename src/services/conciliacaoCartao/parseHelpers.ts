export function parseBrNumber(s: string): number {
  const clean = s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

const MESES: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

export function parseBrDate(s: string): string | null {
  // dd/mm/aaaa
  let m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // dd/mm/aa
  m = s.match(/(\d{2})\/(\d{2})\/(\d{2})\b/);
  if (m) return `20${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

export function parseMesAbrev(dia: string, mes: string, anoRef: number): string | null {
  const key = mes.toLowerCase().slice(0, 3);
  const mm = MESES[key];
  if (!mm) return null;
  const d = dia.padStart(2, "0");
  return `${anoRef}-${String(mm).padStart(2, "0")}-${d}`;
}

export function parseDataExtenso(s: string, anoFallback: number): string | null {
  // "07 de abr. 2025" ou "07 de abril de 2025"
  const m = s.match(/(\d{1,2})\s+de\s+([a-zç]+)\.?\s*(?:de\s*)?(\d{4})?/i);
  if (!m) return null;
  const mm = MESES[m[2].toLowerCase().slice(0, 3)];
  if (!mm) return null;
  const ano = m[3] ? parseInt(m[3], 10) : anoFallback;
  return `${ano}-${String(mm).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/**
 * Competência = mês do fechamento (período consumido).
 * Fallback: mês do vencimento - 1 (convenção padrão do mercado).
 */
export function competenciaDoFechamento(
  dataFechamento?: string | null,
  dataVencimento?: string | null,
): string {
  if (dataFechamento && /^\d{4}-\d{2}-\d{2}$/.test(dataFechamento)) {
    return dataFechamento.slice(0, 7);
  }
  if (dataVencimento && /^\d{4}-\d{2}-\d{2}$/.test(dataVencimento)) {
    const [y, m] = dataVencimento.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1));
    d.setUTCMonth(d.getUTCMonth() - 1);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return "";
}

/** Detecta linhas que são pagamentos/estornos da própria fatura (não devem virar lançamento). */
export function ehLinhaPagamentoFatura(desc: string): boolean {
  const d = desc.trim();
  return (
    /pagamento\s+da\s+fatura/i.test(d) ||
    /^pag\s+fatura/i.test(d) ||
    /pagamento\s+on\s*line/i.test(d) ||
    /^resgate\s+pontos/i.test(d) ||
    /cr[eé]dito\s+de\s+estorno/i.test(d) ||
    /ajuste\s+de\s+fatura/i.test(d) ||
    /estorno\s+de\s+pagamento/i.test(d)
  );
}

/**
 * Para faturas cujo cabeçalho só cita "26 dez" sem ano: se o mês da linha for
 * posterior ao mês do fechamento, é uma compra do ano anterior.
 */
export function ajustarAnoLinha(mesLinha: number, mesFechamento: number, anoRef: number): number {
  if (mesLinha > mesFechamento) return anoRef - 1;
  return anoRef;
}

/** Extrai período "De DD/MM/AAAA até DD/MM/AAAA" — retorna a data final (fechamento). */
export function extrairFechamentoDoPeriodo(texto: string): string | null {
  const m = texto.match(
    /De\s+(\d{2}\/\d{2}\/\d{4})\s+(?:a|at[eé])\s+(\d{2}\/\d{2}\/\d{4})/i,
  );
  if (!m) return null;
  return parseBrDate(m[2]);
}

/** Valida se Σ(linhas positivas) ≈ valor_total. */
export function validarFatura(
  valorTotal: number,
  linhas: Array<{ valor: number }>,
): { ok: boolean; diff: number; aviso?: string } {
  const soma = linhas.reduce((s, l) => s + (l.valor > 0 ? l.valor : 0), 0);
  const diff = Number((valorTotal - soma).toFixed(2));
  if (Math.abs(diff) <= 0.01) return { ok: true, diff: 0 };
  const fmt = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
  return {
    ok: false,
    diff,
    aviso: `Divergência de ${fmt(diff)} — fatura ${fmt(valorTotal)} vs. Σ(linhas) ${fmt(soma)}. Revise as linhas ou gere um ajuste.`,
  };
}