/**
 * WCAG contrast utilities. Pure math, no I/O.
 * Use anywhere a contrast ratio against a background is needed
 * (e.g. theme color validation, dev contrast audits).
 */

export const MIN_CONTRAST_AA = 4.5;
export const MIN_CONTRAST_AA_LARGE = 3;

/** Parse a CSS color string ("rgb(...)", "rgba(...)" or "#rrggbb") into [r,g,b]. */
export function parseRgb(color: string): [number, number, number] | null {
  if (!color) return null;
  const trimmed = color.trim();

  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
    if (full.length !== 6) return null;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    if ([r, g, b].some((v) => Number.isNaN(v))) return null;
    return [r, g, b];
  }

  const matched = trimmed.match(/\d+(\.\d+)?/g);
  if (!matched || matched.length < 3) return null;
  return [Number(matched[0]), Number(matched[1]), Number(matched[2])];
}

/** Relative luminance per WCAG 2.x. */
export function luminance([r, g, b]: [number, number, number]) {
  const [rs, gs, bs] = [r, g, b].map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** Returns the WCAG contrast ratio between two CSS colors, or null if either color cannot be parsed. */
export function contrastRatio(foreground: string, background: string): number | null {
  const fg = parseRgb(foreground);
  const bg = parseRgb(background);
  if (!fg || !bg) return null;
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Convenience: ratio against white and black, plus best contender. */
export function contrastAgainstBaselines(color: string) {
  const white = contrastRatio(color, "#ffffff");
  const black = contrastRatio(color, "#000000");
  if (white === null || black === null) return null;
  return {
    white,
    black,
    bestPair: white >= black ? ("white" as const) : ("black" as const),
    bestRatio: Math.max(white, black),
    passesAA: Math.max(white, black) >= MIN_CONTRAST_AA,
  };
}
