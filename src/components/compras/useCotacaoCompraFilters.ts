import { useEffect, useMemo, useState } from "react";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { type MultiSelectOption } from "@/components/ui/MultiSelect";
import type { CotacaoCompra } from "./cotacaoCompraTypes";

export function useCotacaoCompraFilters(
  data: CotacaoCompra[],
  statusLabels: Record<string, string>,
) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const filteredData = useMemo(() => {
    return data.filter((c) => {
      if (statusFilters.length > 0 && !statusFilters.includes(c.status)) return false;
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        if (
          !c.numero.toLowerCase().includes(q) &&
          !(c.observacoes || "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [data, statusFilters, debouncedSearch]);

  const activeFilters = useMemo<FilterChip[]>(() => {
    return statusFilters.map((s) => ({
      key: "status",
      label: "Status",
      value: [s],
      displayValue: statusLabels[s] || s,
    }));
  }, [statusFilters, statusLabels]);

  const handleRemoveFilter = (key: string, value?: string) => {
    if (key === "status") setStatusFilters((prev) => prev.filter((v) => v !== value));
  };

  const statusOptions: MultiSelectOption[] = Object.entries(statusLabels).map(
    ([value, label]) => ({ value, label })
  );

  return {
    searchTerm,
    setSearchTerm,
    statusFilters,
    setStatusFilters,
    filteredData,
    activeFilters,
    handleRemoveFilter,
    statusOptions,
  };
}
