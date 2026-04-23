import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPreference } from '@/hooks/useUserPreference';
import { useAppConfigContext } from '@/contexts/AppConfigContext';
import { APPEARANCE_DEFAULTS } from '../utils/passwordPolicy';
import type { SidebarMode } from '@/contexts/AppConfigContext';

/** Snapshot de preferências de aparência usado para a ação "Desfazer". */
interface AppearanceSnapshot {
  theme: string;
  densidade: string;
  fontScale: number;
  reduceMotion: boolean;
  sidebarMode: SidebarMode;
  menuCompacto: boolean;
}

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
    // Fase 7: tira snapshot ANTES de resetar para permitir desfazer em até ~8s.
    const snapshot: AppearanceSnapshot = {
      theme: theme || 'system',
      densidade,
      fontScale: fontScale ?? APPEARANCE_DEFAULTS.fontScale,
      reduceMotion: reduceMotion ?? APPEARANCE_DEFAULTS.reduceMotion,
      sidebarMode: sidebarMode || 'dynamic',
      menuCompacto: sidebarMode !== 'fixed-expanded',
    };
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
      return;
    }
    toast.success('Preferências de aparência restauradas ao padrão.', {
      duration: 8000,
      action: {
        label: 'Desfazer',
        onClick: () => { void restoreSnapshot(snapshot); },
      },
    });
  };

  /** Restaura um snapshot anterior — usado pelo toast "Desfazer". */
  const restoreSnapshot = async (snap: AppearanceSnapshot) => {
    setTheme(snap.theme);
    setDensidade(snap.densidade);
    const results = await Promise.allSettled([
      saveThemePref(snap.theme),
      saveDensidadePref(snap.densidade),
      saveFontScale(snap.fontScale),
      saveReduceMotion(snap.reduceMotion),
      saveSidebarMode(snap.sidebarMode),
      saveMenuCompacto(snap.menuCompacto),
    ]);
    document.documentElement.dataset.density =
      snap.densidade === 'compacta' ? 'compact' : 'comfortable';
    document.documentElement.style.setProperty('--base-font-size', `${snap.fontScale}px`);
    document.documentElement.classList.toggle('reduce-motion', snap.reduceMotion);
    setSavedAt(new Date());
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      toast.warning('Não foi possível desfazer todas as alterações.');
    } else {
      toast.success('Preferências anteriores restauradas.');
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