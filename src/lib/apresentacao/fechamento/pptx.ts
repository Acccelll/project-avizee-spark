/**
 * Gera o .pptx do deck de fechamento com formas nativas do PowerPoint
 * (retângulos, textos, linhas e formas livres): tudo continua editável,
 * inclusive cada estado do mapa.
 */
import pptxgen from 'pptxgenjs';
import { type Desenho, type Forma, desenhar } from './graficos';
import { COR, FONTE } from './tema';
import type { Deck, Slide, Visual } from './tipos';

type PSlide = pptxgen.Slide;

export interface OpcoesPptx {
  /** Logo em data URL (PNG), usado na capa. */
  logoDataUrl?: string;
  /** Versão pequena do logo para o rodapé (o .pptx guarda uma cópia por slide). */
  logoRodapeDataUrl?: string;
  /** Largura ÷ altura do logo. */
  logoProporcao?: number;
}

const W = 13.333;
const H = 7.5;
const M = 0.6;
const PT = 72;

// Área do corpo do slide.
const CORPO_Y = 2.05;
const CORPO_H = 4.55;
const VIZ_W = 7.95;
const COM_X = 9.05;

function largura(t: string, size: number, bold?: boolean): number {
  return t.length * size * (bold ? 0.6 : 0.56);
}

/** Desenha as formas numa caixa (x, y, w, h) em polegadas, mantendo a proporção. */
function desenharFormas(s: PSlide, d: Desenho, bx: number, by: number, bw: number, bh: number) {
  const k = Math.min(bw / d.w, bh / d.h);
  const X = (x: number) => bx + x * k;
  const Y = (y: number) => by + y * k;
  for (const f of d.formas) desenharForma(s, f, X, Y, k);
}

function desenharForma(s: PSlide, f: Forma, X: (x: number) => number, Y: (y: number) => number, k: number) {
  switch (f.k) {
    case 'rect': {
      const opts: pptxgen.ShapeProps = {
        x: X(f.x), y: Y(f.y), w: Math.max(f.w * k, 0.005), h: Math.max(f.h * k, 0.005),
        fill: f.fill ? { color: f.fill } : { type: 'none' } as never,
        line: f.stroke ? { color: f.stroke, width: 0.75, dashType: f.dash ? 'dash' : 'solid' } : { type: 'none' } as never,
      };
      if (f.r && f.r >= 4 && f.w > 20) s.addShape('roundRect', { ...opts, rectRadius: 0.08 });
      else s.addShape('rect', opts);
      return;
    }
    case 'text': {
      let size = f.size;
      let tw = largura(f.t, size, f.bold);
      if (f.maxW && tw > f.maxW) { size = Math.max(size * (f.maxW / tw), size * 0.7); tw = largura(f.t, size, f.bold); }
      const w = Math.max(tw * 1.12, 6);
      const x = f.anchor === 'end' ? f.x - w : f.anchor === 'middle' ? f.x - w / 2 : f.x;
      s.addText(f.t, {
        x: X(x), y: Y(f.y - size * 1.08), w: w * k, h: size * 1.4 * k,
        fontFace: FONTE, fontSize: Math.round(size * k * PT * 10) / 10, color: f.color, bold: !!f.bold,
        align: f.anchor === 'end' ? 'right' : f.anchor === 'middle' ? 'center' : 'left',
        valign: 'top', margin: 0, wrap: false,
      });
      return;
    }
    case 'line': {
      const x = Math.min(f.x1, f.x2), y = Math.min(f.y1, f.y2);
      s.addShape('line', {
        x: X(x), y: Y(y), w: Math.max(Math.abs(f.x2 - f.x1) * k, 0.001), h: Math.abs(f.y2 - f.y1) * k,
        flipV: (f.x2 - f.x1) * (f.y2 - f.y1) < 0,
        line: { color: f.color, width: f.width * k * PT * 0.9, dashType: f.dash ? 'dash' : 'solid' },
      });
      return;
    }
    case 'poly':
    case 'path': {
      const aneis = f.k === 'poly' ? [f.pts] : f.aneis;
      const todos = aneis.flat();
      const minX = Math.min(...todos.map((p) => p[0])), maxX = Math.max(...todos.map((p) => p[0]));
      const minY = Math.min(...todos.map((p) => p[1])), maxY = Math.max(...todos.map((p) => p[1]));
      const pontos: NonNullable<pptxgen.ShapeProps['points']> = [];
      const fechar = f.k === 'path' || !!f.fill;
      for (const anel of aneis) {
        anel.forEach(([px, py], i) => pontos.push({ x: (px - minX) * k, y: (py - minY) * k, ...(i === 0 ? { moveTo: true } : {}) }));
        if (fechar) pontos.push({ close: true });
      }
      const fill = f.fill
        ? { color: f.fill, ...(f.k === 'poly' && f.opacity != null ? { transparency: Math.round((1 - f.opacity) * 100) } : {}) }
        : ({ type: 'none' } as never);
      const stroke = f.k === 'path' ? f.stroke : f.stroke;
      const width = f.k === 'path' ? f.width : f.width ?? 1;
      // 'custGeom' existe no pptxgenjs, mas falta na união SHAPE_NAME dos tipos.
      s.addShape('custGeom' as unknown as pptxgen.SHAPE_NAME, {
        x: X(minX), y: Y(minY), w: Math.max((maxX - minX) * k, 0.01), h: Math.max((maxY - minY) * k, 0.01),
        points: pontos,
        fill,
        line: stroke ? { color: stroke, width: width * k * PT * 0.9 } : ({ type: 'none' } as never),
        ...(f.k === 'path' && f.titulo ? { altText: f.titulo } : {}),
      });
    }
  }
}

