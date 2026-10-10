/** Formato único de números e datas do deck de fechamento. */

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const ORDINAIS = ['1º', '2º', '3º', '4º'];

function decimal(v: number, casas: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** "R$ 44,7 mil", "R$ 1,2 mi", "R$ 324,20", "−R$ 10,6 mil". */
export function brl(v: number, casas = 1): string {
  const a = Math.abs(v);
  const sinal = v < 0 && a >= 0.005 ? '−' : '';
  if (a >= 1_000_000) return `${sinal}R$ ${decimal(a / 1_000_000, casas)} mi`;
  if (a >= 1000) return `${sinal}R$ ${decimal(a / 1000, casas)} mil`;
  return `${sinal}R$ ${decimal(a, 2)}`;
}

/** Valor em mil, sem unidade, para eixos e rótulos de gráfico: "44,7". */
export function mil(v: number, casas = 1): string {
  const t = decimal(Math.abs(v) / 1000, casas);
  return v < 0 && Number(t.replace(',', '.')) !== 0 ? `−${t}` : t;
}

/** "+12,8%", "−30,8%". Variação entre dois valores; null se a base é zero. */
export function variacao(atual: number, base: number, casas = 1): string | null {
  if (!base) return null;
  const p = (atual / base - 1) * 100;
  const s = p > 0 ? '+' : p < 0 ? '−' : '';
  return `${s}${decimal(Math.abs(p), casas)}%`;
}

/** "57%", "0,7%": sem casa decimal a partir de 10%. */
export function pct(parte: number, total: number): string {
  if (!total) return '0%';
  const p = (parte / total) * 100;
  return `${decimal(p, p < 10 && p > 0 && Math.round(p) !== p ? 1 : 0)}%`;
}

/** "2,7×". */
export function vezes(atual: number, base: number): string {
  return `${decimal(atual / base, 1)}×`;
}

export function inteiro(v: number): string {
  return Math.round(v).toLocaleString('pt-BR');
}

export function ano(comp: string): number {
  return Number(comp.slice(0, 4));
}

export function mes(comp: string): number {
  return Number(comp.slice(5, 7));
}

/** Soma `n` meses a AAAA-MM. */
export function somarMeses(comp: string, n: number): string {
  const total = ano(comp) * 12 + (mes(comp) - 1) + n;
  const a = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return `${a}-${String(m).padStart(2, '0')}`;
}

/** Meses de `ini` a `fim`, inclusive. */
export function intervaloMeses(ini: string, fim: string): string[] {
  const out: string[] = [];
  for (let c = ini; c <= fim; c = somarMeses(c, 1)) out.push(c);
  return out;
}

/** "setembro". */
export function nomeMes(comp: string): string {
  return MESES[mes(comp) - 1];
}

/** "Setembro". */
export function nomeMesMaiusculo(comp: string): string {
  const n = nomeMes(comp);
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/** "set". */
export function mesCurto(comp: string): string {
  return MESES_CURTOS[mes(comp) - 1];
}

/** "set/26". */
export function mesAnoCurto(comp: string): string {
  return `${mesCurto(comp)}/${String(ano(comp)).slice(2)}`;
}

/** "setembro de 2026". */
export function mesAnoExtenso(comp: string): string {
  return `${nomeMes(comp)} de ${ano(comp)}`;
}

/** 1 a 4. */
export function trimestre(comp: string): number {
  return Math.ceil(mes(comp) / 3);
}

/** "3º tri", ou "3º trimestre" por extenso. */
export function nomeTrimestre(t: number, extenso = false): string {
  return `${ORDINAIS[t - 1]} ${extenso ? 'trimestre' : 'tri'}`;
}

/** "30/09/2026": último dia do mês. */
export function fimDoMes(comp: string): string {
  const d = new Date(ano(comp), mes(comp), 0).getDate();
  return `${String(d).padStart(2, '0')}/${comp.slice(5, 7)}/${ano(comp)}`;
}

/** "30/09": último dia do mês, sem o ano. */
export function fimDoMesCurto(comp: string): string {
  return fimDoMes(comp).slice(0, 5);
}

const SUFIXOS = /\b(LTDA\.?|LIMITADA|S\/?A\.?|S\.A\.?|EIRELI|EPP|ME|MEI|IND(\.|USTRIA)?\s+E\s+COM(\.|ERCIO)?.*|COM(\.|ERCIO)?\s+E\s+REPRESENTA[CÇ][OÕ]ES.*|AGROINDUSTRIAL.*|DE ALIMENTOS.*|ALIMENTOS.*|AVICULTURA.*|BRASIL)\b/gi;
const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

/**
 * Nome curto para o deck: sem razão social ("LTDA", "S.A.", "Indústria e
 * Comércio…"), em caixa normal e com até três palavras.
 */
export function nomeCurto(nome: string): string {
  const limpo = nome.replace(SUFIXOS, ' ').replace(/[.,\-–]+\s*$/, '').replace(/\s+/g, ' ').trim() || nome.trim();
  const palavras = limpo.split(' ').slice(0, 3);
  if (palavras.length === 1 && /^[A-Z0-9]{2,4}$/.test(palavras[0])) return palavras[0];
  return palavras
    .map((p, i) => {
      if (/^[A-Z0-9]{2,3}$/.test(p) && !/[AEIOU]/.test(p)) return p;
      const low = p.toLocaleLowerCase('pt-BR');
      if (i > 0 && MINUSCULAS.has(low)) return low;
      return low.replace(/(^|[-/])(\p{L})/gu, (_m, s: string, c: string) => s + c.toLocaleUpperCase('pt-BR'));
    })
    .join(' ');
}

export const NOME_ESTADO: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal',
  ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais',
  PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};

/** "um", "dois"… até doze; acima disso, o número. */
export function porExtenso(n: number, feminino = false): string {
  const m = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze'];
  if (n < 0 || n > 12 || !Number.isInteger(n)) return String(n);
  const s = m[n];
  if (!feminino) return s;
  return s === 'um' ? 'uma' : s === 'dois' ? 'duas' : s;
}

/** "Três", com inicial maiúscula. */
export function porExtensoMaiusculo(n: number, feminino = false): string {
  const s = porExtenso(n, feminino);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "R$ 1.621,00": valor exato em reais. */
export function reais(v: number): string {
  return `${v < 0 ? '−' : ''}R$ ${decimal(Math.abs(v), 2)}`;
}

/** "0,6", "3,5": número com casas fixas. */
export function numero(v: number, casas = 1): string {
  return decimal(v, casas);
}

/** "0,6 mês", "3,5 meses". */
export function meses(v: number): string {
  return `${decimal(v, 1)} ${v >= 2 ? 'meses' : 'mês'}`;
}

/** "dd/mm/aaaa" de uma data. */
export function dataBr(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
