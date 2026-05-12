import { X } from 'lucide-react';
import { SheetClose } from '@/components/ui/sheet';

export function MobileMenuHeader() {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-3">
      <h2 className="text-base font-semibold">Menu</h2>
      <SheetClose asChild>
        <button
          type="button"
          className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Fechar menu"
        >
          <X className="h-4 w-4" />
        </button>
      </SheetClose>
    </div>
  );
}
