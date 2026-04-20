import { ChevronDown, ChevronUp, Eye, EyeOff, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { WIDGET_REGISTRY } from '@/lib/dashboard/widgets';
import type { DashboardLayoutPrefs, WidgetId } from '@/hooks/useDashboardLayout';

interface DashboardCustomizeMenuProps {
  prefs: DashboardLayoutPrefs;
  onToggle: (id: WidgetId) => void | Promise<void>;
  onMove: (id: WidgetId, direction: 'up' | 'down') => void | Promise<void>;
  onReset: () => void | Promise<void>;
}

export function DashboardCustomizeMenu({ prefs, onToggle, onMove, onReset }: DashboardCustomizeMenuProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" aria-label="Personalizar dashboard">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Personalizar</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
          <p className="text-xs font-semibold text-foreground">Personalizar dashboard</p>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => void onReset()}>
            <RotateCcw className="h-3 w-3" />
            Restaurar
          </Button>
        </div>
        <ul className="max-h-[60vh] divide-y divide-border/40 overflow-y-auto">
          {prefs.order.map((id, index) => {
            const meta = WIDGET_REGISTRY[id];
            if (!meta) return null;
            const hidden = prefs.hidden.includes(id);
            return (
              <li key={id} className="flex items-center gap-2 px-3 py-2">
                <div className="flex flex-col">
                  <button
                    type="button"
                    aria-label={`Mover ${meta.label} para cima`}
                    onClick={() => void onMove(id, 'up')}
                    disabled={index === 0}
                    className="rounded p-0.5 text-muted-foreground hover:bg-muted/40 disabled:opacity-30"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Mover ${meta.label} para baixo`}
                    onClick={() => void onMove(id, 'down')}
                    disabled={index === prefs.order.length - 1}
                    className="rounded p-0.5 text-muted-foreground hover:bg-muted/40 disabled:opacity-30"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">{meta.label}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{meta.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => void onToggle(id)}
                  disabled={meta.required}
                  aria-label={hidden ? `Mostrar ${meta.label}` : `Ocultar ${meta.label}`}
                  title={meta.required ? 'Obrigatório' : hidden ? 'Mostrar' : 'Ocultar'}
                >
                  {hidden ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-primary" />}
                </Button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}