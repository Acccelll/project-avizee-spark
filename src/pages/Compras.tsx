import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { SummaryCard } from "@/components/SummaryCard";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { FormModal } from "@/components/FormModal";
import { ViewDrawerV2, ViewField, ViewSection } from "@/components/ViewDrawerV2";
import { RelationalLink } from "@/components/ui/RelationalLink";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Edit, Trash2, Info, ArrowRight } from "lucide-react";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { useRelationalNavigation } from "@/contexts/RelationalNavigationContext";
import { AutocompleteSearch } from "@/components/ui/AutocompleteSearch";
import { ItemsGrid, type GridItem } from "@/components/ui/ItemsGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency, formatNumber } from "@/lib/format";
import { ShoppingCart, Truck, Clock, CheckCircle2 } from "lucide-react";

interface Compra {
  id: string; numero: string; fornecedor_id: string; data_compra: string;
  data_entrega_prevista: string; data_entrega_real: string;
  valor_produtos: number; frete_valor: number; impostos_valor: number;
  valor_total: number; observacoes: string; status: string; ativo: boolean;
  created_at: string;
  fornecedores?: { nome_razao_social: string; cpf_cnpj: string };
}

const emptyForm: Record<string, any> = {
  numero: "", fornecedor_id: "", data_compra: new Date().toISOString().split("T")[0],
  data_entrega_prevista: "", data_entrega_real: "", frete_valor: 0, impostos_valor: 0,
  observacoes: "", status: "rascunho",
};

import { statusCompra } from "@/lib/statusSchema";

const statusLabels: Record<string, string> = Object.fromEntries(
  Object.entries(statusCompra).map(([k, v]) => [k, v.label])
);

