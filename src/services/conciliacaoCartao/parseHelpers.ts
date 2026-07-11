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