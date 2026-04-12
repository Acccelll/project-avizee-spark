/**
 * PPTX generation engine for Apresentação Gerencial.
 * Uses pptxgenjs to produce a real .pptx file programmatically.
 * Template-driven: theme and slide definitions centralized.
 */
import PptxGenJS from 'pptxgenjs';
import type {
  ApresentacaoRawData,
  ApresentacaoComentario,
  ApresentacaoParametros,
  TemplateConfig,
  ResolvedTheme,
} from '@/types/apresentacao';
import { SLIDE_DEFINITIONS } from './slideDefinitions';
import { resolveTheme, resolveSlides } from './templateConfig';
import {
  formatCurrencyBR,
  formatCompetencia,
  topN,
} from './utils';
import { getEfectiveComentario } from './commentRules';

export interface GeneratePresentationOptions {
  parametros: ApresentacaoParametros;
  geracaoId: string;
  data: ApresentacaoRawData;
  comentarios: ApresentacaoComentario[];
  empresaNome?: string;
  templateConfig?: TemplateConfig | null;
}

// Helper to resolve effective comment text for a given slide code
function getComment(
  comentarios: ApresentacaoComentario[],
  slideCodigo: string
): string {
  const c = comentarios.find((x) => x.slide_codigo === slideCodigo);
  if (!c) return '';
  return getEfectiveComentario(c.comentario_automatico, c.comentario_editado);
}

// -------------------------------------------------------
// Master layout helpers — receive resolved theme
// -------------------------------------------------------

function addSlideHeader(
  slide: PptxGenJS.Slide,
  titulo: string,
  subtitulo: string,
  theme: ResolvedTheme
): void {
  const W = theme.slide.widthInches;
  slide.addShape(PptxGenJS.ShapeType.rect, {
    x: 0, y: 0, w: W, h: 0.85,
    fill: { color: theme.colors.primary },
    line: { type: 'none' },
  });
  slide.addText(titulo, {
    x: 0.3, y: 0.08, w: W - 0.6, h: 0.45,
    fontSize: theme.fontSizes.slideTitle,
    bold: true,
    color: theme.colors.white,
    fontFace: theme.fonts.title,
    valign: 'middle',
  });
  if (subtitulo) {
    slide.addText(subtitulo, {
      x: 0.3, y: 0.52, w: W - 0.6, h: 0.3,
      fontSize: theme.fontSizes.slideSubtitle,
      color: 'C5D3E8',
      fontFace: theme.fonts.body,
      valign: 'middle',
    });
  }
}

function addSlideFooter(
  slide: PptxGenJS.Slide,
  periodo: string,
  empresaNome: string,
  theme: ResolvedTheme
): void {
  const W = theme.slide.widthInches;
  const H = theme.slide.heightInches;
  slide.addShape(PptxGenJS.ShapeType.rect, {
    x: 0, y: H - 0.32, w: W, h: 0.32,
    fill: { color: theme.colors.lightGray },
    line: { type: 'none' },
  });
  slide.addText(`${empresaNome} | ${periodo}`, {
    x: 0.3, y: H - 0.3, w: W * 0.6, h: 0.28,
    fontSize: theme.fontSizes.caption,
    color: theme.colors.mediumGray,
    fontFace: theme.fonts.body,
    valign: 'middle',
  });
  slide.addText('AviZee ERP', {
    x: W * 0.6 + 0.3, y: H - 0.3, w: W * 0.4 - 0.6, h: 0.28,
    fontSize: theme.fontSizes.caption,
    color: theme.colors.mediumGray,
    fontFace: theme.fonts.body,
    align: 'right',
    valign: 'middle',
  });
}

function addCommentBlock(
  slide: PptxGenJS.Slide,
  comentario: string,
  y: number,
  theme: ResolvedTheme
): void {
  if (!comentario) return;
  const W = theme.slide.widthInches;
  slide.addShape(PptxGenJS.ShapeType.rect, {
    x: 0, y, w: W, h: 0.6,
    fill: { color: 'EBF3FB' },
    line: { color: 'C5D3E8', pt: 1 },
  });
  slide.addText(`💬 ${comentario}`, {
    x: 0.25, y: y + 0.05, w: W - 0.5, h: 0.52,
    fontSize: theme.fontSizes.comment,
    color: theme.colors.darkGray,
    fontFace: theme.fonts.body,
    valign: 'middle',
    wrap: true,
  });
}

