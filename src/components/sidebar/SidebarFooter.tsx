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
  return (
    <div className="border-t border-border p-2">
      {!collapsed && secondsSinceSync !== null && (
        <p className="mb-2 px-2 text-[10px] text-muted-foreground">
          Última sincronização: há {secondsSinceSync}s
        </p>
      )}
      <button
        type="button"
        onClick={() => onNavigate('/configuracoes')}
        className={`sidebar-item ${active ? 'sidebar-item-active' : 'sidebar-item-inactive'} ${collapsed ? 'justify-center' : ''}`}
        title={collapsed ? 'Configurações' : undefined}
        aria-label="Abrir configurações"
      >
        <Settings className="h-5 w-5 shrink-0" />
        {!collapsed && <span>Configurações</span>}
      </button>
    </div>
  );
}
