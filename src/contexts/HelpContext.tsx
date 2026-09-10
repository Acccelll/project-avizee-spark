import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { HelpEntry, HelpTourStep } from '@/help/types';

/**
 * Contexto global do sistema de ajuda. Permite a qualquer componente abrir
 * o drawer ou iniciar o tour da rota atual sem prop drilling.
 */
/** Contexto opcional pré-preenchido ao abrir "Reportar problema" a partir de um registro específico. */
export interface ReportProblemaContext {
  registroRelacionadoTipo?: string;
  registroRelacionadoId?: string;
}

interface HelpContextValue {
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;

  tourEntry: HelpEntry | null;
  tourSteps: HelpTourStep[] | null;
  startTour: (entry: HelpEntry) => void;
  endTour: () => void;

  reportOpen: boolean;
  reportContext: ReportProblemaContext | null;
  openReportDialog: (context?: ReportProblemaContext) => void;
  closeReportDialog: () => void;
}

const HelpContext = createContext<HelpContextValue | null>(null);

export function HelpProvider({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tourEntry, setTourEntry] = useState<HelpEntry | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportContext, setReportContext] = useState<ReportProblemaContext | null>(null);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const startTour = useCallback((entry: HelpEntry) => {
    if (!entry.tour?.length) return;
    setDrawerOpen(false);
    setTourEntry(entry);
  }, []);

  const endTour = useCallback(() => setTourEntry(null), []);

  const openReportDialog = useCallback((context?: ReportProblemaContext) => {
    setReportContext(context ?? null);
    setDrawerOpen(false);
    setReportOpen(true);
  }, []);

  const closeReportDialog = useCallback(() => {
    setReportOpen(false);
    setReportContext(null);
  }, []);

  const value = useMemo<HelpContextValue>(
    () => ({
      drawerOpen,
      openDrawer,
      closeDrawer,
      tourEntry,
      tourSteps: tourEntry?.tour ?? null,
      startTour,
      endTour,
      reportOpen,
      reportContext,
      openReportDialog,
      closeReportDialog,
    }),
    [
      drawerOpen,
      openDrawer,
      closeDrawer,
      tourEntry,
      startTour,
      endTour,
      reportOpen,
      reportContext,
      openReportDialog,
      closeReportDialog,
    ],
  );

  return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>;
}

export function useHelp() {
  const ctx = useContext(HelpContext);
  if (!ctx) throw new Error('useHelp deve ser usado dentro de HelpProvider');
  return ctx;
}