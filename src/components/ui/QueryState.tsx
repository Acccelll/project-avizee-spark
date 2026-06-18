import { ReactNode, useEffect } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notifyError } from "@/utils/errorMessages";

interface QueryStateProps<T> {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  data: T | undefined;
  /** Predicado de "vazio". Default: array com length 0. */
  isEmpty?: (data: T) => boolean;
  /** Callback do botão "Tentar novamente" no estado de erro. */
  onRetry?: () => void;
  /** Skeleton específico da tela (renderizado com `aria-busy`). */
  skeleton: ReactNode;
  /** Placeholder de lista vazia (tipicamente `<EmptyState .../>`). */
  empty: ReactNode;
  /** Render do conteúdo quando há dados. */
  children: (data: T) => ReactNode;
}

function defaultIsEmpty<T>(data: T): boolean {
  if (Array.isArray(data)) return data.length === 0;
  if (data == null) return true;
  if (typeof data === "object") return Object.keys(data as object).length === 0;
  return false;
}

/**
 * Wrapper de estados de consulta para listagens/telas de dados.
 *
 * Padroniza skeleton (loading), empty state, e bloco de erro com retry,
 * evitando tela branca quando uma `useQuery` falha. Em caso de erro,
 * dispara `notifyError` uma única vez (toast via sonner).
 *
 * @example
 * <QueryState
 *   isLoading={query.isLoading}
 *   isError={query.isError}
 *   error={query.error}
 *   data={query.data}
 *   onRetry={() => query.refetch()}
 *   skeleton={<TableSkeleton rows={8} />}
 *   empty={<EmptyState title="Nada por aqui" />}
 * >
 *   {(rows) => <DataTable data={rows} />}
 * </QueryState>
 */
export function QueryState<T>({
  isLoading,
  isError,
  error,
  data,
  isEmpty = defaultIsEmpty,
  onRetry,
  skeleton,
  empty,
  children,
}: QueryStateProps<T>) {
  useEffect(() => {
    if (isError && error) notifyError(error);
  }, [isError, error]);

  if (isLoading) {
    return <div aria-busy="true">{skeleton}</div>;
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center py-16 px-4 text-center"
      >
        <div className="rounded-full p-4 mb-4 bg-destructive/10">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1">
          Não foi possível carregar
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-4">
          Verifique sua conexão e tente novamente.
        </p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        )}
      </div>
    );
  }

  if (data === undefined || isEmpty(data)) {
    return <>{empty}</>;
  }

  return <>{children(data)}</>;
}