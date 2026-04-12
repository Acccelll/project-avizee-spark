import pptxgen from 'pptxgenjs';
import type { ApresentacaoData, ApresentacaoParametros, ApresentacaoComentario } from '@/types/apresentacao';
import { getTheme } from './theme';
import { SLIDE_DEFINITIONS } from './slideDefinitions';

export async function generatePresentation(
  data: ApresentacaoData,
  params: ApresentacaoParametros,
  comentarios: ApresentacaoComentario[],
  templateConfig?: Record<string, any>
): Promise<Blob> {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';

  const theme = getTheme(templateConfig);

  // Configuração Global de Design
  const addSlideHeader = (slide: any, title: string) => {
    slide.addText(title, {
      x: 0.5, y: 0.3, w: '90%', h: 0.5,
      fontSize: 24,
      color: theme.colors.primary,
      bold: true,
      fontFace: theme.fonts.heading
    });
    slide.addShape(pres.ShapeType.rect, {
      x: 0.5, y: 0.8, w: '90%', h: 0.02,
      fill: { color: theme.colors.primary }
    });
  };

  const addCommentBox = (slide: any, slideCodigo: string) => {
    const comentario = comentarios.find(c => c.slide_codigo === slideCodigo);
    const texto = comentario?.comentario_editado || comentario?.comentario_automatico || '';

    slide.addShape(pres.ShapeType.rect, {
      x: 0.5, y: 4.5, w: '90%', h: 1.0,
      fill: { color: 'F5F5F5' },
      line: { color: 'E0E0E0', width: 1 }
    });

    slide.addText('Comentários Executivos:', {
      x: 0.6, y: 4.6, w: 3, h: 0.3,
      fontSize: 10,
      bold: true,
      color: theme.colors.primary
    });

    slide.addText(texto, {
      x: 0.6, y: 4.9, w: '85%', h: 0.5,
      fontSize: 11,
      color: theme.colors.text,
      italic: !comentario?.comentario_editado
    });
  };

  // 1. Capa
  const coverSlide = pres.addSlide();
  coverSlide.background = { color: theme.colors.primary };
  coverSlide.addText('APRESENTAÇÃO GERENCIAL', {
    x: 1, y: 2, w: '80%', h: 1,
    fontSize: 44,
    color: 'FFFFFF',
    bold: true,
    align: 'center'
  });
  coverSlide.addText(`Período: ${params.competenciaInicial} a ${params.competenciaFinal}`, {
    x: 1, y: 3.2, w: '80%', h: 0.5,
    fontSize: 20,
    color: 'FFFFFF',
    align: 'center'
  });
  coverSlide.addText('ERP AviZee', {
    x: 1, y: 5, w: '80%', h: 0.5,
    fontSize: 14,
    color: 'FFFFFF',
    align: 'center'
  });

  // 2. Percorrer definições de slides
  for (const def of SLIDE_DEFINITIONS) {
    if (def.codigo === 'cover') continue;
    if (params.slidesSelecionados.length > 0 && !params.slidesSelecionados.includes(def.codigo)) continue;

    const slide = pres.addSlide();
    addSlideHeader(slide, def.titulo);

    const dataset = (data as any)[def.dataset] || [];

    if (dataset.length === 0) {
      slide.addText('Dados não automatizados nesta Fase ou dados indisponíveis.', {
        x: 1, y: 2, w: '80%', h: 1,
        fontSize: 18,
        color: theme.colors.neutral,
        align: 'center'
      });
    } else {
      // Diferenciação visual para Fase 2
      if (def.codigo === 'bridge_ebitda') {
        // Waterfall simulado (Chart support in pptxgenjs)
        slide.addChart(pres.ChartType.bar, [
          { name: 'Valor', labels: dataset.map((d: any) => d.linha), values: dataset.map((d: any) => d.valor) }
        ], { x: 0.5, y: 1.2, w: '90%', h: 3, showLegend: false, showTitle: false });
      } else if (def.codigo === 'dre_gerencial' || def.codigo === 'balanco_gerencial') {
        // Tabela formatada
        const headers = ['Descrição', 'Valor'];
        const rows = dataset.map((row: any) => [
          row.linha || row.conta || row.grupo,
          new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.valor || 0)
        ]);
        slide.addTable([headers, ...rows], {
          x: 0.5, y: 1.2, w: '90%',
          fontSize: 10,
          border: { type: 'solid', color: 'E0E0E0' },
          fill: { color: 'FFFFFF' },
          headerRow: true
        });
      } else if (def.codigo === 'aging_consolidado' || def.codigo === 'inadimplencia') {
        slide.addChart(pres.ChartType.bar, [
          { name: 'Saldo', labels: dataset.map((d: any) => d.faixa_aging), values: dataset.map((d: any) => d.valor || d.valor_total) }
        ], { x: 0.5, y: 1.2, w: '90%', h: 3, showLegend: true });
      } else {
        // Fallback para tabelas simples
        const rows = dataset.slice(-10).map((row: any) => {
          return Object.values(row).map((v) => {
             if (typeof v === 'number') return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(v);
             return String(v);
          });
        });

        const headers = Object.keys(dataset[0]);
        slide.addTable([headers, ...rows], {
          x: 0.5, y: 1.2, w: '90%',
          fontSize: 9,
          border: { type: 'solid', color: 'E0E0E0' },
          fill: { color: 'FFFFFF' },
          headerRow: true
        });
      }
    }

    addCommentBox(slide, def.codigo);
  }

  // 3. Slide de Encerramento
  const endSlide = pres.addSlide();
  endSlide.background = { color: theme.colors.primary };
  endSlide.addText('OBRIGADO!', {
    x: 1, y: 2.5, w: '80%', h: 1,
    fontSize: 44,
    color: 'FFFFFF',
    bold: true,
    align: 'center'
  });
  endSlide.addText('www.avizee.com.br', {
    x: 1, y: 3.5, w: '80%', h: 0.5,
    fontSize: 14,
    color: 'FFFFFF',
    align: 'center'
  });

  // Exportar como Blob
  const buffer = await pres.write({ outputType: 'blob' }) as Blob;
  return buffer;
}
