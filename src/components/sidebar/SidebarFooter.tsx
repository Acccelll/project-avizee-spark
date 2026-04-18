import { Settings } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { isPathActive } from '@/lib/navigation';

interface SidebarFooterProps {
  collapsed: boolean;
  secondsSinceSync: number | null;
  onNavigate: (path: string) => void;
}

export function SidebarFooter({ collapsed, secondsSinceSync, onNavigate }: SidebarFooterProps) {
  const location = useLocation();
  const active = isPathActive(location.pathname, '/configuracoes');
  const synced = secondsSinceSync !== null && secondsSinceSync < 60;
  return (
    <div className="border-t border-border/60 p-2">
      <div className={collapsed ? '' : 'rounded-lg bg-muted/30 p-1.5'}>
        {!collapsed && secondsSinceSync !== null && (
          <div className="mb-1.5 flex items-center gap-1.5 px-2 pt-0.5 text-[10px] text-muted-foreground/80">
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${synced ? 'bg-success' : 'bg-muted-foreground/40'}`}
            />
            <span>Sincronizado há {secondsSinceSync}s</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => onNavigate('/configuracoes')}
          aria-current={active ? 'page' : undefined}
          className={`sidebar-item ${active ? 'sidebar-item-active' : 'sidebar-item-inactive'} ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? 'Configurações' : undefined}
          aria-label="Abrir configurações"
        >
          <Settings className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-primary' : ''}`} />
          {!collapsed && <span>Configurações</span>}
        </button>
      </div>
    </div>
  );
}
