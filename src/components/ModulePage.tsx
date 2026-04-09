import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ModulePageProps {
  title: string;
  subtitle?: string;
  addLabel?: string;
  onAdd?: () => void;
  children: ReactNode;
  count?: number;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  toolbarExtra?: ReactNode;
  showToolbar?: boolean;
  summaryCards?: ReactNode;
  headerActions?: ReactNode;
}

export function ModulePage({
  title,
  subtitle,
  addLabel,
  onAdd,
  children,
  count,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  filters,
  toolbarExtra,
  showToolbar,
  summaryCards,
  headerActions,
}: ModulePageProps) {
  const hasSearch = typeof onSearchChange === "function";
  const shouldShowToolbar = showToolbar ?? Boolean(hasSearch || filters || toolbarExtra || count !== undefined);

  return (
    <div>
      {/* Page Header — stacks on mobile */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {headerActions}
          {addLabel && (
            <Button onClick={onAdd} className="h-11 gap-2 sm:h-9 w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              {addLabel}
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards / KPIs */}
      {summaryCards && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:gap-4">
          {summaryCards}
        </div>
      )}

      {/* Toolbar: Search + Filters */}
      {shouldShowToolbar && (
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            {hasSearch && (
              <div className="relative w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchValue ?? ""}
                  onChange={(event) => onSearchChange?.(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="pl-9 pr-8 h-11 sm:h-9"
                />
                {searchValue && (
                  <button
                    type="button"
                    onClick={() => onSearchChange?.("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Limpar busca"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
            {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
          </div>

          <div className="flex items-center justify-between gap-3 lg:justify-end">
            {toolbarExtra}
            {count !== undefined && (
              <span className="whitespace-nowrap text-sm text-muted-foreground">
                {count} {count === 1 ? "registro" : "registros"}
              </span>
            )}
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
