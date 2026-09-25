/**
 * Preenche o modelo do Workbook de Fechamento direto no pacote OOXML (JSZip),
 * sem passar pelo ExcelJS: o ExcelJS descarta os gráficos ao reescrever o
 * arquivo, e o valor do fechamento está justamente em manter layout, tabelas e
 * gráficos do Workbook original. Só são tocados: a aba BASE (dados), rótulos
 * que dependem do ano, cabeçalhos das tabelas da FOPAG e títulos/faixas dos
 * gráficos. O modelo tem `fullCalcOnLoad`, então o Excel recalcula ao abrir.
 */
import JSZip from 'jszip';
import { buildBaseSheetXml, colLetter, escapeXml } from './baseSheet';
import { GRAFICOS, TABELAS_FOPAG_LINHAS, TEXTOS, aplicarPlaceholders, type ContextoAno, type PatchGrafico } from './layout';
import type { FechamentoDados } from './types';

const REL_NS_ATTR = /r:id="([^"]+)"/;

async function lerTexto(zip: JSZip, path: string): Promise<string> {
  const f = zip.file(path);
  if (!f) throw new Error(`Modelo do Workbook de Fechamento inválido: parte ausente (${path}).`);
  return f.async('string');
}

/** Mapeia nome da aba -> caminho da parte (xl/worksheets/sheetN.xml). */
async function mapaAbas(zip: JSZip): Promise<Map<string, string>> {
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
    const rid = REL_NS_ATTR.exec(m[0])?.[1];
    if (nome && rid && alvo.has(rid)) abas.set(decodeXml(nome), alvo.get(rid)!);
  }
  return abas;
}

function decodeXml(s: string): string {
  return s.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

/** Troca o conteúdo de uma célula por texto inline, preservando o estilo. */
export function definirTextoCelula(sheetXml: string, ref: string, texto: string): string {
  const re = new RegExp(`<c r="${ref}"((?:\\s[^>]*?)?)(?:/>|>[\\s\\S]*?</c>)`);
  const m = re.exec(sheetXml);
  if (!m) throw new Error(`Célula ${ref} não encontrada no modelo.`);
  const estilo = /\ss="(\d+)"/.exec(m[1])?.[1];
  const novo = `<c r="${ref}"${estilo ? ` s="${estilo}"` : ''} t="inlineStr"><is><t xml:space="preserve">${escapeXml(texto)}</t></is></c>`;
  return sheetXml.slice(0, m.index) + novo + sheetXml.slice(m.index + m[0].length);
}

function aplicarPatch(xml: string, patch: PatchGrafico, ctx: ContextoAno): string {
  switch (patch.tipo) {
    case 'ytd': {
      const fim = colLetter(2 + ctx.mes);
      return xml.replace(/\$C\$(\d+):\$([A-N])\$(\d+)(?!\d)/g, (orig, a, _c, b) => (a === b ? `$C$${a}:$${fim}$${a}` : orig));
    }
    case 'janela12': {
      const fim = patch.linhaJaneiroAno + ctx.mes - 1;
      return xml.replace(/\$([A-Z]+)\$(\d+):\$\1\$(\d+)(?!\d)/g, (orig, c, a, b) =>
        Number(b) - Number(a) === 11 ? `$${c}$${fim - 11}:$${c}$${fim}` : orig);
    }
    case 'linhas': {
      const [a, b] = patch.de;
      const [na, nb] = patch.para;
      return xml.replace(new RegExp(`\\$([A-Z]+)\\$${a}:\\$\\1\\$${b}(?!\\d)`, 'g'), (_o, c) => `$${c}$${na}:$${c}$${nb}`);
    }
  }
}

export interface PreencherOpcoes {
  /** Tipo de saída do JSZip (browser: 'blob'; testes: 'uint8array'). */
  tipo?: 'blob' | 'uint8array';
}

export async function preencherWorkbookFechamento(
  modelo: ArrayBuffer | Uint8Array,
  dados: FechamentoDados,
  opcoes: PreencherOpcoes = {},
): Promise<Blob | Uint8Array> {
  const zip = await JSZip.loadAsync(modelo);
  const abas = await mapaAbas(zip);
  const [ano, mes] = dados.competencia.split('-').map(Number);
  const ctx: ContextoAno = { ano, mes };

  const basePath = abas.get('BASE');
  if (!basePath) throw new Error('Modelo do Workbook de Fechamento sem a aba BASE.');
  zip.file(basePath, buildBaseSheetXml(dados));

  // Rótulos de texto por aba.
  const porAba = new Map<string, Array<{ ref: string; texto: string }>>();
  for (const t of TEXTOS) {
    if (!porAba.has(t.aba)) porAba.set(t.aba, []);
    porAba.get(t.aba)!.push({ ref: t.ref, texto: aplicarPlaceholders(t.texto, ctx) });
  }
  for (const [aba, celulas] of porAba) {
    const path = abas.get(aba);
    if (!path) throw new Error(`Modelo do Workbook de Fechamento sem a aba ${aba}.`);
    let xml = await lerTexto(zip, path);
    for (const c of celulas) xml = definirTextoCelula(xml, c.ref, c.texto);
    zip.file(path, xml);
  }

  // Cabeçalhos das tabelas da FOPAG precisam ser iguais aos nomes das colunas.
  const fopagPath = abas.get('FOPAG');
  if (fopagPath) {
    const relsPath = fopagPath.replace(/worksheets\/(sheet[^/]+\.xml)$/, 'worksheets/_rels/$1.rels');
    const rels = zip.file(relsPath) ? await lerTexto(zip, relsPath) : '';
    const tabelas = [...rels.matchAll(/Target="\.\.\/tables\/([^"]+)"/g)].map((m) => `xl/tables/${m[1]}`);
    const textos = porAba.get('FOPAG') ?? [];
    for (const tp of tabelas) {
      let tx = await lerTexto(zip, tp);
      const linha = Number(/\sref="[A-Z]+(\d+):/.exec(tx)?.[1]);
      if (!TABELAS_FOPAG_LINHAS.includes(linha)) continue;
      const nomes = new Map<string, string>();
      for (const t of textos) {
        const m = /^([E-Q])(\d+)$/.exec(t.ref);
        if (m && Number(m[2]) === linha) nomes.set(m[1], t.texto);
      }
      let idx = 0;
      tx = tx.replace(/<tableColumn\b([^>]*?)\sname="[^"]*"/g, (orig, attrs) => {
        idx += 1;
        const col = colLetter(3 + idx); // coluna 1 = D (FOPAG), 2 = E ...
        const nome = nomes.get(col);
        return nome ? `<tableColumn${attrs} name="${escapeXml(nome)}"` : orig;
      });
      zip.file(tp, tx);
    }
  }

  // Gráficos: títulos com ano e faixas que acompanham a competência.
  for (const g of GRAFICOS) {
    const f = zip.file(g.arquivo);
    if (!f) continue;
    let xml = await f.async('string');
    for (const [de, para] of g.titulos ?? []) {
      xml = xml.split(`<a:t>${escapeXml(de)}</a:t>`).join(`<a:t>${escapeXml(aplicarPlaceholders(para, ctx))}</a:t>`);
    }
    for (const p of g.patches) xml = aplicarPatch(xml, p, ctx);
    zip.file(g.arquivo, xml);
  }

  return zip.generateAsync({
    type: opcoes.tipo ?? 'blob',
    compression: 'DEFLATE',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
