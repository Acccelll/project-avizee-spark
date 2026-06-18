import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

/** Container colapsável usado nas seções mobile do formulário de orçamento. */
export function MobileSection({
  title,
  icon: Icon,
  summary,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  summary?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isMobile = useIsMobile();
  if (!isMobile) return <>{children}</>;
  return (
    <div className="bg-card rounded-xl border shadow-soft overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full min-h-[52px] items-center gap-3 px-5 py-4 text-left active:bg-muted/40 transition-colors"
      >
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-semibold text-foreground shrink-0">{title}</span>
        {!open && summary && (
          <span className="ml-auto text-xs text-muted-foreground truncate">{summary}</span>
        )}
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open ? "rotate-180" : "", !summary && "ml-auto")} />
      </button>
      {open && (
        <div className="border-t [&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none">
          {children}
        </div>
      )}
    </div>
  );
}