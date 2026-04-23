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
  /**
   * Inline mode — sem div wrapper. Renderiza apenas o anel,
   * herdando cor (`currentColor`) para uso dentro de buttons/inputs.
   */
  inline?: boolean;
}

/**
 * Spinner padronizado do sistema. Substitui as 3 implementações ad-hoc
 * (Loader2 inline, border-b-2, border-4) garantindo aria-label consistente.
 */
export function Spinner({ size = "md", label = "Carregando", className, inline = false }: SpinnerProps) {
  if (inline) {
    return (
      <span
        role="status"
        aria-label={label}
        className={cn(
          "inline-block animate-spin rounded-full border-current border-t-transparent align-[-0.125em]",
          sizeMap[size],
          className,
        )}
      >
        <span className="sr-only">{label}</span>
      </span>
    );
  }
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

interface PageSpinnerProps {
  /** Mensagem visível abaixo do spinner. Default: "Carregando...". */
  label?: string;
  /** Quando true, oculta a mensagem visível (mantém apenas aria-label). */
  hideLabel?: boolean;
}

/**
 * Spinner centralizado em viewport completo. Usado em route guards
 * (Protected/Admin/Social) — sem shell ainda renderizado.
 *
 * Exibe mensagem visível abaixo do spinner para evitar sensação de "travado"
 * em rotas que dependem de auth + permissões (1-2s).
 *
 * @example
 * <FullPageSpinner label="Verificando permissões..." />
 */
export function FullPageSpinner({ label = "Carregando...", hideLabel = false }: PageSpinnerProps = {}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" label={label} />
        {!hideLabel && (
          <p className="text-sm text-muted-foreground" aria-hidden="true">
            {label}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Spinner centralizado dentro do conteúdo (fallback para LazyPage e Suspense).
 * Mantém shell (sidebar/header) visível.
 *
 * @example
 * <ContentSpinner label="Carregando página..." />
 */
export function ContentSpinner({ label = "Carregando...", hideLabel = false }: PageSpinnerProps = {}) {
  return (
    <div className="flex items-center justify-center flex-1 min-h-[calc(100vh-4rem)]">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="md" label={label} />
        {!hideLabel && (
          <p className="text-sm text-muted-foreground" aria-hidden="true">
            {label}
          </p>
        )}
      </div>
    </div>
  );
}