// -------------------------------------------------------
// Individual slide builders — receive resolved theme
// -------------------------------------------------------

function buildCoverSlide(
  pptx: PptxGenJS,
  titulo: string,
  periodo: string,
  empresaNome: string,
  comentario: string,
  theme: ResolvedTheme
): void {
  const slide = pptx.addSlide();
  const W = theme.slide.widthInches;
  const H = theme.slide.heightInches;
  slide.addShape(PptxGenJS.ShapeType.rect, {
    x: 0, y: 0, w: W, h: H,
    fill: { color: theme.colors.primary },
    line: { type: 'none' },
  });
  slide.addShape(PptxGenJS.ShapeType.rect, {
    x: 0, y: H * 0.6, w: W, h: 0.06,
    fill: { color: theme.colors.accent },
    line: { type: 'none' },
  });
  slide.addText(empresaNome, {
    x: 0.8, y: 1.5, w: W - 1.6, h: 0.7,
    fontSize: 20,
    bold: false,
    color: 'C5D3E8',
    fontFace: theme.fonts.title,
    align: 'center',
  });
  slide.addText(titulo, {
    x: 0.8, y: 2.3, w: W - 1.6, h: 1.0,
    fontSize: theme.fontSizes.coverTitle,
    bold: true,
    color: theme.colors.white,
    fontFace: theme.fonts.title,
    align: 'center',
  });
  slide.addText(periodo, {
    x: 0.8, y: 3.4, w: W - 1.6, h: 0.55,
    fontSize: theme.fontSizes.coverSubtitle,
    color: 'FFC000',
    fontFace: theme.fonts.body,
    align: 'center',
    bold: true,
  });
  slide.addText('AviZee ERP — Apresentação Gerencial', {
    x: 0.8, y: H - 1.0, w: W - 1.6, h: 0.4,
    fontSize: 10,
    color: '8BAED1',
    fontFace: theme.fonts.body,
    align: 'center',
  });
  if (comentario) {
    addCommentBlock(slide, comentario, H - 1.5, theme);
  }
}

function buildKpiSlide(
  pptx: PptxGenJS,
  titulo: string,
  subtitulo: string,
  data: ApresentacaoRawData,
  periodo: string,
  empresaNome: string,
  comentario: string,
  theme: ResolvedTheme
): void {
  const slide = pptx.addSlide();
  const W = theme.slide.widthInches;
  const H = theme.slide.heightInches;
  addSlideHeader(slide, titulo, subtitulo, theme);
  addSlideFooter(slide, periodo, empresaNome, theme);

  const last = data.highlights[data.highlights.length - 1];
  const kpis = last
    ? [
        { label: 'Receita', value: `R$ ${formatCurrencyBR(last.total_receita)}`, color: theme.colors.secondary },
        { label: 'Recebido', value: `R$ ${formatCurrencyBR(last.total_recebido)}`, color: theme.colors.success },
        { label: 'Despesa', value: `R$ ${formatCurrencyBR(last.total_despesa)}`, color: theme.colors.danger },
        { label: 'Pago', value: `R$ ${formatCurrencyBR(last.total_pago)}`, color: theme.colors.warning },
        { label: 'Resultado', value: `R$ ${formatCurrencyBR(last.resultado_bruto)}`, color: last.resultado_bruto >= 0 ? theme.colors.success : theme.colors.danger },
      ]
    : [];

  const kpiW = (W - 0.4) / 5;
  kpis.forEach((kpi, i) => {
    const x = 0.2 + i * kpiW;
    slide.addShape(PptxGenJS.ShapeType.rect, {
      x, y: 1.1, w: kpiW - 0.1, h: 1.6,
      fill: { color: kpi.color },
      line: { type: 'none' },
      shadow: { type: 'outer', blur: 3, offset: 2, angle: 45, color: '888888' },
    });
    slide.addText(kpi.value, {
      x: x + 0.05, y: 1.3, w: kpiW - 0.2, h: 0.65,
      fontSize: theme.fontSizes.kpiValue,
      bold: true,
      color: theme.colors.white,
      fontFace: theme.fonts.title,
      align: 'center',
    });
    slide.addText(kpi.label, {
      x: x + 0.05, y: 1.95, w: kpiW - 0.2, h: 0.3,
      fontSize: theme.fontSizes.kpiLabel,
      color: theme.colors.white,
      fontFace: theme.fonts.body,
      align: 'center',
    });
  });

  if (!last) {
    slide.addText('Dados de highlights indisponíveis para o período selecionado.', {
      x: 0.5, y: 1.5, w: W - 1, h: 1,
      fontSize: theme.fontSizes.body,
      color: theme.colors.mediumGray,
      align: 'center',
    });
  }

  addCommentBlock(slide, comentario, H - 1.1, theme);
}

