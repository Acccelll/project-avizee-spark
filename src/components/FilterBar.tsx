import { ReactNode } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface FilterBarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
  onClearFilters?: () => void;
  showClear?: boolean;
  count?: number;
  extra?: ReactNode;
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  children,
  onClearFilters,
  showClear = false,
  count,
  extra,
}: FilterBarProps) {
  const hasSearch = typeof onSearchChange === "function";

  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        {hasSearch && (
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue ?? ""}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9 pr-8"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => onSearchChange?.("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
        {showClear && onClearFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters} className="gap-1 text-muted-foreground">
            <X className="h-3.5 w-3.5" /> Limpar filtros
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 lg:justify-end">
        {extra}
        {count !== undefined && (
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {count} {count === 1 ? "registro" : "registros"}
          </span>
        )}
      </div>
    </div>
  );
}
