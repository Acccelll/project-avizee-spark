import { cn } from "@/lib/utils";

export type SpinnerSize = "sm" | "md" | "lg";

const sizeMap: Record<SpinnerSize, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-8 w-8 border-[3px]",
};

export interface SpinnerProps {
  size?: SpinnerSize;
  /** Accessible label for screen readers. Default: "Carregando". */
  label?: string;
  className?: string;
}

/**
 * Spinner padronizado do sistema. Substitui as 3 implementações ad-hoc
 * (Loader2 inline, border-b-2, border-4) garantindo aria-label consistente.
 */
export function Spinner({ size = "md", label = "Carregando", className }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        "animate-spin rounded-full border-primary border-t-transparent",
        sizeMap[size],
        className,
      )}
    >
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * Spinner centralizado em viewport completo. Usado em route guards
 * (Protected/Admin/Social) e Suspense fallback de páginas.
 */
export function FullPageSpinner({ label }: { label?: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Spinner size="lg" label={label} />
    </div>
  );
}

/**
 * Spinner centralizado dentro do conteúdo (fallback para LazyPage).
 */
export function ContentSpinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center flex-1 min-h-[calc(100vh-4rem)]">
      <Spinner size="md" label={label} />
    </div>
  );
}
