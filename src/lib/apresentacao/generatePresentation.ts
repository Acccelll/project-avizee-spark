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
} from '@/types/apresentacao';
import { SLIDE_DEFINITIONS } from './slideDefinitions';
import { THEME } from './theme';
import {
  formatCurrencyBR,
  formatCompetencia,
  topN,
  sumValues,
} from './utils';
import { getEfectiveComentario } from './commentRules';

export interface GeneratePresentationOptions {
  parametros: ApresentacaoParametros;
  geracaoId: string;
  data: ApresentacaoRawData;
  comentarios: ApresentacaoComentario[];
  empresaNome?: string;
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
// Master layout helpers
// -------------------------------------------------------
const W = THEME.slide.widthInches;
const H = THEME.slide.heightInches;

function addSlideHeader(
  slide: PptxGenJS.Slide,
  titulo: string,
  subtitulo: string
): void {
  // Blue header bar
  slide.addShape(PptxGenJS.ShapeType.rect, {
    x: 0,
    y: 0,
    w: W,
    h: 0.85,
    fill: { color: THEME.colors.primary },
    line: { type: 'none' },
  });
  // Title
  slide.addText(titulo, {
    x: 0.3,
    y: 0.08,
    w: W - 0.6,
    h: 0.45,
    fontSize: THEME.fontSizes.slideTitle,
    bold: true,
    color: THEME.colors.white,
    fontFace: THEME.fonts.title,
    valign: 'middle',
  });
  // Subtitle
  if (subtitulo) {
    slide.addText(subtitulo, {
      x: 0.3,
      y: 0.52,
      w: W - 0.6,
      h: 0.3,
      fontSize: THEME.fontSizes.slideSubtitle,
      color: 'C5D3E8',
      fontFace: THEME.fonts.body,
      valign: 'middle',
    });
  }
}

function addSlideFooter(
  slide: PptxGenJS.Slide,
  periodo: string,
  empresaNome: string
): void {
  slide.addShape(PptxGenJS.ShapeType.rect, {
    x: 0,
    y: H - 0.32,
    w: W,
    h: 0.32,
    fill: { color: THEME.colors.lightGray },
    line: { type: 'none' },
  });
  slide.addText(`${empresaNome} | ${periodo}`, {
    x: 0.3,
    y: H - 0.3,
    w: W * 0.6,
    h: 0.28,
    fontSize: THEME.fontSizes.caption,
    color: THEME.colors.mediumGray,
    fontFace: THEME.fonts.body,
    valign: 'middle',
  });
  slide.addText('AviZee ERP', {
    x: W * 0.6 + 0.3,
    y: H - 0.3,
    w: W * 0.4 - 0.6,
    h: 0.28,
    fontSize: THEME.fontSizes.caption,
    color: THEME.colors.mediumGray,
    fontFace: THEME.fonts.body,
    align: 'right',
    valign: 'middle',
  });
}

function addCommentBlock(
  slide: PptxGenJS.Slide,
  comentario: string,
  y: number
): void {
  if (!comentario) return;
  slide.addShape(PptxGenJS.ShapeType.rect, {
    x: 0,
    y,
    w: W,
    h: 0.6,
    fill: { color: 'EBF3FB' },
    line: { color: 'C5D3E8', pt: 1 },
  });
  slide.addText(`💬 ${comentario}`, {
    x: 0.25,
    y: y + 0.05,
    w: W - 0.5,
    h: 0.52,
    fontSize: THEME.fontSizes.comment,
    color: THEME.colors.darkGray,
    fontFace: THEME.fonts.body,
    valign: 'middle',
    wrap: true,
  });
}

// -------------------------------------------------------
// Individual slide builders
// -------------------------------------------------------

function buildCoverSlide(
  pptx: PptxGenJS,
  periodo: string,
  empresaNome: string,
  comentario: string
): void {
  const slide = pptx.addSlide();
  // Full background
  slide.addShape(PptxGenJS.ShapeType.rect, {
    x: 0, y: 0, w: W, h: H,
    fill: { color: THEME.colors.primary },
    line: { type: 'none' },
  });
  // Accent bar
  slide.addShape(PptxGenJS.ShapeType.rect, {
    x: 0, y: H * 0.6, w: W, h: 0.06,
    fill: { color: THEME.colors.accent },
    line: { type: 'none' },
  });
  // Company name
  slide.addText(empresaNome, {
    x: 0.8, y: 1.5, w: W - 1.6, h: 0.7,
    fontSize: 20,
    bold: false,
    color: 'C5D3E8',
    fontFace: THEME.fonts.title,
    align: 'center',
  });
  // Main title
  slide.addText('Fechamento Mensal', {
    x: 0.8, y: 2.3, w: W - 1.6, h: 1.0,
    fontSize: THEME.fontSizes.coverTitle,
    bold: true,
    color: THEME.colors.white,
    fontFace: THEME.fonts.title,
    align: 'center',
  });
  // Period
  slide.addText(periodo, {
    x: 0.8, y: 3.4, w: W - 1.6, h: 0.55,
    fontSize: THEME.fontSizes.coverSubtitle,
    color: 'FFC000',
    fontFace: THEME.fonts.body,
    align: 'center',
    bold: true,
  });
  // AviZee ERP branding
  slide.addText('AviZee ERP — Apresentação Gerencial', {
    x: 0.8, y: H - 1.0, w: W - 1.6, h: 0.4,
    fontSize: 10,
    color: '8BAED1',
    fontFace: THEME.fonts.body,
    align: 'center',
  });
  if (comentario) {
    addCommentBlock(slide, comentario, H - 1.5);
  }
}

function buildKpiSlide(
  pptx: PptxGenJS,
  data: ApresentacaoRawData,
  periodo: string,
  empresaNome: string,
  comentario: string
): void {
  const slide = pptx.addSlide();
  const def = SLIDE_DEFINITIONS.find((s) => s.codigo === 'highlights_financeiros')!;
  addSlideHeader(slide, def.titulo, def.subtitulo);
  addSlideFooter(slide, periodo, empresaNome);

  const last = data.highlights[data.highlights.length - 1];
  const kpis = last
    ? [
        { label: 'Receita', value: `R$ ${formatCurrencyBR(last.total_receita)}`, color: THEME.colors.secondary },
        { label: 'Recebido', value: `R$ ${formatCurrencyBR(last.total_recebido)}`, color: THEME.colors.success },
        { label: 'Despesa', value: `R$ ${formatCurrencyBR(last.total_despesa)}`, color: THEME.colors.danger },
        { label: 'Pago', value: `R$ ${formatCurrencyBR(last.total_pago)}`, color: THEME.colors.warning },
        { label: 'Resultado', value: `R$ ${formatCurrencyBR(last.resultado_bruto)}`, color: last.resultado_bruto >= 0 ? THEME.colors.success : THEME.colors.danger },
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
      fontSize: THEME.fontSizes.kpiValue,
      bold: true,
      color: THEME.colors.white,
      fontFace: THEME.fonts.title,
      align: 'center',
    });
    slide.addText(kpi.label, {
      x: x + 0.05, y: 1.95, w: kpiW - 0.2, h: 0.3,
      fontSize: THEME.fontSizes.kpiLabel,
      color: THEME.colors.white,
      fontFace: THEME.fonts.body,
      align: 'center',
    });
  });

  if (!last) {
    slide.addText('Dados de highlights indisponíveis para o período selecionado.', {
      x: 0.5, y: 1.5, w: W - 1, h: 1,
      fontSize: THEME.fontSizes.body,
      color: THEME.colors.mediumGray,
      align: 'center',
    });
  }

  addCommentBlock(slide, comentario, H - 1.1);
}

