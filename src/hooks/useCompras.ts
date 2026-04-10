import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { statusCompra } from "@/lib/statusSchema";
import { type GridItem } from "@/components/ui/ItemsGrid";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { type MultiSelectOption } from "@/components/ui/MultiSelect";
import type { Database } from "@/integrations/supabase/types";

export interface Compra {
  id: string;
  numero: string | null;
  fornecedor_id: string | null;
  data_compra: string | null;
  data_entrega_prevista: string | null;
  data_entrega_real: string | null;
  valor_produtos: number | null;
  frete_valor: number | null;
  impostos_valor: number | null;
  valor_total: number | null;
  observacoes: string | null;
  status: string;
  ativo: boolean;
  created_at: string;
  fornecedores?: { nome_razao_social: string; cpf_cnpj: string | null } | null;
}

export interface CompraFormValues {
  numero: string;
  fornecedor_id: string;
  data_compra: string;
  data_entrega_prevista: string;
  data_entrega_real: string;
  frete_valor: number;
  impostos_valor: number;
  observacoes: string;
  status: string;
}

type CompraItem = {
  id: string;
  produto_id: string | null;
  quantidade: number | null;
  valor_unitario: number | null;
  valor_total: number | null;
  produtos?: { nome: string | null; sku: string | null } | null;
};

type FornecedorRow = Database["public"]["Tables"]["fornecedores"]["Row"];
type ProdutoRow = Database["public"]["Tables"]["produtos"]["Row"];

const emptyForm: CompraFormValues = {
  numero: "",
  fornecedor_id: "",
  data_compra: new Date().toISOString().split("T")[0],
  data_entrega_prevista: "",
  data_entrega_real: "",
  frete_valor: 0,
  impostos_valor: 0,
  observacoes: "",
  status: "rascunho",
};

export const statusLabels: Record<string, string> = Object.fromEntries(
  Object.entries(statusCompra).map(([k, v]) => [k, v.label]),
);

