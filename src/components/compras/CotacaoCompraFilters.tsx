import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";

interface CotacaoCompraFiltersProps {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  activeFilters: FilterChip[];
  onRemoveFilter: (key: string, value?: string) => void;
  onClearAll: () => void;
  count: number;
  statusOptions: MultiSelectOption[];
  statusFilters: string[];
  onStatusChange: (v: string[]) => void;
}

export function CotacaoCompraFilters({
  searchTerm,
  onSearchChange,
  activeFilters,
  onRemoveFilter,
  onClearAll,
  count,
  statusOptions,
  statusFilters,
  onStatusChange,
}: CotacaoCompraFiltersProps) {
  return (
    <AdvancedFilterBar
      searchValue={searchTerm}
      onSearchChange={onSearchChange}
      searchPlaceholder="Buscar por número ou observações..."
      activeFilters={activeFilters}
      onRemoveFilter={onRemoveFilter}
      onClearAll={onClearAll}
      count={count}
    >
      <MultiSelect
        options={statusOptions}
        selected={statusFilters}
        onChange={onStatusChange}
        placeholder="Status"
        className="w-[180px]"
      />
    </AdvancedFilterBar>
  );
}