function buildColumnChartSlide(
  pptx: PptxGenJS,
  titulo: string,
  subtitulo: string,
  labels: string[],
  series: Array<{ name: string; values: number[] }>,
  periodo: string,
  empresaNome: string,
  comentario: string
): void {
  const slide = pptx.addSlide();
  addSlideHeader(slide, titulo, subtitulo);
  addSlideFooter(slide, periodo, empresaNome);

  if (labels.length === 0) {
    slide.addText('Dados indisponíveis para o período selecionado.', {
      x: 0.5, y: 2.0, w: W - 1, h: 1,
      fontSize: THEME.fontSizes.body,
      color: THEME.colors.mediumGray,
      align: 'center',
    });
  } else {
    slide.addChart(PptxGenJS.ChartType.bar, series.map((s, i) => ({
      name: s.name,
      labels,
      values: s.values,
      color: THEME.colors.chartSeries[i % THEME.colors.chartSeries.length],
    })), {
      x: 0.4,
      y: 0.95,
      w: W - 0.8,
      h: H - 2.0,
      barDir: 'col',
      barGrouping: 'clustered',
      showValue: false,
      showLegend: true,
      legendPos: 'b',
      dataLabelFontSize: 8,
    });
  }

  addCommentBlock(slide, comentario, H - 1.1);
}

