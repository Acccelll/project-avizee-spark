import { BarChart3, FileText, PieChart, Table2, TrendingUp, LayoutGrid, AlertTriangle, Lock, Settings2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SLIDE_DEFINITIONS } from '@/lib/apresentacao/slideDefinitions';
import type { ApresentacaoComentario, ApresentacaoRawData, SlideChartType } from '@/types/apresentacao';

const CHART_ICON: Record<SlideChartType, React.ElementType> = {
  coluna: BarChart3,
  linha: TrendingUp,
  barra_horizontal: BarChart3,
  pizza: PieChart,
  donut: PieChart,
  tabela: Table2,
  kpi_card: LayoutGrid,
  waterfall: BarChart3,
  none: FileText,
};

interface ApresentacaoSlidesPreviewProps {
  /** Codigos of slides to show. If omitted, shows all default slides. */
  slideCodigosAtivos?: string[];
  /** Raw data used to determine data availability per slide. */
  data?: ApresentacaoRawData;
  /** Persisted comments for the selected generation. */
  comentarios?: ApresentacaoComentario[];
}

export function ApresentacaoSlidesPreview({
  slideCodigosAtivos,
  data,
  comentarios = [],
}: ApresentacaoSlidesPreviewProps) {
  const slides = slideCodigosAtivos
    ? SLIDE_DEFINITIONS.filter((s) => slideCodigosAtivos.includes(s.codigo))
    : SLIDE_DEFINITIONS.filter((s) => !s.optional);

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-100 border border-green-300" /> Dados disponíveis</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-100 border border-amber-300" /> Dados parciais / não automatizados</span>
        <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-500" /> Requer configuração</span>
        <span className="flex items-center gap-1"><Lock className="h-3 w-3 text-muted-foreground" /> Obrigatório</span>
        <span className="flex items-center gap-1"><Settings2 className="h-3 w-3 text-muted-foreground" /> Opcional (V2)</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {slides.map((slide, idx) => {
          const Icon = CHART_ICON[slide.chartType] ?? FileText;

          // Determine data availability
          const hasData = data
            ? slide.dependencias.every((dep) => {
                const arr = data[dep];
                return Array.isArray(arr) && arr.length > 0;
              })
            : true; // unknown → optimistic

          const needsConfig = Boolean(slide.notaAutomacao);
          const isV2 = slide.fase === 'v2';
          const isRequired = slide.required;

          // Comment for this slide
          const comentario = comentarios.find((c) => c.slide_codigo === slide.codigo);
          const hasEditedComment = Boolean(comentario?.comentario_editado?.trim());
          const highPriority = (comentario?.prioridade ?? 1) >= 3;

          let borderCls = 'border-border';
          let bgCls = 'bg-card';
          if (needsConfig) {
            borderCls = 'border-amber-300';
            bgCls = 'bg-amber-50/50 dark:bg-amber-950/20';
          } else if (data && hasData) {
            borderCls = 'border-green-300';
            bgCls = 'bg-green-50/50 dark:bg-green-950/20';
          } else if (data && !hasData) {
            borderCls = 'border-muted';
            bgCls = 'bg-muted/30';
          }

          return (
            <div
              key={slide.codigo}
              className={`flex flex-col rounded-lg border ${borderCls} ${bgCls} p-3 text-center transition`}
              title={slide.notaAutomacao ?? slide.subtitulo}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div className="flex gap-1">
                  {isRequired && <Lock className="h-3 w-3 text-muted-foreground" aria-label="Slide obrigatório" />}
                  {isV2 && !isRequired && <Settings2 className="h-3 w-3 text-muted-foreground" aria-label="Slide V2 opcional" />}
                  {needsConfig && <AlertTriangle className="h-3 w-3 text-amber-500" aria-label="Requer configuração" />}
                  {highPriority && <span className="text-[10px] text-red-500 font-bold" title="Prioridade alta">!</span>}
                </div>
              </div>

              <Icon className="mx-auto mb-1.5 h-5 w-5 text-primary" aria-hidden="true" />
              <p className="text-xs font-medium leading-tight">{slide.titulo}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground leading-tight line-clamp-1">
                {slide.subtitulo}
              </p>

              {/* Comment snippet */}
              {comentario && (
                <div className="mt-1.5 border-t border-border pt-1">
                  <p className="text-[9px] text-muted-foreground leading-tight line-clamp-2 italic text-left">
                    {(comentario.comentario_editado ?? comentario.comentario_automatico ?? '').slice(0, 80)}…
                  </p>
                  {hasEditedComment && (
                    <Badge variant="outline" className="mt-0.5 text-[9px] px-1 py-0">
                      Editado
                    </Badge>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
