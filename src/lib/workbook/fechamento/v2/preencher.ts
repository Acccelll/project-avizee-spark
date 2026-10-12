/**
 * Preenche o modelo v2 direto no pacote OOXML (JSZip), sem ExcelJS (que
 * descarta os gráficos). Só a aba Dados recebe valores; nas listas, as linhas
 * vazias das abas ficam ocultas. No fim, cada fórmula ganha o valor calculado
 * (ver `recalculo.ts`) para o arquivo abrir preenchido mesmo sem recálculo.
 */
import JSZip from 'jszip';
import type { ApresentacaoFechamentoDados } from '@/lib/apresentacao/fechamento/tipos';
import { colLetter, escapeXml } from '../ooxml';
import { colunaParaNumero } from '../formulas';
import { gravarValoresCalculados } from '../recalculo';
import { montarConteudoDados, type ValorCelula } from './dados';
import { ABA_DADOS, DETALHE_PRIMEIRA_LINHA } from './layout';

async function lerTexto(zip: JSZip, path: string): Promise<string> {
  const f = zip.file(path);
  if (!f) throw new Error(`Modelo do Workbook inválido: parte ausente (${path}).`);
  return f.async('string');
}

function decodificar(s: string): string {
  return s.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

/** Nome da aba -> caminho da parte (xl/worksheets/sheetN.xml). */
export async function mapaAbas(zip: JSZip): Promise<Map<string, string>> {
  const wb = await lerTexto(zip, 'xl/workbook.xml');
  const rels = await lerTexto(zip, 'xl/_rels/workbook.xml.rels');
  const alvo = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /Id="([^"]+)"/.exec(m[0])?.[1];
    const target = /Target="([^"]+)"/.exec(m[0])?.[1];
    if (id && target) alvo.set(id, `xl/${target.replace(/^\/?xl\//, '')}`);
  }
  const abas = new Map<string, string>();
  for (const m of wb.matchAll(/<sheet\b[^>]*\/>/g)) {
    const nome = /name="([^"]+)"/.exec(m[0])?.[1];
    const rid = /r:id="([^"]+)"/.exec(m[0])?.[1];
    if (nome && rid && alvo.has(rid)) abas.set(decodificar(nome), alvo.get(rid)!);
  }
  return abas;
}

interface Linha {
  attrs: string;
  /** coluna numérica -> xml da célula */
  celulas: Map<number, string>;
}

const RE_LINHA = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
const RE_CEL = /<c\b([^>]*?)(?:\/>|>[\s\S]*?<\/c>)/g;

function lerLinhas(sheetData: string): Map<number, Linha> {
  const linhas = new Map<number, Linha>();
  for (const m of sheetData.matchAll(RE_LINHA)) {
    const r = Number(/\sr="(\d+)"/.exec(m[1])?.[1]);
    if (!r) continue;
    const celulas = new Map<number, string>();
    for (const c of (m[2] ?? '').matchAll(RE_CEL)) {
      const ref = /\sr="([A-Z]+)\d+"/.exec(c[1])?.[1];
      if (ref) celulas.set(colunaParaNumero(ref), c[0]);
    }
    linhas.set(r, { attrs: m[1], celulas });
  }
  return linhas;
}

function estiloDe(celulaXml: string | undefined): string | null {
  if (!celulaXml) return null;
  return /\ss="(\d+)"/.exec(celulaXml)?.[1] ?? null;
}

function celulaXml(ref: string, v: ValorCelula, estilo: string | null): string {
  const s = estilo ? ` s="${estilo}"` : '';
  if (v === null) return `<c r="${ref}"${s}/>`;
  if (typeof v === 'number') return `<c r="${ref}"${s}><v>${v}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`;
}

function serializar(linhas: Map<number, Linha>): string {
  return [...linhas.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, l]) => {
      const attrs = l.attrs.replace(/\sspans="[^"]*"/, '');
      const cel = [...l.celulas.entries()].sort(([a], [b]) => a - b).map(([, x]) => x).join('');
      return cel ? `<row${attrs}>${cel}</row>` : `<row${attrs}/>`;
    })
    .join('');
}

