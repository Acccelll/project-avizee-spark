import { ReactNode } from "react";
import { QueryErrorFallback } from "./QueryErrorFallback";

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
  if (isLoading) {
    return <div aria-busy="true">{skeleton}</div>;
  }

  if (isError) {
    return <QueryErrorFallback error={error} onRetry={onRetry} />;
  }

  if (data === undefined || isEmpty(data)) {
    return <>{empty}</>;
  }

  return <>{children(data)}</>;
}