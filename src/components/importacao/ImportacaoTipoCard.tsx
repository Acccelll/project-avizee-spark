import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileUp, List, AlertCircle, CheckCircle2, Clock, Loader2, AlertTriangle, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type CardImportStatus =
  | "nunca_importado"
  | "pronto"
  | "processando"
  | "erro_recente"
  | "pendente_conferencia"
  | "concluido"
  | "concluido_com_alertas";

export type ImportacaoCriticidade =
  | "estrutural"
  | "cadastral"
  | "operacional"
  | "financeiro"
  | "historico"
  | "fiscal";

const STATUS_CONFIG: Record<CardImportStatus, { label: string; dotClass: string; icon: React.ElementType }> = {
  nunca_importado: { label: "Nunca importado", dotClass: "bg-muted-foreground/40", icon: Clock },
  pronto: { label: "Pronto para importar", dotClass: "bg-info", icon: Clock },
  processando: { label: "Em processamento", dotClass: "bg-warning animate-pulse", icon: Loader2 },
  erro_recente: { label: "Erro recente", dotClass: "bg-destructive", icon: AlertCircle },
  pendente_conferencia: { label: "Pendente de conferência", dotClass: "bg-warning", icon: AlertTriangle },
  concluido: { label: "Concluído", dotClass: "bg-success", icon: CheckCircle2 },
  concluido_com_alertas: { label: "Concluído com alertas", dotClass: "bg-warning/70", icon: AlertTriangle },
};

const CRITICIDADE_CONFIG: Record<ImportacaoCriticidade, { label: string; className: string }> = {
  estrutural: { label: "Impacto estrutural", className: "bg-accent text-accent-foreground border-border" },
  cadastral: { label: "Impacto cadastral", className: "bg-info/10 text-info border-info/30" },
  operacional: { label: "Impacto operacional", className: "bg-warning/10 text-warning border-warning/30" },
  financeiro: { label: "Impacto financeiro", className: "bg-success/10 text-success border-success/30" },
  historico: { label: "Impacto histórico", className: "bg-secondary/15 text-secondary border-secondary/30" },
  fiscal: { label: "Impacto fiscal", className: "bg-destructive/10 text-destructive border-destructive/30" },
};

interface ImportacaoTipoCardProps {
  title: string;
  description: string;
  type: string;
  onImport: (type: string) => void;
  onViewBatches: (type: string) => void;
  cardStatus?: CardImportStatus;
  criticidade?: ImportacaoCriticidade;
  dependencies?: string[];
  orderStep?: number;
  summary?: {
    lastDate?: string;
    lastStatus?: string;
    totalBatches?: number;
    pendingCount?: number;
    nextAction?: string;
  };
}

export function ImportacaoTipoCard({
  title,
  description,
  type,
  onImport,
  onViewBatches,
  cardStatus = "nunca_importado",
  criticidade,
  dependencies,
  summary,
}: ImportacaoTipoCardProps) {
  const statusCfg = STATUS_CONFIG[cardStatus];
  const StatusIcon = statusCfg.icon;
  const critCfg = criticidade ? CRITICIDADE_CONFIG[criticidade] : null;

  const isBlocked = false; // reserved for future dependency-blocking logic

  return (
    <TooltipProvider>
      <Card className={cn("flex flex-col h-full hover:shadow-md transition-shadow", isBlocked && "opacity-60")}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-tight">{title}</CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 shrink-0 mt-0.5 cursor-default">
                  <span className={cn("h-2 w-2 rounded-full shrink-0", statusCfg.dotClass)} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {statusCfg.label}
              </TooltipContent>
            </Tooltip>
          </div>
          <CardDescription className="line-clamp-2 text-xs">{description}</CardDescription>
          {critCfg && (
            <span className={cn("inline-flex w-fit text-[10px] font-medium px-1.5 py-0.5 rounded border mt-1", critCfg.className)}>
              {critCfg.label}
            </span>
          )}
        </CardHeader>

        <CardContent className="flex-grow space-y-2 pt-0">
          {/* Status line */}
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <StatusIcon className={cn("h-3 w-3 shrink-0", cardStatus === "processando" && "animate-spin")} />
            <span>{statusCfg.label}</span>
          </div>

          {/* Dependencies */}
          {dependencies && dependencies.length > 0 && (
            <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <Link2 className="h-3 w-3 shrink-0 mt-0.5" />
              <span>Depende de: <span className="font-medium text-foreground">{dependencies.join(", ")}</span></span>
            </div>
          )}

          {/* Summary */}
          {summary && (
            <div className="space-y-1.5 pt-1 text-[11px] text-muted-foreground border-t mt-2">
              {summary.lastDate && (
                <div className="flex justify-between">
                  <span>Último lote:</span>
                  <span className="font-medium text-foreground">{summary.lastDate}</span>
                </div>
              )}
              {summary.totalBatches !== undefined && (
                <div className="flex justify-between">
                  <span>Total de lotes:</span>
                  <span className="font-medium text-foreground">{summary.totalBatches}</span>
                </div>
              )}
              {summary.pendingCount !== undefined && summary.pendingCount > 0 && (
                <div className="flex justify-between">
                  <span className="text-warning font-medium">Aguardando conferência:</span>
                  <span className="font-bold text-warning">{summary.pendingCount}</span>
                </div>
              )}
              {summary.nextAction && (
                <div className="pt-1 text-[10px] italic text-muted-foreground border-t">
                  → {summary.nextAction}
                </div>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="grid grid-cols-2 gap-2 pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onImport(type)}
            disabled={isBlocked}
            className="w-full gap-1.5"
          >
            <FileUp className="h-3.5 w-3.5" />
            Importar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewBatches(type)}
            className="w-full gap-1.5"
          >
            <List className="h-3.5 w-3.5" />
            Ver lotes
          </Button>
        </CardFooter>
      </Card>
    </TooltipProvider>
  );
}
