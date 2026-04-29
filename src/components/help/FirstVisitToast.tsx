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
  // Tags já processadas nesta sessão (evita re-disparo enquanto a persistência
  // remota de `markSeen` ainda não refletiu em `state.seenTours`, e também
  // protege contra StrictMode dupla-execução do efeito).
  const handledThisSession = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!loaded) return;
    if (state.disabledFirstVisit) return;
    const entry = resolveHelpEntry(pathname);
    if (!entry?.tour?.length) return;
    const key = `${entry.route}@${entry.version}`;
    if (hasSeen(entry.route, entry.version)) return;
    if (handledThisSession.current.has(key)) return;

    // Marca imediatamente como tratado nesta sessão. Assim, mesmo que o
    // usuário navegue para fora e volte antes do `markSeen` persistir no
    // banco, o toast não reaparece. A persistência continua acontecendo via
    // `markSeen` para travar o registro entre sessões/dispositivos.
    handledThisSession.current.add(key);

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
            /* já marcado em handledThisSession */
          },
        },
      });
      // Persiste no banco para não reaparecer em sessões futuras / outros
      // dispositivos. Usuário pode reabrir o tour via menu de ajuda.
      markSeen(entry.route, entry.version);
    }, 800);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, loaded, state.disabledFirstVisit, state.seenTours]);

  // referenciado para silenciar lint em closures que possam parecer não usadas
  void setDisabledFirstVisit;
  return null;
}