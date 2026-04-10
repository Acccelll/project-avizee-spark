import { useMemo, useState } from "react";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import type { PedidoCompra, FornecedorOptionRow } from "./pedidoCompraTypes";

const recebimentoFilterOptions: MultiSelectOption[] = [
  { label: "Aguardando Recebimento", value: "aguardando" },
  { label: "Parcialmente Recebido", value: "parcial" },
  { label: "Recebido", value: "recebido" },
];

function getRecebimentoFilter(status: string): string {
  if (status === "recebido") return "recebido";
  if (status === "parcialmente_recebido") return "parcial";
  if (["aguardando_recebimento", "enviado_ao_fornecedor", "aprovado"].includes(status)) return "aguardando";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [fornecedorFilters, setFornecedorFilters] = useState<string[]>([]);
  const [recebimentoFilters, setRecebimentoFilters] = useState<string[]>([]);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

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
    >
      <MultiSelect
        options={statusOptions}
        selected={statusFilters}
        onChange={onStatusFiltersChange}
        placeholder="Status"
        className="w-[200px]"
      />
      <MultiSelect
        options={recebimentoFilterOptions}
        selected={recebimentoFilters}
        onChange={onRecebimentoFiltersChange}
        placeholder="Recebimento"
        className="w-[200px]"
      />
      <MultiSelect
        options={fornecedorOptions2}
        selected={fornecedorFilters}
        onChange={onFornecedorFiltersChange}
        placeholder="Fornecedor"
        className="w-[220px]"
      />
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={dataInicio}
          onChange={(e) => onDataInicioChange(e.target.value)}
          className="h-9 w-[140px] text-xs"
          title="Pedido desde"
        />
        <span className="text-xs text-muted-foreground">até</span>
        <Input
          type="date"
          value={dataFim}
          onChange={(e) => onDataFimChange(e.target.value)}
          className="h-9 w-[140px] text-xs"
          title="Pedido até"
        />
      </div>
    </AdvancedFilterBar>
  );
}
