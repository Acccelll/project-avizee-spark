/**
 * Grava no pacote OOXML o valor calculado de cada fórmula (e o cache dos
 * gráficos), para o Workbook de Fechamento abrir preenchido mesmo onde não há
 * recálculo (Modo de Exibição Protegido, pré-visualizações, Excel no celular).
 * As fórmulas continuam no arquivo e `fullCalcOnLoad` segue ligado: o Excel
 * recalcula normalmente quando a edição é habilitada.
 */
import type JSZip from 'jszip';
import {
  ErroExcel,
  avaliar,
  colunaParaNumero,
  formatoGeral,
  isErro,
  parsearFormula,
  type Escalar,
  type FonteCelulas,
} from './formulas';

const RE_CELULA = /<c\b([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g;

function decodificar(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');
}

function escapar(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function textoDe(xml: string): string {
  return [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decodificar(m[1])).join('');
}

async function lerStringsCompartilhadas(zip: JSZip): Promise<string[]> {
  const f = zip.file('xl/sharedStrings.xml');
  if (!f) return [];
  const xml = await f.async('string');
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => textoDe(m[1]));
}

interface Celula {
  formula: string | null;
  valor: Escalar;
}

type Aba = Map<string, Celula>; // "C:L" (coluna numérica : linha) -> célula

const chave = (col: number, lin: number) => `${col}:${lin}`;

function lerAba(xml: string, compartilhadas: string[]): Aba {
  const aba: Aba = new Map();
  for (const m of xml.matchAll(RE_CELULA)) {
    const attrs = m[1];
    const interno = m[3] ?? '';
    const ref = /\sr="([A-Z]+)(\d+)"/.exec(attrs);
    if (!ref) continue;
    const tipo = /\st="([^"]+)"/.exec(attrs)?.[1];
    const f = /<f\b[^>]*>([\s\S]*?)<\/f>/.exec(interno);
    const v = /<v>([\s\S]*?)<\/v>/.exec(interno)?.[1];
    let valor: Escalar = null;
    if (tipo === 'inlineStr') valor = textoDe(interno);
    else if (v !== undefined) {
      if (tipo === 's') valor = compartilhadas[Number(v)] ?? '';
      else if (tipo === 'str') valor = decodificar(v);
      else if (tipo === 'b') valor = v === '1';
      else if (tipo === 'e') valor = new ErroExcel(v);
      else valor = Number(v);
    }
    aba.set(chave(colunaParaNumero(ref[1]), Number(ref[2])), {
      formula: f ? decodificar(f[1]) : null,
      valor,
    });
  }
  return aba;
}

/** Calcula todas as fórmulas, com memória e proteção contra referência circular. */
class Planilha implements FonteCelulas {
  private calculado = new Map<string, Escalar>();
  private emCurso = new Set<string>();

  constructor(private abas: Map<string, Aba>) {}

  valor(nomeAba: string, col: number, lin: number): Escalar {
    const aba = this.abas.get(nomeAba);
    if (!aba) return new ErroExcel('#REF!');
    const cel = aba.get(chave(col, lin));
    if (!cel) return null;
    if (cel.formula === null) return cel.valor;
    const k = `${nomeAba}!${chave(col, lin)}`;
    if (this.calculado.has(k)) return this.calculado.get(k)!;
    if (this.emCurso.has(k)) return 0; // circular: Excel sem iteração mostra 0
    this.emCurso.add(k);
    let r: Escalar;
    try {
      const res = avaliar(parsearFormula(cel.formula), nomeAba, this);
      r = Array.isArray(res) ? (res[0]?.[0] ?? null) : res;
      if (r === null) r = 0;
      if (typeof r === 'number' && !Number.isFinite(r)) r = new ErroExcel('#NUM!');
    } catch {
      r = new ErroExcel('#NAME?');
    }
    this.emCurso.delete(k);
    this.calculado.set(k, r);
    return r;
  }
}

function celulaComValor(attrs: string, interno: string, v: Escalar): string {
  const semTipo = attrs.replace(/\st="[^"]*"/, '');
  const f = /<f\b[^>]*>[\s\S]*?<\/f>|<f\b[^>]*\/>/.exec(interno)?.[0] ?? '';
  if (isErro(v)) return `<c${semTipo} t="e">${f}<v>${escapar(v.codigo)}</v></c>`;
  if (typeof v === 'number') return `<c${semTipo}>${f}<v>${v}</v></c>`;
  if (typeof v === 'boolean') return `<c${semTipo} t="b">${f}<v>${v ? 1 : 0}</v></c>`;
  return `<c${semTipo} t="str">${f}<v>${escapar(String(v ?? ''))}</v></c>`;
}

