/**
 * Template config helpers for Apresentação Gerencial.
 *
 * resolveTheme  — merges THEME defaults with config_json overrides.
 * resolveSlides — builds the ordered, filtered slide list from config_json.
 * buildDefaultConfig — constructs a TemplateConfig matching the current defaults.
 * validateTemplateConfig — basic structural validation.
 */
import type {
  TemplateConfig,
  TemplateThemeConfig,
  TemplateSlideConfig,
  ResolvedTheme,
  ResolvedSlide,
} from '@/types/apresentacao';
import { THEME } from './theme';
import { SLIDE_DEFINITIONS } from './slideDefinitions';

// ---------------------------------------------------------------------------
// resolveTheme
// ---------------------------------------------------------------------------

/**
 * Merges THEME defaults with optional overrides coming from config_json.theme.
 * Unknown/invalid hex codes are silently ignored and the default is kept.
 *
 * @returns A complete ResolvedTheme with all fields populated from THEME defaults
 *          merged with any valid overrides from the provided config.
 */
export function resolveTheme(config: TemplateConfig | null | undefined): ResolvedTheme {
  const themeOverrides: TemplateThemeConfig = config?.theme ?? {};

  // Only 6-char hex values (without #) are accepted as color overrides.
  function safeColor(override: string | undefined, fallback: string): string {
    if (!override) return fallback;
    return /^[0-9A-Fa-f]{6}$/.test(override) ? override : fallback;
  }

  return {
    colors: {
      primary: safeColor(themeOverrides.primaryColor, THEME.colors.primary),
      secondary: safeColor(themeOverrides.secondaryColor, THEME.colors.secondary),
      accent: safeColor(themeOverrides.accentColor, THEME.colors.accent),
      success: THEME.colors.success,
      danger: THEME.colors.danger,
      warning: THEME.colors.warning,
      white: THEME.colors.white,
      lightGray: THEME.colors.lightGray,
      darkGray: THEME.colors.darkGray,
      mediumGray: THEME.colors.mediumGray,
      background: THEME.colors.background,
      chartSeries: [...THEME.colors.chartSeries],
    },
    fonts: {
      title: themeOverrides.fontTitle?.trim() || THEME.fonts.title,
      body: themeOverrides.fontBody?.trim() || THEME.fonts.body,
      mono: THEME.fonts.mono,
    },
    fontSizes: { ...THEME.fontSizes },
    slide: { ...THEME.slide },
    logoUrl: themeOverrides.logoUrl ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// resolveSlides
// ---------------------------------------------------------------------------

/**
 * Returns the ordered list of slides to include in the presentation.
 *
 * Rules:
 * 1. Starts from SLIDE_DEFINITIONS (the full catalogue).
 * 2. For each slide, checks if config_json.slides has an entry for it.
 * 3. If found: uses ativo/ordem/tituloCustom/subtituloCustom from the entry.
 * 4. If not found: defaults to ativo=true and keeps the catalogue defaults.
 * 5. Result is sorted by `ordem` ascending.
 */
export function resolveSlides(config: TemplateConfig | null | undefined): ResolvedSlide[] {
  const overrideMap = new Map<string, TemplateSlideConfig>();
  if (config?.slides) {
    config.slides.forEach((s) => overrideMap.set(s.codigo, s));
  }

  const resolved: ResolvedSlide[] = SLIDE_DEFINITIONS.map((def, index) => {
    const override = overrideMap.get(def.codigo);
    return {
      codigo: def.codigo,
      ativo: override?.ativo ?? true,
      ordem: override?.ordem ?? index,
      titulo: override?.tituloCustom?.trim() || def.titulo,
      subtitulo: override?.subtituloCustom?.trim() || def.subtitulo,
    };
  });

  return resolved.sort((a, b) => a.ordem - b.ordem);
}

// ---------------------------------------------------------------------------
// buildDefaultConfig
// ---------------------------------------------------------------------------

/**
 * Returns a TemplateConfig that explicitly encodes the current defaults.
 * Useful as a starting point when creating a new template from scratch.
 */
export function buildDefaultConfig(): TemplateConfig {
  return {
    version: '1.0',
    theme: {
      primaryColor: THEME.colors.primary,
      secondaryColor: THEME.colors.secondary,
      accentColor: THEME.colors.accent,
      fontTitle: THEME.fonts.title,
      fontBody: THEME.fonts.body,
    },
    slides: SLIDE_DEFINITIONS.map((def, index) => ({
      codigo: def.codigo,
      ativo: true,
      ordem: index,
    })),
  };
}

// ---------------------------------------------------------------------------
// validateTemplateConfig
// ---------------------------------------------------------------------------

export interface TemplateConfigValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Basic structural validation of a TemplateConfig object.
 * Returns { valid, errors } — does NOT throw.
 */
export function validateTemplateConfig(
  config: unknown
): TemplateConfigValidationResult {
  const errors: string[] = [];

  if (config === null || config === undefined) {
    return { valid: true, errors: [] };
  }

  if (typeof config !== 'object' || Array.isArray(config)) {
    errors.push('config_json must be an object or null.');
    return { valid: false, errors };
  }

  const c = config as Record<string, unknown>;

  if (c['version'] !== '1.0') {
    errors.push(`Unsupported config_json version: "${String(c['version'])}". Expected "1.0".`);
  }

  if (c['theme'] !== undefined && c['theme'] !== null) {
    if (typeof c['theme'] !== 'object' || Array.isArray(c['theme'])) {
      errors.push('config_json.theme must be an object.');
    } else {
      const theme = c['theme'] as Record<string, unknown>;
      for (const colorField of ['primaryColor', 'secondaryColor', 'accentColor']) {
        const val = theme[colorField];
        if (val !== undefined && val !== null) {
          if (typeof val !== 'string' || !/^[0-9A-Fa-f]{6}$/.test(val as string)) {
            errors.push(`config_json.theme.${colorField} must be a 6-char hex string (e.g. "1F3864").`);
          }
        }
      }
    }
  }

  if (c['slides'] !== undefined && c['slides'] !== null) {
    if (!Array.isArray(c['slides'])) {
      errors.push('config_json.slides must be an array.');
    } else {
      const knownCodes = new Set(SLIDE_DEFINITIONS.map((s) => s.codigo));
      (c['slides'] as unknown[]).forEach((entry, i) => {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
          errors.push(`config_json.slides[${i}] must be an object.`);
          return;
        }
        const s = entry as Record<string, unknown>;
        if (typeof s['codigo'] !== 'string') {
          errors.push(`config_json.slides[${i}].codigo must be a string.`);
        } else if (!knownCodes.has(s['codigo'] as string)) {
          errors.push(
            `config_json.slides[${i}].codigo "${s['codigo']}" is not a recognised slide code.`
          );
        }
        if (typeof s['ativo'] !== 'boolean') {
          errors.push(`config_json.slides[${i}].ativo must be a boolean.`);
        }
        if (typeof s['ordem'] !== 'number') {
          errors.push(`config_json.slides[${i}].ordem must be a number.`);
        }
      });
    }
  }

  return { valid: errors.length === 0, errors };
}