const Compras = () => {
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data, loading, remove, fetchData } = useSupabaseCrud<Compra>({
    table: "compras", select: "*, fornecedores(nome_razao_social, cpf_cnpj)",
  });
  const { pushView } = useRelationalNavigation();
  const fornecedoresCrud = useSupabaseCrud<any>({ table: "fornecedores" });
  const produtosCrud = useSupabaseCrud<any>({ table: "produtos" });
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Compra | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState<GridItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [viewItems, setViewItems] = useState<any[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [fornecedorFilters, setFornecedorFilters] = useState<string[]>([]);
  const [searchParams] = useSearchParams();

  const valorProdutos = items.reduce((s, i) => s + (i.valor_total || 0), 0);
  const viewParam = searchParams.get("view");
  const isCotacoesView = viewParam === "cotacoes";
  const title = isCotacoesView ? "Compras · Cotações" : "Compras";
  const subtitle = isCotacoesView
    ? "Solicitações e negociações com fornecedores antes da confirmação do pedido de compra."
    : "Pedidos de compra confirmados, recebimentos e acompanhamento de entrega.";
  const addLabel = isCotacoesView ? "Nova Cotação de Compra" : "Novo Pedido de Compra";
  const valorTotal = valorProdutos + (form.frete_valor || 0) + (form.impostos_valor || 0);

  const filteredData = useMemo(() => {
    return data.filter((compra) => {
      const baseMatch = isCotacoesView ? compra.status === "rascunho" : compra.status !== "rascunho";
      if (!baseMatch) return false;

      if (statusFilters.length > 0 && !statusFilters.includes(compra.status)) return false;
      if (fornecedorFilters.length > 0 && !fornecedorFilters.includes(compra.fornecedor_id || "")) return false;

      return true;
    });
  }, [data, isCotacoesView, statusFilters, fornecedorFilters]);

  // KPIs
  const kpis = useMemo(() => {
    const confirmed = data.filter(c => c.status === "confirmado");
    const delivered = data.filter(c => c.status === "entregue");
    const pending = data.filter(c => c.status === "confirmado" && !c.data_entrega_real);
    const totalValue = filteredData.reduce((s, c) => s + Number(c.valor_total || 0), 0);
    return {
      total: filteredData.length,
      totalValue,
      pendingDelivery: pending.length,
      delivered: delivered.length,
    };
  }, [data, filteredData]);

  const openCreate = () => {
    setMode("create");
    setForm({ ...emptyForm, numero: `COMP-${String(data.length + 1).padStart(4, "0")}`, status: isCotacoesView ? "rascunho" : "confirmado" });
    setItems([]); setSelected(null); setModalOpen(true);
  };

  const openEdit = async (c: Compra) => {
    setMode("edit"); setSelected(c);
    setForm({
      numero: c.numero, fornecedor_id: c.fornecedor_id || "", data_compra: c.data_compra,
      data_entrega_prevista: c.data_entrega_prevista || "", data_entrega_real: c.data_entrega_real || "",
      frete_valor: c.frete_valor || 0, impostos_valor: c.impostos_valor || 0,
      observacoes: c.observacoes || "", status: c.status,
    });
    const { data: itens } = await supabase.from("compras_itens").select("*, produtos(nome, sku)").eq("compra_id", c.id);
    setItems((itens || []).map((i: any) => ({
      id: i.id, produto_id: i.produto_id, codigo: i.produtos?.sku || "",
      descricao: i.produtos?.nome || "", quantidade: i.quantidade,
      valor_unitario: i.valor_unitario, valor_total: i.valor_total,
    })));
    setModalOpen(true);
  };

  const openView = async (c: Compra) => {
    setSelected(c);
    const { data: itens } = await supabase.from("compras_itens").select("*, produtos(nome, sku)").eq("compra_id", c.id);
    setViewItems(itens || []);
    setDrawerOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.numero) { toast.error("Número é obrigatório"); return; }
    setSaving(true);
    try {
      let status = form.status;
      if (form.data_entrega_real && status !== "cancelado") status = "entregue";
      const payload = { ...form, status, fornecedor_id: form.fornecedor_id || null, valor_produtos: valorProdutos, valor_total: valorTotal };
      let compraId = selected?.id;
      if (mode === "create") {
        const { data: newC, error } = await supabase.from("compras").insert(payload as any).select().single();
        if (error) throw error;
        compraId = newC.id;
      } else if (selected) {
        await supabase.from("compras").update(payload).eq("id", selected.id);
        await supabase.from("compras_itens").delete().eq("compra_id", selected.id);
      }
      if (items.length > 0 && compraId) {
        const itemsPayload = items.filter((i) => i.produto_id).map((i) => ({
          compra_id: compraId, produto_id: i.produto_id, quantidade: i.quantidade,
          valor_unitario: i.valor_unitario, valor_total: i.valor_total,
        }));
        if (itemsPayload.length > 0) await supabase.from("compras_itens").insert(itemsPayload);
      }
      toast.success(isCotacoesView ? "Cotação de compra salva!" : "Compra salva!");
      setModalOpen(false); fetchData();
    } catch (err: any) {
      console.error('[compras]', err);
      toast.error("Erro ao salvar. Tente novamente.");
    }
    setSaving(false);
  };

  const fornecedorOptions = fornecedoresCrud.data.map((f: any) => ({ id: f.id, label: f.nome_razao_social, sublabel: f.cpf_cnpj || "" }));
  const selectedFornecedor = fornecedoresCrud.data.find((f: any) => f.id === form.fornecedor_id);

  const compActiveFilters = useMemo(() => {
    const chips: FilterChip[] = [];
    statusFilters.forEach(f => {
      chips.push({ key: "status",
      mobileCard: true, label: "Status", value: [f], displayValue: statusLabels[f] || f });
    });
    fornecedorFilters.forEach(f => {
      const forn = fornecedoresCrud.data.find(x => x.id === f);
      chips.push({ key: "fornecedor",
      mobilePrimary: true, label: "Fornecedor", value: [f], displayValue: forn?.nome_razao_social || f });
    });
    return chips;
  }, [statusFilters, fornecedorFilters, fornecedoresCrud.data]);

  const handleRemoveCompFilter = (key: string, value?: string) => {
    if (key === "status") setStatusFilters(prev => prev.filter(v => v !== value));
    if (key === "fornecedor") setFornecedorFilters(prev => prev.filter(v => v !== value));
  };

  const statusOptions: MultiSelectOption[] = Object.entries(statusLabels)
    .filter(([k]) => isCotacoesView ? k === "rascunho" : k !== "rascunho")
    .map(([k, v]) => ({ label: v, value: k }));

  const fornecedorFilterOptions: MultiSelectOption[] = fornecedoresCrud.data.map(f => ({
    label: f.nome_razao_social, value: f.id
  }));

  const columns = [
    { key: "numero",
      mobileCard: true, label: "Nº", render: (c: Compra) => <span className="font-mono text-xs font-medium text-primary">{c.numero}</span> },
    { key: "fornecedor", label: "Fornecedor", render: (c: Compra) => (c as any).fornecedores?.nome_razao_social || "—" },
    { key: "data_compra", label: "Data", render: (c: Compra) => new Date(c.data_compra).toLocaleDateString("pt-BR") },
    { key: "valor_total",
      mobileCard: true, label: "Total", render: (c: Compra) => <span className="font-semibold font-mono">{formatCurrency(Number(c.valor_total || 0))}</span> },
    { key: "status", label: "Status", render: (c: Compra) => <StatusBadge status={c.status} label={statusLabels[c.status] || c.status} /> },
  ];

  return (
    <AppLayout>
      <ModulePage title={title} subtitle={subtitle} addLabel={addLabel} onAdd={openCreate}>
        <AdvancedFilterBar
          activeFilters={compActiveFilters}
          onRemoveFilter={handleRemoveCompFilter}
          onClearAll={() => { setStatusFilters([]); setFornecedorFilters([]); }}
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
          <SummaryCard title="Total de Compras" value={formatNumber(kpis.total)} icon={ShoppingCart} variationType="neutral" variation="no período" />
          <SummaryCard title="Valor Total" value={formatCurrency(kpis.totalValue)} icon={ShoppingCart} variationType="neutral" variation="acumulado" />
          <SummaryCard title="Aguardando Entrega" value={formatNumber(kpis.pendingDelivery)} icon={Clock} variationType={kpis.pendingDelivery > 0 ? "negative" : "positive"} variant={kpis.pendingDelivery > 0 ? "warning" : undefined} variation="pedidos" />
          <SummaryCard title="Entregues" value={formatNumber(kpis.delivered)} icon={CheckCircle2} variationType="positive" variation="concluídas" />
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
                Receber uma compra <strong>não gera estoque nem lançamento financeiro automaticamente</strong>.
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

        <DataTable columns={columns} data={filteredData} loading={loading} onView={openView} onEdit={openEdit} />
      </ModulePage>

      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={mode === "create" ? addLabel : "Editar Compra"} size="xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="space-y-2"><Label>Número *</Label><Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} required className="font-mono" /></div>
            <div className="space-y-2"><Label>Data Compra</Label><Input type="date" value={form.data_compra} onChange={(e) => setForm({ ...form, data_compra: e.target.value })} /></div>
            <div className="space-y-2"><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rascunho">Cotação</SelectItem>
                  <SelectItem value="confirmado">Pedido Confirmado</SelectItem>
                  <SelectItem value="parcial">Recebimento Parcial</SelectItem>
                  <SelectItem value="entregue">Entregue</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 rounded-lg bg-accent/30 p-4">
            <Label className="text-sm font-semibold">Fornecedor</Label>
            <AutocompleteSearch options={fornecedorOptions} value={form.fornecedor_id} onChange={(id) => setForm({ ...form, fornecedor_id: id })} placeholder="Buscar por nome ou CNPJ..." />
            {selectedFornecedor && (
              <div className="grid grid-cols-3 gap-2 text-sm">
                <p><span className="text-xs text-muted-foreground">Razão Social:</span><br />{selectedFornecedor.nome_razao_social}</p>
                <p><span className="text-xs text-muted-foreground">CNPJ:</span><br /><span className="font-mono">{selectedFornecedor.cpf_cnpj || "—"}</span></p>
                <p><span className="text-xs text-muted-foreground">Contato:</span><br />{selectedFornecedor.telefone || "—"}</p>
              </div>
            )}
          </div>

          <ItemsGrid items={items} onChange={setItems} produtos={produtosCrud.data} title="Itens da Compra" />

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="space-y-2"><Label>Frete</Label><Input type="number" step="0.01" value={form.frete_valor} onChange={(e) => setForm({ ...form, frete_valor: Number(e.target.value) })} /></div>
            <div className="space-y-2"><Label>Impostos</Label><Input type="number" step="0.01" value={form.impostos_valor} onChange={(e) => setForm({ ...form, impostos_valor: Number(e.target.value) })} /></div>
            <div className="space-y-2"><Label>Entrega Prevista</Label><Input type="date" value={form.data_entrega_prevista} onChange={(e) => setForm({ ...form, data_entrega_prevista: e.target.value })} /></div>
            <div className="space-y-2"><Label>Entrega Real</Label><Input type="date" value={form.data_entrega_real} onChange={(e) => setForm({ ...form, data_entrega_real: e.target.value })} /></div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-accent/50 p-4">
            <div className="text-sm">
              <span className="text-muted-foreground">Produtos:</span> <span className="font-mono font-semibold">{formatCurrency(valorProdutos)}</span>
              <span className="mx-3 text-muted-foreground">|</span>
              <span className="text-muted-foreground">Frete:</span> <span className="font-mono">{formatCurrency(form.frete_valor || 0)}</span>
              <span className="mx-3 text-muted-foreground">|</span>
              <span className="text-muted-foreground">Impostos:</span> <span className="font-mono">{formatCurrency(form.impostos_valor || 0)}</span>
            </div>
            <div>
              <span className="mr-2 text-sm text-muted-foreground">TOTAL:</span>
              <span className="text-lg font-bold font-mono text-primary">{formatCurrency(valorTotal)}</span>
            </div>
          </div>

          <div className="space-y-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </FormModal>

      <ViewDrawerV2 open={drawerOpen} onClose={() => setDrawerOpen(false)} title={isCotacoesView ? "Detalhes da Cotação de Compra" : "Detalhes da Compra"}
        actions={selected ? <>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setDrawerOpen(false); openEdit(selected); }}><Edit className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Editar</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { setDrawerOpen(false); remove(selected.id); }}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Excluir</TooltipContent></Tooltip>
        </> : undefined}
        badge={selected ? <StatusBadge status={selected.status} label={statusLabels[selected.status] || selected.status} /> : undefined}
        tabs={selected ? [
          { value: "dados", label: "Dados", content: (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <ViewField label="Número"><span className="font-mono">{selected.numero}</span></ViewField>
                <ViewField label="Data Compra">{new Date(selected.data_compra).toLocaleDateString("pt-BR")}</ViewField>
              </div>
              <ViewField label="Fornecedor">
                {(selected as any).fornecedores?.nome_razao_social ? (
                  <RelationalLink type="fornecedor" id={selected.fornecedor_id}>{(selected as any).fornecedores.nome_razao_social}</RelationalLink>
                ) : "—"}
              </ViewField>
              <div className="grid grid-cols-2 gap-4">
                <ViewField label="Valor Total"><span className="font-semibold font-mono">{formatCurrency(Number(selected.valor_total || 0))}</span></ViewField>
                <ViewField label="Frete"><span className="font-mono">{formatCurrency(Number(selected.frete_valor || 0))}</span></ViewField>
              </div>
              {selected.observacoes && <ViewField label="Observações">{selected.observacoes}</ViewField>}
              {!isCotacoesView && selected.status === "entregue" && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-3">
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                  <p className="text-sm text-muted-foreground flex-1">
                    Compra recebida. Para registrar estoque e financeiro, acesse a nota de entrada.
                  </p>
                  <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => { setDrawerOpen(false); navigate("/fiscal?tipo=entrada"); }}>
                    Ir para Fiscal <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )},
          { value: "itens", label: `Itens (${viewItems.length})`, content: (
            <div className="space-y-1">
              {viewItems.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Nenhum item</p> :
                viewItems.map((i: any, idx: number) => (
                  <div key={idx} className="flex justify-between border-b py-2 text-sm last:border-b-0">
                    <div>
                      <RelationalLink type="produto" id={i.produto_id}>{i.produtos?.nome || "—"}</RelationalLink>
                      <p className="text-xs text-muted-foreground font-mono">{i.produtos?.sku || "—"} × {i.quantidade}</p>
                    </div>
                    <span className="font-mono font-semibold">{formatCurrency(Number(i.valor_total))}</span>
                  </div>
                ))
              }
            </div>
          )},
        ] : undefined}
      />
    </AppLayout>
  );
};

export default Compras;
