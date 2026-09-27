/**
 * Avaliador de fórmulas do Workbook de Fechamento.
 *
 * O modelo tem ~2.300 fórmulas e depende de `fullCalcOnLoad` para o Excel
 * calcular ao abrir. Visualizadores que não recalculam (Modo de Exibição
 * Protegido do Excel, pré-visualização do navegador/Drive/WhatsApp, Excel no
 * celular) mostravam as abas vazias. Este avaliador calcula as fórmulas na
 * geração para gravar o valor junto de cada fórmula.
 *
 * Cobre só o que o modelo usa: referências (com aba e intervalo), operadores
 * aritméticos, `&`, comparações, operações em matriz (idioma
 * `LOOKUP(2,1/(...),faixa)`) e as funções IF, IFERROR, SUM, AVERAGE, AND,
 * ISNUMBER, N, YEAR, MONTH, EOMONTH, VLOOKUP e LOOKUP. Fórmula com algo fora
 * disso é avaliada como erro #NAME? — a célula fica sem valor e o Excel
 * calcula ao abrir, como antes.
 */

export class ErroExcel {
  constructor(readonly codigo: string) {}
}

export type Escalar = number | string | boolean | null | ErroExcel;
export type Matriz = Escalar[][];
export type Resultado = Escalar | Matriz;

const E = {
  div0: new ErroExcel('#DIV/0!'),
  na: new ErroExcel('#N/A'),
  valor: new ErroExcel('#VALUE!'),
  ref: new ErroExcel('#REF!'),
  nome: new ErroExcel('#NAME?'),
  num: new ErroExcel('#NUM!'),
};

export const isErro = (v: unknown): v is ErroExcel => v instanceof ErroExcel;
const isMatriz = (v: Resultado): v is Matriz => Array.isArray(v);

// ── Referências ──────────────────────────────────────────────────────────────

export function colunaParaNumero(col: string): number {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

export function numeroParaColuna(n: number): string {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function partesCelula(ref: string): { col: number; lin: number } {
  const m = /^\$?([A-Z]{1,3})\$?(\d+)$/.exec(ref);
  if (!m) throw new Error(`Referência inválida: ${ref}`);
  return { col: colunaParaNumero(m[1]), lin: Number(m[2]) };
}

// ── Tokenização e parser ─────────────────────────────────────────────────────

type No =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'bool'; v: boolean }
  | { t: 'err'; v: ErroExcel }
  | { t: 'ref'; aba: string | null; c1: number; l1: number; c2: number; l2: number; faixa: boolean }
  | { t: 'un'; op: string; a: No }
  | { t: 'pct'; a: No }
  | { t: 'bin'; op: string; a: No; b: No }
  | { t: 'fn'; nome: string; args: No[] };

type Tok =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'bool'; v: boolean }
  | { k: 'err'; v: string }
  | { k: 'ref'; aba: string | null; a: string; b: string | null }
  | { k: 'fn'; v: string }
  | { k: 'op'; v: string };

