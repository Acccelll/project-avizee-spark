import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { type MultiSelectOption } from "@/components/ui/MultiSelect";
import type { CotacaoCompra } from "./cotacaoCompraTypes";

export function useCotacaoCompraFilters(
  data: CotacaoCompra[],
  statusLabels: Record<string, string>,
) {
  const [searchParams, setSearchParams] = useSearchParams();

  const searchTerm = searchParams.get("q") ?? "";
  const statusFilters = searchParams.getAll("status");

  const updateParam = (key: string, value: string | string[] | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(key);
      if (Array.isArray(value)) {
        value.forEach((v) => next.append(key, v));
      } else if (value) {
        next.set(key, value);
      }
      return next;
    }, { replace: true });
  };

  const setSearchTerm = (v: string) => updateParam("q", v || null);
  const setStatusFilters = (fn: string[] | ((prev: string[]) => string[])) => {
    const next = typeof fn === "function" ? fn(statusFilters) : fn;
    updateParam("status", next);
  };

  const filteredData = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase();
    return data.filter((c) => {
      if (statusFilters.length > 0 && !statusFilters.includes(c.status)) return false;
      if (normalizedSearch) {
        const q = normalizedSearch;
        if (
          !c.numero.toLowerCase().includes(q) &&
          !(c.observacoes || "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [data, statusFilters, searchTerm]);

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
