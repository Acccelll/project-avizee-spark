import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCan } from '@/hooks/useCan';
import type { Permission } from '@/utils/permissions';

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
  /**
   * Disparado pela tecla `?` (sem modificadores) — abre o manual da tela atual.
   * Mantemos retrocompat: se ausente, o `?` cai no comportamento legado de
   * abrir a busca global, mas com o sistema de Ajuda em uso a tendência é
   * sempre passar este callback.
   */
  onOpenHelp?: () => void;
}

/** Cada slot de Cmd+1..9 carrega o caminho e a permissão necessária. */
const QUICK_NAV_ROUTES: ReadonlyArray<{ path: string; permission?: Permission }> = [
  { path: '/' },
  { path: '/orcamentos', permission: 'orcamentos:visualizar' },
  { path: '/pedidos', permission: 'pedidos:visualizar' },
  { path: '/pedidos-compra', permission: 'compras:visualizar' },
  { path: '/estoque', permission: 'estoque:visualizar' },
  { path: '/financeiro', permission: 'financeiro:visualizar' },
  { path: '/fiscal?tipo=saida', permission: 'faturamento_fiscal:visualizar' },
  { path: '/relatorios', permission: 'relatorios:visualizar' },
  { path: '/configuracoes' },
];

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

export function useGlobalHotkeys({ onOpenSearch, onOpenShortcuts, onOpenHelp }: Options = {}) {
  const navigate = useNavigate();
  const { can } = useCan();

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
      if (mod && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        if (can('faturamento_fiscal:visualizar')) {
          navigate('/fiscal/dashboard');
        }
        return;
      }
      if (mod && event.key === '/') {
        event.preventDefault();
        onOpenShortcuts?.();
        return;
      }
      if (mod && /^[1-9]$/.test(event.key)) {
        const index = Number(event.key) - 1;
        const target = QUICK_NAV_ROUTES[index];
        if (target && (!target.permission || can(target.permission))) {
          event.preventDefault();
          navigate(target.path);
        }
        return;
      }
      if (!event.metaKey && !event.ctrlKey && event.key === '?') {
        event.preventDefault();
        if (onOpenHelp) onOpenHelp();
        else onOpenSearch?.();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, onOpenSearch, onOpenShortcuts, onOpenHelp, can]);
}
