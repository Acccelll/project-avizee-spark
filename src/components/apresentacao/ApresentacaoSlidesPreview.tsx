import type { SlideCodigo } from '@/types/apresentacao';
import { APRESENTACAO_SLIDES_V2 } from '@/lib/apresentacao/slideDefinitions';

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

  return (
    <div className="grid gap-2 md:grid-cols-2">
      {slides.map((slide, index) => {
        const hasData = dataAvailability?.[slide.codigo];
        return (
          <div key={slide.codigo} className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Slide {index + 1} · {slide.chartType}</p>
            <p className="font-medium text-sm">{slide.titulo}</p>
            <p className="text-xs text-muted-foreground">{slide.subtitulo}</p>
            <p className="text-xs mt-1">
              {hasData === undefined ? 'Aguardando dados' : hasData ? 'Dados disponíveis' : 'Não automatizado nesta fase'}
            </p>
          </div>
        );
      })}
    </div>
  );
}
