import { AlertTriangle, FileQuestion, LucideIcon, RefreshCw, SearchX } from "lucide-react";
import { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
            <Skeleton className="h-3 w-2/3" tone="card" />
            <Skeleton className="h-5 w-1/2" tone="card" />
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
  /** Ação customizada — quando passada, ignora `onRetry`. */
  action?: ReactNode;
  /**
   * Callback de retry — quando passado, renderiza automaticamente um botão
   * "Tentar novamente" com ícone, evitando que cada caller monte o próprio.
   */
  onRetry?: () => void;
}

/**
 * Estado de erro para telas de detalhe (drawer, view relacional).
 *
 * @example
 * // Erro com retry automático
 * <DetailError
 *   message={error.message}
 *   onRetry={() => refetch()}
 * />
 *
 * @example
 * // Ação customizada
 * <DetailError action={<Button onClick={...}>Voltar</Button>} />
 */
export function DetailError({
  title = "Erro ao carregar dados",
  message,
  className,
  action,
  onRetry,
}: DetailErrorProps) {
  const finalAction =
    action ??
    (onRetry ? (
      <Button size="sm" variant="outline" onClick={onRetry} className="gap-2">
        <RefreshCw className="h-3.5 w-3.5" />
        Tentar novamente
      </Button>
    ) : null);

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
      {finalAction && <div className="mt-2">{finalAction}</div>}
    </div>
  );
}

export type DetailEmptyVariant = "default" | "noResults" | "warning";

export interface DetailEmptyProps {
  title?: string;
  message?: string;
  icon?: LucideIcon;
  className?: string;
  action?: ReactNode;
  /**
   * Variant semântica para diferenciar visualmente o tipo de estado vazio.
   *
   * - `default`: bg-muted (registro não encontrado, lista vazia)
   * - `noResults`: bg-info/10 (filtro sem resultados)
   * - `warning`: bg-warning/10 (acesso restrito, configuração pendente)
   */
  variant?: DetailEmptyVariant;
}

const detailEmptyStyles: Record<
  DetailEmptyVariant,
  { wrapper: string; icon: string }
> = {
  default: { wrapper: "bg-muted", icon: "text-muted-foreground" },
  noResults: { wrapper: "bg-info/10", icon: "text-info" },
  warning: { wrapper: "bg-warning/10", icon: "text-warning" },
};

/**
 * Estado vazio compacto para telas de detalhe (drawer, view relacional).
 *
 * @example
 * <DetailEmpty title="Registro não encontrado" />
 *
 * @example
 * <DetailEmpty
 *   variant="noResults"
 *   icon={SearchX}
 *   title="Nenhum item corresponde aos filtros"
 * />
 */
export function DetailEmpty({
  title = "Registro não encontrado",
  message,
  icon,
  className,
  action,
  variant = "default",
}: DetailEmptyProps) {
  const styles = detailEmptyStyles[variant];
  const Icon = icon ?? (variant === "noResults" ? SearchX : FileQuestion);
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-4 py-12 text-center",
        className,
      )}
    >
      <div className={cn("rounded-full p-3", styles.wrapper)}>
        <Icon className={cn("h-6 w-6", styles.icon)} />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {message && <p className="max-w-md text-xs text-muted-foreground">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