function buildHBarChartSlide(
  pptx: PptxGenJS,
  titulo: string,
  subtitulo: string,
  labels: string[],
  values: number[],
  periodo: string,
  empresaNome: string,
  comentario: string
): void {
  const slide = pptx.addSlide();
  addSlideHeader(slide, titulo, subtitulo);
  addSlideFooter(slide, periodo, empresaNome);

  if (labels.length === 0) {
    slide.addText('Dados indisponíveis para o período selecionado.', {
      x: 0.5, y: 2.0, w: W - 1, h: 1,
      fontSize: THEME.fontSizes.body,
      color: THEME.colors.mediumGray,
      align: 'center',
    });
  } else {
    slide.addChart(PptxGenJS.ChartType.bar, [{
      name: titulo,
      labels: labels.slice(0, 12),
      values: values.slice(0, 12),
    }], {
      x: 0.4,
      y: 0.95,
      w: W - 0.8,
      h: H - 2.0,
      barDir: 'bar',
      barGrouping: 'clustered',
      showValue: true,
      dataLabelFontSize: 8,
      chartColors: [THEME.colors.secondary],
    });
  }

  addCommentBlock(slide, comentario, H - 1.1);
}

function buildLineChartSlide(
  pptx: PptxGenJS,
  titulo: string,
  subtitulo: string,
  labels: string[],
  series: Array<{ name: string; values: number[] }>,
  periodo: string,
  empresaNome: string,
  comentario: string
): void {
  const slide = pptx.addSlide();
  addSlideHeader(slide, titulo, subtitulo);
  addSlideFooter(slide, periodo, empresaNome);

  if (labels.length === 0) {
    slide.addText('Dados indisponíveis para o período selecionado.', {
      x: 0.5, y: 2.0, w: W - 1, h: 1,
      fontSize: THEME.fontSizes.body,
      color: THEME.colors.mediumGray,
      align: 'center',
    });
  } else {
    slide.addChart(PptxGenJS.ChartType.line, series.map((s, i) => ({
      name: s.name,
      labels,
      values: s.values,
      color: THEME.colors.chartSeries[i % THEME.colors.chartSeries.length],
    })), {
      x: 0.4,
      y: 0.95,
      w: W - 0.8,
      h: H - 2.0,
      showLegend: true,
      legendPos: 'b',
    });
  }

  addCommentBlock(slide, comentario, H - 1.1);
}