function cabecalho(s: PSlide, slide: Slide, n: number) {
  s.addText(slide.rotulo.toUpperCase(), {
    x: M, y: 0.42, w: 10, h: 0.3, fontFace: FONTE, fontSize: 12, bold: true, color: COR.terracota, charSpacing: 2, margin: 0,
  });
  s.addText(String(n).padStart(2, '0'), {
    x: W - M - 1, y: 0.42, w: 1, h: 0.3, fontFace: FONTE, fontSize: 12, color: COR.apagado, align: 'right', margin: 0,
  });
  s.addText(slide.mensagem, {
    x: M, y: 0.8, w: W - 2 * M, h: 1.05, fontFace: FONTE, fontSize: slide.mensagem.length > 70 ? 24 : 28, bold: true,
    color: COR.vinho, valign: 'top', margin: 0, fit: 'shrink',
  });
}

function rodape(s: PSlide, deck: Deck, slide: Slide, opts: OpcoesPptx) {
  s.addShape('line', { x: M, y: 6.92, w: W - 2 * M, h: 0, line: { color: COR.linha, width: 1 } });
  let x = M;
  const logo = opts.logoRodapeDataUrl ?? opts.logoDataUrl;
  if (logo) {
    const h = 0.24;
    const w = h * (opts.logoProporcao ?? 3.3);
    s.addImage({ data: logo, x, y: 7.03, w, h });
    x += w + 0.2;
  }
  s.addText(deck.rodape, { x, y: 7.02, w: 4.5, h: 0.26, fontFace: FONTE, fontSize: 10, color: COR.apagado, margin: 0 });
  if (slide.fonte) {
    s.addText(slide.fonte, { x: W - M - 7, y: 7.02, w: 7, h: 0.26, fontFace: FONTE, fontSize: 10, color: COR.apagado, align: 'right', margin: 0 });
  }
}

function comentarios(s: PSlide, itens: string[]) {
  if (!itens.length) return;
  s.addShape('line', { x: COM_X - 0.3, y: CORPO_Y + 0.15, w: 0, h: CORPO_H - 0.3, line: { color: COR.linha, width: 2.5 } });
  s.addText(
    itens.map((t, i) => ({ text: t, options: { breakLine: i < itens.length - 1, paraSpaceAfter: 14 } })),
    { x: COM_X, y: CORPO_Y, w: W - M - COM_X, h: CORPO_H, fontFace: FONTE, fontSize: 15, color: COR.tinta, valign: 'middle', margin: 0, lineSpacingMultiple: 1.1 },
  );
}

/** "Título. Resto do texto" → título em negrito. */
function separarTitulo(t: string): [string, string] {
  const i = t.indexOf('. ');
  if (i > 0 && i < 48) return [t.slice(0, i + 1), t.slice(i + 1)];
  return ['', t];
}

function lista(s: PSlide, itens: string[]) {
  const runs: pptxgen.TextProps[] = [];
  itens.forEach((t, i) => {
    const [tit, resto] = separarTitulo(t);
    runs.push({ text: `${i + 1}   `, options: { bold: true, color: COR.terracota } });
    if (tit) runs.push({ text: tit, options: { bold: true, color: COR.vinho } });
    runs.push({ text: resto, options: { breakLine: i < itens.length - 1, paraSpaceAfter: 18 } });
  });
  s.addText(runs, { x: M + 0.1, y: CORPO_Y, w: W - 2 * M - 0.2, h: CORPO_H, fontFace: FONTE, fontSize: 20, color: COR.tinta, valign: 'top', margin: 0, lineSpacingMultiple: 1.15 });
}

