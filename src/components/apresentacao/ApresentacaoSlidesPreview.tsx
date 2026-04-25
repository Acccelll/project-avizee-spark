import type { SlideCodigo } from '@/types/apresentacao';
import { APRESENTACAO_SLIDES_V2, SECAO_LABELS, SECAO_ORDEM, type SlideSecao } from '@/lib/apresentacao/slideDefinitions';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  LineChart,
  PieChart,
  Table as TableIcon,
  LayoutGrid,
  TrendingUp,
  Layers,
  AlignLeft,
  FileText,
} from 'lucide-react';

type ChartType = 'coluna' | 'linha' | 'barra_horizontal' | 'donut' | 'tabela' | 'cards' | 'texto' | 'waterfall' | 'stacked';

const CHART_ICON: Record<ChartType, typeof BarChart3> = {
  coluna: BarChart3,
  linha: LineChart,
  barra_horizontal: AlignLeft,
  donut: PieChart,
  tabela: TableIcon,
  cards: LayoutGrid,
  texto: FileText,
  waterfall: TrendingUp,
  stacked: Layers,
};

const CHART_LABEL: Record<ChartType, string> = {
  coluna: 'Coluna',
  linha: 'Linha',
  barra_horizontal: 'Barra horizontal',
  donut: 'Donut',
  tabela: 'Tabela',
  cards: 'Cards',
  texto: 'Texto',
  waterfall: 'Waterfall',
  stacked: 'Empilhado',
};

const SECAO_ACCENT: Record<SlideSecao, string> = {
  capa: 'bg-slate-500',
  financeiro: 'bg-blue-600',
  pessoas: 'bg-amber-600',
  comercial: 'bg-emerald-600',
  operacoes: 'bg-purple-600',
  risco: 'bg-rose-600',
  marketing: 'bg-pink-600',
  encerramento: 'bg-slate-600',
};

function MiniThumb({ chartType, accentClass }: { chartType: ChartType; accentClass: string }) {
  const Icon = CHART_ICON[chartType] ?? FileText;
  return (
    <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded border bg-card">
      <div className={`absolute inset-x-0 top-0 h-1.5 ${accentClass}`} />
      <div className="absolute inset-0 flex items-center justify-center">
        <Icon className="h-7 w-7 text-muted-foreground/70" />
      </div>
    </div>
  );
}

export function ApresentacaoSlidesPreview({
  activeSlides,
  dataAvailability,
}: {
  activeSlides?: SlideCodigo[];
  dataAvailability?: Partial<Record<SlideCodigo, boolean>>;
}) {
  const slides = APRESENTACAO_SLIDES_V2
    .filter((slide) => !activeSlides || activeSlides.includes(slide.codigo))
    .sort((a, b) => a.order - b.order);

  const grouped = SECAO_ORDEM
    .map((secao) => ({ secao, items: slides.filter((s) => s.secao === secao) }))
    .filter((g) => g.items.length > 0);

  const total = slides.length;
  const comDados = slides.filter((s) => dataAvailability?.[s.codigo] === true).length;
  const semDados = slides.filter((s) => dataAvailability?.[s.codigo] === false).length;
  const aguardando = total - comDados - semDados;

  let runningIndex = 0;
  return (
    <div className="space-y-4">
      {dataAvailability && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2 text-xs">
          <span className="font-medium">Cobertura:</span>
          <Badge variant="secondary">{comDados}/{total} com dados</Badge>
          {semDados > 0 && <Badge variant="outline">{semDados} indisponíveis</Badge>}
          {aguardando > 0 && <Badge variant="outline">{aguardando} aguardando</Badge>}
        </div>
      )}

      {grouped.map(({ secao, items }) => (
        <section key={secao}>
          <header className="flex items-baseline justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${SECAO_ACCENT[secao as SlideSecao]}`} />
              <h4 className="text-sm font-semibold">{SECAO_LABELS[secao as SlideSecao]}</h4>
            </div>
            <span className="text-xs text-muted-foreground">{items.length} slide(s)</span>
          </header>
          <div className="grid gap-2 md:grid-cols-2">
            {items.map((slide) => {
              runningIndex += 1;
              const hasData = dataAvailability?.[slide.codigo];
              const chartType = slide.chartType as ChartType;
              return (
                <div key={slide.codigo} className="flex gap-3 rounded-md border p-3 transition-colors hover:bg-accent/30">
                  <MiniThumb chartType={chartType} accentClass={SECAO_ACCENT[slide.secao]} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">Slide {runningIndex}</p>
                      <Badge variant="outline" className="h-5 text-[10px] font-normal">{CHART_LABEL[chartType]}</Badge>
                    </div>
                    <p className="truncate font-medium text-sm">{slide.titulo}</p>
                    <p className="truncate text-xs text-muted-foreground">{slide.subtitulo}</p>
                    <div className="mt-1">
                      {hasData === undefined ? (
                        <span className="text-xs text-muted-foreground">Aguardando dados</span>
                      ) : hasData ? (
                        <Badge variant="secondary" className="h-5 text-[10px]">Dados disponíveis</Badge>
                      ) : (
                        <Badge variant="outline" className="h-5 text-[10px] text-amber-700 border-amber-300">Indisponível nesta fase</Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
