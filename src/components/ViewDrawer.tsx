import { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface ViewDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
}

export function ViewDrawer({ open, onClose, title, children, badge, actions }: ViewDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
        <SheetHeader className="sticky top-0 z-10 bg-card border-b px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <SheetTitle className="text-lg truncate">{title}</SheetTitle>
              <SheetDescription className="sr-only">Visualização de {title}</SheetDescription>
              {badge}
            </div>
            {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
          </div>
        </SheetHeader>
        <div className="px-6 py-5 space-y-5">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

/* Reusable field row for ViewDrawer content */
interface ViewFieldProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function ViewField({ label, children, className = "" }: ViewFieldProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-0.5 text-sm text-foreground break-words overflow-wrap-anywhere max-w-full truncate" title={typeof children === 'string' ? children : undefined}>{children}</div>
    </div>
  );
}

export function ViewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</span>
        <Separator className="flex-1" />
      </div>
      {children}
    </div>
  );
}
