/**
 * Desenho dos gráficos do deck em formas simples, numa caixa de VB_L × VB_A
 * unidades. A prévia (SVG) e o .pptx (formas nativas do PowerPoint) desenham
 * as mesmas formas.
 */
import { mil, pct } from './formato';
import { MAPA_BRASIL, MAPA_BRASIL_ALTURA } from './mapaBrasil';
import { COR, LEGENDA_MAPA, corFatia, corPapel, textoSobre } from './tema';
import type { FaixaAging, Kpi, PassoPonte, SerieBarras, Visual } from './tipos';

export const VB_L = 480;
export const VB_A = 268;

export type Forma =
  | { k: 'rect'; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; r?: number; dash?: boolean }
  | {
      k: 'text';
      x: number;
      /** Linha de base. */
      y: number;
      t: string;
      size: number;
      color: string;
      bold?: boolean;
      anchor?: 'start' | 'middle' | 'end';
      /** Largura máxima, para quebra de linha no .pptx e corte na prévia. */
      maxW?: number;
    }
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; width: number; dash?: boolean }
  | { k: 'poly'; pts: Array<[number, number]>; fill?: string; stroke?: string; width?: number; opacity?: number }
  | { k: 'path'; aneis: Array<Array<[number, number]>>; fill: string; stroke: string; width: number; titulo?: string };

export interface Desenho {
  w: number;
  h: number;
  formas: Forma[];
}

const AX = 9.5; // eixos
const LB = 11; // rótulos
const VL = 11; // valores

function eixoY(formas: Forma[], x0: number, x1: number, yTopo: number, yBase: number, max: number, min = 0) {
  for (const t of [0, 0.5, 1]) {
    const v = min + (max - min) * t;
    const y = yBase - (yBase - yTopo) * t;
    formas.push({ k: 'line', x1: x0, y1: y, x2: x1, y2: y, color: COR.linha, width: 1 });
    formas.push({ k: 'text', x: x0 - 4, y: y + 3, t: mil(v, 0), size: AX, color: COR.apagado, anchor: 'end' });
  }
}

function legenda(formas: Forma[], itens: Array<[string, string]>, x: number, y: number) {
  let cx = x;
  for (const [cor, nome] of itens) {
    formas.push({ k: 'rect', x: cx, y: y - 8, w: 9, h: 9, fill: cor, r: 1.5 });
    formas.push({ k: 'text', x: cx + 13, y, t: nome, size: AX, color: COR.apagado });
    cx += 22 + nome.length * 5.6;
  }
}

/** Escala "bonita" para o topo do eixo. */
function topo(v: number): number {
  if (v <= 0) return 1000;
  const e = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * e >= v) return m * e;
  return 10 * e;
}

// ----------------------------------------------------------------- barras ---

