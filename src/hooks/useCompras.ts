
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { useCompras as useComprasData } from "@/pages/comercial/compras/hooks/useCompras";
import { useDebounce } from "@/hooks/useDebounce";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { statusCompra } from "@/lib/statusSchema";
import { type GridItem } from "@/components/ui/ItemsGrid";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { type MultiSelectOption } from "@/components/ui/MultiSelect";
import type { Database } from "@/integrations/supabase/types";
import { getUserFriendlyError } from "@/utils/errorMessages";

type CompraInsert = Database["public"]["Tables"]["compras"]["Insert"];
type CompraUpdate = Database["public"]["Tables"]["compras"]["Update"];

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
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Filters persisted in URL
  const searchTerm = searchParams.get("search") ?? "";
  const statusFilters = useMemo(
    () => searchParams.getAll("status").filter(Boolean),
    [searchParams],
  );
  const fornecedorFilters = useMemo(
    () => searchParams.getAll("fornecedor_id").filter(Boolean),
    [searchParams],
  );

  const setSearchTerm = useCallback(
    (value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set("search", value);
        else next.delete("search");
        next.set("page", "1");
        return next;
      });
    },
    [setSearchParams],
  );

  const setStatusFilters = useCallback(
    (values: string[] | ((prev: string[]) => string[])) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("status");
        const resolved = typeof values === "function" ? values(prev.getAll("status")) : values;
        resolved.forEach((v) => next.append("status", v));
        next.set("page", "1");
        return next;
      });
    },
    [setSearchParams],
  );

  const setFornecedorFilters = useCallback(
    (values: string[] | ((prev: string[]) => string[])) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("fornecedor_id");
        const resolved =
          typeof values === "function" ? values(prev.getAll("fornecedor_id")) : values;
        resolved.forEach((v) => next.append("fornecedor_id", v));
        next.set("page", "1");
        return next;
      });
    },
    [setSearchParams],
  );

  const debouncedSearch = useDebounce(searchTerm, 300);

  const { data: rawData = [], isLoading: loading } = useComprasData();

  const invalidateCompras = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["compras"] }),
    [queryClient],
  );

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
    const lowerSearch = debouncedSearch.toLowerCase();
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
      if (lowerSearch) {
        const matchesNumero = (compra.numero ?? "").toLowerCase().includes(lowerSearch);
        const matchesFornecedor = (
          compra.fornecedores?.nome_razao_social ?? ""
        ).toLowerCase().includes(lowerSearch);
        if (!matchesNumero && !matchesFornecedor) return false;
      }
      return true;
    });
  }, [data, isCotacoesView, statusFilters, fornecedorFilters, debouncedSearch]);

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

  const openCreate = useCallback(async () => {
    setMode("create");
    const { data: rpcNumero } = await supabase.rpc(
      isCotacoesView ? "proximo_numero_cotacao_compra" : "proximo_numero_pedido_compra"
    );
    setForm({
      ...emptyForm,
      numero: rpcNumero || `COMP-${String(Date.now()).slice(-6)}`,
      status: isCotacoesView ? "rascunho" : "confirmado",
    });
    setItems([]);
    setSelected(null);
    setModalOpen(true);
  }, [isCotacoesView]);

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
      (itens || []).map((i) => ({
        id: i.id,
        produto_id: (i as CompraItem).produto_id ?? "",
        codigo: (i as CompraItem).produtos?.sku || "",
        descricao: (i as CompraItem).produtos?.nome || "",
        quantidade: i.quantidade ?? 0,
        valor_unitario: i.valor_unitario ?? 0,
        valor_total: i.valor_total ?? 0,
      })),
    );
    setModalOpen(true);
  }, []);

  const openView = useCallback(async (c: Compra) => {
    setSelected(c);
    const { data: itens } = await supabase
      .from("compras_itens")
      .select("*, produtos(nome, sku)")
      .eq("compra_id", c.id);
    setViewItems((itens || []).map((i) => i as CompraItem));
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
        const payload: CompraInsert & CompraUpdate = {
          numero: form.numero || null,
          fornecedor_id: form.fornecedor_id || null,
          data_compra: form.data_compra || null,
          data_entrega_prevista: form.data_entrega_prevista || null,
          data_entrega_real: form.data_entrega_real || null,
          frete_valor: form.frete_valor,
          impostos_valor: form.impostos_valor,
          observacoes: form.observacoes || null,
          status,
          valor_produtos: currentValorProdutos,
          valor_total: currentValorTotal,
        };
        let compraId = selected?.id;
        if (mode === "create") {
          const { data: newC, error } = await supabase
            .from("compras")
            .insert(payload)
            .select()
            .single();
          if (error) throw error;
          compraId = newC.id;
        } else if (selected) {
          await Promise.all([
            supabase.from("compras").update(payload).eq("id", selected.id),
            supabase.from("compras_itens").delete().eq("compra_id", selected.id),
          ]);
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
        invalidateCompras();
      } catch (err: unknown) {
        console.error("[compras]", err);
        toast.error(getUserFriendlyError(err));
      }
      setSaving(false);
    },
    [form, items, mode, selected, isCotacoesView, invalidateCompras],
  );

  const remove = useCallback(
    async (id: string) => {
      await supabase.from("compras").update({ ativo: false }).eq("id", id);
      invalidateCompras();
    },
    [invalidateCompras],
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
  }, [setStatusFilters, setFornecedorFilters]);

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
    statusLabels,
    openCreate,
    openEdit,
    openView,
    handleSubmit,
    remove,
  };
}