export interface UseComprasReturn {
  data: Compra[];
  loading: boolean;
  filteredData: Compra[];
  kpis: {
    total: number;
    totalValue: number;
    pendingDelivery: number;
    delivered: number;
  };
  // Modal state
  modalOpen: boolean;
  setModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mode: "create" | "edit";
  selected: Compra | null;
  form: CompraFormValues;
  setForm: React.Dispatch<React.SetStateAction<CompraFormValues>>;
  items: GridItem[];
  setItems: React.Dispatch<React.SetStateAction<GridItem[]>>;
  saving: boolean;
  // Drawer state
  drawerOpen: boolean;
  setDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  viewItems: CompraItem[];
  // Filter state
  statusFilters: string[];
  setStatusFilters: React.Dispatch<React.SetStateAction<string[]>>;
  fornecedorFilters: string[];
  setFornecedorFilters: React.Dispatch<React.SetStateAction<string[]>>;
  compActiveFilters: FilterChip[];
  handleRemoveCompFilter: (key: string, value?: string) => void;
  // Options
  fornecedorOptions: { id: string; label: string; sublabel: string }[];
  fornecedorFilterOptions: MultiSelectOption[];
  statusOptions: MultiSelectOption[];
  selectedFornecedor: FornecedorRow | undefined;
  produtosData: ProdutoRow[];
  // Computed values
  valorProdutos: number;
  valorTotal: number;
  isCotacoesView: boolean;
  title: string;
  subtitle: string;
  addLabel: string;
  statusLabels: Record<string, string>;
  // Actions
  openCreate: () => void;
  openEdit: (c: Compra) => Promise<void>;
  openView: (c: Compra) => Promise<void>;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useCompras(): UseComprasReturn {
  const [searchParams] = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const {
    data: rawData,
    loading,
    remove: removeRecord,
    fetchData,
  } = useSupabaseCrud({
    table: "compras",
    select: "*, fornecedores(nome_razao_social, cpf_cnpj)",
  });
  const data = rawData as unknown as Compra[];

  const { data: fornecedoresData } = useSupabaseCrud({ table: "fornecedores" });
  const { data: produtosData } = useSupabaseCrud({ table: "produtos" });

  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Compra | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<CompraFormValues>(emptyForm);
  const [items, setItems] = useState<GridItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [viewItems, setViewItems] = useState<CompraItem[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [fornecedorFilters, setFornecedorFilters] = useState<string[]>([]);

  const viewParam = searchParams.get("view");
  const isCotacoesView = viewParam === "cotacoes";
  const title = isCotacoesView ? "Compras · Cotações" : "Compras";
  const subtitle = isCotacoesView
    ? "Solicitações e negociações com fornecedores antes da confirmação do pedido de compra."
    : "Pedidos de compra confirmados, recebimentos e acompanhamento de entrega.";
  const addLabel = isCotacoesView ? "Nova Cotação de Compra" : "Novo Pedido de Compra";

  const valorProdutos = items.reduce((s, i) => s + (i.valor_total || 0), 0);
  const valorTotal = valorProdutos + (form.frete_valor || 0) + (form.impostos_valor || 0);

  const filteredData = useMemo(() => {
    return data.filter((compra) => {
      const baseMatch = isCotacoesView
        ? compra.status === "rascunho"
        : compra.status !== "rascunho";
      if (!baseMatch) return false;
      if (statusFilters.length > 0 && !statusFilters.includes(compra.status)) return false;
      if (
        fornecedorFilters.length > 0 &&
        !fornecedorFilters.includes(compra.fornecedor_id || "")
      )
        return false;
      return true;
    });
  }, [data, isCotacoesView, statusFilters, fornecedorFilters]);

  const kpis = useMemo(() => {
    const delivered = data.filter((c) => c.status === "entregue");
    const pending = data.filter((c) => c.status === "confirmado" && !c.data_entrega_real);
    const totalValue = filteredData.reduce((s, c) => s + Number(c.valor_total || 0), 0);
    return {
      total: filteredData.length,
      totalValue,
      pendingDelivery: pending.length,
      delivered: delivered.length,
    };
  }, [data, filteredData]);

  const openCreate = useCallback(() => {
    setMode("create");
    setForm({
      ...emptyForm,
      numero: `COMP-${String(data.length + 1).padStart(4, "0")}`,
      status: isCotacoesView ? "rascunho" : "confirmado",
    });
    setItems([]);
    setSelected(null);
    setModalOpen(true);
  }, [data.length, isCotacoesView]);

  const openEdit = useCallback(async (c: Compra) => {
    setMode("edit");
    setSelected(c);
    setForm({
      numero: c.numero ?? "",
      fornecedor_id: c.fornecedor_id || "",
      data_compra: c.data_compra ?? new Date().toISOString().split("T")[0],
      data_entrega_prevista: c.data_entrega_prevista || "",
      data_entrega_real: c.data_entrega_real || "",
      frete_valor: c.frete_valor || 0,
      impostos_valor: c.impostos_valor || 0,
      observacoes: c.observacoes || "",
      status: c.status,
    });
    const { data: itens } = await supabase
      .from("compras_itens")
      .select("*, produtos(nome, sku)")
      .eq("compra_id", c.id);
    setItems(
      (itens || []).map((i) => {
        const item = i as unknown as CompraItem;
        return {
          id: item.id,
          produto_id: item.produto_id ?? "",
          codigo: item.produtos?.sku || "",
          descricao: item.produtos?.nome || "",
          quantidade: item.quantidade ?? 0,
          valor_unitario: item.valor_unitario ?? 0,
          valor_total: item.valor_total ?? 0,
        };
      }),
    );
    setModalOpen(true);
  }, []);

  const openView = useCallback(async (c: Compra) => {
    setSelected(c);
    const { data: itens } = await supabase
      .from("compras_itens")
      .select("*, produtos(nome, sku)")
      .eq("compra_id", c.id);
    setViewItems((itens || []) as unknown as CompraItem[]);
    setDrawerOpen(true);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!form.numero) {
        toast.error("Número é obrigatório");
        return;
      }
      setSaving(true);
      try {
        let status = form.status;
        if (form.data_entrega_real && status !== "cancelado") status = "entregue";
        const currentValorProdutos = items.reduce((s, i) => s + (i.valor_total || 0), 0);
        const currentValorTotal =
          currentValorProdutos + (form.frete_valor || 0) + (form.impostos_valor || 0);
        const payload = {
          ...form,
          status,
          fornecedor_id: form.fornecedor_id || null,
          valor_produtos: currentValorProdutos,
          valor_total: currentValorTotal,
        };
        let compraId = selected?.id;
        if (mode === "create") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: newC, error } = await (supabase.from as any)("compras")
            .insert(payload)
            .select()
            .single();
          if (error) throw error;
          compraId = newC.id;
        } else if (selected) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from as any)("compras").update(payload).eq("id", selected.id);
          await supabase.from("compras_itens").delete().eq("compra_id", selected.id);
        }
        if (items.length > 0 && compraId) {
          const itemsPayload = items
            .filter((i) => i.produto_id)
            .map((i) => ({
              compra_id: compraId!,
              produto_id: i.produto_id,
              quantidade: i.quantidade,
              valor_unitario: i.valor_unitario,
              valor_total: i.valor_total,
            }));
          if (itemsPayload.length > 0) {
            await supabase.from("compras_itens").insert(itemsPayload);
          }
        }
        toast.success(isCotacoesView ? "Cotação de compra salva!" : "Compra salva!");
        setModalOpen(false);
        fetchData();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erro inesperado";
        console.error("[compras]", msg);
        toast.error("Erro ao salvar. Tente novamente.");
      }
      setSaving(false);
    },
    [form, items, mode, selected, isCotacoesView, fetchData],
  );

  const remove = useCallback(
    async (id: string) => {
      await removeRecord(id);
      fetchData();
    },
    [removeRecord, fetchData],
  );

  const fornecedorOptions = useMemo(
    () =>
      fornecedoresData.map((f) => ({
        id: f.id,
        label: f.nome_razao_social,
        sublabel: f.cpf_cnpj || "",
      })),
    [fornecedoresData],
  );

  const selectedFornecedor = fornecedoresData.find((f) => f.id === form.fornecedor_id);

  const compActiveFilters = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    statusFilters.forEach((f) => {
      chips.push({
        key: "status",
        mobileCard: true,
        label: "Status",
        value: [f],
        displayValue: statusLabels[f] || f,
      });
    });
    fornecedorFilters.forEach((f) => {
      const forn = fornecedoresData.find((x) => x.id === f);
      chips.push({
        key: "fornecedor",
        mobilePrimary: true,
        label: "Fornecedor",
        value: [f],
        displayValue: forn?.nome_razao_social || f,
      });
    });
    return chips;
  }, [statusFilters, fornecedorFilters, fornecedoresData]);

  const handleRemoveCompFilter = useCallback((key: string, value?: string) => {
    if (key === "status") setStatusFilters((prev) => prev.filter((v) => v !== value));
    if (key === "fornecedor") setFornecedorFilters((prev) => prev.filter((v) => v !== value));
  }, []);

  const statusOptions = useMemo<MultiSelectOption[]>(
    () =>
      Object.entries(statusLabels)
        .filter(([k]) => (isCotacoesView ? k === "rascunho" : k !== "rascunho"))
        .map(([k, v]) => ({ label: v, value: k })),
    [isCotacoesView],
  );

  const fornecedorFilterOptions = useMemo<MultiSelectOption[]>(
    () =>
      fornecedoresData.map((f) => ({
        label: f.nome_razao_social,
        value: f.id,
      })),
    [fornecedoresData],
  );

  return {
    data,
    loading,
    filteredData,
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
    statusLabels,
    openCreate,
    openEdit,
    openView,
    handleSubmit,
    remove,
  };
}