function buildColumnChartSlide(
  pptx: PptxGenJS,
  titulo: string,
  subtitulo: string,
  labels: string[],
  series: Array<{ name: string; values: number[] }>,
  periodo: string,
  empresaNome: string,
  comentario: string,
  theme: ResolvedTheme
): void {
  const slide = pptx.addSlide();
  const W = theme.slide.widthInches;
  const H = theme.slide.heightInches;
  addSlideHeader(slide, titulo, subtitulo, theme);
  addSlideFooter(slide, periodo, empresaNome, theme);

  if (labels.length === 0) {
    slide.addText('Dados indisponíveis para o período selecionado.', {
      x: 0.5, y: 2.0, w: W - 1, h: 1,
      fontSize: theme.fontSizes.body,
      color: theme.colors.mediumGray,
      align: 'center',
    });
  } else {
    slide.addChart(PptxGenJS.ChartType.bar, series.map((s, i) => ({
      name: s.name,
      labels,
      values: s.values,
      color: theme.colors.chartSeries[i % theme.colors.chartSeries.length],
    })), {
      x: 0.4, y: 0.95, w: W - 0.8, h: H - 2.0,
      barDir: 'col',
      barGrouping: 'clustered',
      showValue: false,
      showLegend: true,
      legendPos: 'b',
      dataLabelFontSize: 8,
    });
  }

  addCommentBlock(slide, comentario, H - 1.1, theme);
}

function buildHBarChartSlide(
  pptx: PptxGenJS,
  titulo: string,
  subtitulo: string,
  labels: string[],
  values: number[],
  periodo: string,
  empresaNome: string,
  comentario: string,
  theme: ResolvedTheme
): void {
  const slide = pptx.addSlide();
  const W = theme.slide.widthInches;
  const H = theme.slide.heightInches;
  addSlideHeader(slide, titulo, subtitulo, theme);
  addSlideFooter(slide, periodo, empresaNome, theme);

  if (labels.length === 0) {
    slide.addText('Dados indisponíveis para o período selecionado.', {
      x: 0.5, y: 2.0, w: W - 1, h: 1,
      fontSize: theme.fontSizes.body,
      color: theme.colors.mediumGray,
      align: 'center',
    });
  } else {
    slide.addChart(PptxGenJS.ChartType.bar, [{
      name: titulo,
      labels: labels.slice(0, 12),
      values: values.slice(0, 12),
    }], {
      x: 0.4, y: 0.95, w: W - 0.8, h: H - 2.0,
      barDir: 'bar',
      barGrouping: 'clustered',
      showValue: true,
      dataLabelFontSize: 8,
      chartColors: [theme.colors.secondary],
    });
  }

  addCommentBlock(slide, comentario, H - 1.1, theme);
}