function barras(v: Extract<Visual, { tipo: 'barras' }>, w = VB_L, h = VB_A): Desenho {
  const formas: Forma[] = [];
  const temLimite = !!v.limite;
  const hGraf = temLimite ? h - 58 : h - 18;
  const padL = 34, padB = 20, padT = 18;
  const n = v.categorias.length;
  const vals = v.series.flatMap((s) => s.valores.map((x) => x ?? 0));
  let max: number, min: number;
  if (v.empilhado) {
    const pos = v.categorias.map((_, i) => v.series.reduce((s, se) => s + Math.max(se.valores[i] ?? 0, 0), 0));
    const neg = v.categorias.map((_, i) => v.series.reduce((s, se) => s + Math.min(se.valores[i] ?? 0, 0), 0));
    max = topo(Math.max(...pos) * 1.08);
    min = Math.min(...neg) < 0 ? -topo(-Math.min(...neg) * 1.08) : 0;
  } else {
    max = topo(Math.max(...vals, 0) * 1.08);
    min = Math.min(...vals) < 0 ? -topo(-Math.min(...vals) * 1.08) : 0;
  }
  const yBase = hGraf - padB;
  const Y = (x: number) => yBase - ((x - min) / (max - min)) * (yBase - padT);
  eixoY(formas, padL, w - 4, padT, yBase, max, min);
  if (min < 0) formas.push({ k: 'line', x1: padL, y1: Y(0), x2: w - 4, y2: Y(0), color: COR.bege, width: 1 });
  const gw = (w - padL - 6) / n;
  const ns = v.empilhado ? 1 : v.series.length;
  const bw = Math.min((gw * 0.72) / ns, 26);
  for (let i = 0; i < n; i++) {
    const x0 = padL + i * gw + (gw - bw * ns) / 2;
    let accPos = 0, accNeg = 0;
    v.series.forEach((s, j) => {
      const val = s.valores[i];
      const x = v.empilhado ? x0 : x0 + j * bw;
      if (val == null) {
        if (!v.empilhado) formas.push({ k: 'rect', x, y: Y(0) - 12, w: bw - 2, h: 12, stroke: COR.bege, dash: true });
        return;
      }
      if (!val) return;
      let y1: number, y2: number;
      if (v.empilhado) {
        if (val >= 0) { y1 = Y(accPos + val); y2 = Y(accPos); accPos += val; } else { y1 = Y(accNeg); y2 = Y(accNeg + val); accNeg += val; }
      } else {
        y1 = Y(Math.max(val, 0));
        y2 = Y(Math.min(val, 0));
      }
      formas.push({ k: 'rect', x, y: y1, w: Math.max(bw - 2, 1), h: Math.max(y2 - y1, 0.5), fill: corPapel(s.cor), r: 1.5 });
      if (!v.empilhado && n <= 4) {
        formas.push({ k: 'text', x: x + bw / 2 - 1, y: val >= 0 ? y1 - 4 : y2 + 11, t: mil(val), size: 9.5, color: COR.tinta, bold: true, anchor: 'middle' });
      }
    });
    if (n <= 12 || i % 2 === 1 || i === n - 1) {
      formas.push({ k: 'text', x: padL + i * gw + gw / 2, y: hGraf - 6, t: v.categorias[i], size: AX, color: i === v.destaque ? COR.tinta : COR.apagado, bold: i === v.destaque, anchor: 'middle' });
    }
  }
  // valor da categoria em destaque
  if (v.destaque != null && n > 4) {
    const i = v.destaque;
    // Rótulo da série "atual" (ou da última), sobre a sua barra.
    const ia = v.series.findIndex((s) => s.cor === 'atual');
    const js = ia >= 0 ? ia : v.series.length - 1;
    const tot = v.empilhado
      ? v.series.reduce((s, se) => s + (se.valores[i] ?? 0), 0)
      : v.series[js].valores[i] ?? 0;
    const alto = v.empilhado ? tot : Math.max(tot, 0);
    const x = v.empilhado ? padL + i * gw + gw / 2 : padL + i * gw + (gw - bw * ns) / 2 + js * bw + bw / 2 - 1;
    formas.push({ k: 'text', x, y: Y(Math.max(alto, 0)) - 5, t: mil(tot), size: VL, color: COR.tinta, bold: true, anchor: 'middle' });
  }
  if (v.referencia) {
    const y = Y(v.referencia.valor);
    formas.push({ k: 'line', x1: padL, y1: y, x2: w - 4, y2: y, color: COR.ruim, width: 1.3, dash: true });
    formas.push({ k: 'text', x: padL + 4, y: y - 5, t: v.referencia.rotulo, size: AX, color: COR.ruim, bold: true });
  }
  legenda(formas, v.series.map((s) => [corPapel(s.cor), s.nome]), padL, 9);
  if (v.limite) {
    const { usado, limite, rotulo } = v.limite;
    const y = h - 36;
    const uso = usado / limite;
    const larg = w - padL - 4;
    formas.push({ k: 'text', x: padL, y: y - 6, t: rotulo, size: AX, color: COR.apagado });
    formas.push({ k: 'text', x: w - 4, y: y - 6, t: `R$ ${mil(usado)} mil · ${pct(usado, limite)} do limite da ME`, size: LB, color: uso >= 1 ? COR.ruim : COR.tinta, bold: true, anchor: 'end' });
    formas.push({ k: 'rect', x: padL, y, w: larg, h: 10, fill: COR.linha, r: 5 });
    formas.push({ k: 'rect', x: padL, y, w: larg * Math.min(uso, 1), h: 10, fill: uso >= 1 ? COR.ruim : uso >= 0.8 ? COR.terracota : COR.vinho, r: 5 });
    if (uso > 1) {
      const xm = padL + larg / uso;
      formas.push({ k: 'line', x1: xm, y1: y - 3, x2: xm, y2: y + 13, color: COR.tinta, width: 1.5 });
    }
    formas.push({ k: 'text', x: padL, y: y + 24, t: 'R$ 0', size: AX, color: COR.apagado });
    formas.push({ k: 'text', x: uso > 1 ? padL + larg / uso : w - 4, y: y + 24, t: `Limite R$ ${mil(limite, 0)} mil`, size: AX, color: COR.apagado, anchor: uso > 1 ? 'middle' : 'end' });
  }
  return { w, h, formas };
}

