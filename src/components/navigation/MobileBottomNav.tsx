import { Menu } from 'lucide-react';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { mobileBottomTabs, getNavSectionKey, DASHBOARD_KEY, navSections, type NavSectionKey } from '@/lib/navigation';
import { useVisibleSectionKeys } from '@/hooks/useVisibleNavSections';
import { useCan } from '@/hooks/useCan';
import type { Permission } from '@/utils/permissions';
import { cn } from '@/lib/utils';

/**
 * Mapeia o path padrão de cada bottom tab para a permissão necessária.
 * Quando o usuário não tem acesso ao destino padrão, caímos para o primeiro
 * item da seção que ele pode acessar — evita o tap → AccessDenied.
 */
const TAB_PATH_PERMISSIONS: Record<string, Permission> = {
  '/orcamentos': 'orcamentos:visualizar',
  '/clientes': 'clientes:visualizar',
  '/financeiro': 'financeiro:visualizar',
};

const PATH_PERMISSION_MAP: Record<string, Permission> = {
  '/produtos': 'produtos:visualizar',
  '/clientes': 'clientes:visualizar',
  '/fornecedores': 'fornecedores:visualizar',
  '/transportadoras': 'transportadoras:visualizar',
  '/formas-pagamento': 'formas_pagamento:visualizar',
  '/grupos-economicos': 'clientes:visualizar',
  '/funcionarios': 'usuarios:visualizar',
  '/socios': 'socios:visualizar',
  '/orcamentos': 'orcamentos:visualizar',
  '/pedidos': 'pedidos:visualizar',
  '/financeiro': 'financeiro:visualizar',
  '/fluxo-caixa': 'financeiro:visualizar',
  '/contas-bancarias': 'financeiro:visualizar',
  '/contas-contabeis-plano': 'financeiro:visualizar',
  '/conciliacao': 'financeiro:visualizar',
  '/socios-participacoes': 'socios:visualizar',
};

function basePath(p: string) {
  return p.split('?')[0];
}

interface MobileBottomNavProps {
  onOpenMenu: () => void;
}

export function MobileBottomNav({ onOpenMenu }: MobileBottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { can } = useCan();
  const currentRoute = `${location.pathname}${location.search}`;
  const activeKey = getNavSectionKey(currentRoute);
  const visibleKeys = useVisibleSectionKeys();

  // Always keep "Início" visible; for the rest, only show tabs whose section is allowed.
  // Adicionalmente, recalculamos o path destino por permissão real — se o destino
  // padrão da tab não pode ser acessado, escolhe o primeiro item permitido da seção.
  const tabs = useMemo(() => {
    return mobileBottomTabs
      .filter((tab) => tab.key === DASHBOARD_KEY || visibleKeys.has(tab.key as NavSectionKey))
      .map((tab) => {
        if (tab.key === DASHBOARD_KEY) return tab;
        const defaultPerm = TAB_PATH_PERMISSIONS[basePath(tab.path)];
        if (!defaultPerm || can(defaultPerm)) return tab;
        // Procura o primeiro item da seção que o usuário pode acessar
        const section = navSections.find((s) => s.key === tab.key);
        if (!section) return tab;
        const items = section.items.flatMap((g) => g.items);
        const allowed = items.find((item) => {
          const perm = PATH_PERMISSION_MAP[basePath(item.path)];
          return !perm || can(perm);
        });
        return allowed ? { ...tab, path: allowed.path } : tab;
      });
  }, [visibleKeys, can]);

  return (
    <nav
      aria-label="Navegação mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2 shadow-[0_-10px_30px_rgba(0,0,0,0.08)] backdrop-blur md:hidden"
    >
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeKey === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => navigate(tab.path)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute top-0 left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full bg-primary"
                />
              )}
              <span
                className={cn(
                  'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                  active && 'bg-primary/10',
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span>{tab.title}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={onOpenMenu}
          className={cn(
            'relative flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-medium transition-colors',
            activeKey === 'menu' ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {activeKey === 'menu' && (
            <span
              aria-hidden
              className="absolute top-0 left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full bg-primary"
            />
          )}
          <span
            className={cn(
              'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
              activeKey === 'menu' && 'bg-primary/10',
            )}
          >
            <Menu className="h-5 w-5" />
          </span>
          <span>Menu</span>
        </button>
      </div>
    </nav>
  );
}
