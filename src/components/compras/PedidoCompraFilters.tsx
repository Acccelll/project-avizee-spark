import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { Input } from "@/components/ui/input";
import { FILTER_W_MD, FILTER_W_LG, FILTER_W_DATE } from "@/components/list/filterTokens";
import { recebimentoFilterOptions } from "./usePedidoCompraFilters";

interface PedidoCompraFiltersProps {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  activeFilters: FilterChip[];
  onRemoveFilter: (key: string, value?: string) => void;
  onClearAll: () => void;
  count: number;
  statusFilters: string[];
  onStatusFiltersChange: (v: string[]) => void;
  recebimentoFilters: string[];
  onRecebimentoFiltersChange: (v: string[]) => void;
  fornecedorFilters: string[];
  onFornecedorFiltersChange: (v: string[]) => void;
  dataInicio: string;
  onDataInicioChange: (v: string) => void;
  dataFim: string;
  onDataFimChange: (v: string) => void;
  statusOptions: MultiSelectOption[];
  fornecedorOptions2: MultiSelectOption[];
}

export function PedidoCompraFilters({
  searchTerm,
  onSearchChange,
  activeFilters,
  onRemoveFilter,
  onClearAll,
  count,
  statusFilters,
  onStatusFiltersChange,
  recebimentoFilters,
  onRecebimentoFiltersChange,
  fornecedorFilters,
  onFornecedorFiltersChange,
  dataInicio,
  onDataInicioChange,
  dataFim,
  onDataFimChange,
  statusOptions,
  fornecedorOptions2,
}: PedidoCompraFiltersProps) {
  return (
    <AdvancedFilterBar
      searchValue={searchTerm}
      onSearchChange={onSearchChange}
      searchPlaceholder="Buscar por número, fornecedor ou observações..."
      activeFilters={activeFilters}
      onRemoveFilter={onRemoveFilter}
      onClearAll={onClearAll}
      count={count}
      hideCount
    >
      <MultiSelect
        options={statusOptions}
        selected={statusFilters}
        onChange={onStatusFiltersChange}
        placeholder="Status"
        className={FILTER_W_MD}
      />
      <MultiSelect
        options={recebimentoFilterOptions}
        selected={recebimentoFilters}
        onChange={onRecebimentoFiltersChange}
        placeholder="Recebimento"
        className={FILTER_W_MD}
      />
      <MultiSelect
        options={fornecedorOptions2}
        selected={fornecedorFilters}
        onChange={onFornecedorFiltersChange}
        placeholder="Fornecedor"
        className={FILTER_W_LG}
      />
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={dataInicio}
          onChange={(e) => onDataInicioChange(e.target.value)}
          className={`h-9 text-xs ${FILTER_W_DATE}`}
          title="Pedido desde"
        />
        <span className="text-xs text-muted-foreground">até</span>
        <Input
          type="date"
          value={dataFim}
          onChange={(e) => onDataFimChange(e.target.value)}
          className={`h-9 text-xs ${FILTER_W_DATE}`}
          title="Pedido até"
        />
      </div>
    </AdvancedFilterBar>
  );
}