// ----------------------------------------------------------------- linhas ---

function linhas(v: Extract<Visual, { tipo: 'linhas' }>, w = VB_L, h = VB_A, padT = 22): Desenho {
  const formas: Forma[] = [];
  const padL = 34, padB = 20;
  const n = v.categorias.length;
  const vals = v.series.flatMap((s) => s.valores.filter((x): x is number => x != null));
  const max = topo(Math.max(...vals, v.referencia?.valor ?? 0) * 1.08);
  const yBase = h - padB;
  const Y = (x: number) => yBase - (x / max) * (yBase - padT);
  const sx = (w - padL - 16) / Math.max(n - 1, 1);
  eixoY(formas, padL, w - 4, padT, yBase, max);
  if (v.referencia) {
    const y = Y(v.referencia.valor);
    formas.push({ k: 'line', x1: padL, y1: y, x2: w - 4, y2: y, color: COR.ruim, width: 1.4, dash: true });
    formas.push({ k: 'text', x: padL + 4, y: y - 5, t: v.referencia.rotulo, size: AX, color: COR.ruim, bold: true });
  }
  v.series.forEach((s, j) => {
    const pts: Array<[number, number]> = [];
    s.valores.forEach((x, i) => { if (x != null) pts.push([padL + i * sx, Y(x)]); });
    if (pts.length < 2) return;
    const cor = corPapel(s.cor);
    if (v.area && j === v.series.length - 1) formas.push({ k: 'poly', pts: [[pts[0][0], yBase], ...pts, [pts[pts.length - 1][0], yBase]], fill: cor, opacity: 0.14 });
    formas.push({ k: 'poly', pts, stroke: cor, width: j === v.series.length - 1 ? 2.6 : 2 });
    const [lx, ly] = pts[pts.length - 1];
    const ultimo = s.valores.reduce<number>((u, x, i) => (x != null ? i : u), -1);
    if (v.marca && v.marca.serie === j && v.marca.indice === ultimo) return;
    formas.push({ k: 'text', x: lx - 4, y: ly - 7, t: `${s.nome} · ${mil(s.valores[ultimo] ?? 0)}`, size: VL, color: s.cor === 'anterior' ? COR.apagado : COR.tinta, bold: true, anchor: 'end' });
  });
  if (v.marca) {
    const x = v.series[v.marca.serie].valores[v.marca.indice] ?? 0;
    const cx = padL + v.marca.indice * sx;
    formas.push({ k: 'rect', x: cx - 4, y: Y(x) - 4, w: 8, h: 8, fill: COR.ruim, r: 4 });
    formas.push({ k: 'text', x: cx - 7, y: Y(x) - 9, t: v.marca.rotulo, size: VL, color: COR.ruim, bold: true, anchor: 'end' });
  }
  v.categorias.forEach((c, i) => {
    if (n <= 12 || i % 2 === 1 || i === n - 1) formas.push({ k: 'text', x: padL + i * sx, y: h - 6, t: c, size: AX, color: COR.apagado, anchor: 'middle' });
  });
  if (v.series.length > 1) legenda(formas, v.series.map((s) => [corPapel(s.cor), s.nome]), padL, 9);
  return { w, h, formas };
}