function buildTableSlide(
  pptx: PptxGenJS,
  titulo: string,
  subtitulo: string,
  headers: string[],
  rows: string[][],
  periodo: string,
  empresaNome: string,
  comentario: string
): void {
  const slide = pptx.addSlide();
  addSlideHeader(slide, titulo, subtitulo);
  addSlideFooter(slide, periodo, empresaNome);

  if (rows.length === 0) {
    slide.addText('Dados indisponíveis para o período selecionado.', {
      x: 0.5, y: 2.0, w: W - 1, h: 1,
      fontSize: THEME.fontSizes.body,
      color: THEME.colors.mediumGray,
      align: 'center',
    });
  } else {
    const tableData = [
      headers.map((h) => ({
        text: h,
        options: {
          bold: true,
          fill: { color: THEME.colors.primary },
          color: THEME.colors.white,
          fontSize: THEME.fontSizes.tableHeader,
          fontFace: THEME.fonts.title,
        },
      })),
      ...rows.slice(0, 20).map((row, ri) =>
        row.map((cell) => ({
          text: cell,
          options: {
            fill: { color: ri % 2 === 0 ? THEME.colors.white : THEME.colors.lightGray },
            fontSize: THEME.fontSizes.tableBody,
            fontFace: THEME.fonts.body,
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

  addCommentBlock(slide, comentario, H - 1.1);
}

function buildUnavailableSlide(
  pptx: PptxGenJS,
  titulo: string,
  subtitulo: string,
  periodo: string,
  empresaNome: string
): void {
  const slide = pptx.addSlide();
  addSlideHeader(slide, titulo, subtitulo);
  addSlideFooter(slide, periodo, empresaNome);
  slide.addShape(PptxGenJS.ShapeType.rect, {
    x: 1.5, y: 2.0, w: W - 3, h: 2.0,
    fill: { color: THEME.colors.lightGray },
    line: { color: 'D0D0D0', pt: 1 },
  });
  slide.addText('⚠️ Dados não automatizados nesta V1 / Dados indisponíveis', {
    x: 1.5, y: 2.0, w: W - 3, h: 2.0,
    fontSize: 14,
    color: THEME.colors.mediumGray,
    align: 'center',
    valign: 'middle',
    fontFace: THEME.fonts.body,
  });
}

// -------------------------------------------------------
// Main export
// -------------------------------------------------------

export async function generatePresentation(
  options: GeneratePresentationOptions
): Promise<Blob> {
  const { parametros, data, comentarios, empresaNome = 'AviZee' } = options;
  const { competenciaInicial, competenciaFinal } = parametros;
  const periodo = `${formatCompetencia(competenciaInicial)} a ${formatCompetencia(competenciaFinal)}`;

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = `Fechamento Mensal — ${periodo}`;
  pptx.subject = 'Apresentação Gerencial AviZee';
  pptx.author = 'AviZee ERP';

  // Define master slide style
  pptx.defineSlideMaster({
    title: 'AVIZEE_MASTER',
    background: { color: THEME.colors.background },
  });

  // 1. Cover
  buildCoverSlide(pptx, periodo, empresaNome, getComment(comentarios, 'cover'));

  // 2. Highlights Financeiros
  buildKpiSlide(pptx, data, periodo, empresaNome, getComment(comentarios, 'highlights_financeiros'));

  // 3. Faturamento
  if (data.faturamento.length > 0) {
    const labels = data.faturamento.map((f) => f.competencia);
    buildColumnChartSlide(
      pptx,
      'Faturamento', 'Evolução mensal do faturamento',
      labels,
      [
        { name: 'Faturado (R$)', values: data.faturamento.map((f) => f.total_faturado) },
      ],
      periodo, empresaNome, getComment(comentarios, 'faturamento')
    );
  } else {
    buildUnavailableSlide(pptx, 'Faturamento', 'Evolução mensal do faturamento', periodo, empresaNome);
  }

  // 4. Despesas
  if (data.despesas.length > 0) {
    const porCat = data.despesas.reduce<Record<string, number>>((acc, d) => {
      acc[d.categoria] = (acc[d.categoria] ?? 0) + d.total_despesa;
      return acc;
    }, {});
    const sorted = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
    buildHBarChartSlide(
      pptx,
      'Despesas', 'Distribuição e evolução das despesas',
      sorted.map(([k]) => k),
      sorted.map(([, v]) => v),
      periodo, empresaNome, getComment(comentarios, 'despesas')
    );
  } else {
    buildUnavailableSlide(pptx, 'Despesas', 'Distribuição das despesas', periodo, empresaNome);
  }

  // 5. Caixa / ROL
  {
    const headers = ['Conta', 'Banco', 'Agência', 'Número', 'Saldo (R$)'];
    const rows = data.rolCaixa.map((c) => [
      c.conta_descricao,
      c.banco_nome,
      c.agencia,
      c.conta,
      formatCurrencyBR(c.saldo_atual),
    ]);
    buildTableSlide(
      pptx,
      'Caixa / ROL', 'Posição de caixa e contas bancárias',
      headers, rows,
      periodo, empresaNome, getComment(comentarios, 'rol_caixa')
    );
  }

  // 6. Receita vs Despesa
  if (data.receitaVsDespesa.length > 0) {
    const labels = data.receitaVsDespesa.map((r) => r.competencia);
    buildLineChartSlide(
      pptx,
      'Receita vs Despesa', 'Comparativo mensal',
      labels,
      [
        { name: 'Receita (R$)', values: data.receitaVsDespesa.map((r) => r.total_receita) },
        { name: 'Despesa (R$)', values: data.receitaVsDespesa.map((r) => r.total_despesa) },
        { name: 'Resultado (R$)', values: data.receitaVsDespesa.map((r) => r.resultado_bruto) },
      ],
      periodo, empresaNome, getComment(comentarios, 'receita_vs_despesa')
    );
  } else {
    buildUnavailableSlide(pptx, 'Receita vs Despesa', 'Comparativo mensal', periodo, empresaNome);
  }

  // 7. FOPAG
  {
    const headers = ['Funcionário', 'Salário Base', 'Proventos', 'Descontos', 'Líquido'];
    const rows = data.fopag.map((f) => [
      f.funcionario_nome,
      formatCurrencyBR(f.salario_base),
      formatCurrencyBR(f.proventos),
      formatCurrencyBR(f.descontos),
      formatCurrencyBR(f.valor_liquido),
    ]);
    buildTableSlide(
      pptx,
      'FOPAG', 'Folha de pagamento',
      headers, rows,
      periodo, empresaNome, getComment(comentarios, 'fopag')
    );
  }

  // 8. Fluxo de Caixa
  if (data.fluxoCaixa.length > 0) {
    const labels = data.fluxoCaixa.map((f) => f.competencia);
    buildColumnChartSlide(
      pptx,
      'Fluxo de Caixa', 'Entradas e saídas do período',
      labels,
      [
        { name: 'Entradas (R$)', values: data.fluxoCaixa.map((f) => f.total_entradas) },
        { name: 'Saídas (R$)', values: data.fluxoCaixa.map((f) => f.total_saidas) },
      ],
      periodo, empresaNome, getComment(comentarios, 'fluxo_caixa')
    );
  } else {
    buildUnavailableSlide(pptx, 'Fluxo de Caixa', 'Entradas e saídas do período', periodo, empresaNome);
  }

  // 9. Lucro por Produto e Cliente
  if (data.lucro.length > 0) {
    const topProd = topN(data.lucro, 'margem_bruta', 10);
    buildHBarChartSlide(
      pptx,
      'Lucro por Produto', 'Top produtos por margem bruta',
      topProd.map((p) => p.produto_nome),
      topProd.map((p) => p.margem_bruta),
      periodo, empresaNome, getComment(comentarios, 'lucro_produto_cliente')
    );
  } else {
    buildUnavailableSlide(pptx, 'Lucro por Produto e Cliente', 'Top produtos e clientes por margem', periodo, empresaNome);
  }

  // 10. Variação de Estoque
  {
    const headers = ['Produto', 'SKU', 'Grupo', 'Qtd', 'Custo Unit.', 'Valor Total'];
    const topEstoque = topN(data.estoque, 'valor_total', 20);
    const rows = topEstoque.map((e) => [
      e.produto_nome,
      e.produto_sku,
      e.grupo_nome,
      String(e.quantidade_atual),
      formatCurrencyBR(e.custo_unitario),
      formatCurrencyBR(e.valor_total),
    ]);
    buildTableSlide(
      pptx,
      'Variação de Estoque', 'Posição e valor do estoque (top 20)',
      headers, rows,
      periodo, empresaNome, getComment(comentarios, 'variacao_estoque')
    );
  }

  // 11. Venda por Estado
  if (data.vendaEstado.length > 0) {
    const sorted = [...data.vendaEstado].sort((a, b) => b.total_vendas - a.total_vendas);
    buildHBarChartSlide(
      pptx,
      'Venda por Estado', 'Distribuição geográfica das vendas',
      sorted.map((v) => v.estado),
      sorted.map((v) => v.total_vendas),
      periodo, empresaNome, getComment(comentarios, 'venda_estado')
    );
  } else {
    buildUnavailableSlide(pptx, 'Venda por Estado', 'Distribuição geográfica das vendas', periodo, empresaNome);
  }

  // 12. Redes Sociais
  if (data.redesSociais.length > 0) {
    const headers = ['Plataforma', 'Métrica', 'Valor'];
    const rows = data.redesSociais.map((r) => [r.plataforma, r.metrica, String(r.valor)]);
    buildTableSlide(
      pptx,
      'Redes Sociais', 'Performance nas plataformas digitais',
      headers, rows,
      periodo, empresaNome, getComment(comentarios, 'redes_sociais')
    );
  } else {
    buildUnavailableSlide(pptx, 'Redes Sociais', 'Performance nas plataformas digitais — dados não automatizados nesta V1', periodo, empresaNome);
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
