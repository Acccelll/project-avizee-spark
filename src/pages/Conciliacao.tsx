import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ModulePage } from "@/components/ModulePage";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/DataTable";
import type { Column } from "@/components/DataTable";
import { SummaryCard } from "@/components/SummaryCard";
import { StatusBadge } from "@/components/StatusBadge";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { supabase } from "@/integrations/supabase/client";
import { parseOFX, type OFXTransaction } from "@/lib/parseOFX";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import {
  Upload, CheckCircle, XCircle, Shuffle, AlertTriangle,
  CheckCheck, GitMerge, Landmark, ChevronDown, ChevronUp,
} from "lucide-react";

interface ContaBancaria {
  id: string;
  nome: string;
  banco?: string;
}

interface Lancamento {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  tipo: string;
  status: string;
  nota_fiscal_id?: string | null;
  documento_pai_id?: string | null;
  conta_bancaria_id?: string | null;
  forma_pagamento?: string | null;
  contas_bancarias?: { descricao: string; bancos?: { nome: string } } | null;
}

interface LancamentoComStatus extends Lancamento {
  statusConciliacao: string;
  extratoId: string | null;
  divergencia: number | null;
}

interface Match {
  extratoId: string;
  lancamentoId: string;
}

const statusConciliacaoOptions: MultiSelectOption[] = [
  { value: "pendente", label: "Pendente" },
  { value: "conciliado", label: "Conciliado" },
  { value: "divergente", label: "Divergente" },
];

const tipoOptions: MultiSelectOption[] = [
  { value: "receber", label: "A Receber" },
  { value: "pagar", label: "A Pagar" },
];

const origemOptions: MultiSelectOption[] = [
  { value: "manual", label: "Manual" },
  { value: "nf", label: "NF Fiscal" },
  { value: "parcela", label: "Parcelamento" },
];

