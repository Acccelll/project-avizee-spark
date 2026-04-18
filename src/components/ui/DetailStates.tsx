import { AlertTriangle, FileQuestion, LucideIcon } from "lucide-react";
import { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Estados padronizados para telas de detalhe/visualização (loading, error, empty).
 * Substitui textos soltos `<div className="p-8 text-center animate-pulse">Carregando...</div>`
 * espalhados por todas as Views.
 */

export function DetailLoading({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-5 animate-pulse", className)} aria-busy="true" aria-live="polite">
      {/* KPI strip skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-3 space-y-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        ))}
      </div>
      {/* Tabs skeleton */}
      <Skeleton className="h-9 w-full rounded-md" />
      {/* Body */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    </div>
  );
}

export interface DetailErrorProps {
  title?: string;
  message?: string;
  className?: string;
  action?: ReactNode;
}

export function DetailError({
  title = "Erro ao carregar dados",
  message,
  className,
  action,
}: DetailErrorProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-4 py-12 text-center",
        className,
      )}
    >
      <div className="rounded-full bg-destructive/10 p-3">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <p className="text-sm font-semibold text-destructive">{title}</p>
      {message && <p className="max-w-md text-xs text-muted-foreground">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export interface DetailEmptyProps {
  title?: string;
  message?: string;
  icon?: LucideIcon;
  className?: string;
  action?: ReactNode;
}

export function DetailEmpty({
  title = "Registro não encontrado",
  message,
  icon: Icon = FileQuestion,
  className,
  action,
}: DetailEmptyProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-4 py-12 text-center",
        className,
      )}
    >
      <div className="rounded-full bg-muted p-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {message && <p className="max-w-md text-xs text-muted-foreground">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
