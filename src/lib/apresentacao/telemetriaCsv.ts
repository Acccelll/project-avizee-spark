import { APRESENTACAO_SLIDES_MAP } from './slideDefinitions';

export interface SlideUsoRow {
  slide_codigo: string;
  total_selecionado: number;
  total_desselecionado: number;
  total_gerado: number;
  ultimo_uso_em: string | null;
}

/**
 * Gera o conteúdo CSV (string) para a telemetria de uso de slides.
 * Usa `;` como separador (compatível com Excel pt-BR) e adiciona BOM ao montar o Blob.
 */
export function buildTelemetriaCsv(rows: SlideUsoRow[]): string {
  const header = ['slide_codigo', 'titulo', 'total_selecionado', 'total_desselecionado', 'total_gerado', 'ultimo_uso_em'];
  const data = rows.map((s) => [
    s.slide_codigo,
    APRESENTACAO_SLIDES_MAP.get(s.slide_codigo as never)?.titulo ?? s.slide_codigo,
    s.total_selecionado,
    s.total_desselecionado,
    s.total_gerado,
    s.ultimo_uso_em ?? '',
  ]);
  return [header, ...data]
    .map((r) =>
      r
        .map((cell) => {
          const v = String(cell ?? '');
          return /[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        })
        .join(';'),
    )
    .join('\n');
}