function tabela(s: PSlide, v: Extract<Visual, { tipo: 'tabela' }>) {
  const n = v.cabecalho.length;
  const borda = { type: 'solid' as const, color: COR.linha, pt: 1 };
  const semBorda = { type: 'none' as const };
  const cel = (t: string, i: number, o: pptxgen.TableCellProps = {}) => ({
    text: t,
    options: { align: i === 0 ? 'left' as const : 'right' as const, border: [semBorda, semBorda, borda, semBorda] as never, ...o },
  });
  const rows: pptxgen.TableRow[] = [
    v.cabecalho.map((t, i) => cel(t, i, { bold: true, color: COR.apagado, fontSize: 11 })),
    ...v.linhas.map((l) => l.map((t, i) => cel(t, i, i === n - 1 && n > 4 ? { bold: true } : {}))),
  ];
  if (v.total) rows.push(v.total.map((t, i) => cel(t, i, { bold: true, color: COR.vinho, border: [{ type: 'solid', color: COR.tinta, pt: 1.5 }, semBorda, semBorda, semBorda] as never })));
  const first = 2.6;
  const rest = (VIZ_W - first) / (n - 1);
  s.addTable(rows, {
    x: M, y: CORPO_Y + 0.2, w: VIZ_W, colW: [first, ...Array(n - 1).fill(rest)], fontFace: FONTE, fontSize: 14, color: COR.tinta,
    rowH: 0.48, valign: 'middle', margin: [0, 0.08, 0, 0.08],
  });
  if (v.nota) s.addText(v.nota, { x: M, y: CORPO_Y + 0.35 + 0.48 * rows.length, w: VIZ_W, h: 0.3, fontFace: FONTE, fontSize: 11, color: COR.apagado, margin: 0 });
}

function capa(s: PSlide, v: Extract<Visual, { tipo: 'capa' }>, opts: OpcoesPptx) {
  s.background = { color: COR.creme };
  s.addShape('rect', { x: 0, y: 0, w: 0.22, h: H, fill: { color: COR.terracota }, line: { type: 'none' } as never });
  if (opts.logoDataUrl) {
    const h = 0.85;
    s.addImage({ data: opts.logoDataUrl, x: 0.95, y: 0.8, w: h * (opts.logoProporcao ?? 3.3), h });
  }
  s.addText(v.eyebrow.toUpperCase(), { x: 0.95, y: 3.0, w: 10, h: 0.35, fontFace: FONTE, fontSize: 14, bold: true, color: COR.terracota, charSpacing: 3, margin: 0 });
  s.addText(v.titulo, { x: 0.95, y: 3.4, w: 11.5, h: 1.1, fontFace: FONTE, fontSize: 54, bold: true, color: COR.vinho, margin: 0, valign: 'top' });
  s.addText(v.subtitulo, { x: 0.95, y: 4.55, w: 11, h: 0.5, fontFace: FONTE, fontSize: 20, color: COR.apagado, margin: 0 });
  s.addShape('line', { x: 0.95, y: 6.85, w: W - 0.95 - M, h: 0, line: { color: COR.regra, width: 1 } });
  s.addText(v.rodape, { x: 0.95, y: 6.97, w: 8, h: 0.3, fontFace: FONTE, fontSize: 11, color: COR.apagado, margin: 0 });
  s.addText('01', { x: W - M - 1, y: 6.97, w: 1, h: 0.3, fontFace: FONTE, fontSize: 11, color: COR.apagado, align: 'right', margin: 0 });
}

function corpo(s: PSlide, slide: Slide) {
  const v = slide.visual;
  const temCom = slide.comentarios.length > 0;
  const largViz = temCom ? VIZ_W : W - 2 * M;
  if (v.tipo === 'lista') return lista(s, v.itens);
  if (v.tipo === 'tabela') return tabela(s, v);
  const d = desenhar(v);
  if (!d) return;
  // Centraliza na vertical quando o desenho é mais baixo que o corpo.
  const k = Math.min(largViz / d.w, CORPO_H / d.h);
  const y = CORPO_Y + Math.max((CORPO_H - d.h * k) / 2, 0);
  desenharFormas(s, d, M, y, largViz, CORPO_H);
}

export async function gerarPptx(deck: Deck, opts: OpcoesPptx = {}, saida: 'blob' | 'nodebuffer' = 'blob'): Promise<Blob | Uint8Array> {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = `AviZee · ${deck.rodape}`;
  pptx.company = 'AviZee';
  pptx.subject = 'Apresentação de fechamento';
  pptx.theme = { headFontFace: FONTE, bodyFontFace: FONTE };

  deck.slides.forEach((slide, i) => {
    const s = pptx.addSlide();
    if (slide.visual.tipo === 'capa') {
      capa(s, slide.visual, opts);
      return;
    }
    s.background = { color: COR.branco };
    cabecalho(s, slide, i + 1);
    corpo(s, slide);
    if (slide.visual.tipo !== 'lista') comentarios(s, slide.comentarios);
    rodape(s, deck, slide, opts);
  });

  return (await pptx.write({ outputType: saida === 'blob' ? 'blob' : 'nodebuffer' })) as Blob | Uint8Array;
}
