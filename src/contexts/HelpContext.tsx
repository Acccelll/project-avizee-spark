import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { HelpEntry, HelpTourStep } from '@/help/types';

/**
 * Contexto global do sistema de ajuda. Permite a qualquer componente abrir
 * o drawer ou iniciar o tour da rota atual sem prop drilling.
 */
interface HelpContextValue {
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;

  tourEntry: HelpEntry | null;
  tourSteps: HelpTourStep[] | null;
  startTour: (entry: HelpEntry) => void;
  endTour: () => void;
}

const HelpContext = createContext<HelpContextValue | null>(null);

export function HelpProvider({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tourEntry, setTourEntry] = useState<HelpEntry | null>(null);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const startTour = useCallback((entry: HelpEntry) => {
    if (!entry.tour?.length) return;
    setDrawerOpen(false);
    setTourEntry(entry);
  }, []);

  const endTour = useCallback(() => setTourEntry(null), []);

  const value = useMemo<HelpContextValue>(
    () => ({
      drawerOpen,
      openDrawer,
      closeDrawer,
      tourEntry,
      tourSteps: tourEntry?.tour ?? null,
      startTour,
      endTour,
    }),
    [drawerOpen, openDrawer, closeDrawer, tourEntry, startTour, endTour],
  );

  return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>;
}

export function useHelp() {
  const ctx = useContext(HelpContext);
  if (!ctx) throw new Error('useHelp deve ser usado dentro de HelpProvider');
  return ctx;
}