// ---------------------------------------------------------------- ranking ---

function ranking(v: Extract<Visual, { tipo: 'ranking' }>, w = VB_L): Desenho {
  const formas: Forma[] = [];
  const n = v.itens.length;
  const rowh = n > 7 ? 24 : 34;
  const h = Math.max(rowh * n + 8, 120);
  const lw = 178;
  const mx = Math.max(...v.itens.map((i) => i.valor), 1);
  v.itens.forEach((it, i) => {
    const y = i * rowh + 6;
    const bw = Math.max(((w - lw - 128) * it.valor) / mx, 2);
    const cor = i < v.destaques ? corPapel(v.cor) : v.cor === 'despesa' ? COR.terracota3 : COR.vinho3;
    formas.push({ k: 'text', x: lw - 10, y: y + rowh / 2 + 2, t: it.rotulo, size: LB, color: COR.tinta, anchor: 'end', maxW: lw - 14 });
    formas.push({ k: 'rect', x: lw, y: y + 4, w: bw, h: rowh - 12, fill: cor, r: 2 });
    formas.push({ k: 'text', x: lw + bw + 6, y: y + rowh / 2 + 2, t: it.detalhe, size: VL, color: COR.tinta, bold: true });
  });
  return { w, h, formas };
}

// ------------------------------------------------------------------ ponte ---

function ponte(passos: PassoPonte[], w: number, h: number, y0 = 0): Forma[] {
  const formas: Forma[] = [];
  const padB = 22, padT = 18;
  let run = 0;
  let mx = 0;
  for (const p of passos) {
    if (p.tipo === 'base') run = p.valor;
    else run += p.valor;
    mx = Math.max(mx, run, p.tipo === 'base' ? p.valor : 0);
  }
  mx = topo(mx * 1.05);
  const sc = (h - padT - padB) / mx;
  const cw = (w - 20) / passos.length;
  run = 0;
  passos.forEach((p, i) => {
    let a: number, b: number, cor: string;
    if (p.tipo === 'base') { a = 0; b = p.valor; run = p.valor; cor = COR.vinho; }
    else if (p.valor >= 0) { a = run; b = run + p.valor; run = b; cor = COR.bom; }
    else { a = run + p.valor; b = run; run = a; cor = COR.ruim; }
    const x = 10 + i * cw + cw * 0.18;
    const top = y0 + h - padB - b * sc;
    formas.push({ k: 'rect', x, y: top, w: cw * 0.64, h: Math.max((b - a) * sc, 0.8), fill: cor, r: 2 });
    const sinal = p.tipo === 'base' ? '' : p.valor >= 0 ? '+' : '−';
    formas.push({ k: 'text', x: x + cw * 0.32, y: top - 5, t: `${sinal}${mil(Math.abs(p.valor))}`, size: VL, color: COR.tinta, bold: true, anchor: 'middle' });
    formas.push({ k: 'text', x: x + cw * 0.32, y: y0 + h - 7, t: p.rotulo, size: AX, color: COR.apagado, anchor: 'middle', maxW: cw - 4 });
    if (i < passos.length - 1) {
      const yc = y0 + h - padB - run * sc;
      formas.push({ k: 'line', x1: x + cw * 0.64, y1: yc, x2: x + cw, y2: yc, color: COR.bege, width: 1, dash: true });
    }
  });
  return formas;
}

