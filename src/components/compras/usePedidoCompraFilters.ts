import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { type MultiSelectOption } from "@/components/ui/MultiSelect";
import { formatDate } from "@/lib/format";
import type { PedidoCompra, FornecedorOptionRow } from "./pedidoCompraTypes";
import { canonicalPedidoStatus } from "./comprasStatus";

export const recebimentoFilterOptions: MultiSelectOption[] = [
  { label: "Aguardando Recebimento", value: "aguardando" },
  { label: "Parcialmente Recebido", value: "parcial" },
  { label: "Recebido", value: "recebido" },
];

function getRecebimentoFilter(status: string): string {
  const normalized = canonicalPedidoStatus(status);
  if (normalized === "recebido") return "recebido";
  if (normalized === "parcialmente_recebido") return "parcial";
  if (["aguardando_recebimento", "enviado_ao_fornecedor", "aprovado"].includes(normalized)) return "aguardando";
  return "";
}

export interface PedidoCompraFiltersState {
  searchTerm: string;
  statusFilters: string[];
  fornecedorFilters: string[];
  recebimentoFilters: string[];
  dataInicio: string;
  dataFim: string;
}

export function usePedidoCompraFilters(
  pedidos: PedidoCompra[],
  fornecedoresAtivos: FornecedorOptionRow[],
  statusLabels: Record<string, string>,
) {
  const [searchParams, setSearchParams] = useSearchParams();

  const searchTerm = searchParams.get("q") ?? "";
  const statusFilters = searchParams.getAll("status");
  const fornecedorFilters = searchParams.getAll("fornecedor");
  const recebimentoFilters = searchParams.getAll("recebimento");
  const dataInicio = searchParams.get("dataInicio") ?? searchParams.get("data_inicio") ?? "";
  const dataFim = searchParams.get("dataFim") ?? searchParams.get("data_fim") ?? "";

  const updateParam = (key: string, value: string | string[] | null) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(key);
        if (Array.isArray(value)) {
          value.forEach((v) => next.append(key, v));
        } else if (value) {
          next.set(key, value);
        }
        return next;
      },
      { replace: true },
    );
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
  const setRecebimentoFilters = (fn: string[] | ((prev: string[]) => string[])) => {
    const next = typeof fn === "function" ? fn(recebimentoFilters) : fn;
    updateParam("recebimento", next);
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

  const pedidoNumero = (p: Pick<PedidoCompra, "id" | "numero">) => p.numero || `PC-${p.id}`;

  const filteredData = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return pedidos.filter((p) => {
      if (statusFilters.length > 0 && !statusFilters.includes(p.status)) return false;
      if (fornecedorFilters.length > 0 && !fornecedorFilters.includes(String(p.fornecedor_id || ""))) return false;
      if (recebimentoFilters.length > 0) {
        const rf = getRecebimentoFilter(p.status);
        if (!recebimentoFilters.includes(rf)) return false;
      }
      if (dataInicio && p.data_pedido < dataInicio) return false;
      if (dataFim && p.data_pedido > dataFim) return false;
      if (!query) return true;
      return [
        pedidoNumero(p),
        p.fornecedores?.nome_razao_social,
        p.observacoes,
        p.condicao_pagamento,
      ].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }, [pedidos, searchTerm, statusFilters, fornecedorFilters, recebimentoFilters, dataInicio, dataFim]);

  const activeFilters = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    statusFilters.forEach((f) => chips.push({ key: "status", label: "Status", value: [f], displayValue: statusLabels[f] || f }));
    fornecedorFilters.forEach((f) => {
      const forn = fornecedoresAtivos.find((x) => String(x.id) === f);
      chips.push({ key: "fornecedor", label: "Fornecedor", value: [f], displayValue: forn?.nome_razao_social || f });
    });
    recebimentoFilters.forEach((f) => {
      const opt = recebimentoFilterOptions.find((x) => x.value === f);
      chips.push({ key: "recebimento", label: "Recebimento", value: [f], displayValue: opt?.label || f });
    });
    if (dataInicio) chips.push({ key: "dataInicio", label: "Pedido desde", value: [dataInicio], displayValue: formatDate(dataInicio) });
    if (dataFim) chips.push({ key: "dataFim", label: "Pedido até", value: [dataFim], displayValue: formatDate(dataFim) });
    return chips;
  }, [statusFilters, fornecedorFilters, recebimentoFilters, dataInicio, dataFim, fornecedoresAtivos, statusLabels]);

  const handleRemoveFilter = (key: string, value?: string) => {
    if (key === "status") setStatusFilters((prev) => prev.filter((v) => v !== value));
    if (key === "fornecedor") setFornecedorFilters((prev) => prev.filter((v) => v !== value));
    if (key === "recebimento") setRecebimentoFilters((prev) => prev.filter((v) => v !== value));
    if (key === "dataInicio") setDataInicio("");
    if (key === "dataFim") setDataFim("");
  };

  const handleClearAllFilters = () => {
    setStatusFilters([]);
    setFornecedorFilters([]);
    setRecebimentoFilters([]);
    setDataInicio("");
    setDataFim("");
  };

  return {
    searchTerm,
    setSearchTerm,
    statusFilters,
    setStatusFilters,
    fornecedorFilters,
    setFornecedorFilters,
    recebimentoFilters,
    setRecebimentoFilters,
    dataInicio,
    setDataInicio,
    dataFim,
    setDataFim,
    filteredData,
    activeFilters,
    handleRemoveFilter,
    handleClearAllFilters,
  };
}
