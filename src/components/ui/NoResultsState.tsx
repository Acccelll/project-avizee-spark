import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export interface NoResultsStateProps {
  /** Quantidade de filtros ativos (mostrado como chip informativo). */
  activeFiltersCount?: number;
  /** Termo de busca atual (mencionado na descrição quando presente). */
  searchTerm?: string;
  /** Callback para limpar todos os filtros aplicados. */
  onClearFilters?: () => void;
  /** Override do título padrão. */
  title?: string;
  /** Override da descrição padrão. */
  description?: string;
}

/**
 * Estado vazio específico para listas filtradas que não retornaram resultados.
 *
 * Diferencia visualmente do `EmptyState` "nada cadastrado" usando a variant
 * `noResults` (ícone em círculo `bg-info/10`) e oferece ação de limpar
 * filtros pronta — padrão Linear/Notion.
 *
 * @example
 * <NoResultsState
 *   activeFiltersCount={3}
 *   searchTerm={search}
 *   onClearFilters={() => clearAll()}
 * />
 */
export function NoResultsState({
  activeFiltersCount = 0,
  searchTerm,
  onClearFilters,
  title = "Nenhum resultado encontrado",
  description,
}: NoResultsStateProps) {
  const finalDescription =
    description ??
    (searchTerm
      ? `Nenhum item corresponde a "${searchTerm}". Tente outro termo ou ajuste os filtros.`
      : "Tente ajustar ou remover os filtros aplicados para ver mais resultados.");

  const action = onClearFilters ? (
    <div className="flex flex-col items-center gap-2">
      {activeFiltersCount > 0 && (
        <Badge variant="secondary" className="font-normal">
          {activeFiltersCount} {activeFiltersCount === 1 ? "filtro ativo" : "filtros ativos"}
        </Badge>
      )}
      <Button variant="outline" size="sm" onClick={onClearFilters}>
        Limpar filtros
      </Button>
    </div>
  ) : undefined;

  return (
    <EmptyState
      variant="noResults"
      icon={SearchX}
      title={title}
      description={finalDescription}
      action={action}
    />
  );
}
