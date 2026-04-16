
// LEGADO: Este módulo é o fluxo antigo de compras (/compras).
// O fluxo canônico é /cotacoes-compra → /pedidos-compra.
// Mantido apenas para compatibilidade temporária — NÃO expandir.
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { SummaryCard } from "@/components/SummaryCard";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Card, CardContent } from "@/components/ui/card";
import { Info, ShoppingCart, Clock, CheckCircle2 } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useCompras, statusLabels, type Compra } from "@/hooks/useCompras";
import { CompraFormModal } from "@/components/compras/CompraFormModal";
import { CompraDetailDrawer } from "@/components/compras/CompraDetailDrawer";

const columns = [
  {
    key: "numero",
    mobileCard: true,
    label: "Nº",
    render: (c: Compra) => (
      <span className="font-mono text-xs font-medium text-primary">{c.numero}</span>
    ),
  },
  {
    key: "fornecedor",
    label: "Fornecedor",
    render: (c: Compra) => c.fornecedores?.nome_razao_social || "—",
  },
  {
    key: "data_compra",
    label: "Data",
    render: (c: Compra) =>
      c.data_compra ? new Date(c.data_compra).toLocaleDateString("pt-BR") : "—",
  },
  {
    key: "valor_total",
    mobileCard: true,
    label: "Total",
    render: (c: Compra) => (
      <span className="font-semibold font-mono">
        {formatCurrency(Number(c.valor_total || 0))}
      </span>
    ),
  },
  {
    key: "status",
    label: "Status",
    render: (c: Compra) => (
      <StatusBadge status={c.status} label={statusLabels[c.status] || c.status} />
    ),
  },
];

export default function Compras() {
  const navigate = useNavigate();
  const {
    filteredData,
    loading,
    kpis,
    modalOpen,
    setModalOpen,
    mode,
    selected,
    form,
    setForm,
    items,
    setItems,
    saving,
    drawerOpen,
    setDrawerOpen,
    viewItems,
    searchTerm,
    setSearchTerm,
    statusFilters,
    setStatusFilters,
    fornecedorFilters,
    setFornecedorFilters,
    compActiveFilters,
    handleRemoveCompFilter,
    fornecedorOptions,
    fornecedorFilterOptions,
    statusOptions,
    selectedFornecedor,
    produtosData,
    valorProdutos,
    valorTotal,
    isCotacoesView,
    title,
    subtitle,
    addLabel,
    openCreate,
    openEdit,
    openView,
    handleSubmit,
    remove,
  } = useCompras();

  return (
    <AppLayout>
      <ModulePage title={title} subtitle={subtitle} addLabel={addLabel} onAdd={openCreate}>
        <AdvancedFilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar por nº ou fornecedor..."
          activeFilters={compActiveFilters}
          onRemoveFilter={handleRemoveCompFilter}
          onClearAll={() => {
            setSearchTerm("");
            setStatusFilters([]);
            setFornecedorFilters([]);
          }}
          count={filteredData.length}
        >
          {!isCotacoesView && (
            <MultiSelect
              options={statusOptions}
              selected={statusFilters}
              onChange={setStatusFilters}
              placeholder="Status"
              className="w-[200px]"
            />
          )}
          <MultiSelect
            options={fornecedorFilterOptions}
            selected={fornecedorFilters}
            onChange={setFornecedorFilters}
            placeholder="Fornecedores"
            className="w-[250px]"
          />
        </AdvancedFilterBar>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SummaryCard
            title="Total de Compras"
            value={formatNumber(kpis.total)}
            icon={ShoppingCart}
            variationType="neutral"
            variation="no período"
          />
          <SummaryCard
            title="Valor Total"
            value={formatCurrency(kpis.totalValue)}
            icon={ShoppingCart}
            variationType="neutral"
            variation="acumulado"
          />
          <SummaryCard
            title="Aguardando Entrega"
            value={formatNumber(kpis.pendingDelivery)}
            icon={Clock}
            variationType={kpis.pendingDelivery > 0 ? "negative" : "positive"}
            variant={kpis.pendingDelivery > 0 ? "warning" : undefined}
            variation="pedidos"
          />
          <SummaryCard
            title="Entregues"
            value={formatNumber(kpis.delivered)}
            icon={CheckCircle2}
            variationType="positive"
            variation="concluídas"
          />
        </div>

        {isCotacoesView && (
          <Card className="mb-4 border-primary/20 bg-primary/5">
            <CardContent className="px-4 py-3 text-sm text-muted-foreground">
              Esta visão concentra solicitações e cotações de compra ainda não confirmadas.
            </CardContent>
          </Card>
        )}

        {!isCotacoesView && (
          <Card className="mb-4 border-info/30 bg-info/5">
            <CardContent className="flex items-start gap-3 px-4 py-3">
              <Info className="w-4 h-4 text-info shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Receber uma compra{" "}
                <strong>não gera estoque nem lançamento financeiro automaticamente</strong>.
                Após marcar como entregue, acesse{" "}
                <button
                  className="text-primary underline underline-offset-2 hover:no-underline"
                  onClick={() => navigate("/fiscal?tipo=entrada")}
                >
                  Fiscal → Entradas
                </button>{" "}
                para emitir a nota de entrada e registrar os movimentos.
              </p>
            </CardContent>
          </Card>
        )}

        <DataTable
          columns={columns}
          data={filteredData}
          loading={loading}
          onView={openView}
          onEdit={openEdit}
          emptyTitle={isCotacoesView ? "Nenhuma cotação encontrada" : "Nenhuma compra encontrada"}
          emptyDescription="Tente ajustar os filtros ou registre uma nova compra."
        />
      </ModulePage>

      <CompraFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={mode === "create" ? addLabel : "Editar Compra"}
        form={form}
        onFormChange={setForm}
        items={items}
        onItemsChange={setItems}
        saving={saving}
        onSubmit={handleSubmit}
        fornecedorOptions={fornecedorOptions}
        selectedFornecedor={selectedFornecedor}
        produtosData={produtosData}
        valorProdutos={valorProdutos}
        valorTotal={valorTotal}
      />

      <CompraDetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        selected={selected}
        viewItems={viewItems}
        isCotacoesView={isCotacoesView}
        onEdit={() => {
          setDrawerOpen(false);
          if (selected) openEdit(selected);
        }}
        onDelete={() => {
          setDrawerOpen(false);
          if (selected) remove(selected.id);
        }}
      />
    </AppLayout>
  );
}
