import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { resolveHelpEntry } from '@/help/registry';
import { useHelp } from '@/contexts/HelpContext';
import { useHelpProgress } from '@/hooks/useHelpProgress';

/**
 * Em cada navegação para uma rota com tour configurado, verifica se o usuário
 * já viu este tour (na versão atual). Se não, dispara um toast não-bloqueante
 * oferecendo "Fazer tour" / "Agora não" / "Não mostrar mais".
 */
export function FirstVisitToast() {
  const { pathname } = useLocation();
  const { startTour } = useHelp();
  const { state, loaded, hasSeen, markSeen, setDisabledFirstVisit } = useHelpProgress();
  const skippedThisSession = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!loaded) return;
    if (state.disabledFirstVisit) return;
    const entry = resolveHelpEntry(pathname);
    if (!entry?.tour?.length) return;
    const key = `${entry.route}@${entry.version}`;
    if (hasSeen(entry.route, entry.version)) return;
    if (skippedThisSession.current.has(key)) return;

    // pequeno delay para não competir com renders iniciais
    const t = setTimeout(() => {
      toast(`Primeira vez aqui? Conheça ${entry.title}`, {
        description: `Tour rápido com ${entry.tour!.length} passos.`,
        duration: 12000,
        action: {
          label: 'Fazer tour',
          onClick: () => startTour(entry),
        },
        cancel: {
          label: 'Agora não',
          onClick: () => {
            skippedThisSession.current.add(key);
          },
        },
        onDismiss: () => {
          skippedThisSession.current.add(key);
        },
      });
      // marca como visto para não reaparecer constantemente; usuário pode reabrir via menu
      markSeen(entry.route, entry.version);
    }, 800);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, loaded, state.disabledFirstVisit]);

  // referenciado para silenciar lint em closures que possam parecer não usadas
  void setDisabledFirstVisit;
  return null;
}