/**
 * ViewField / ViewSection — primitives compartilhadas para conteúdo de drawers e
 * páginas de visualização. Extraídas de `ViewDrawer.tsx` (legado) para um arquivo
 * neutro, permitindo deprecar o drawer antigo sem quebrar consumidores.
 */
import { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface ViewFieldProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function ViewField({ label, children, className = "" }: ViewFieldProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div
        className="mt-0.5 text-sm text-foreground break-words overflow-wrap-anywhere max-w-full truncate"
        title={typeof children === "string" ? children : undefined}
      >
        {children}
      </div>
    </div>
  );
}

export function ViewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <Separator className="flex-1" />
      </div>
      {children}
    </div>
  );
}
