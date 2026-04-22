import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from 'next-themes';

/**
 * RemoteUiPreferencesHydrator
 *
 * Após o login, busca as preferências de UI persistidas em `user_preferences`
 * (tema, densidade, tamanho de fonte, reduzir movimento) e aplica ao DOM.
 *
 * Garante consistência cross-device: o `ThemeProvider` continua aplicando os
 * defaults locais (`localStorage`) imediatamente para evitar flash, mas assim
 * que a sessão estiver disponível, o valor remoto sobrescreve o local —
 * resolvendo o caso "navegador novo / outro dispositivo" em que `localStorage`
 * estava vazio ou desatualizado.
 *
 * Roda apenas uma vez por sessão (controlado por `appliedRef`).
 */

const KEYS = ['ui_theme', 'ui_density', 'ui_font_scale', 'ui_reduce_motion'] as const;

function applyDensity(value: unknown) {
  const v = typeof value === 'string' ? value : 'confortavel';
  document.documentElement.dataset.density =
    v === 'compacto' || v === 'compacta' ? 'compact' : 'comfortable';
}

function applyFontScale(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(n)) {
    document.documentElement.style.setProperty(
      '--base-font-size',
      `${Math.max(16, Math.min(22, n))}px`,
    );
  }
}

function applyReduceMotion(value: unknown) {
  document.documentElement.classList.toggle('reduce-motion', Boolean(value));
}

export function RemoteUiPreferencesHydrator() {
  const { user } = useAuth();
  const { setTheme } = useTheme();
  const appliedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user || !supabase) return;
    if (appliedRef.current === user.id) return;
    appliedRef.current = user.id;

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('module_key, columns_config')
        .eq('user_id', user.id)
        .in('module_key', KEYS as unknown as string[]);

      if (cancelled || error || !data) return;

      const map = new Map<string, unknown>();
      for (const row of data) {
        map.set(
          (row as { module_key: string }).module_key,
          (row as { columns_config: unknown }).columns_config,
        );
      }

      if (map.has('ui_theme')) {
        const t = map.get('ui_theme');
        if (typeof t === 'string') setTheme(t);
      }
      if (map.has('ui_density')) applyDensity(map.get('ui_density'));
      if (map.has('ui_font_scale')) applyFontScale(map.get('ui_font_scale'));
      if (map.has('ui_reduce_motion')) applyReduceMotion(map.get('ui_reduce_motion'));
    })();

    return () => {
      cancelled = true;
    };
  }, [user, setTheme]);

  return null;
}