import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { ReactNode, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

function hexToHslString(hex: string) {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  return `${h} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function applyLocalUiPreferences() {
  try {
    const keys = Object.keys(localStorage);
    const densityKey = keys.find((k) => k.includes(':ui_density'));
    const fontKey = keys.find((k) => k.includes(':ui_font_scale'));
    const motionKey = keys.find((k) => k.includes(':ui_reduce_motion'));

    const density = densityKey ? JSON.parse(localStorage.getItem(densityKey) || '"confortavel"') : 'confortavel';
    const fontScale = fontKey ? Number(JSON.parse(localStorage.getItem(fontKey) || '16')) : 16;
    const reduceMotion = motionKey ? Boolean(JSON.parse(localStorage.getItem(motionKey) || 'false')) : window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    document.documentElement.dataset.density = density === 'compacto' || density === 'compacta' ? 'compact' : 'comfortable';
    document.documentElement.style.setProperty('--base-font-size', `${Math.max(16, Math.min(22, fontScale))}px`);
    document.documentElement.classList.toggle('reduce-motion', reduceMotion);
  } catch {
    // noop
  }
}

function applyCorporateTheme(primary?: string | null, secondary?: string | null) {
  const primaryHsl = primary ? hexToHslString(primary) : null;
  const secondaryHsl = secondary ? hexToHslString(secondary) : null;
  if (primaryHsl) {
    document.documentElement.style.setProperty('--primary', primaryHsl);
    document.documentElement.style.setProperty('--ring', primaryHsl);
  }
  if (secondaryHsl) {
    document.documentElement.style.setProperty('--secondary', secondaryHsl);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyLocalUiPreferences();

    supabase.from('app_configuracoes')
      .select('chave, valor')
      .in('chave', ['theme_primary_color', 'theme_secondary_color'])
      .then(({ data }) => {
        const primary = data?.find((c) => c.chave === 'theme_primary_color')?.valor as string | undefined;
        const secondary = data?.find((c) => c.chave === 'theme_secondary_color')?.valor as string | undefined;
        applyCorporateTheme(primary, secondary);
      });
  }, []);

  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {children}
    </NextThemesProvider>
  );
}
