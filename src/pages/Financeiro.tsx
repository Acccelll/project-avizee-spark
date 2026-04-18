import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { FormModal } from "@/components/FormModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SummaryCard } from "@/components/SummaryCard";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { financialPeriods } from "@/components/dashboard/periodTypes";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import {
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  CalendarClock,
  Download,
  List,
  CalendarDays,
  FileDown,
} from "lucide-react";
import { FinanceiroCalendar } from "@/components/financeiro/FinanceiroCalendar";
import { BaixaParcialDialog } from "@/components/financeiro/BaixaParcialDialog";
import { BaixaLoteModal } from "@/components/financeiro/BaixaLoteModal";
import { FinanceiroDrawer } from "@/components/financeiro/FinanceiroDrawer";
import { getEffectiveStatus } from "@/services/financeiro.service";
import { statusFinanceiro as statusFinanceiroSchema, statusToOptions } from "@/lib/statusSchema";
import type { Lancamento, Cliente, Fornecedor } from "@/types/domain";
import { useFinanceiroAuxiliares } from "@/pages/financeiro/hooks/useFinanceiroAuxiliares";
import { useFinanceiroFiltros } from "@/pages/financeiro/hooks/useFinanceiroFiltros";
import { useFinanceiroKpis } from "@/pages/financeiro/hooks/useFinanceiroKpis";
import { useFinanceiroActions } from "@/pages/financeiro/hooks/useFinanceiroActions";
import { buildFinanceiroColumns } from "@/pages/financeiro/config/financeiroColumns";
import { FinanceiroLancamentoForm } from "@/pages/financeiro/components/FinanceiroLancamentoForm";
import { emptyLancamentoForm, type LancamentoForm } from "@/pages/financeiro/types";

