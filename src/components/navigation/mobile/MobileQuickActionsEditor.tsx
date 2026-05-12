import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { QuickAction } from '@/lib/navigation';

interface MobileQuickActionsEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allowed: QuickAction[];
  selectedIds: string[];
  max: number;
  onSave: (ids: string[]) => void;
}

export function MobileQuickActionsEditor({
  open,
  onOpenChange,
  allowed,
  selectedIds,
  max,
  onSave,
}: MobileQuickActionsEditorProps) {
  const [draft, setDraft] = useState<string[]>(selectedIds);

  useEffect(() => {
    if (open) setDraft(selectedIds);
  }, [open, selectedIds]);

  const toggle = (id: string) => {
    setDraft((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= max) return prev;
      return [...prev, id];
    });
  };

  const remaining = max - draft.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80vh] rounded-t-[20px] p-0">
        <SheetHeader className="px-4 pb-2 pt-4 text-left">
          <SheetTitle>Personalizar atalhos</SheetTitle>
          <SheetDescription>
            Escolha até {max} atalhos para o seu menu.
            {remaining > 0 ? ` Você pode adicionar mais ${remaining}.` : ' Limite atingido.'}
          </SheetDescription>
        </SheetHeader>

        <div className="max-h-[55vh] overflow-y-auto px-4 pb-4">
          {allowed.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum atalho disponível para o seu perfil.
            </p>
          )}
          <ul className="space-y-2">
            {allowed.map((action) => {
              const enabled = draft.includes(action.id);
              const disabled = !enabled && draft.length >= max;
              return (
                <li
                  key={action.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{action.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{action.description}</p>
                  </div>
                  <Switch
                    checked={enabled}
                    disabled={disabled}
                    onCheckedChange={() => toggle(action.id)}
                    aria-label={`${enabled ? 'Remover' : 'Adicionar'} atalho ${action.title}`}
                  />
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex gap-2 border-t border-border bg-background px-4 py-3">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
            }}
          >
            Salvar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}