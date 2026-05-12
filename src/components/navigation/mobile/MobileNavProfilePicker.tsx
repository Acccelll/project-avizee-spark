import { Check } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  NAV_PROFILES,
  NAV_PROFILE_LABELS,
  NAV_PROFILE_DESCRIPTIONS,
  type NavProfile,
} from '@/lib/navigation/profiles';
import { cn } from '@/lib/utils';

interface MobileNavProfilePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: NavProfile;
  onChange: (profile: NavProfile) => void;
}

export function MobileNavProfilePicker({ open, onOpenChange, value, onChange }: MobileNavProfilePickerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80vh] rounded-t-[20px] p-0">
        <SheetHeader className="px-4 pb-2 pt-4 text-left">
          <SheetTitle>Modo de visão</SheetTitle>
          <SheetDescription>
            Escolha um foco operacional para reorganizar o menu. Suas permissões continuam valendo.
          </SheetDescription>
        </SheetHeader>
        <div className="max-h-[60vh] overflow-y-auto px-3 pb-4">
          <ul role="radiogroup" aria-label="Modo de visão" className="space-y-1.5">
            {NAV_PROFILES.map((p) => {
              const selected = p === value;
              return (
                <li key={p}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      onChange(p);
                      onOpenChange(false);
                    }}
                    className={cn(
                      'flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition',
                      selected
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:bg-accent',
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{NAV_PROFILE_LABELS[p]}</p>
                      <p className="text-xs text-muted-foreground">{NAV_PROFILE_DESCRIPTIONS[p]}</p>
                    </div>
                    {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}