const Financeiro = () => {
  const { id: paramId } = useParams<{ id?: string }>();
  const queryClient = useQueryClient();
  const autoOpenedRef = useRef(false);
  const {
    data,
    loading,
    create,
    update,
    remove,
    fetchData,
  } = useSupabaseCrud<Lancamento>({
    table: "financeiro_lancamentos" as const,
    select: "*, clientes(nome_razao_social), fornecedores(nome_razao_social), contas_bancarias(descricao, bancos(nome)), contas_contabeis(descricao, codigo)",
  });

  // Após uma baixa/estorno, o saldo de `contas_bancarias` pode mudar — invalidar caches relacionados.
  const invalidateAfterBaixa = useCallback(() => {
    fetchData();
    queryClient.invalidateQueries({ queryKey: ["contas_bancarias"] });
    queryClient.invalidateQueries({ queryKey: ["ref", "contas_bancarias"] });
  }, [fetchData, queryClient]);

  const clientesCrud = useSupabaseCrud<Cliente>({ table: "clientes" });
  const fornecedoresCrud = useSupabaseCrud<Fornecedor>({ table: "fornecedores" });

  const { contasBancarias, contasContabeis } = useFinanceiroAuxiliares();

  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<Lancamento | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<LancamentoForm>({ ...emptyLancamentoForm });
  const [viewMode, setViewMode] = useState<"lista" | "calendario">("lista");
  const [baixaLoteOpen, setBaixaLoteOpen] = useState(false);
  const [baixaParcialOpen, setBaixaParcialOpen] = useState(false);
  const [baixaParcialTarget, setBaixaParcialTarget] = useState<Lancamento | null>(null);

  const hoje = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);
  const hojeStr = useMemo(() => hoje.toISOString().split("T")[0], [hoje]);

  const getLancamentoStatus = useCallback((l: Lancamento) => getEffectiveStatus(l.status, l.data_vencimento, hoje), [hoje]);

  useEffect(() => {
    if (!paramId || autoOpenedRef.current || loading || data.length === 0) return;
    const found = data.find((l) => l.id === paramId);
    if (found) {
      autoOpenedRef.current = true;
      setSelected(found);
      setDrawerOpen(true);
    }
  }, [paramId, data, loading]);

  const {
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
  } = useFinanceiroFiltros({ data, contasBancarias, getLancamentoStatus });

  const statusOpts = statusToOptions(statusFinanceiroSchema);

  const {
    saving,
    handleSubmit,
    handleExportar,
    handleEstorno,
    estornoTarget,
    setEstornoTarget,
    estornoProcessing,
    estornoMotivo,
    setEstornoMotivo,
  } = useFinanceiroActions({ filteredData, getLancamentoStatus, create, update, fetchData });

  const kpis = useFinanceiroKpis({ filteredData, getLancamentoStatus, hojeStr });

  const openCreate = () => {
    setMode("create");
    setForm({ ...emptyLancamentoForm });
    setModalOpen(true);
  };

  const openEdit = (l: Lancamento) => {
    setMode("edit");
    setSelected(l);
    setForm({
      tipo: l.tipo,
      descricao: l.descricao,
      valor: l.valor,
      data_vencimento: l.data_vencimento,
      data_pagamento: l.data_pagamento || "",
      status: l.status,
      forma_pagamento: l.forma_pagamento || "",
      banco: l.banco || "",
      cartao: l.cartao || "",
      cliente_id: l.cliente_id || "",
      fornecedor_id: l.fornecedor_id || "",
      conta_bancaria_id: l.conta_bancaria_id || "",
      conta_contabil_id: l.conta_contabil_id || "",
      observacoes: l.observacoes || "",
      gerar_parcelas: false,
      num_parcelas: 2,
      intervalo_dias: 30,
    });
    setModalOpen(true);
  };

  const selectedForBaixa = useMemo(
    () => data.filter((l) => selectedIds.includes(l.id)),
    [data, selectedIds],
  );

  const columns = useMemo(
    () =>
      buildFinanceiroColumns({
        getLancamentoStatus,
        hoje,
        hojeStr,
        onBaixaParcial: (l) => {
          setBaixaParcialTarget(l);
          setBaixaParcialOpen(true);
        },
      }),
    [getLancamentoStatus, hoje, hojeStr],
  );

  return (
    <AppLayout>
      <ModulePage title="Contas a Pagar/Receber" subtitle="Gestão unificada de contas a pagar e receber" addLabel="Novo Lançamento" onAdd={openCreate}>
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <PeriodFilter value={period} onChange={setPeriod} options={financialPeriods} />
          <div className="flex gap-1 ml-auto rounded-lg border p-0.5">
            <Button size="sm" variant={viewMode === "lista" ? "default" : "ghost"} className="h-7 gap-1.5 text-xs" onClick={() => setViewMode("lista")}>
              <List className="h-3.5 w-3.5" /> Lista
            </Button>
            <Button size="sm" variant={viewMode === "calendario" ? "default" : "ghost"} className="h-7 gap-1.5 text-xs" onClick={() => setViewMode("calendario")}>
              <CalendarDays className="h-3.5 w-3.5" /> Calendário
            </Button>
          </div>
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => handleExportar("excel")}>
            <FileDown className="h-3.5 w-3.5" /> Exportar
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
          <SummaryCard title="A Vencer" value={kpis.aVencer.toString()} subtitle={formatCurrency(kpis.totalAVencer)} icon={CalendarClock} variant="info" onClick={() => setStatusFilters(["aberto"])} />
          <SummaryCard title="Vence Hoje" value={kpis.venceHoje.toString()} icon={Clock} variant="warning" />
          <SummaryCard title="Vencidos" value={kpis.vencido.toString()} subtitle={formatCurrency(kpis.totalVencido)} icon={AlertTriangle} variant="danger" onClick={() => setStatusFilters(["vencido"])} />
          <SummaryCard title="Parcialmente Baixados" value={kpis.parcialCount.toString()} subtitle={formatCurrency(kpis.totalParcial)} icon={DollarSign} variant="info" onClick={() => setStatusFilters(["parcial"])} />
          <SummaryCard title="Pagos" value={kpis.pagoNoPeriodo.toString()} subtitle={formatCurrency(kpis.totalPago)} icon={CheckCircle} variant="success" onClick={() => setStatusFilters(["pago"])} />
        </div>

        <AdvancedFilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar por descrição, pessoa, banco ou forma de pagamento..."
          activeFilters={activeFilters}
          onRemoveFilter={handleRemoveFilter}
          onClearAll={() => {
            setTipoFilters([]);
            setStatusFilters([]);
            setBancoFilters([]);
          }}
          count={filteredData.length}
          extra={selectedIds.length > 0 ? (
            <Button size="sm" variant="default" className="gap-2" onClick={() => {
              if (selectedIds.length === 0) {
                toast.error("Selecione os lançamentos");
                return;
              }
              setBaixaLoteOpen(true);
            }}>
              <Download className="w-3.5 h-3.5" /> Baixar {selectedIds.length} selecionado(s)
            </Button>
          ) : undefined}
        >
          <MultiSelect options={tipoOpts} selected={tipoFilters} onChange={setTipoFilters} placeholder="Tipo" className="w-[150px]" />
          <MultiSelect options={statusOpts} selected={statusFilters} onChange={setStatusFilters} placeholder="Status" className="w-[180px]" />
          <MultiSelect options={bancoOpts} selected={bancoFilters} onChange={setBancoFilters} placeholder="Bancos" className="w-[200px]" />
        </AdvancedFilterBar>

        {viewMode === "calendario" ? (
          <FinanceiroCalendar data={filteredData} />
        ) : (
          <PullToRefresh onRefresh={fetchData}>
            <DataTable
              columns={columns}
              data={filteredData}
              loading={loading}
              moduleKey="financeiro-lancamentos"
              showColumnToggle={true}
              selectable
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              emptyTitle="Nenhum lançamento encontrado"
              emptyDescription="Tente ajustar os filtros ou crie um novo lançamento."
              onView={(l) => {
                setSelected(l);
                setDrawerOpen(true);
              }}
            />
          </PullToRefresh>
        )}
      </ModulePage>

      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={mode === "create" ? "Novo Lançamento" : "Editar Lançamento"} size="lg">
        <FinanceiroLancamentoForm
          form={form}
          mode={mode}
          saving={saving}
          contasBancarias={contasBancarias}
          contasContabeis={contasContabeis}
          clientes={clientesCrud.data}
          fornecedores={fornecedoresCrud.data}
          setForm={setForm}
          onCancel={() => setModalOpen(false)}
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(mode, form, selected, () => setModalOpen(false));
          }}
        />
      </FormModal>

      <FinanceiroDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        selected={selected}
        effectiveStatus={selected ? getLancamentoStatus(selected) : ""}
        onBaixa={(l) => {
          setBaixaParcialTarget(l);
          setBaixaParcialOpen(true);
        }}
        onEstorno={(l) => {
          setDrawerOpen(false);
          setEstornoTarget(l);
        }}
        onEdit={(l) => {
          setDrawerOpen(false);
          openEdit(l);
        }}
        onDelete={(id) => {
          setDrawerOpen(false);
          remove(id);
        }}
      />

      <BaixaLoteModal
        open={baixaLoteOpen}
        onClose={() => setBaixaLoteOpen(false)}
        selectedLancamentos={selectedForBaixa}
        contasBancarias={contasBancarias}
        onSuccess={() => {
          setSelectedIds([]);
          invalidateAfterBaixa();
        }}
      />

      <ConfirmDialog
        open={!!estornoTarget}
        onClose={() => {
          setEstornoTarget(null);
          setEstornoMotivo("");
        }}
        onConfirm={handleEstorno}
        title="Confirmar Estorno"
        description={`Deseja estornar a baixa do lançamento "${estornoTarget?.descricao}"? O status voltará para Aberto.`}
        confirmLabel="Estornar"
        loading={estornoProcessing}
        confirmDisabled={!estornoMotivo.trim()}
      >
        <div className="space-y-2 mt-2">
          <Label className="text-sm font-medium">Motivo do estorno *</Label>
          <Textarea value={estornoMotivo} onChange={(e) => setEstornoMotivo(e.target.value)} placeholder="Informe o motivo do cancelamento da baixa..." rows={3} />
        </div>
      </ConfirmDialog>

      <BaixaParcialDialog
        open={baixaParcialOpen}
        onClose={() => setBaixaParcialOpen(false)}
        lancamento={baixaParcialTarget}
        contasBancarias={contasBancarias}
        onSuccess={() => {
          invalidateAfterBaixa();
        }}
      />
    </AppLayout>
  );
};

export default Financeiro;
