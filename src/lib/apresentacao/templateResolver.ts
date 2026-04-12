import type { ApresentacaoTemplate, SlideCodigo, SlideConfigItem } from '@/types/apresentacao';
import { APRESENTACAO_SLIDES_V2 } from './slideDefinitions';

interface TemplateConfigJson {
  slides?: Array<{ codigo: SlideCodigo; enabled?: boolean; order?: number }>;
  hiddenWhenEmpty?: boolean;
}

function defaultConfig(): SlideConfigItem[] {
  return APRESENTACAO_SLIDES_V2.map((slide) => ({
    codigo: slide.codigo,
    enabled: slide.required || !slide.optional,
    order: slide.order,
  }));
}

export function resolveSlideConfig(
  template: ApresentacaoTemplate | undefined,
  generationConfig?: SlideConfigItem[] | null,
): SlideConfigItem[] {
  const base = defaultConfig();

  const fromTemplate = (template?.config_json as TemplateConfigJson | null)?.slides;
  if (fromTemplate?.length) {
    fromTemplate.forEach((cfg) => {
      const target = base.find((b) => b.codigo === cfg.codigo);
      if (!target) return;
      if (typeof cfg.enabled === 'boolean') target.enabled = target.enabled ? true : cfg.enabled;
      if (typeof cfg.order === 'number') target.order = cfg.order;
    });
  }

  if (generationConfig?.length) {
    generationConfig.forEach((cfg) => {
      const target = base.find((b) => b.codigo === cfg.codigo);
      if (!target) return;
      target.enabled = target.enabled ? true : cfg.enabled;
      target.order = cfg.order;
    });
  }

  return base.sort((a, b) => a.order - b.order);
}

export function activeSlides(config: SlideConfigItem[]): SlideCodigo[] {
  return config.filter((c) => c.enabled).map((c) => c.codigo);
}
