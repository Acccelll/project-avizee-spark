import { BarChart3, FileText, PieChart, Table2, TrendingUp, LayoutGrid } from 'lucide-react';
import { SLIDE_DEFINITIONS } from '@/lib/apresentacao/slideDefinitions';
import type { SlideChartType } from '@/types/apresentacao';

const CHART_ICON: Record<SlideChartType, React.ElementType> = {
  coluna: BarChart3,
  linha: TrendingUp,
  barra_horizontal: BarChart3,
  pizza: PieChart,
  donut: PieChart,
  tabela: Table2,
  kpi_card: LayoutGrid,
  none: FileText,
};

interface ApresentacaoSlidesPreviewProps {
  slideCodigosAtivos?: string[];
}

export function ApresentacaoSlidesPreview({
  slideCodigosAtivos,
}: ApresentacaoSlidesPreviewProps) {
  const slides = slideCodigosAtivos
    ? SLIDE_DEFINITIONS.filter((s) => slideCodigosAtivos.includes(s.codigo))
    : SLIDE_DEFINITIONS;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {slides.map((slide, idx) => {
        const Icon = CHART_ICON[slide.chartType] ?? FileText;
        return (
          <div
            key={slide.codigo}
            className="flex flex-col items-center rounded-lg border border-border bg-card p-3 text-center transition hover:border-primary/40"
          >
            <span className="mb-1 text-xs font-semibold text-muted-foreground">
              {String(idx + 1).padStart(2, '0')}
            </span>
            <Icon className="mb-1.5 h-5 w-5 text-primary" aria-hidden="true" />
            <p className="text-xs font-medium leading-tight">{slide.titulo}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground leading-tight">
              {slide.subtitulo}
            </p>
          </div>
        );
      })}
    </div>
  );
}
