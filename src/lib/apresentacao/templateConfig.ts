import type { SlideCodigo, SlideConfigItem } from '@/types/apresentacao';
import { APRESENTACAO_SLIDES_V2 } from './slideDefinitions';

export interface TemplateThemeConfig {
  palette?: string;
  logoUrl?: string;
  accentColor?: string;
}

interface RawTemplateConfig {
  slides?: unknown;
  theme?: TemplateThemeConfig;
}

function isSlideCode(value: string): value is SlideCodigo {
  return APRESENTACAO_SLIDES_V2.some((s) => s.codigo === value);
}

export function normalizeTemplateSlides(input: unknown): SlideConfigItem[] {
  if (!Array.isArray(input)) return [];

  const normalized: SlideConfigItem[] = [];
  for (const row of input) {
    if (!row || typeof row !== 'object') continue;
    const codigo = String((row as Record<string, unknown>).codigo ?? '');
    if (!codigo || !isSlideCode(codigo)) continue;
    normalized.push({
      codigo,
      enabled: Boolean((row as Record<string, unknown>).enabled),
      order: Number((row as Record<string, unknown>).order ?? 999),
    });
  }
  return normalized;
}

export function parseTemplateConfig(configJson: Record<string, unknown> | null | undefined): {
  slides: SlideConfigItem[];
  theme: TemplateThemeConfig;
} {
  const raw = (configJson ?? {}) as RawTemplateConfig;
  return {
    slides: normalizeTemplateSlides(raw.slides),
    theme: {
      palette: raw.theme?.palette ?? 'default',
      logoUrl: raw.theme?.logoUrl,
      accentColor: raw.theme?.accentColor,
    },
  };
}

export function buildDefaultTemplateConfig(): { slides: SlideConfigItem[]; theme: TemplateThemeConfig } {
  return {
    slides: APRESENTACAO_SLIDES_V2.map((s) => ({
      codigo: s.codigo,
      enabled: s.required || !s.optional,
      order: s.order,
    })),
    theme: { palette: 'default' },
  };
}
