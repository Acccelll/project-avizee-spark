import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ExternalLink, MoreHorizontal } from 'lucide-react';
import type { ResolvedDrillAction } from '../hooks/useRelatorioDrillDown';

interface RowActionsMenuProps {
  actions: ResolvedDrillAction[];
  onSelect: (action: ResolvedDrillAction) => void;
}

/**
 * Menu compacto de ações de drill-down por linha. Renderizado dentro da
 * coluna "Ações" do `DataTable`. Esconde-se sozinho quando não há ações
 * disponíveis para a linha (ex.: row sem `produtoId`).
 */
export function RowActionsMenu({ actions, onSelect }: RowActionsMenuProps) {
  if (!actions.length) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Ações da linha"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-xs">Drill-down</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {actions.map((a) => (
          <DropdownMenuItem
            key={a.key}
            onSelect={() => onSelect(a)}
            className="gap-2 text-sm"
          >
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            {a.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}