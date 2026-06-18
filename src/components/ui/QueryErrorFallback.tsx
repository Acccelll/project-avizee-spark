import { useEffect } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notifyError } from "@/utils/errorMessages";

interface QueryErrorFallbackProps {
  error?: unknown;
  onRetry?: () => void;
  title?: string;
  description?: string;
}

/**
 * Bloco de erro padronizado para listagens que já usam `DataTable`
 * (que cuida do skeleton/empty internamente). Dispara `notifyError`
 * uma única vez quando montado com erro.
 *
 * Equivalente ao estado de erro de `QueryState`, exposto separadamente
 * para evitar tela branca quando uma `useQuery`/`useSupabaseCrud` falha.
 */
export function QueryErrorFallback({
  error,
  onRetry,
  title = "Não foi possível carregar",
  description = "Verifique sua conexão e tente novamente.",
}: QueryErrorFallbackProps) {
  useEffect(() => {
    if (error) notifyError(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      <div className="rounded-full p-4 mb-4 bg-destructive/10">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}