function buildLineChartSlide(
  pptx: PptxGenJS,
  titulo: string,
  subtitulo: string,
  labels: string[],
  series: Array<{ name: string; values: number[] }>,
  periodo: string,
  empresaNome: string,
  comentario: string,
  theme: ResolvedTheme
): void {
  const slide = pptx.addSlide();
  const W = theme.slide.widthInches;
  const H = theme.slide.heightInches;
  addSlideHeader(slide, titulo, subtitulo, theme);
  addSlideFooter(slide, periodo, empresaNome, theme);

  if (labels.length === 0) {
    slide.addText('Dados indisponíveis para o período selecionado.', {
      x: 0.5, y: 2.0, w: W - 1, h: 1,
      fontSize: theme.fontSizes.body,
      color: theme.colors.mediumGray,
      align: 'center',
    });
  } else {
    slide.addChart(PptxGenJS.ChartType.line, series.map((s, i) => ({
      name: s.name,
      labels,
      values: s.values,
      color: theme.colors.chartSeries[i % theme.colors.chartSeries.length],
    })), {
      x: 0.4, y: 0.95, w: W - 0.8, h: H - 2.0,
      showLegend: true,
      legendPos: 'b',
    });
  }

  addCommentBlock(slide, comentario, H - 1.1, theme);
}

function buildTableSlide(
  pptx: PptxGenJS,
  titulo: string,
  subtitulo: string,
  headers: string[],
  rows: string[][],
  periodo: string,
  empresaNome: string,
  comentario: string,
  theme: ResolvedTheme
): void {
  const slide = pptx.addSlide();
  const W = theme.slide.widthInches;
  const H = theme.slide.heightInches;
  addSlideHeader(slide, titulo, subtitulo, theme);
  addSlideFooter(slide, periodo, empresaNome, theme);

  if (rows.length === 0) {
    slide.addText('Dados indisponíveis para o período selecionado.', {
      x: 0.5, y: 2.0, w: W - 1, h: 1,
      fontSize: theme.fontSizes.body,
      color: theme.colors.mediumGray,
      align: 'center',
    });
  } else {
    const tableData = [
      headers.map((h) => ({
        text: h,
        options: {
          bold: true,
          fill: { color: theme.colors.primary },
          color: theme.colors.white,
          fontSize: theme.fontSizes.tableHeader,
          fontFace: theme.fonts.title,
        },
      })),
      ...rows.slice(0, 20).map((row, ri) =>
        row.map((cell) => ({
          text: cell,
          options: {
            fill: { color: ri % 2 === 0 ? theme.colors.white : theme.colors.lightGray },
            fontSize: theme.fontSizes.tableBody,
            fontFace: theme.fonts.body,
          },
        }))
      ),
    ];

    slide.addTable(tableData, {
      x: 0.3,
      y: 0.95,
      w: W - 0.6,
      colW: Array(headers.length).fill((W - 0.6) / headers.length),
      border: { type: 'solid', color: 'D0D0D0', pt: 0.5 },
    });
  }

  addCommentBlock(slide, comentario, H - 1.1, theme);
}

function buildUnavailableSlide(
  pptx: PptxGenJS,
  titulo: string,
  subtitulo: string,
  periodo: string,
  empresaNome: string,
  theme: ResolvedTheme
): void {
  const slide = pptx.addSlide();
  const W = theme.slide.widthInches;
  const H = theme.slide.heightInches;
  addSlideHeader(slide, titulo, subtitulo, theme);
  addSlideFooter(slide, periodo, empresaNome, theme);
  slide.addShape(PptxGenJS.ShapeType.rect, {
    x: 1.5, y: 2.0, w: W - 3, h: 2.0,
    fill: { color: theme.colors.lightGray },
    line: { color: 'D0D0D0', pt: 1 },
  });
  slide.addText('⚠️ Dados não automatizados nesta V1 / Dados indisponíveis', {
    x: 1.5, y: 2.0, w: W - 3, h: 2.0,
    fontSize: 14,
    color: theme.colors.mediumGray,
    align: 'center',
    valign: 'middle',
    fontFace: theme.fonts.body,
  });
}

// -------------------------------------------------------
// Main export
// -------------------------------------------------------

