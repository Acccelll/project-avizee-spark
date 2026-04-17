import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { type MultiSelectOption } from "@/components/ui/MultiSelect";
import { formatDate } from "@/lib/format";
import type { CotacaoCompra } from "./cotacaoCompraTypes";

export function useCotacaoCompraFilters(
  data: CotacaoCompra[],
  statusLabels: Record<string, string>,
) {
  const [searchParams, setSearchParams] = useSearchParams();

  const searchTerm = searchParams.get("q") ?? "";
  const statusFilters = searchParams.getAll("status");
  const fornecedorFilters = searchParams.getAll("fornecedor");
  const dataInicio = searchParams.get("dataInicio") ?? searchParams.get("data_inicio") ?? "";
  const dataFim = searchParams.get("dataFim") ?? searchParams.get("data_fim") ?? "";

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
  const setFornecedorFilters = (fn: string[] | ((prev: string[]) => string[])) => {
    const next = typeof fn === "function" ? fn(fornecedorFilters) : fn;
    updateParam("fornecedor", next);
  };
  const setDataInicio = (v: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("data_inicio");
      next.delete("dataInicio");
      if (v) next.set("dataInicio", v);
      return next;
    }, { replace: true });
  };
  const setDataFim = (v: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("data_fim");
      next.delete("dataFim");
      if (v) next.set("dataFim", v);
      return next;
    }, { replace: true });
  };

  const filteredData = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase();
    return data.filter((c) => {
      if (statusFilters.length > 0 && !statusFilters.includes(c.status)) return false;
      if (fornecedorFilters.length > 0) {
        const fornecedorId =
          "fornecedor_id" in c
            ? String((c as Record<string, unknown>).fornecedor_id || "")
            : "";
        if (!fornecedorFilters.includes(fornecedorId)) return false;
      }
      if (dataInicio && c.data_cotacao < dataInicio) return false;
      if (dataFim && c.data_cotacao > dataFim) return false;
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
  }, [data, statusFilters, fornecedorFilters, dataInicio, dataFim, searchTerm]);

  const activeFilters = useMemo<FilterChip[]>(() => {
    const chips = statusFilters.map((s) => ({
      key: "status",
      label: "Status",
      value: [s],
      displayValue: statusLabels[s] || s,
    }));
    fornecedorFilters.forEach((f) => {
      chips.push({
        key: "fornecedor",
        label: "Fornecedor",
        value: [f],
        displayValue: f,
      });
    });
    if (dataInicio) {
      chips.push({
        key: "dataInicio",
        label: "Cotação desde",
        value: [dataInicio],
        displayValue: formatDate(dataInicio),
      });
    }
    if (dataFim) {
      chips.push({
        key: "dataFim",
        label: "Cotação até",
        value: [dataFim],
        displayValue: formatDate(dataFim),
      });
    }
    return chips;
  }, [statusFilters, statusLabels, fornecedorFilters, dataInicio, dataFim]);

  const handleRemoveFilter = (key: string, value?: string) => {
    if (key === "status") setStatusFilters((prev) => prev.filter((v) => v !== value));
    if (key === "fornecedor") setFornecedorFilters((prev) => prev.filter((v) => v !== value));
    if (key === "dataInicio") setDataInicio("");
    if (key === "dataFim") setDataFim("");
  };

  const statusOptions: MultiSelectOption[] = Object.entries(statusLabels).map(
    ([value, label]) => ({ value, label })
  );

  return {
    searchTerm,
    setSearchTerm,
    statusFilters,
    setStatusFilters,
    fornecedorFilters,
    setFornecedorFilters,
    dataInicio,
    setDataInicio,
    dataFim,
    setDataFim,
    filteredData,
    activeFilters,
    handleRemoveFilter,
    statusOptions,
  };
}
