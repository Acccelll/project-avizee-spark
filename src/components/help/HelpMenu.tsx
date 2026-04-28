import { useLocation, useNavigate } from 'react-router-dom';
import { HelpCircle, BookOpen, Play, Keyboard, LibraryBig } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { resolveHelpEntry } from '@/help/registry';
import { useHelp } from '@/contexts/HelpContext';

interface HelpMenuProps {
  onOpenShortcuts: () => void;
  variant?: 'header' | 'mobile';
}

/**
 * Botão `?` no header. Abre menu com:
 *  - Manual desta tela
 *  - Iniciar tour guiado (se houver)
 *  - Atalhos do teclado
 *  - Central de ajuda
 */
export function HelpMenu({ onOpenShortcuts, variant = 'header' }: HelpMenuProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { openDrawer, startTour } = useHelp();
  const entry = resolveHelpEntry(pathname);
  const hasTour = !!entry?.tour?.length;

  const triggerSize = variant === 'mobile' ? 'h-9 w-9' : 'h-9 w-9';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`${triggerSize} rounded-full text-muted-foreground hover:text-foreground`}
          aria-label="Ajuda desta tela"
          title="Ajuda (?)"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="space-y-0.5">
          <p className="text-sm font-medium leading-none">Ajuda</p>
          <p className="text-xs text-muted-foreground font-normal">
            {entry ? entry.title : 'Esta tela ainda não tem manual'}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!entry} onClick={() => entry && openDrawer()}>
          <BookOpen className="mr-2 h-4 w-4" /> Manual desta tela
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!hasTour} onClick={() => entry && startTour(entry)}>
          <Play className="mr-2 h-4 w-4" />
          Iniciar tour guiado
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenShortcuts}>
          <Keyboard className="mr-2 h-4 w-4" /> Atalhos do teclado
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/ajuda')}>
          <LibraryBig className="mr-2 h-4 w-4" /> Central de ajuda
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}