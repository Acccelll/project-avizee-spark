import JSZip from 'jszip';
import { APRESENTACAO_SLIDES_MAP } from './slideDefinitions';
import { buildAutomaticComment } from './commentRules';
import type { ApresentacaoDataBundle, SlideCodigo, SlideData } from '@/types/apresentacao';
import { pickEditedComment } from './utils';
import { apresentacaoTheme, resolveApresentacaoTheme } from './theme';
import { defaultSlideLayout } from './layouts';
import { formatMoneyCompact, formatPercentOne } from './numberFormat';
import { getSeverityColor } from './colorRules';

const EMU = 914400;
let activeTheme = apresentacaoTheme;

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function emu(inches: number): number {
  return Math.round(inches * EMU);
}

function hex(value: string): string {
  return value.replace('#', '').toUpperCase();
}

function contentTypes(slideCount: number): string {
  const slideOverrides = Array.from({ length: slideCount }, (_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${slideOverrides}</Types>`;
}

function baseXml(slideCount: number): Record<string, string> {
  const slideEntries = Array.from({ length: slideCount }, (_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('');
  const relEntries = Array.from({ length: slideCount }, (_, i) => `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join('');
  return {
    '[Content_Types].xml': contentTypes(slideCount),
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`,
    'docProps/app.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>AviZee ERP</Application></Properties>`,
    'docProps/core.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Apresentação Gerencial</dc:title></cp:coreProperties>`,
    'ppt/presentation.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slideEntries}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="wide"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`,
    'ppt/_rels/presentation.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${relEntries}</Relationships>`,
    'ppt/slideMasters/slideMaster1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`,
    'ppt/slideMasters/_rels/slideMaster1.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`,
    'ppt/slideLayouts/slideLayout1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld></p:sldLayout>`,
    'ppt/theme/theme1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="AviZee"><a:themeElements><a:clrScheme name="AviZee"><a:dk1><a:srgbClr val="${activeTheme.colors.text}"/></a:dk1><a:lt1><a:srgbClr val="${activeTheme.colors.white}"/></a:lt1><a:accent1><a:srgbClr val="${activeTheme.colors.primary}"/></a:accent1><a:accent2><a:srgbClr val="${activeTheme.colors.secondary}"/></a:accent2><a:accent3><a:srgbClr val="${activeTheme.colors.accent}"/></a:accent3></a:clrScheme><a:fontScheme name="AviZee"><a:majorFont><a:latin typeface="${activeTheme.typography.fontFamily}"/></a:majorFont><a:minorFont><a:latin typeface="${activeTheme.typography.fontFamily}"/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"/></a:themeElements></a:theme>`,
  };
}

function formatValue(value: unknown, key = ''): string {
  if (typeof value === 'number') {
    if (key.includes('pct') || key.includes('percent')) return formatPercentOne(value);
    if (key.includes('valor') || key.includes('receita') || key.includes('despesa') || key.includes('saldo') || key.includes('caixa')) {
      return `R$ ${formatMoneyCompact(value)}`;
    }
    return String(Math.round(value * 100) / 100);
  }
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (value == null) return '-';
  return String(value);
}

function prettyLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function flatPairs(dados: Record<string, unknown>): Array<{ key: string; value: unknown }> {
  return Object.entries(dados)
    .filter(([k, v]) => !['indisponivel', 'motivo'].includes(k) && !Array.isArray(v) && typeof v !== 'object')
    .map(([key, value]) => ({ key, value }));
}

function findArrayRows(dados: Record<string, unknown>): Array<Record<string, unknown>> {
  for (const value of Object.values(dados)) {
    if (Array.isArray(value) && value.length && typeof value[0] === 'object') return value as Array<Record<string, unknown>>;
  }
  return [];
}

function shapeBox(id: number, name: string, x: number, y: number, w: number, h: number, fill = apresentacaoTheme.colors.white, line = 'D1D5DB', radius = false): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${esc(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="${radius ? 'roundRect' : 'rect'}"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${hex(fill)}"/></a:solidFill><a:ln w="12700"><a:solidFill><a:srgbClr val="${hex(line)}"/></a:solidFill></a:ln></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`;
}

function shapeText(id: number, name: string, x: number, y: number, w: number, h: number, lines: string[], opts?: { size?: number; bold?: boolean; color?: string }): string {
  const size = Math.round((opts?.size ?? activeTheme.typography.bodySize) * 100);
  const bold = opts?.bold ? ' b="1"' : '';
  const color = hex(opts?.color ?? activeTheme.colors.text);
  const paragraphs = lines.map((line) => `<a:p><a:r><a:rPr sz="${size}"${bold}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:rPr><a:t>${esc(line)}</a:t></a:r></a:p>`).join('');
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${esc(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>${paragraphs || '<a:p/>'}</p:txBody></p:sp>`;
}

function unavailablePanel(idStart: number, motivo: string): string[] {
  const c = getSeverityColor('warning');
  return [
    shapeBox(idStart, 'UnavailableBox', defaultSlideLayout.chart.x, defaultSlideLayout.chart.y, defaultSlideLayout.chart.w, defaultSlideLayout.chart.h, 'FFF7ED', hex(c), true),
    shapeText(idStart + 1, 'UnavailableTitle', defaultSlideLayout.chart.x + 0.3, defaultSlideLayout.chart.y + 0.4, defaultSlideLayout.chart.w - 0.6, 0.5, ['Dados indisponíveis nesta fase'], { size: 18, bold: true, color: hex(c) }),
    shapeText(idStart + 2, 'UnavailableBody', defaultSlideLayout.chart.x + 0.3, defaultSlideLayout.chart.y + 1.0, defaultSlideLayout.chart.w - 0.6, 1.2, [motivo || 'Este slide não possui base confiável no modo atual.'], { size: 12, color: activeTheme.colors.muted }),
  ];
}

function renderCards(idStart: number, dados: Record<string, unknown>): string[] {
  const pairs = flatPairs(dados).slice(0, 4);
  if (!pairs.length) return unavailablePanel(idStart, 'Sem indicadores para exibição.');
  const cards: string[] = [];
  const cardW = 4.1;
  const cardH = 1.35;
  pairs.forEach((pair, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = defaultSlideLayout.chart.x + col * (cardW + 0.25);
    const y = defaultSlideLayout.chart.y + row * (cardH + 0.25);
    const base = idStart + idx * 2;
    cards.push(shapeBox(base, `Card${idx + 1}`, x, y, cardW, cardH, 'EEF2FF', 'C7D2FE', true));
    cards.push(shapeText(base + 1, `CardText${idx + 1}`, x + 0.2, y + 0.18, cardW - 0.4, cardH - 0.3, [prettyLabel(pair.key), formatValue(pair.value, pair.key)], { size: 12, color: activeTheme.colors.primary, bold: true }));
  });
  return cards;
}

function renderTable(idStart: number, dados: Record<string, unknown>): string[] {
  const rows = findArrayRows(dados);
  const shapes: string[] = [shapeBox(idStart, 'TableArea', defaultSlideLayout.chart.x, defaultSlideLayout.chart.y, defaultSlideLayout.chart.w, defaultSlideLayout.chart.h, 'FFFFFF', 'CBD5E1', true)];
  if (rows.length) {
    const cols = Object.keys(rows[0]).slice(0, 3);
    shapes.push(shapeText(idStart + 1, 'TableHeader', defaultSlideLayout.chart.x + 0.2, defaultSlideLayout.chart.y + 0.15, defaultSlideLayout.chart.w - 0.4, 0.4, [cols.map(prettyLabel).join('  |  ')], { size: 12, bold: true, color: activeTheme.colors.primary }));
    const lineRows = rows.slice(0, 6).map((r) => cols.map((c) => formatValue(r[c], c)).join('  |  '));
    shapes.push(shapeText(idStart + 2, 'TableRows', defaultSlideLayout.chart.x + 0.2, defaultSlideLayout.chart.y + 0.6, defaultSlideLayout.chart.w - 0.4, defaultSlideLayout.chart.h - 0.8, lineRows, { size: 11 }));
    return shapes;
  }

  const pairs = flatPairs(dados).slice(0, 8).map((p) => `${prettyLabel(p.key)}: ${formatValue(p.value, p.key)}`);
  shapes.push(shapeText(idStart + 1, 'TableFallback', defaultSlideLayout.chart.x + 0.2, defaultSlideLayout.chart.y + 0.3, defaultSlideLayout.chart.w - 0.4, defaultSlideLayout.chart.h - 0.5, pairs.length ? pairs : ['Sem dados tabulares para exibição.'], { size: 12 }));
  return shapes;
}

function renderRanking(idStart: number, dados: Record<string, unknown>): string[] {
  const rows = findArrayRows(dados);
  const items = rows.slice(0, 5).map((r, idx) => {
    const name = String(r.nome ?? r.label ?? r.estado ?? `Item ${idx + 1}`);
    const valKey = Object.keys(r).find((k) => typeof r[k] === 'number') ?? 'valor';
    const value = formatValue(r[valKey], valKey);
    return `${idx + 1}. ${name} — ${value}`;
  });
  const lines = items.length ? items : flatPairs(dados).slice(0, 5).map((p, idx) => `${idx + 1}. ${prettyLabel(p.key)} — ${formatValue(p.value, p.key)}`);
  return [
    shapeBox(idStart, 'RankingBox', defaultSlideLayout.chart.x, defaultSlideLayout.chart.y, defaultSlideLayout.chart.w, defaultSlideLayout.chart.h, 'FFFFFF', 'D1D5DB', true),
    shapeText(idStart + 1, 'RankingText', defaultSlideLayout.chart.x + 0.25, defaultSlideLayout.chart.y + 0.25, defaultSlideLayout.chart.w - 0.5, defaultSlideLayout.chart.h - 0.4, lines.length ? lines : ['Sem ranking disponível.'], { size: 12 }),
  ];
}

function renderSeries(idStart: number, dados: Record<string, unknown>): string[] {
  const numerics = flatPairs(dados)
    .filter((p) => typeof p.value === 'number')
    .slice(0, 6) as Array<{ key: string; value: number }>;
  if (!numerics.length) return unavailablePanel(idStart, 'Sem série numérica para visualização.');
  const max = Math.max(...numerics.map((n) => Math.abs(n.value)), 1);
  const lines = numerics.map((n) => {
    const bars = Math.max(1, Math.round((Math.abs(n.value) / max) * 16));
    return `${prettyLabel(n.key)} ${'█'.repeat(bars)} ${formatValue(n.value, n.key)}`;
  });
  return [
    shapeBox(idStart, 'SeriesBox', defaultSlideLayout.chart.x, defaultSlideLayout.chart.y, defaultSlideLayout.chart.w, defaultSlideLayout.chart.h, 'FFFFFF', 'D1D5DB', true),
    shapeText(idStart + 1, 'SeriesText', defaultSlideLayout.chart.x + 0.25, defaultSlideLayout.chart.y + 0.25, defaultSlideLayout.chart.w - 0.5, defaultSlideLayout.chart.h - 0.5, lines, { size: 11 }),
  ];
}

function renderCover(slide: SlideData, data: ApresentacaoDataBundle): string[] {
  const periodo = `${data.periodo.competenciaInicial} a ${data.periodo.competenciaFinal}`;
  return [
    shapeBox(10, 'CoverBand', 0, 0, 13.33, 1.3, activeTheme.colors.primary, activeTheme.colors.primary),
    shapeText(11, 'CoverBrand', 0.6, 0.35, 6, 0.6, ['AviZee | Apresentação Gerencial'], { size: 14, color: activeTheme.colors.white, bold: true }),
    shapeText(12, 'CoverTitle', 0.7, 2.0, 11.5, 1.1, [slide.titulo], { size: 36, color: activeTheme.colors.primary, bold: true }),
    shapeText(13, 'CoverSubtitle', 0.7, 3.2, 11.5, 0.8, [slide.subtitulo || 'Resumo executivo do período'], { size: 18, color: activeTheme.colors.muted }),
    shapeText(14, 'CoverPeriod', 0.7, 4.3, 11.5, 0.6, [`Período: ${periodo}`], { size: 14, color: activeTheme.colors.secondary, bold: true }),
  ];
}

function renderClosing(slide: SlideData, comment: string, metadata?: Record<string, unknown>): string[] {
  const metaKeys = metadata ? Object.keys(metadata).slice(0, 3) : [];
  const metaLine = metaKeys.length ? `Base: ${metaKeys.join(', ')}` : 'Base: parâmetros da geração';
  return [
    shapeBox(10, 'ClosingMain', defaultSlideLayout.chart.x, 2.0, 8.8, 2.7, 'F8FAFC', 'CBD5E1', true),
    shapeText(11, 'ClosingTitle', defaultSlideLayout.chart.x + 0.3, 2.3, 8.2, 0.7, [slide.titulo || 'Encerramento'], { size: 24, bold: true, color: activeTheme.colors.primary }),
    shapeText(12, 'ClosingBody', defaultSlideLayout.chart.x + 0.3, 3.0, 8.2, 1.5, [comment || 'Obrigado. Próximos passos na sequência da agenda executiva.'], { size: 13 }),
    shapeText(13, 'ClosingMeta', 0.6, 6.7, 12.2, 0.35, [metaLine], { size: 10, color: activeTheme.colors.muted }),
  ];
}

function renderCommentaryBox(comment: string): string[] {
  const headline = comment.split(/[.!?]/).find((s) => s.trim().length > 0)?.trim() ?? 'Sem comentário adicional';
  return [
    shapeBox(100, 'CommentBox', defaultSlideLayout.commentary.x, defaultSlideLayout.commentary.y, defaultSlideLayout.commentary.w, defaultSlideLayout.commentary.h, 'ECFEFF', '67E8F9', true),
    shapeText(101, 'CommentTitle', defaultSlideLayout.commentary.x + 0.2, defaultSlideLayout.commentary.y + 0.2, defaultSlideLayout.commentary.w - 0.4, 0.4, ['Comentário executivo'], { size: 12, bold: true, color: activeTheme.colors.primary }),
    shapeText(102, 'CommentHeadline', defaultSlideLayout.commentary.x + 0.2, defaultSlideLayout.commentary.y + 0.6, defaultSlideLayout.commentary.w - 0.4, 0.35, [headline], { size: 11, bold: true }),
    shapeText(103, 'CommentBody', defaultSlideLayout.commentary.x + 0.2, defaultSlideLayout.commentary.y + 1.0, defaultSlideLayout.commentary.w - 0.4, defaultSlideLayout.commentary.h - 1.2, [comment || 'Sem comentário adicional.'], { size: 10 }),
  ];
}

function renderFooterMeta(slide: SlideData, data: ApresentacaoDataBundle): string {
  return shapeText(104, 'Footer', 0.5, 6.95, 12.2, 0.25, [`${slide.codigo} · ${data.periodo.competenciaInicial}–${data.periodo.competenciaFinal}`], { size: 9, color: activeTheme.colors.muted });
}

function slideXml(slide: SlideData, data: ApresentacaoDataBundle, comment: string, metadata?: Record<string, unknown>): string {
  const def = APRESENTACAO_SLIDES_MAP.get(slide.codigo);
  const content: string[] = [];
  content.push(shapeBox(2, 'HeaderBand', 0, 0, 13.33, 0.9, 'F1F5F9', 'F1F5F9'));
  content.push(shapeText(3, 'Title', defaultSlideLayout.title.x, defaultSlideLayout.title.y, defaultSlideLayout.title.w, defaultSlideLayout.title.h, [slide.titulo], { size: 22, bold: true, color: activeTheme.colors.primary }));
  content.push(shapeText(4, 'Subtitle', defaultSlideLayout.subtitle.x, defaultSlideLayout.subtitle.y, defaultSlideLayout.subtitle.w, defaultSlideLayout.subtitle.h, [slide.subtitulo || ''], { size: 12, color: activeTheme.colors.muted }));

  if (slide.codigo === 'cover') {
    content.push(...renderCover(slide, data));
  } else if (slide.codigo === 'closing') {
    content.push(...renderClosing(slide, comment, metadata));
  } else if (slide.indisponivel) {
    content.push(...unavailablePanel(20, String(slide.dados.motivo ?? 'não automatizado no modo fechado')));
  } else if (def?.chartType === 'cards') {
    content.push(...renderCards(20, slide.dados));
  } else if (def?.chartType === 'tabela') {
    content.push(...renderTable(20, slide.dados));
  } else if (def?.chartType === 'barra_horizontal') {
    content.push(...renderRanking(20, slide.dados));
  } else if (def?.chartType === 'coluna' || def?.chartType === 'linha' || def?.chartType === 'stacked' || def?.chartType === 'waterfall' || def?.chartType === 'donut') {
    content.push(...renderSeries(20, slide.dados));
  } else {
    content.push(...renderTable(20, slide.dados));
  }

  content.push(...renderCommentaryBox(comment));
  content.push(renderFooterMeta(slide, data));

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${content.join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

export async function generatePresentation(
  data: ApresentacaoDataBundle,
  comentariosEditados: Partial<Record<string, string>>,
  options?: { slideOrder?: SlideCodigo[]; metadata?: Record<string, unknown>; themePreset?: string | null },
): Promise<Blob> {
  activeTheme = resolveApresentacaoTheme(options?.themePreset ?? (options?.metadata?.themePreset as string | undefined));
  const order = options?.slideOrder?.length ? options.slideOrder : (Object.keys(data.slides) as SlideCodigo[]);

  const slides: SlideData[] = order.map((codigo) => {
    const def = APRESENTACAO_SLIDES_MAP.get(codigo);
    const dadosSlide = data.slides[codigo] ?? {};
    return {
      codigo,
      titulo: def?.titulo ?? codigo,
      subtitulo: def?.subtitulo ?? '',
      dados: dadosSlide,
      comentarioAutomatico: buildAutomaticComment(codigo, dadosSlide),
      comentarioEditado: comentariosEditados[codigo],
      indisponivel: Boolean(dadosSlide.indisponivel),
    };
  });

  const zip = new JSZip();
  const files = baseXml(slides.length);
  Object.entries(files).forEach(([path, content]) => zip.file(path, content));

  slides.forEach((slide, index) => {
    const comment = pickEditedComment(slide.comentarioAutomatico, slide.comentarioEditado);
    zip.file(`ppt/slides/slide${index + 1}.xml`, slideXml(slide, data, comment, options?.metadata));
  });

  return zip.generateAsync({ type: 'blob' });
}