export async function generatePresentation(
  options: GeneratePresentationOptions
): Promise<Blob> {
  const { parametros, data, comentarios, empresaNome = 'AviZee', templateConfig } = options;
  const { competenciaInicial, competenciaFinal } = parametros;
  const periodo = `${formatCompetencia(competenciaInicial)} a ${formatCompetencia(competenciaFinal)}`;

  // Resolve theme and slides from template config (null = use defaults)
  const theme = resolveTheme(templateConfig);
  const activeSlides = resolveSlides(templateConfig);

  function isActive(codigo: string): boolean {
    const s = activeSlides.find((x) => x.codigo === codigo);
    return s ? s.ativo : true;
  }

  function slideTitles(codigo: string): { titulo: string; subtitulo: string } {
    const s = activeSlides.find((x) => x.codigo === codigo);
    const def = SLIDE_DEFINITIONS.find((d) => d.codigo === codigo);
    return {
      titulo: s?.titulo ?? def?.titulo ?? codigo,
      subtitulo: s?.subtitulo ?? def?.subtitulo ?? '',
    };
  }

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = `Fechamento Mensal — ${periodo}`;
  pptx.subject = 'Apresentação Gerencial AviZee';
  pptx.author = 'AviZee ERP';

  pptx.defineSlideMaster({
    title: 'AVIZEE_MASTER',
    background: { color: theme.colors.background },
  });

  // Build slides in resolved order, respecting ativo flag.
  for (const resolved of activeSlides) {
    if (!resolved.ativo) continue;
    const { codigo, titulo, subtitulo } = resolved;

    switch (codigo) {
      case 'cover':
        buildCoverSlide(pptx, titulo, periodo, empresaNome, getComment(comentarios, 'cover'), theme);
        break;

      case 'highlights_financeiros':
        buildKpiSlide(pptx, titulo, subtitulo, data, periodo, empresaNome, getComment(comentarios, 'highlights_financeiros'), theme);
        break;

      case 'faturamento':
        if (data.faturamento.length > 0) {
          buildColumnChartSlide(
            pptx, titulo, subtitulo,
            data.faturamento.map((f) => f.competencia),
            [{ name: 'Faturado (R$)', values: data.faturamento.map((f) => f.total_faturado) }],
            periodo, empresaNome, getComment(comentarios, 'faturamento'), theme
          );
        } else {
          buildUnavailableSlide(pptx, titulo, subtitulo, periodo, empresaNome, theme);
        }
        break;

      case 'despesas':
        if (data.despesas.length > 0) {
          const porCat = data.despesas.reduce<Record<string, number>>((acc, d) => {
            acc[d.categoria] = (acc[d.categoria] ?? 0) + d.total_despesa;
            return acc;
          }, {});
          const sorted = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
          buildHBarChartSlide(
            pptx, titulo, subtitulo,
            sorted.map(([k]) => k),
            sorted.map(([, v]) => v),
            periodo, empresaNome, getComment(comentarios, 'despesas'), theme
          );
        } else {
          buildUnavailableSlide(pptx, titulo, subtitulo, periodo, empresaNome, theme);
        }
        break;

      case 'rol_caixa': {
        const headers = ['Conta', 'Banco', 'Agência', 'Número', 'Saldo (R$)'];
        const rows = data.rolCaixa.map((c) => [
          c.conta_descricao, c.banco_nome, c.agencia, c.conta, formatCurrencyBR(c.saldo_atual),
        ]);
        buildTableSlide(pptx, titulo, subtitulo, headers, rows, periodo, empresaNome, getComment(comentarios, 'rol_caixa'), theme);
        break;
      }

      case 'receita_vs_despesa':
        if (data.receitaVsDespesa.length > 0) {
          buildLineChartSlide(
            pptx, titulo, subtitulo,
            data.receitaVsDespesa.map((r) => r.competencia),
            [
              { name: 'Receita (R$)', values: data.receitaVsDespesa.map((r) => r.total_receita) },
              { name: 'Despesa (R$)', values: data.receitaVsDespesa.map((r) => r.total_despesa) },
              { name: 'Resultado (R$)', values: data.receitaVsDespesa.map((r) => r.resultado_bruto) },
            ],
            periodo, empresaNome, getComment(comentarios, 'receita_vs_despesa'), theme
          );
        } else {
          buildUnavailableSlide(pptx, titulo, subtitulo, periodo, empresaNome, theme);
        }
        break;

      case 'fopag': {
        const headers = ['Funcionário', 'Salário Base', 'Proventos', 'Descontos', 'Líquido'];
        const rows = data.fopag.map((f) => [
          f.funcionario_nome,
          formatCurrencyBR(f.salario_base),
          formatCurrencyBR(f.proventos),
          formatCurrencyBR(f.descontos),
          formatCurrencyBR(f.valor_liquido),
        ]);
        buildTableSlide(pptx, titulo, subtitulo, headers, rows, periodo, empresaNome, getComment(comentarios, 'fopag'), theme);
        break;
      }

      case 'fluxo_caixa':
        if (data.fluxoCaixa.length > 0) {
          buildColumnChartSlide(
            pptx, titulo, subtitulo,
            data.fluxoCaixa.map((f) => f.competencia),
            [
              { name: 'Entradas (R$)', values: data.fluxoCaixa.map((f) => f.total_entradas) },
              { name: 'Saídas (R$)', values: data.fluxoCaixa.map((f) => f.total_saidas) },
            ],
            periodo, empresaNome, getComment(comentarios, 'fluxo_caixa'), theme
          );
        } else {
          buildUnavailableSlide(pptx, titulo, subtitulo, periodo, empresaNome, theme);
        }
        break;

      case 'lucro_produto_cliente':
        if (data.lucro.length > 0) {
          const topProd = topN(data.lucro, 'margem_bruta', 10);
          buildHBarChartSlide(
            pptx, titulo, subtitulo,
            topProd.map((p) => p.produto_nome),
            topProd.map((p) => p.margem_bruta),
            periodo, empresaNome, getComment(comentarios, 'lucro_produto_cliente'), theme
          );
        } else {
          buildUnavailableSlide(pptx, titulo, subtitulo, periodo, empresaNome, theme);
        }
        break;

      case 'variacao_estoque': {
        const headers = ['Produto', 'SKU', 'Grupo', 'Qtd', 'Custo Unit.', 'Valor Total'];
        const topEstoque = topN(data.estoque, 'valor_total', 20);
        const rows = topEstoque.map((e) => [
          e.produto_nome, e.produto_sku, e.grupo_nome,
          String(e.quantidade_atual),
          formatCurrencyBR(e.custo_unitario),
          formatCurrencyBR(e.valor_total),
        ]);
        buildTableSlide(pptx, titulo, subtitulo, headers, rows, periodo, empresaNome, getComment(comentarios, 'variacao_estoque'), theme);
        break;
      }

      case 'venda_estado':
        if (data.vendaEstado.length > 0) {
          const sorted = [...data.vendaEstado].sort((a, b) => b.total_vendas - a.total_vendas);
          buildHBarChartSlide(
            pptx, titulo, subtitulo,
            sorted.map((v) => v.estado),
            sorted.map((v) => v.total_vendas),
            periodo, empresaNome, getComment(comentarios, 'venda_estado'), theme
          );
        } else {
          buildUnavailableSlide(pptx, titulo, subtitulo, periodo, empresaNome, theme);
        }
        break;

      case 'redes_sociais':
        if (data.redesSociais.length > 0) {
          const headers = ['Plataforma', 'Métrica', 'Valor'];
          const rows = data.redesSociais.map((r) => [r.plataforma, r.metrica, String(r.valor)]);
          buildTableSlide(pptx, titulo, subtitulo, headers, rows, periodo, empresaNome, getComment(comentarios, 'redes_sociais'), theme);
        } else {
          buildUnavailableSlide(pptx, titulo, subtitulo, periodo, empresaNome, theme);
        }
        break;

      default:
        // Unknown slide codigo: skip silently
        break;
    }
  }

  // Export as Blob
  const base64 = await pptx.write({ outputType: 'base64' });
  const binaryStr = atob(base64 as string);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
}

