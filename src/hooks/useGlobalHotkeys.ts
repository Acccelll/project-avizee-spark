import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * useGlobalHotkeys
 *
 * Registers application-wide keyboard shortcuts. Must be mounted exactly once
 * (in `AppLayout`) so listeners survive route changes and never duplicate.
 *
 * Shortcuts:
 *  - Ctrl/Cmd + N       → Novo orçamento
 *  - Ctrl/Cmd + Shift+N → Nova nota fiscal
 *  - Ctrl/Cmd + Shift+C → Novo cliente
 *  - Ctrl/Cmd + Shift+P → Novo produto
 *  - Ctrl/Cmd + [1..9]  → Navegação rápida pelos módulos principais
 *  - Ctrl/Cmd + /       → Abrir painel de atalhos (via callback)
 *  - ?                  → Abrir busca global (via callback)
 */
interface Options {
  onOpenSearch?: () => void;
  onOpenShortcuts?: () => void;
}

const QUICK_NAV_ROUTES = [
  '/',
  '/orcamentos',
  '/pedidos',
  '/pedidos-compra',
  '/estoque',
  '/financeiro',
  '/fiscal',
  '/relatorios',
  '/configuracoes',
];

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

export function useGlobalHotkeys({ onOpenSearch, onOpenShortcuts }: Options = {}) {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const mod = event.metaKey || event.ctrlKey;

      if (mod && event.key.toLowerCase() === 'n' && !event.shiftKey) {
        event.preventDefault();
        navigate('/orcamentos/novo');
        return;
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        navigate('/fiscal?tipo=saida');
        return;
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        navigate('/clientes');
        return;
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        navigate('/produtos');
        return;
      }
      if (mod && event.key === '/') {
        event.preventDefault();
        onOpenShortcuts?.();
        return;
      }
      if (mod && /^[1-9]$/.test(event.key)) {
        const index = Number(event.key) - 1;
        const route = QUICK_NAV_ROUTES[index];
        if (route) {
          event.preventDefault();
          navigate(route);
        }
        return;
      }
      if (!event.metaKey && !event.ctrlKey && event.key === '?') {
        event.preventDefault();
        onOpenSearch?.();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, onOpenSearch, onOpenShortcuts]);
}