export default function Conciliacao() {
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [selectedConta, setSelectedConta] = useState<string>("");
  const [extratoItems, setExtratoItems] = useState<OFXTransaction[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [loadingLanc, setLoadingLanc] = useState(false);
  const [showOFXPane, setShowOFXPane] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Period filter state (independent of OFX)
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [dataFim, setDataFim] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1, 0);
    return d.toISOString().split("T")[0];
  });

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusConcFilters, setStatusConcFilters] = useState<string[]>([]);
  const [tipoFilters, setTipoFilters] = useState<string[]>([]);
  const [origemFilters, setOrigemFilters] = useState<string[]>([]);

  // ─── Load contas bancárias ───────────────────────────────────────────────
  useEffect(() => {
    (supabase.from as any)("contas_bancarias")
      .select("id, descricao, bancos(nome)")
      .eq("ativo", true)
      .then(({ data }: any) => {
        if (data) {
          setContasBancarias(
            data.map((d: any) => ({
              id: d.id,
              nome: d.descricao,
              banco: d.bancos?.nome,
            })) as ContaBancaria[],
          );
        }
      });
  }, []);

  // ─── Load lancamentos based on account + period ───────────────────────────
  const loadLancamentosFromPeriod = useCallback(async (from: string, to: string, contaId: string) => {
    if (!contaId) return;
    setLoadingLanc(true);
    try {
      const { data } = await supabase
        .from("financeiro_lancamentos")
        .select(
          "id, descricao, valor, data_vencimento, tipo, status, nota_fiscal_id, documento_pai_id, conta_bancaria_id, forma_pagamento, contas_bancarias(descricao, bancos(nome))",
        )
        .eq("ativo", true)
        .eq("conta_bancaria_id", contaId)
        .gte("data_vencimento", from)
        .lte("data_vencimento", to)
        .order("data_vencimento", { ascending: true });
      setLancamentos((data as Lancamento[]) || []);
    } finally {
      setLoadingLanc(false);
    }
  }, []);

  useEffect(() => {
    if (selectedConta) {
      loadLancamentosFromPeriod(dataInicio, dataFim, selectedConta);
      setMatches([]);
    } else {
      setLancamentos([]);
    }
  }, [selectedConta, dataInicio, dataFim, loadLancamentosFromPeriod]);

  // ─── OFX file handling ───────────────────────────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const text = await file.text();
      const items = parseOFX(text);
      if (items.length === 0) {
        toast.error("Nenhuma transação encontrada no arquivo OFX.");
        return;
      }
      setExtratoItems(items);
      setMatches([]);
      setShowOFXPane(true);
      toast.success(`${items.length} transações importadas do extrato.`);

      // If no account selected, just show OFX items
      // If account selected, also refresh lancamentos for the OFX period
      if (selectedConta) {
        const dates = items.map((i) => i.data).sort();
        await loadLancamentosFromPeriod(dates[0], dates[dates.length - 1], selectedConta);
      }
    } catch (err: any) {
      toast.error("Erro ao processar arquivo OFX: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleContaChange = async (contaId: string) => {
    setSelectedConta(contaId);
    setMatches([]);
  };

  // ─── Auto-match ──────────────────────────────────────────────────────────
  const handleAutoMatch = () => {
    const newMatches: Match[] = [];
    const usedLancamentos = new Set<string>();

    for (const extrato of extratoItems) {
      const candidate = lancamentos.find((l) => {
        if (usedLancamentos.has(l.id)) return false;
        const valorMatch = Math.abs(Math.abs(l.valor) - Math.abs(extrato.valor)) < 0.01;
        if (!valorMatch) return false;
        const extratoDate = new Date(extrato.data);
        const lancDate = new Date(l.data_vencimento);
        const diffDays = Math.abs((extratoDate.getTime() - lancDate.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= 3;
      });

      if (candidate) {
        newMatches.push({ extratoId: extrato.id, lancamentoId: candidate.id });
        usedLancamentos.add(candidate.id);
      }
    }

    setMatches(newMatches);
    toast.success(`${newMatches.length} pares encontrados automaticamente.`);
  };

  const handleManualMatch = (extratoId: string, lancamentoId: string) => {
    setMatches((prev) => {
      const filtered = prev.filter((m) => m.extratoId !== extratoId);
      if (lancamentoId === "") return filtered;
      return [...filtered, { extratoId, lancamentoId }];
    });
  };

  // ─── Confirm reconciliation ──────────────────────────────────────────────
  const handleConfirmarConciliacao = async () => {
    if (matches.length === 0) {
      toast.error("Nenhum par confirmado para conciliar.");
      return;
    }

    // Structured payload — ready to be persisted when a service is plugged in.
    const payload = {
      conta_bancaria_id: selectedConta,
      data_conciliacao: new Date().toISOString(),
      pares: matches.map((m) => {
        const extrato = extratoItems.find((e) => e.id === m.extratoId);
        const lancamento = lancamentos.find((l) => l.id === m.lancamentoId);
        return {
          extrato_id: m.extratoId,
          lancamento_id: m.lancamentoId,
          valor_extrato: extrato?.valor ?? null,
          valor_lancamento: lancamento?.valor ?? null,
        };
      }),
    };

    setConfirming(true);
    try {
      // TODO: replace with a conciliacao.service.ts call when the table is ready.
      // Example: await confirmarConciliacao(payload);
      // The payload is fully structured and validated, ready to plug into a service.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _payload = payload;

      const total = extratoItems.length;
      const pareados = matches.length;
      const semPar = total - pareados;
      toast.warning(
        `Revisão concluída: ${pareados} par(es) identificado(s), ${semPar} sem correspondência.` +
          " Atenção: esta ação ainda não foi gravada no banco de dados.",
      );
    } finally {
      setConfirming(false);
    }
  };

  // ─── Derived data ─────────────────────────────────────────────────────────
  const getMatch = (extratoId: string) => matches.find((m) => m.extratoId === extratoId);
  const usedLancamentoIds = new Set(matches.map((m) => m.lancamentoId));

  const pareados = matches.length;
  const semParOFX = extratoItems.length - pareados;
  const pendentesERP = lancamentos.length - pareados;

  const lancamentosComStatus = useMemo((): LancamentoComStatus[] => {
    return lancamentos.map((l) => {
      const match = matches.find((m) => m.lancamentoId === l.id);
      const extratoItem = match ? extratoItems.find((e) => e.id === match.extratoId) : null;

      let statusConciliacao = "pendente";
      let divergencia: number | null = null;

      if (match && extratoItem) {
        const diff = Math.abs(Math.abs(l.valor) - Math.abs(extratoItem.valor));
        if (diff < 0.01) {
          statusConciliacao = "conciliado";
        } else {
          statusConciliacao = "divergente";
          divergencia = diff;
        }
      }

      return {
        ...l,
        statusConciliacao,
        extratoId: match?.extratoId ?? null,
        divergencia,
      };
    });
  }, [lancamentos, matches, extratoItems]);

  // ─── Filtered data for DataTable ─────────────────────────────────────────
  const filteredData = useMemo(() => {
    return lancamentosComStatus.filter((l) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (
          !l.descricao?.toLowerCase().includes(term) &&
          !l.tipo?.toLowerCase().includes(term) &&
          !l.status?.toLowerCase().includes(term) &&
          !l.forma_pagamento?.toLowerCase().includes(term)
        ) return false;
      }
      if (statusConcFilters.length > 0 && !statusConcFilters.includes(l.statusConciliacao)) return false;
      if (tipoFilters.length > 0 && !tipoFilters.includes(l.tipo)) return false;
      if (origemFilters.length > 0) {
        const isNF = !!l.nota_fiscal_id;
        const isParcela = !!l.documento_pai_id;
        const isManual = !isNF && !isParcela;
        const matchesOrigem =
          (origemFilters.includes("nf") && isNF) ||
          (origemFilters.includes("parcela") && isParcela) ||
          (origemFilters.includes("manual") && isManual);
        if (!matchesOrigem) return false;
      }
      return true;
    });
  }, [lancamentosComStatus, searchTerm, statusConcFilters, tipoFilters, origemFilters]);

  // ─── DataTable columns ────────────────────────────────────────────────────
  const columns: Column<LancamentoComStatus>[] = [
    {
      key: "data_vencimento",
      label: "Data",
      sortable: true,
      render: (l) => <span className="text-sm whitespace-nowrap">{formatDate(l.data_vencimento)}</span>,
    },
    {
      key: "descricao",
      label: "Descrição",
      sortable: true,
      render: (l) => <span className="text-sm">{l.descricao}</span>,
    },
    {
      key: "valor",
      label: "Valor",
      sortable: true,
      render: (l) => (
        <span className={`font-mono font-semibold text-sm ${l.tipo === "receber" ? "text-success" : "text-destructive"}`}>
          {l.tipo === "receber" ? "+" : "-"}{formatCurrency(Math.abs(l.valor))}
        </span>
      ),
    },
    {
      key: "tipo",
      label: "Tipo",
      sortable: true,
      render: (l) => (
        <Badge
          variant={l.tipo === "receber" ? "default" : "secondary"}
          className="text-[10px] whitespace-nowrap"
        >
          {l.tipo === "receber" ? "A Receber" : "A Pagar"}
        </Badge>
      ),
    },
    {
      key: "statusConciliacao",
      label: "Conciliação",
      sortable: true,
      render: (l) => (
        <div className="flex flex-col gap-0.5">
          <StatusBadge status={l.statusConciliacao} />
          {l.divergencia !== null && (
            <span className="text-[10px] text-warning font-mono">
              Δ {formatCurrency(l.divergencia)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status Financeiro",
      sortable: true,
      render: (l) => <StatusBadge status={l.status} />,
    },
    {
      key: "origem",
      label: "Origem",
      hidden: true,
      render: (l) => {
        if (l.nota_fiscal_id)
          return <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/5 whitespace-nowrap">NF Fiscal</Badge>;
        if (l.documento_pai_id)
          return <Badge variant="outline" className="text-xs whitespace-nowrap">Parcelamento</Badge>;
        return <Badge variant="outline" className="text-xs text-muted-foreground whitespace-nowrap">Manual</Badge>;
      },
    },
    {
      key: "forma_pagamento",
      label: "Forma Pgto",
      hidden: true,
      render: (l) =>
        l.forma_pagamento ? (
          <span className="text-xs">{l.forma_pagamento}</span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
    {
      key: "conta_bancaria",
      label: "Banco/Conta",
      hidden: true,
      render: (l) => {
        if (!l.contas_bancarias) return <span className="text-muted-foreground text-xs">—</span>;
        return (
          <span className="text-xs">
            {l.contas_bancarias.bancos?.nome} — {l.contas_bancarias.descricao}
          </span>
        );
      },
    },
  ];

  // ─── Active filter chips ──────────────────────────────────────────────────
  const activeFilterChips = useMemo((): FilterChip[] => {
    const chips: FilterChip[] = [];
    if (statusConcFilters.length > 0)
      chips.push({ key: "statusConc", label: "Conciliação", value: statusConcFilters, displayValue: statusConcFilters.join(", ") });
    if (tipoFilters.length > 0)
      chips.push({ key: "tipo", label: "Tipo", value: tipoFilters, displayValue: tipoFilters.join(", ") });
    if (origemFilters.length > 0)
      chips.push({ key: "origem", label: "Origem", value: origemFilters, displayValue: origemFilters.join(", ") });
    return chips;
  }, [statusConcFilters, tipoFilters, origemFilters]);

  const handleRemoveFilter = (key: string) => {
    if (key === "statusConc") setStatusConcFilters([]);
    if (key === "tipo") setTipoFilters([]);
    if (key === "origem") setOrigemFilters([]);
  };

  const handleClearAll = () => {
    setStatusConcFilters([]);
    setTipoFilters([]);
    setOrigemFilters([]);
  };

  return (
    <AppLayout>
      <ModulePage
        title="Conciliação Bancária"
        subtitle="Central de conferência financeira entre ERP e movimentação real"
      >
        {/* ── TOP CONTROLS: conta + period + import ─────────────────────────── */}
        <div className="flex flex-wrap gap-3 mb-5 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Landmark className="w-3 h-3" />Conta Bancária
            </label>
            <Select value={selectedConta} onValueChange={handleContaChange}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Selecionar conta..." />
              </SelectTrigger>
              <SelectContent>
                {contasBancarias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}{c.banco ? ` — ${c.banco}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">De</label>
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-36"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Até</label>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-36"
            />
          </div>

          <div className="flex gap-2 ml-auto">
            <input
              ref={fileInputRef}
              type="file"
              accept=".ofx,.qfx,.xml"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              variant="outline"
              size="sm"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? "Importando..." : "Importar OFX"}
            </Button>

            {extratoItems.length > 0 && lancamentos.length > 0 && (
              <Button onClick={handleAutoMatch} variant="secondary" size="sm">
                <Shuffle className="w-4 h-4 mr-2" />
                Match Automático
              </Button>
            )}
          </div>
        </div>

        {/* ── SUMMARY CARDS ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SummaryCard
            title="Conciliados"
            value={pareados}
            subtitle={extratoItems.length > 0 ? `de ${extratoItems.length} do extrato` : "pares confirmados"}
            variant="success"
            icon={CheckCheck}
          />
          <SummaryCard
            title="Pendentes ERP"
            value={pendentesERP}
            subtitle="lançamentos sem par"
            variant="warning"
            icon={GitMerge}
          />
          <SummaryCard
            title="Sem Correspondência"
            value={semParOFX}
            subtitle={extratoItems.length > 0 ? "itens do extrato OFX" : "importe um extrato OFX"}
            variant={semParOFX > 0 ? "danger" : "default"}
            icon={XCircle}
          />
          <SummaryCard
            title="Total no Período"
            value={lancamentos.length}
            subtitle={`${selectedConta ? "lançamentos da conta" : "selecione uma conta"}`}
            variant="info"
            icon={Landmark}
          />
        </div>

        {/* ── FILTER BAR + DATATABLE ───────────────────────────────────────── */}
        <AdvancedFilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar por descrição, tipo, status ou forma de pagamento..."
          activeFilters={activeFilterChips}
          onRemoveFilter={handleRemoveFilter}
          onClearAll={handleClearAll}
          count={filteredData.length}
        >
          <MultiSelect
            options={statusConciliacaoOptions}
            selected={statusConcFilters}
            onChange={setStatusConcFilters}
            placeholder="Conciliação"
            className="w-[140px]"
          />
          <MultiSelect
            options={tipoOptions}
            selected={tipoFilters}
            onChange={setTipoFilters}
            placeholder="Tipo"
            className="w-[120px]"
          />
          <MultiSelect
            options={origemOptions}
            selected={origemFilters}
            onChange={setOrigemFilters}
            placeholder="Origem"
            className="w-[120px]"
          />
        </AdvancedFilterBar>

        <DataTable
          columns={columns}
          data={filteredData}
          loading={loadingLanc}
          moduleKey="conciliacao"
          showColumnToggle={true}
          emptyTitle={
            !selectedConta
              ? "Selecione uma conta bancária"
              : "Nenhum lançamento encontrado"
          }
          emptyDescription={
            !selectedConta
              ? "Escolha uma conta e um período para visualizar os lançamentos para conciliação."
              : "Tente ajustar o período ou os filtros de busca."
          }
        />

        {/* ── OFX MATCHING SECTION (secondary, only when OFX loaded) ────────── */}
        {extratoItems.length > 0 && (
          <div className="mt-6 rounded-lg border border-border/60">
            {/* Section header */}
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/30 transition-colors rounded-t-lg"
              onClick={() => setShowOFXPane((v) => !v)}
            >
              <span className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-muted-foreground" />
                Correspondência OFX — {extratoItems.length} transações importadas
                <Badge variant="outline" className="text-xs font-normal">
                  {pareados} pareados · {semParOFX} sem par
                </Badge>
              </span>
              {showOFXPane ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {showOFXPane && (
              <div className="p-4 border-t border-border/60">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                  {/* Left: extrato OFX */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                      Extrato OFX ({extratoItems.length} transações)
                    </h3>
                    <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                      {extratoItems.map((item) => {
                        const match = getMatch(item.id);
                        const isPareado = !!match;
                        return (
                          <div
                            key={item.id}
                            className={`rounded-lg border p-3 transition-colors ${
                              isPareado
                                ? "border-success/40 bg-success/5"
                                : "border-destructive/40 bg-destructive/5"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{item.descricao || "Sem descrição"}</p>
                                <p className="text-xs text-muted-foreground">{formatDate(item.data)}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span
                                  className={`text-sm font-mono font-semibold ${
                                    item.valor >= 0 ? "text-success" : "text-destructive"
                                  }`}
                                >
                                  {formatCurrency(item.valor)}
                                </span>
                                {isPareado ? (
                                  <CheckCircle className="w-4 h-4 text-success" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-destructive" />
                                )}
                              </div>
                            </div>
                            <div className="mt-2">
                              <Select
                                value={match?.lancamentoId || ""}
                                onValueChange={(val) => handleManualMatch(item.id, val)}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder="Vincular lançamento..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">Nenhum</SelectItem>
                                  {lancamentos
                                    .filter((l) => !usedLancamentoIds.has(l.id) || l.id === match?.lancamentoId)
                                    .map((l) => (
                                      <SelectItem key={l.id} value={l.id}>
                                        {formatDate(l.data_vencimento)} · {l.descricao} · {formatCurrency(l.valor)}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right: lançamentos ERP */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                      Lançamentos ERP ({lancamentos.length} no período)
                    </h3>
                    <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                      {lancamentos.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">
                          {selectedConta
                            ? "Nenhum lançamento encontrado no período."
                            : "Selecione uma conta bancária para carregar lançamentos."}
                        </p>
                      ) : (
                        lancamentos.map((l) => {
                          const isPareado = usedLancamentoIds.has(l.id);
                          return (
                            <div
                              key={l.id}
                              className={`rounded-lg border p-3 transition-colors ${
                                isPareado
                                  ? "border-success/40 bg-success/5"
                                  : "border-border bg-card"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{l.descricao}</p>
                                  <p className="text-xs text-muted-foreground">{formatDate(l.data_vencimento)}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-sm font-mono font-semibold">{formatCurrency(l.valor)}</span>
                                  <Badge variant={l.tipo === "receber" ? "default" : "secondary"} className="text-[10px]">
                                    {l.tipo}
                                  </Badge>
                                  {isPareado && <CheckCircle className="w-4 h-4 text-success" />}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* OFX footer with warning + confirm action */}
                <div className="rounded-lg border border-border/60 bg-muted/10 p-4 flex flex-col gap-3">
                  <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2">
                    <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      <strong>Atenção:</strong> a confirmação abaixo ainda não persiste os pares no banco de dados.
                      Os lançamentos conciliados precisam ser revisados manualmente por enquanto.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex gap-6 text-sm">
                      <div>
                        <span className="text-muted-foreground">Pareados: </span>
                        <span className="font-semibold text-success">{pareados}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Sem correspondência: </span>
                        <span className="font-semibold text-destructive">{semParOFX}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total OFX: </span>
                        <span className="font-semibold">{extratoItems.length}</span>
                      </div>
                    </div>
                    <Button
                      onClick={handleConfirmarConciliacao}
                      disabled={matches.length === 0 || confirming}
                      variant="outline"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {confirming ? "Processando..." : "Confirmar Revisão"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── EMPTY STATE (no account selected, no OFX) ────────────────────── */}
        {!selectedConta && extratoItems.length === 0 && (
          <div className="py-12 text-center border rounded-xl bg-muted/10 mt-4">
            <Landmark className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">Selecione uma conta bancária para começar</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Escolha a conta e o período para ver os lançamentos e iniciar a conciliação
            </p>
          </div>
        )}
      </ModulePage>
    </AppLayout>
  );
}
