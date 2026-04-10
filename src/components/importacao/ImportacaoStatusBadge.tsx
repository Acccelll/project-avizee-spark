import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ImportacaoStatusBadgeProps {
  status: string;
  className?: string;
}

export function ImportacaoStatusBadge({ status, className }: ImportacaoStatusBadgeProps) {
  const configs: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" }> = {
    rascunho: { label: "Rascunho", variant: "secondary" },
    processando: { label: "Processando", variant: "outline" },
    validado: { label: "Validado", variant: "default" },
    parcial: { label: "Parcial", variant: "secondary" },
    concluido: { label: "Concluído", variant: "outline" }, // shadcn default badge doesn't have "success" by default, using outline as placeholder or will use custom style
    cancelado: { label: "Cancelado", variant: "destructive" },
  };

  const config = configs[status.toLowerCase()] || { label: status, variant: "outline" };

  return (
    <Badge
      variant={config.variant as any}
      className={cn(
        status.toLowerCase() === 'concluido' && "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200",
        status.toLowerCase() === 'processando' && "animate-pulse",
        className
      )}
    >
      {config.label}
    </Badge>
  );
}
