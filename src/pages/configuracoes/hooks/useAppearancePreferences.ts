import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPreference } from '@/hooks/useUserPreference';
import { useAppConfigContext } from '@/contexts/AppConfigContext';
import { APPEARANCE_DEFAULTS } from '../utils/passwordPolicy';

/**
 * Centraliza todas as preferências de aparência pessoais:
 * - tema, densidade, escala de fonte, redução de movimento
 * - sessão (keepalive, aviso antes de expirar)
 * - modo do menu lateral (com derivação automática do boolean legado)
 * - reset em lote com `Promise.allSettled`
 */
export function useAppearancePreferences() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [densidade, setDensidade] = useState('confortavel');
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const { saveSidebarCollapsed: saveMenuCompacto, sidebarMode, saveSidebarMode } = useAppConfigContext();
  const { value: themePref, save: saveThemePref } = useUserPreference<string>(user?.id, 'ui_theme', 'system');
  const { value: densidadePref, save: saveDensidadePref } = useUserPreference<string>(user?.id, 'ui_density', 'confortavel');
  const { value: fontScale, save: saveFontScale } = useUserPreference<number>(user?.id, 'ui_font_scale', 16);
  const { value: reduceMotion, save: saveReduceMotion } = useUserPreference<boolean>(user?.id, 'ui_reduce_motion', false);
  const { value: sessionKeepalive, save: saveSessionKeepalive } = useUserPreference<boolean>(user?.id, 'session_keepalive', false);
  const { value: sessionWarnMinutes, save: saveSessionWarnMinutes } = useUserPreference<number>(user?.id, 'session_warn_minutes', 5);

  useEffect(() => {
    if (densidadePref) setDensidade(densidadePref);
  }, [densidadePref]);

  useEffect(() => {
    if (themePref && theme !== themePref) setTheme(themePref);
  }, [themePref, theme, setTheme]);

  const markSaved = () => setSavedAt(new Date());

  const reset = async () => {
    setTheme(APPEARANCE_DEFAULTS.theme);
    setDensidade(APPEARANCE_DEFAULTS.densidade);
    const results = await Promise.allSettled([
      saveThemePref(APPEARANCE_DEFAULTS.theme),
      saveDensidadePref(APPEARANCE_DEFAULTS.densidade),
      saveFontScale(APPEARANCE_DEFAULTS.fontScale),
      saveReduceMotion(APPEARANCE_DEFAULTS.reduceMotion),
      saveSidebarMode('dynamic'),
      saveMenuCompacto(true),
    ]);
    document.documentElement.dataset.density =
      APPEARANCE_DEFAULTS.densidade === 'compacta' ? 'compact' : 'comfortable';
    document.documentElement.style.setProperty('--base-font-size', `${APPEARANCE_DEFAULTS.fontScale}px`);
    document.documentElement.classList.remove('reduce-motion');
    setSavedAt(new Date());
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      toast.warning(`Algumas preferências (${failed}) não puderam ser salvas. Tente novamente.`);
    } else {
      toast.success('Preferências de aparência restauradas ao padrão.');
    }
  };

  return {
    theme, setTheme,
    densidade, setDensidade,
    fontScale, saveFontScale,
    reduceMotion, saveReduceMotion,
    sessionKeepalive, saveSessionKeepalive,
    sessionWarnMinutes, saveSessionWarnMinutes,
    sidebarMode, saveSidebarMode,
    saveMenuCompacto,
    saveThemePref, saveDensidadePref,
    savedAt, markSaved, reset,
  };
}