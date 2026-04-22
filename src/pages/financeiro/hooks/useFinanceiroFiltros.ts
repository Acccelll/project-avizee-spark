import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import type { MultiSelectOption } from "@/components/ui/MultiSelect";
import { periodToFinancialRange } from "@/lib/periodFilter";
import type { Period } from "@/components/filters/periodTypes";
import type { ContaBancaria, Lancamento } from "@/types/domain";

const validPeriods: readonly Period[] = ["7d", "15d", "30d", "90d", "year", "hoje", "todos", "vencidos"];

const isPeriod = (value: string | null): value is Period =>
  value !== null && validPeriods.includes(value as Period);

interface Params {
  data: Lancamento[];
  contasBancarias: ContaBancaria[];
  getLancamentoStatus: (l: Lancamento) => string;
}

export function useFinanceiroFiltros({ data, contasBancarias, getLancamentoStatus }: Params) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tipoParam = searchParams.get("tipo");
  const statusParam = searchParams.get("status");
  const bancoParam = searchParams.get("banco");
  const periodParam = searchParams.get("period");

  const [statusFilters, setStatusFilters] = useState<string[]>(
    statusParam ? statusParam.split(",") : [],
  );
  const [tipoFilters, setTipoFilters] = useState<string[]>(tipoParam ? [tipoParam] : []);
  const [bancoFilters, setBancoFilters] = useState<string[]>(
    bancoParam ? bancoParam.split(",") : [],
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") ?? "");
  const [period, setPeriod] = useState<Period>(isPeriod(periodParam) ? periodParam : "30d");

  useEffect(() => {
    if (tipoParam) setTipoFilters([tipoParam]);
  }, [tipoParam]);

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (searchTerm) next.set("search", searchTerm);
        else next.delete("search");
        if (statusFilters.length) next.set("status", statusFilters.join(","));
        else next.delete("status");
        if (tipoFilters.length) next.set("tipo", tipoFilters.join(","));
        else next.delete("tipo");
        if (bancoFilters.length) next.set("banco", bancoFilters.join(","));
        else next.delete("banco");
        if (period !== "30d") next.set("period", period);
        else next.delete("period");
        return next;
      },
      { replace: true },
    );
  }, [searchTerm, statusFilters, tipoFilters, bancoFilters, period, setSearchParams]);

  const filteredData = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const { dateFrom, dateTo } = periodToFinancialRange(period);
    const isOverdueFilter = period === "vencidos";

    return data.filter((l) => {
      const effectiveStatus = getLancamentoStatus(l);
      if (period === "todos") {
        // sem filtro de período
      } else if (isOverdueFilter) {
        if (effectiveStatus !== "vencido") return false;
      } else {
        if (l.data_vencimento < dateFrom) return false;
        if (dateTo && l.data_vencimento > dateTo) return false;
      }

      if (statusFilters.length > 0 && !statusFilters.includes(effectiveStatus)) return false;
      if (tipoFilters.length > 0 && !tipoFilters.includes(l.tipo)) return false;
      if (bancoFilters.length > 0 && !bancoFilters.includes(l.conta_bancaria_id || "")) return false;

      if (query) {
        const haystack = [
          l.descricao,
          l.clientes?.nome_razao_social,
          l.fornecedores?.nome_razao_social,
          l.forma_pagamento,
          l.banco,
          l.contas_bancarias?.descricao,
          l.contas_bancarias?.bancos?.nome,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [data, statusFilters, tipoFilters, bancoFilters, searchTerm, period, getLancamentoStatus]);

  const activeFilters = useMemo(() => {
    const chips: FilterChip[] = [];

    tipoFilters.forEach((filter) =>
      chips.push({
        key: "tipo",
        label: "Tipo",
        value: [filter],
        displayValue: filter === "receber" ? "A Receber" : "A Pagar",
      }),
    );

    statusFilters.forEach((filter) =>
      chips.push({
        key: "status",
        label: "Status",
        value: [filter],
        displayValue: filter.charAt(0).toUpperCase() + filter.slice(1),
      }),
    );

    bancoFilters.forEach((filter) => {
      const banco = contasBancarias.find((item) => item.id === filter);
      chips.push({
        key: "banco",
        label: "Banco",
        value: [filter],
        displayValue: banco ? `${banco.bancos?.nome} - ${banco.descricao}` : filter,
      });
    });

    return chips;
  }, [tipoFilters, statusFilters, bancoFilters, contasBancarias]);

  const handleRemoveFilter = (key: string, value?: string) => {
    if (key === "tipo") setTipoFilters((prev) => prev.filter((v) => v !== value));
    if (key === "status") setStatusFilters((prev) => prev.filter((v) => v !== value));
    if (key === "banco") setBancoFilters((prev) => prev.filter((v) => v !== value));
  };

  const tipoOpts: MultiSelectOption[] = [
    { label: "A Receber", value: "receber" },
    { label: "A Pagar", value: "pagar" },
  ];
  const bancoOpts: MultiSelectOption[] = contasBancarias.map((item) => ({
    label: `${item.bancos?.nome} - ${item.descricao}`,
    value: item.id,
  }));

  return {
    selectedIds,
    setSelectedIds,
    searchTerm,
    setSearchTerm,
    statusFilters,
    setStatusFilters,
    tipoFilters,
    setTipoFilters,
    bancoFilters,
    setBancoFilters,
    period,
    setPeriod,
    filteredData,
    activeFilters,
    handleRemoveFilter,
    tipoOpts,
    bancoOpts,
  };
}