function ponteComSerie(v: Extract<Visual, { tipo: 'ponte' }>, w = VB_L, h = VB_A): Desenho {
  if (!v.serie) return { w, h, formas: ponte(v.passos, w, h) };
  const hs = Math.round(h * 0.46);
  const area = linhas({ tipo: 'linhas', categorias: v.serie.categorias, series: [{ nome: 'Caixa', valores: v.serie.valores, cor: 'atual' }], area: true }, w, hs, 14);
  return { w, h, formas: [...area.formas, ...ponte(v.passos, w, h - hs - 6, hs + 6)] };
}

// ------------------------------------------------------------------ aging ---

const COR_AGING_CR = [COR.vinho, COR.vinho2, COR.vinho3, COR.ruim];
const COR_AGING_CP = [COR.terracota, COR.terracota2, COR.terracota3, COR.ruim];

function aging(receber: FaixaAging[], pagar: FaixaAging[], w = VB_L): Desenho {
  const formas: Forma[] = [];
  const lw = 78;
  const tot = (xs: FaixaAging[]) => xs.reduce((s, x) => s + x.valor, 0);
  const mx = Math.max(tot(receber), tot(pagar), 1);
  const linhasA: Array<[string, FaixaAging[], string[]]> = [['A receber', receber, COR_AGING_CR], ['A pagar', pagar, COR_AGING_CP]];
  linhasA.forEach(([nome, faixas, cores], r) => {
    const y = 20 + r * 74;
    let x = lw;
    formas.push({ k: 'text', x: lw - 10, y: y + 20, t: nome, size: LB, color: COR.tinta, bold: true, anchor: 'end' });
    for (const f of faixas) {
      const bw = ((w - lw - 96) * f.valor) / mx;
      if (bw <= 0) continue;
      formas.push({ k: 'rect', x, y: y + 6, w: Math.max(bw, 1), h: 22, fill: cores[f.nivel] });
      if (bw > 46) formas.push({ k: 'text', x: x + bw / 2, y: y + 21, t: mil(f.valor), size: AX, color: textoSobre(cores[f.nivel]), bold: true, anchor: 'middle' });
      x += bw;
    }
    formas.push({ k: 'text', x: x + 6, y: y + 21, t: `R$ ${mil(tot(faixas))} mil`, size: VL, color: COR.tinta, bold: true });
    const at30 = faixas.find((f) => f.nivel === 0)?.valor ?? 0;
    const venc = faixas.find((f) => f.nivel === 3)?.valor ?? 0;
    formas.push({ k: 'text', x: lw, y: y + 44, t: `até 30 dias: R$ ${mil(at30)} mil · vencido: R$ ${mil(venc)} mil`, size: AX, color: COR.apagado });
  });
  const leg: Array<[string, string]> = [[COR.vinho, 'até 30 dias'], [COR.vinho2, '31 a 90 dias'], [COR.vinho3, 'mais de 90'], [COR.ruim, 'vencido']];
  legenda(formas, leg, lw, 182);
  return { w, h: 192, formas };
}

// ------------------------------------------------------------------- mapa ---

function parseAnel(s: string): Array<[number, number]> {
  return s.split(' ').map((p) => {
    const [x, y] = p.split(',');
    return [Number(x), Number(y)];
  });
}

const ANEIS = new Map<string, Array<Array<[number, number]>>>();
function aneis(uf: string) {
  let a = ANEIS.get(uf);
  if (!a) { a = MAPA_BRASIL[uf].aneis.map(parseAnel); ANEIS.set(uf, a); }
  return a;
}

