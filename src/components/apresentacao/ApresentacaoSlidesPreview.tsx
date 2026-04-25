import type { SlideCodigo } from '@/types/apresentacao';
import { APRESENTACAO_SLIDES_V2, SECAO_LABELS, SECAO_ORDEM, type SlideSecao } from '@/lib/apresentacao/slideDefinitions';

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

  let runningIndex = 0;
  return (
    <div className="space-y-4">
      {grouped.map(({ secao, items }) => (
        <section key={secao}>
          <header className="flex items-baseline justify-between mb-2">
            <h4 className="text-sm font-semibold">{SECAO_LABELS[secao as SlideSecao]}</h4>
            <span className="text-xs text-muted-foreground">{items.length} slide(s)</span>
          </header>
          <div className="grid gap-2 md:grid-cols-2">
            {items.map((slide) => {
              runningIndex += 1;
              const hasData = dataAvailability?.[slide.codigo];
              return (
                <div key={slide.codigo} className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Slide {runningIndex} · {slide.chartType}</p>
                  <p className="font-medium text-sm">{slide.titulo}</p>
                  <p className="text-xs text-muted-foreground">{slide.subtitulo}</p>
                  <p className="text-xs mt-1">
                    {hasData === undefined ? 'Aguardando dados' : hasData ? 'Dados disponíveis' : 'Não automatizado nesta fase'}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
