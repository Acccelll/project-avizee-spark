import { APRESENTACAO_SLIDES_V1 } from '@/lib/apresentacao/slideDefinitions';

export function ApresentacaoSlidesPreview() {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {APRESENTACAO_SLIDES_V1.map((slide, index) => (
        <div key={slide.codigo} className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Slide {index + 1} · {slide.chartType}</p>
          <p className="font-medium text-sm">{slide.titulo}</p>
          <p className="text-xs text-muted-foreground">{slide.subtitulo}</p>
        </div>
      ))}
    </div>
  );
}