const RE_FN = /^([A-Za-z_][A-Za-z0-9_.]*)\(/;
const RE_REF = /^(?:('(?:[^']|'')+'|[A-Za-z_À-ÿ][\w.À-ÿ]*)!)?(\$?[A-Z]{1,3}\$?\d+)(?::(\$?[A-Z]{1,3}\$?\d+))?(?![\w(])/;
const RE_NUM = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/;
const RE_ERR = /^#(?:DIV\/0!|N\/A|VALUE!|REF!|NAME\?|NUM!|NULL!)/;

function tokenizar(f: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < f.length) {
    const ch = f[i];
    if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') { i++; continue; }
    const resto = f.slice(i);
    if (ch === '"') {
      let j = i + 1;
      let s = '';
      while (j < f.length) {
        if (f[j] === '"') {
          if (f[j + 1] === '"') { s += '"'; j += 2; continue; }
          break;
        }
        s += f[j++];
      }
      toks.push({ k: 'str', v: s });
      i = j + 1;
      continue;
    }
    let m = RE_ERR.exec(resto);
    if (m) { toks.push({ k: 'err', v: m[0] }); i += m[0].length; continue; }
    m = RE_FN.exec(resto);
    if (m) { toks.push({ k: 'fn', v: m[1].toUpperCase() }); i += m[0].length; continue; }
    m = RE_REF.exec(resto);
    if (m) {
      const aba = m[1] ? (m[1].startsWith("'") ? m[1].slice(1, -1).replace(/''/g, "'") : m[1]) : null;
      toks.push({ k: 'ref', aba, a: m[2], b: m[3] ?? null });
      i += m[0].length;
      continue;
    }
    m = /^(TRUE|FALSE)(?![\w(])/i.exec(resto);
    if (m) { toks.push({ k: 'bool', v: m[1].toUpperCase() === 'TRUE' }); i += m[0].length; continue; }
    m = RE_NUM.exec(resto);
    if (m) { toks.push({ k: 'num', v: Number(m[0]) }); i += m[0].length; continue; }
    const dois = f.slice(i, i + 2);
    if (dois === '<>' || dois === '<=' || dois === '>=') { toks.push({ k: 'op', v: dois }); i += 2; continue; }
    if ('+-*/^&=<>(),%'.includes(ch)) { toks.push({ k: 'op', v: ch }); i++; continue; }
    throw new Error(`Caractere inesperado "${ch}" na fórmula ${f}`);
  }
  return toks;
}

class Parser {
  private i = 0;
  constructor(private toks: Tok[], private f: string) {}

  parse(): No {
    const n = this.comparacao();
    if (this.i < this.toks.length) throw new Error(`Sobra na fórmula ${this.f}`);
    return n;
  }

  private ver(): Tok | undefined { return this.toks[this.i]; }
  private op(v: string): boolean {
    const t = this.ver();
    if (t?.k === 'op' && t.v === v) { this.i++; return true; }
    return false;
  }

  private comparacao(): No {
    let a = this.concat();
    for (;;) {
      const t = this.ver();
      if (t?.k === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(t.v)) {
        this.i++;
        a = { t: 'bin', op: t.v, a, b: this.concat() };
      } else return a;
    }
  }
  private concat(): No {
    let a = this.soma();
    while (this.op('&')) a = { t: 'bin', op: '&', a, b: this.soma() };
    return a;
  }
  private soma(): No {
    let a = this.produto();
    for (;;) {
      if (this.op('+')) a = { t: 'bin', op: '+', a, b: this.produto() };
      else if (this.op('-')) a = { t: 'bin', op: '-', a, b: this.produto() };
      else return a;
    }
  }
  private produto(): No {
    let a = this.potencia();
    for (;;) {
      if (this.op('*')) a = { t: 'bin', op: '*', a, b: this.potencia() };
      else if (this.op('/')) a = { t: 'bin', op: '/', a, b: this.potencia() };
      else return a;
    }
  }
  private potencia(): No {
    let a = this.unario();
    while (this.op('^')) a = { t: 'bin', op: '^', a, b: this.unario() };
    return a;
  }
  private unario(): No {
    if (this.op('-')) return { t: 'un', op: '-', a: this.unario() };
    if (this.op('+')) return this.unario();
    let a = this.primario();
    while (this.op('%')) a = { t: 'pct', a };
    return a;
  }
  private primario(): No {
    const t = this.toks[this.i++];
    if (!t) throw new Error(`Fórmula incompleta: ${this.f}`);
    switch (t.k) {
      case 'num': return { t: 'num', v: t.v };
      case 'str': return { t: 'str', v: t.v };
      case 'bool': return { t: 'bool', v: t.v };
      case 'err': return { t: 'err', v: new ErroExcel(t.v) };
      case 'ref': {
        const a = partesCelula(t.a);
        const b = t.b ? partesCelula(t.b) : a;
        return {
          t: 'ref', aba: t.aba,
          c1: Math.min(a.col, b.col), l1: Math.min(a.lin, b.lin),
          c2: Math.max(a.col, b.col), l2: Math.max(a.lin, b.lin),
          faixa: !!t.b,
        };
      }
      case 'fn': {
        const args: No[] = [];
        if (!this.op(')')) {
          do {
            const prox = this.ver();
            // Argumento omitido: "f(a,,b)".
            if (prox?.k === 'op' && (prox.v === ',' || prox.v === ')')) args.push({ t: 'str', v: '' });
            else args.push(this.comparacao());
          } while (this.op(','));
          if (!this.op(')')) throw new Error(`Faltou ")" em ${this.f}`);
        }
        return { t: 'fn', nome: t.v, args };
      }
      case 'op':
        if (t.v === '(') {
          const n = this.comparacao();
          if (!this.op(')')) throw new Error(`Faltou ")" em ${this.f}`);
          return n;
        }
    }
    throw new Error(`Token inesperado na fórmula ${this.f}`);
  }
}

export function parsearFormula(f: string): No {
  return new Parser(tokenizar(f), f).parse();
}

// ── Coerções ─────────────────────────────────────────────────────────────────

function paraNumero(v: Escalar): number | ErroExcel {
  if (isErro(v)) return v;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === null) return 0;
  const s = v.trim();
  if (s === '') return E.valor;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : E.valor;
}

