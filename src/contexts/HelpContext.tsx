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

  /** Drawer global "Reportar problema" — seção 3 da especificação de Ajuda/Suporte. */
  reportarProblemaOpen: boolean;
  openReportarProblema: () => void;
  closeReportarProblema: () => void;
}

const HelpContext = createContext<HelpContextValue | null>(null);

export function HelpProvider({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tourEntry, setTourEntry] = useState<HelpEntry | null>(null);
  const [reportarProblemaOpen, setReportarProblemaOpen] = useState(false);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const startTour = useCallback((entry: HelpEntry) => {
    if (!entry.tour?.length) return;
    setDrawerOpen(false);
    setTourEntry(entry);
  }, []);

  const endTour = useCallback(() => setTourEntry(null), []);

  const openReportarProblema = useCallback(() => setReportarProblemaOpen(true), []);
  const closeReportarProblema = useCallback(() => setReportarProblemaOpen(false), []);

  const value = useMemo<HelpContextValue>(
    () => ({
      drawerOpen,
      openDrawer,
      closeDrawer,
      tourEntry,
      tourSteps: tourEntry?.tour ?? null,
      startTour,
      endTour,
      reportarProblemaOpen,
      openReportarProblema,
      closeReportarProblema,
    }),
    [
      drawerOpen, openDrawer, closeDrawer, tourEntry, startTour, endTour,
      reportarProblemaOpen, openReportarProblema, closeReportarProblema,
    ],
  );

  return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>;
}

export function useHelp() {
  const ctx = useContext(HelpContext);
  if (!ctx) throw new Error('useHelp deve ser usado dentro de HelpProvider');
  return ctx;
}