function desenharMapa(formas: Forma[], valores: Record<string, number>, x0: number, y0: number, altura: number, rotulos = true) {
  const tot = Object.values(valores).reduce((s, v) => s + v, 0) || 1;
  const sc = altura / MAPA_BRASIL_ALTURA;
  for (const [uf, g] of Object.entries(MAPA_BRASIL)) {
    const v = valores[uf] ?? 0;
    const fill = corFatia(v / tot) ?? COR.semVenda;
    formas.push({
      k: 'path',
      aneis: aneis(uf).map((r) => r.map(([x, y]) => [x0 + x * sc, y0 + y * sc] as [number, number])),
      fill,
      stroke: COR.branco,
      width: 0.8,
      titulo: g.nome,
    });
  }
  if (!rotulos) return;
  for (const [uf, g] of Object.entries(MAPA_BRASIL)) {
    const v = valores[uf] ?? 0;
    if (v <= 0 || g.area < 900) continue;
    const fill = corFatia(v / tot) ?? COR.semVenda;
    formas.push({ k: 'text', x: x0 + g.cx * sc, y: y0 + g.cy * sc + 3, t: uf, size: 7.5, color: textoSobre(fill), bold: true, anchor: 'middle' });
  }
}

function mapa(v: Extract<Visual, { tipo: 'mapa' }>, w = VB_L, h = VB_A): Desenho {
  const formas: Forma[] = [];
  const tot = Object.values(v.valores).reduce((s, x) => s + x, 0) || 1;
  if (v.anterior) {
    const alt = h - 40;
    const larg = (alt * 613) / MAPA_BRASIL_ALTURA;
    formas.push({ k: 'text', x: larg / 2, y: 11, t: v.anterior.rotulo, size: LB, color: COR.apagado, bold: true, anchor: 'middle' });
    desenharMapa(formas, v.anterior.valores, 0, 16, alt, false);
    const x1 = w - larg;
    formas.push({ k: 'text', x: x1 + larg / 2, y: 11, t: v.rotulo, size: LB, color: COR.tinta, bold: true, anchor: 'middle' });
    desenharMapa(formas, v.valores, x1, 16, alt);
    LEGENDA_MAPA.forEach(([c, t], j) => {
      const lx = 8 + j * 92;
      formas.push({ k: 'rect', x: lx, y: h - 14, w: 10, h: 10, fill: c, r: 1.5 });
      formas.push({ k: 'text', x: lx + 14, y: h - 5, t, size: AX, color: COR.apagado });
    });
    return { w, h, formas };
  }
  desenharMapa(formas, v.valores, 2, 2, h - 4);
  const lista = Object.entries(v.valores).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const mx = lista[0]?.[1] ?? 1;
  const x0 = 270, bmax = 62;
  lista.forEach(([uf, val], i) => {
    const y = 14 + i * 30;
    const bw = Math.max((bmax * val) / mx, 2);
    formas.push({ k: 'text', x: x0, y: y + 12, t: uf, size: LB, color: COR.tinta });
    formas.push({ k: 'rect', x: x0 + 26, y: y + 1, w: bw, h: 15, fill: corFatia(val / tot) ?? COR.semVenda, r: 2 });
    formas.push({ k: 'text', x: x0 + 32 + bw, y: y + 12.5, t: `${mil(val)} mil · ${pct(val, tot)}`, size: VL, color: COR.tinta, bold: true });
  });
  LEGENDA_MAPA.forEach(([c, t], j) => {
    const lx = x0 + [0, 96, 172][j % 3];
    const ly = 14 + 6 * 30 + 10 + Math.floor(j / 3) * 17;
    formas.push({ k: 'rect', x: lx, y: ly, w: 10, h: 10, fill: c, r: 1.5 });
    formas.push({ k: 'text', x: lx + 14, y: ly + 9, t, size: AX, color: COR.apagado });
  });
  return { w, h, formas };
}

// ------------------------------------------------------------------ redes ---