function referenciaFaixa(ref: string): { aba: string; c1: number; l1: number; c2: number; l2: number } | null {
  const m = /^(?:'((?:[^']|'')+)'|([^!]+))!\$?([A-Z]{1,3})\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?$/.exec(ref.trim());
  if (!m) return null;
  const aba = m[1] ? m[1].replace(/''/g, "'") : m[2];
  const c1 = colunaParaNumero(m[3]);
  const l1 = Number(m[4]);
  const c2 = m[5] ? colunaParaNumero(m[5]) : c1;
  const l2 = m[6] ? Number(m[6]) : l1;
  return { aba, c1: Math.min(c1, c2), l1: Math.min(l1, l2), c2: Math.max(c1, c2), l2: Math.max(l1, l2) };
}

function cacheGrafico(tipo: 'num' | 'str', valores: Escalar[]): string {
  const pts = valores
    .map((v, i) => {
      if (v === null || isErro(v)) return '';
      if (tipo === 'num') {
        if (typeof v !== 'number') return '';
        return `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`;
      }
      const s = typeof v === 'number' ? formatoGeral(v) : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : v;
      return `<c:pt idx="${i}"><c:v>${escapar(s)}</c:v></c:pt>`;
    })
    .join('');
  return tipo === 'num'
    ? `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${valores.length}"/>${pts}</c:numCache>`
    : `<c:strCache><c:ptCount val="${valores.length}"/>${pts}</c:strCache>`;
}

export interface ResumoRecalculo {
  formulas: number;
  erros: number;
  graficos: number;
}

/**
 * Calcula as fórmulas das abas e grava os valores no zip.
 * `abas`: nome da aba -> caminho da parte (xl/worksheets/sheetN.xml).
 */
export async function gravarValoresCalculados(zip: JSZip, abas: Map<string, string>): Promise<ResumoRecalculo> {
  const compartilhadas = await lerStringsCompartilhadas(zip);
  const xmlPorAba = new Map<string, string>();
  const modelo = new Map<string, Aba>();
  for (const [nome, path] of abas) {
    const f = zip.file(path);
    if (!f) continue;
    const xml = await f.async('string');
    xmlPorAba.set(nome, xml);
    modelo.set(nome, lerAba(xml, compartilhadas));
  }
  const planilha = new Planilha(modelo);
  const resumo: ResumoRecalculo = { formulas: 0, erros: 0, graficos: 0 };

  for (const [nome, xml] of xmlPorAba) {
    if (!xml.includes('<f')) continue;
    const novo = xml.replace(RE_CELULA, (orig, attrs: string, _fim: string, interno?: string) => {
      if (!interno || !/<f\b/.test(interno)) return orig;
      const ref = /\sr="([A-Z]+)(\d+)"/.exec(attrs);
      if (!ref) return orig;
      const v = planilha.valor(nome, colunaParaNumero(ref[1]), Number(ref[2]));
      resumo.formulas++;
      // Fórmula que o avaliador não entende fica sem valor: o Excel calcula ao abrir.
      if (isErro(v) && v.codigo === '#NAME?') {
        resumo.erros++;
        return orig;
      }
      if (isErro(v)) resumo.erros++;
      return celulaComValor(attrs, interno, v);
    });
    zip.file(abas.get(nome)!, novo);
  }

  // Gráficos: cache dos dados de cada série (só referências na posição padrão).
  const graficos = Object.keys(zip.files).filter((p) => /^xl\/charts\/chart\d+\.xml$/.test(p));
  for (const path of graficos) {
    let xml = await zip.file(path)!.async('string');
    let mudou = false;
    xml = xml.replace(
      /<c:(num|str)Ref><c:f>([^<]*)<\/c:f>(?:<c:(?:num|str)Cache>[\s\S]*?<\/c:(?:num|str)Cache>)?/g,
      (orig, tipo: 'num' | 'str', formula: string) => {
        const faixa = referenciaFaixa(decodificar(formula));
        if (!faixa || !modelo.has(faixa.aba)) return orig;
        const valores: Escalar[] = [];
        for (let l = faixa.l1; l <= faixa.l2; l++) {
          for (let c = faixa.c1; c <= faixa.c2; c++) valores.push(planilha.valor(faixa.aba, c, l));
        }
        mudou = true;
        return `<c:${tipo}Ref><c:f>${formula}</c:f>${cacheGrafico(tipo, valores)}`;
      },
    );
    if (mudou) {
      zip.file(path, xml);
      resumo.graficos++;
    }
  }
  return resumo;
}

