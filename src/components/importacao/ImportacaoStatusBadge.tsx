import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success";

interface ImportacaoStatusBadgeProps {
  status: string;
  className?: string;
}

export function ImportacaoStatusBadge({ status, className }: ImportacaoStatusBadgeProps) {
  const configs: Record<string, { label: string; variant: BadgeVariant }> = {
    rascunho: { label: "Rascunho", variant: "secondary" },
    processando: { label: "Processando", variant: "outline" },
    validado: { label: "Validado", variant: "default" },
    parcial: { label: "Parcial", variant: "secondary" },
    concluido: { label: "Concluído", variant: "outline" }, // shadcn default badge doesn't have "success" by default, using outline as placeholder or will use custom style
    cancelado: { label: "Cancelado", variant: "destructive" },
  };

  const config = configs[status.toLowerCase()] || { label: status, variant: "outline" as BadgeVariant };

  return (
    <Badge
      variant={config.variant}
      className={cn(
        status.toLowerCase() === 'concluido' && "bg-success/15 text-success hover:bg-success/25 border-success/30",
        status.toLowerCase() === 'processando' && "animate-pulse",
        className
      )}
    >
      {config.label}
    </Badge>
  );
}