/**
 * Escreve valores numa aba preservando o estilo de cada célula. Célula nova
 * herda o estilo da mesma coluna na `linhaModelo` (linhas do detalhe).
 */
export function escreverCelulas(sheetXml: string, valores: Map<string, ValorCelula>, linhaModelo?: number): string {
  const m = /<sheetData\s*\/>|<sheetData>([\s\S]*?)<\/sheetData>/.exec(sheetXml);
  if (!m) throw new Error('Aba sem sheetData.');
  const linhas = lerLinhas(m[1] ?? '');
  const modelo = linhaModelo ? linhas.get(linhaModelo) : undefined;
  for (const [ref, v] of valores) {
    const p = /^([A-Z]+)(\d+)$/.exec(ref);
    if (!p) throw new Error(`Referência inválida: ${ref}`);
    const col = colunaParaNumero(p[1]);
    const r = Number(p[2]);
    let linha = linhas.get(r);
    if (!linha) {
      linha = { attrs: ` r="${r}"`, celulas: new Map() };
      linhas.set(r, linha);
    }
    const estilo = estiloDe(linha.celulas.get(col)) ?? (modelo && r >= (linhaModelo ?? 0) ? estiloDe(modelo.celulas.get(col)) : null);
    linha.celulas.set(col, celulaXml(ref, v, estilo));
  }
  let maxLin = 1;
  let maxCol = 1;
  for (const [r, l] of linhas) {
    maxLin = Math.max(maxLin, r);
    for (const c of l.celulas.keys()) maxCol = Math.max(maxCol, c);
  }
  const corpo = `<sheetData>${serializar(linhas)}</sheetData>`;
  return sheetXml
    .slice(0, m.index)
    .concat(corpo, sheetXml.slice(m.index + m[0].length))
    .replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:${colLetter(maxCol)}${maxLin}"/>`);
}

/** Marca linhas como ocultas. */
export function ocultarLinhas(sheetXml: string, linhas: number[]): string {
  if (!linhas.length) return sheetXml;
  const alvo = new Set(linhas);
  return sheetXml.replace(/<row\b([^>]*?)(\/?)>/g, (orig, attrs: string, fecha: string) => {
    const r = Number(/\sr="(\d+)"/.exec(attrs)?.[1]);
    if (!alvo.has(r)) return orig;
    const semHidden = attrs.replace(/\shidden="[^"]*"/, '');
    return `<row${semHidden} hidden="1"${fecha}>`;
  });
}

export interface PreencherV2Opcoes {
  tipo?: 'blob' | 'uint8array';
  /** AAAA-MM-DD; padrão: hoje. */
  geradoEm?: string;
}

export async function preencherWorkbookFechamentoV2(
  modelo: ArrayBuffer | Uint8Array,
  dados: ApresentacaoFechamentoDados,
  opcoes: PreencherV2Opcoes = {},
): Promise<Blob | Uint8Array> {
  const zip = await JSZip.loadAsync(modelo);
  const abas = await mapaAbas(zip);
  const conteudo = montarConteudoDados(dados, opcoes.geradoEm);

  const dadosPath = abas.get(ABA_DADOS);
  if (!dadosPath) throw new Error('Modelo do Workbook sem a aba Dados.');
  zip.file(dadosPath, escreverCelulas(await lerTexto(zip, dadosPath), conteudo.celulas, DETALHE_PRIMEIRA_LINHA));

  for (const [aba, linhas] of Object.entries(conteudo.ocultar)) {
    const path = abas.get(aba);
    if (!path || !linhas.length) continue;
    zip.file(path, ocultarLinhas(await lerTexto(zip, path), linhas));
  }

  await gravarValoresCalculados(zip, abas);

  return zip.generateAsync({
    type: opcoes.tipo ?? 'blob',
    compression: 'DEFLATE',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
