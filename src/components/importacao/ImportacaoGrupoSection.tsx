import { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface ImportacaoGrupoSectionProps {
  title: string;
  description: string;
  order: number;
  colorClass?: string;
  children: ReactNode;
}

export function ImportacaoGrupoSection({
  title,
  description,
  order,
  colorClass = "bg-primary/10 text-primary",
  children,
}: ImportacaoGrupoSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex items-center justify-center h-6 w-6 rounded-full text-[11px] font-bold shrink-0",
            colorClass
          )}
        >
          {order}
        </div>
        <div className="flex-grow min-w-0">
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-semibold leading-none">{title}</h3>
            <span className="text-xs text-muted-foreground">{description}</span>
          </div>
        </div>
        <Separator className="flex-grow" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {children}
      </div>
    </div>
  );
}