function redes(v: Extract<Visual, { tipo: 'redes' }>, w = VB_L): Desenho {
  const formas: Forma[] = [];
  const hh = 78;
  v.series.forEach((s, j) => {
    const y0 = 8 + j * 112;
    const vals = s.valores.map((x, i) => [i, x] as const).filter((p): p is readonly [number, number] => p[1] != null);
    if (!vals.length) return;
    const nums = vals.map((p) => p[1]);
    const mn = Math.min(...nums) * 0.97;
    const mx = Math.max(...nums) * 1.02 || 1;
    const n = v.categorias.length;
    const sx = (w - 160) / Math.max(n - 1, 1);
    const pts = vals.map(([i, x]) => [120 + i * sx, y0 + hh - ((x - mn) / (mx - mn || 1)) * hh] as [number, number]);
    const cor = corPapel(s.cor);
    const ult = nums[nums.length - 1];
    formas.push({ k: 'text', x: 0, y: y0 + 16, t: s.nome, size: LB, color: COR.tinta });
    formas.push({ k: 'text', x: 0, y: y0 + 40, t: ult.toLocaleString('pt-BR'), size: 20, color: cor, bold: true });
    const d = ult - nums[0];
    formas.push({ k: 'text', x: 0, y: y0 + 58, t: `${d >= 0 ? '+' : '−'}${Math.abs(d).toLocaleString('pt-BR')} no período`, size: AX, color: COR.apagado });
    if (pts.length > 1) {
      formas.push({ k: 'poly', pts: [[pts[0][0], y0 + hh], ...pts, [pts[pts.length - 1][0], y0 + hh]], fill: cor, opacity: 0.13 });
      formas.push({ k: 'poly', pts, stroke: cor, width: 2.2 });
    }
    const [lx, ly] = pts[pts.length - 1];
    formas.push({ k: 'rect', x: lx - 3.5, y: ly - 3.5, w: 7, h: 7, fill: cor, r: 3.5 });
    formas.push({ k: 'text', x: pts[0][0], y: y0 + hh + 13, t: v.categorias[vals[0][0]], size: AX, color: COR.apagado, anchor: 'middle' });
    formas.push({ k: 'text', x: lx, y: y0 + hh + 13, t: v.categorias[vals[vals.length - 1][0]], size: AX, color: COR.apagado, anchor: 'middle' });
  });
  return { w, h: 8 + v.series.length * 112, formas };
}

// ------------------------------------------------------------------- kpis ---

function kpis(itens: Kpi[], w = VB_L, h = VB_A): Desenho {
  const formas: Forma[] = [];
  const cols = itens.length <= 4 ? 2 : 3;
  const rows = Math.ceil(itens.length / cols);
  const g = 12;
  const cw = (w - g * (cols - 1)) / cols;
  const ch = Math.min((h - g * (rows - 1)) / rows, 116);
  itens.forEach((k, i) => {
    const x = (i % cols) * (cw + g);
    const y = Math.floor(i / cols) * (ch + g);
    formas.push({ k: 'rect', x, y, w: cw, h: ch, fill: COR.branco, stroke: k.alerta ? COR.ruim : COR.regra, r: 6 });
    formas.push({ k: 'text', x: x + 14, y: y + 24, t: k.rotulo.toUpperCase(), size: 9.5, color: COR.apagado, bold: true, maxW: cw - 28 });
    formas.push({ k: 'text', x: x + 14, y: y + 60, t: k.valor, size: cols === 3 ? 21 : 25, color: k.alerta ? COR.ruim : COR.vinho, bold: true, maxW: cw - 28 });
    formas.push({ k: 'text', x: x + 14, y: y + 84, t: k.detalhe, size: 10, color: COR.apagado, maxW: cw - 28 });
  });
  return { w, h: rows * ch + (rows - 1) * g, formas };
}

/** Desenho do visual; `null` para os que cada renderizador monta do seu jeito (capa, tabela, lista). */
export function desenhar(v: Visual): Desenho | null {
  switch (v.tipo) {
    case 'barras': return barras(v);
    case 'linhas': return linhas(v);
    case 'ranking': return ranking(v);
    case 'ponte': return ponteComSerie(v);
    case 'aging': return aging(v.receber, v.pagar);
    case 'mapa': return mapa(v);
    case 'redes': return redes(v);
    case 'kpis': return kpis(v.itens);
    default: return null;
  }
}

export type { SerieBarras };
