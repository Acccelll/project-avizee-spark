import type { Desenho, Forma } from '@/lib/apresentacao/fechamento/graficos';

const hex = (c?: string) => (c ? `#${c}` : 'none');

function FormaSvg({ f }: { f: Forma }) {
  switch (f.k) {
    case 'rect':
      return (
        <rect
          x={f.x} y={f.y} width={Math.max(f.w, 0)} height={Math.max(f.h, 0)} rx={f.r ?? 0}
          fill={hex(f.fill)} stroke={hex(f.stroke)} strokeDasharray={f.dash ? '3 2' : undefined}
        />
      );
    case 'text':
      return (
        <text
          x={f.x} y={f.y} fontSize={f.size} fill={hex(f.color)} fontWeight={f.bold ? 700 : 400}
          textAnchor={f.anchor ?? 'start'}
        >
          {f.t}
        </text>
      );
    case 'line':
      return <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke={hex(f.color)} strokeWidth={f.width} strokeDasharray={f.dash ? '5 3' : undefined} />;
    case 'poly': {
      const pts = f.pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
      return f.fill
        ? <polygon points={pts} fill={hex(f.fill)} fillOpacity={f.opacity ?? 1} stroke={hex(f.stroke)} strokeWidth={f.width} />
        : <polyline points={pts} fill="none" stroke={hex(f.stroke)} strokeWidth={f.width ?? 1} strokeLinejoin="round" />;
    }
    case 'path': {
      const d = f.aneis.map((r) => `M${r.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`).join('');
      return (
        <path d={d} fill={hex(f.fill)} stroke={hex(f.stroke)} strokeWidth={f.width} strokeLinejoin="round">
          {f.titulo ? <title>{f.titulo}</title> : null}
        </path>
      );
    }
  }
}

/** Desenha as formas do gráfico em SVG, na mesma escala do .pptx. */
export function DesenhoSvg({ desenho, className }: { desenho: Desenho; className?: string }) {
  return (
    <svg viewBox={`0 0 ${desenho.w} ${desenho.h}`} preserveAspectRatio="xMinYMid meet" className={className} role="img" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      {desenho.formas.map((f, i) => <FormaSvg key={i} f={f} />)}
    </svg>
  );
}