function paraLogico(v: Escalar): boolean | ErroExcel {
  if (isErro(v)) return v;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (v === null) return false;
  const s = v.toUpperCase();
  if (s === 'TRUE') return true;
  if (s === 'FALSE') return false;
  return E.valor;
}

/** Formato "Geral" do Excel para concatenação. */
export function formatoGeral(n: number): string {
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
  return String(Number(n.toPrecision(15)));
}

function paraTexto(v: Escalar): string | ErroExcel {
  if (isErro(v)) return v;
  if (v === null) return '';
  if (typeof v === 'number') return formatoGeral(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return v;
}

const RANK_TIPO = (v: number | string | boolean) => (typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : 2);

function comparar(a: Escalar, b: Escalar, op: string): Escalar {
  if (isErro(a)) return a;
  if (isErro(b)) return b;
  // Célula vazia assume o "zero" do outro lado.
  const vazio = (o: Escalar) => (typeof o === 'string' ? '' : typeof o === 'boolean' ? false : 0);
  const x = a === null ? vazio(b) : a;
  const y = b === null ? vazio(a) : b;
  let c: number;
  if (RANK_TIPO(x) !== RANK_TIPO(y)) c = RANK_TIPO(x) - RANK_TIPO(y);
  else if (typeof x === 'string') {
    const xs = x.toLowerCase();
    const ys = (y as string).toLowerCase();
    c = xs < ys ? -1 : xs > ys ? 1 : 0;
  } else c = Number(x) - Number(y);
  switch (op) {
    case '=': return c === 0;
    case '<>': return c !== 0;
    case '<': return c < 0;
    case '>': return c > 0;
    case '<=': return c <= 0;
    default: return c >= 0;
  }
}

function aplicarBinario(op: string, a: Escalar, b: Escalar): Escalar {
  if (['=', '<>', '<', '>', '<=', '>='].includes(op)) return comparar(a, b, op);
  if (op === '&') {
    const x = paraTexto(a);
    if (isErro(x)) return x;
    const y = paraTexto(b);
    if (isErro(y)) return y;
    return x + y;
  }
  const x = paraNumero(a);
  if (isErro(x)) return x;
  const y = paraNumero(b);
  if (isErro(y)) return y;
  switch (op) {
    case '+': return x + y;
    case '-': return x - y;
    case '*': return x * y;
    case '/': return y === 0 ? E.div0 : x / y;
    case '^': {
      const r = x ** y;
      return Number.isFinite(r) ? r : E.num;
    }
  }
  return E.valor;
}

/** Aplica `f` elemento a elemento, com difusão de escalares e linhas/colunas. */
function mapear2(a: Resultado, b: Resultado, f: (x: Escalar, y: Escalar) => Escalar): Resultado {
  if (!isMatriz(a) && !isMatriz(b)) return f(a, b);
  const A = isMatriz(a) ? a : [[a]];
  const B = isMatriz(b) ? b : [[b]];
  const linhas = Math.max(A.length, B.length);
  const cols = Math.max(A[0]?.length ?? 0, B[0]?.length ?? 0);
  const pega = (M: Matriz, i: number, j: number): Escalar => {
    const li = M.length === 1 ? 0 : i;
    const cj = M[0].length === 1 ? 0 : j;
    return li < M.length && cj < M[0].length ? M[li][cj] : E.na;
  };
  const out: Matriz = [];
  for (let i = 0; i < linhas; i++) {
    const linha: Escalar[] = [];
    for (let j = 0; j < cols; j++) linha.push(f(pega(A, i, j), pega(B, i, j)));
    out.push(linha);
  }
  return out;
}

function mapear1(a: Resultado, f: (x: Escalar) => Escalar): Resultado {
  return isMatriz(a) ? a.map((l) => l.map(f)) : f(a);
}

const escalar = (r: Resultado): Escalar => (isMatriz(r) ? (r[0]?.[0] ?? null) : r);
const achatar = (r: Resultado): Escalar[] => (isMatriz(r) ? r.flat() : [r]);

// ── Datas (sistema 1900) ─────────────────────────────────────────────────────

const DIA_MS = 86_400_000;
const BASE_1900 = Date.UTC(1899, 11, 30);

function serialParaData(serial: number): Date {
  const s = Math.floor(serial);
  // Até 28/02/1900 o Excel conta a partir de 31/12/1899 (bug do 29/02/1900).
  return s < 61 ? new Date(Date.UTC(1899, 11, 31) + s * DIA_MS) : new Date(BASE_1900 + s * DIA_MS);
}

function dataParaSerial(ano: number, mes0: number, dia: number): number {
  const s = Math.round((Date.UTC(ano, mes0, dia) - BASE_1900) / DIA_MS);
  return s < 61 ? s - 1 : s;
}

// ── Avaliação ────────────────────────────────────────────────────────────────

export interface FonteCelulas {
  /** Valor (já calculado, se for fórmula) de uma célula; null se vazia. */
  valor(aba: string, col: number, lin: number): Escalar;
}

export function avaliar(no: No, abaAtual: string, fonte: FonteCelulas): Resultado {
  const ev = (n: No): Resultado => avaliar(n, abaAtual, fonte);
  switch (no.t) {
    case 'num': return no.v;
    case 'str': return no.v;
    case 'bool': return no.v;
    case 'err': return no.v;
    case 'ref': {
      const aba = no.aba ?? abaAtual;
      if (!no.faixa) return fonte.valor(aba, no.c1, no.l1);
      const m: Matriz = [];
      for (let l = no.l1; l <= no.l2; l++) {
        const linha: Escalar[] = [];
        for (let c = no.c1; c <= no.c2; c++) linha.push(fonte.valor(aba, c, l));
        m.push(linha);
      }
      return m;
    }
    case 'un': return mapear1(ev(no.a), (x) => {
      const n = paraNumero(x);
      return isErro(n) ? n : -n;
    });
    case 'pct': return mapear1(ev(no.a), (x) => {
      const n = paraNumero(x);
      return isErro(n) ? n : n / 100;
    });
    case 'bin': return mapear2(ev(no.a), ev(no.b), (x, y) => aplicarBinario(no.op, x, y));
    case 'fn': return chamar(no.nome, no.args, ev);
  }
}

/** Valores de um argumento: referências e matrizes ignoram texto/lógico/vazio. */
function valoresNumericos(arg: No, r: Resultado): number[] | ErroExcel {
  const out: number[] = [];
  if (arg.t === 'ref' || isMatriz(r)) {
    for (const v of achatar(r)) {
      if (isErro(v)) return v;
      if (typeof v === 'number') out.push(v);
    }
    return out;
  }
  const n = paraNumero(r as Escalar);
  if (isErro(n)) return n;
  out.push(n);
  return out;
}

function chamar(nome: string, args: No[], ev: (n: No) => Resultado): Resultado {
  switch (nome) {
    case 'IF': {
      if (args.length < 2) return E.valor;
      const c = paraLogico(escalar(ev(args[0])));
      if (isErro(c)) return c;
      if (c) return ev(args[1]);
      return args.length > 2 ? ev(args[2]) : false;
    }
    case 'IFERROR': {
      if (args.length < 2) return E.valor;
      const r = ev(args[0]);
      return isErro(escalar(r)) ? ev(args[1]) : r;
    }
    case 'SUM':
    case 'AVERAGE': {
      let soma = 0;
      let n = 0;
      for (const a of args) {
        const vs = valoresNumericos(a, ev(a));
        if (isErro(vs)) return vs;
        for (const v of vs) { soma += v; n++; }
      }
      if (nome === 'SUM') return soma;
      return n === 0 ? E.div0 : soma / n;
    }
    case 'AND': {
      let algum = false;
      for (const a of args) {
        const r = ev(a);
        if (a.t === 'ref' || isMatriz(r)) {
          for (const v of achatar(r)) {
            if (isErro(v)) return v;
            if (typeof v === 'boolean' || typeof v === 'number') {
              algum = true;
              if (!(typeof v === 'boolean' ? v : v !== 0)) return false;
            }
          }
        } else {
          const b = paraLogico(r as Escalar);
          if (isErro(b)) return b;
          algum = true;
          if (!b) return false;
        }
      }
      return algum ? true : E.valor;
    }
    case 'ISNUMBER':
      return args.length ? mapear1(ev(args[0]), (v) => typeof v === 'number') : E.valor;
    case 'N': {
      const v = escalar(args.length ? ev(args[0]) : null);
      if (isErro(v)) return v;
      return typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : 0;
    }
    case 'YEAR':
    case 'MONTH': {
      const n = paraNumero(escalar(args.length ? ev(args[0]) : null));
      if (isErro(n)) return n;
      if (n < 0) return E.num;
      const d = serialParaData(n);
      return nome === 'YEAR' ? d.getUTCFullYear() : d.getUTCMonth() + 1;
    }
    case 'EOMONTH': {
      if (args.length < 2) return E.valor;
      const ini = paraNumero(escalar(ev(args[0])));
      if (isErro(ini)) return ini;
      const meses = paraNumero(escalar(ev(args[1])));
      if (isErro(meses)) return meses;
      if (ini < 0) return E.num;
      const d = serialParaData(ini);
      const alvo = d.getUTCMonth() + Math.trunc(meses) + 1;
      return dataParaSerial(d.getUTCFullYear(), alvo, 0);
    }
    case 'VLOOKUP': {
      if (args.length < 3) return E.valor;
      const alvo = escalar(ev(args[0]));
      if (isErro(alvo)) return alvo;
      const tabela = ev(args[1]);
      const M = isMatriz(tabela) ? tabela : [[tabela]];
      const col = paraNumero(escalar(ev(args[2])));
      if (isErro(col)) return col;
      if (col < 1 || col > (M[0]?.length ?? 0)) return E.ref;
      const aprox = args.length > 3 ? paraLogico(escalar(ev(args[3]))) : true;
      if (isErro(aprox)) return aprox;
      let achou = -1;
      for (let i = 0; i < M.length; i++) {
        const v = M[i][0];
        if (isErro(v) || v === null) continue;
        if (!aprox) {
          if (comparar(v, alvo, '=') === true) { achou = i; break; }
        } else if (RANK_TIPO(v) === RANK_TIPO(alvo as number | string | boolean) && comparar(v, alvo, '<=') === true) {
          achou = i;
        } else if (aprox && RANK_TIPO(v) === RANK_TIPO(alvo as number | string | boolean)) {
          break;
        }
      }
      return achou < 0 ? E.na : M[achou][Math.trunc(col) - 1];
    }
    case 'LOOKUP': {
      if (args.length < 2) return E.valor;
      const alvo = escalar(ev(args[0]));
      if (isErro(alvo) || alvo === null) return isErro(alvo) ? alvo : E.na;
      const vetor = achatar(ev(args[1]));
      const resultado = args.length > 2 ? achatar(ev(args[2])) : vetor;
      let achou = -1;
      vetor.forEach((v, i) => {
        if (isErro(v) || v === null) return;
        if (RANK_TIPO(v) === RANK_TIPO(alvo) && comparar(v, alvo, '<=') === true) achou = i;
      });
      if (achou < 0 || achou >= resultado.length) return E.na;
      return resultado[achou];
    }
    default:
      return E.nome;
  }
}
