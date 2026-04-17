
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { getUserFriendlyError } from "@/utils/errorMessages";
import { type GridItem } from "@/components/ui/ItemsGrid";
import {
  type PedidoCompra,
  type FornecedorOptionRow,
  type ProdutoOptionRow,
  emptyPedidoForm,
  pedidoNumero,
} from "@/components/compras/pedidoCompraTypes";
import { statusPedidoCompra } from "@/lib/statusSchema";

/** Shape of a row from pedidos_compra_itens joined with produtos */
interface PedidoItemRow {
  id: string | number;
  produto_id: string | number | null;
  quantidade: number | null;
  preco_unitario?: number | null;
  subtotal?: number | null;
  valor_unitario?: number | null;
  valor_total?: number | null;
  produtos: { nome: string | null; codigo_interno: string | null; estoque_atual?: number | null } | null;
}

/** Minimal cotacao_compra row returned from the draw query */
interface CotacaoRow {
  id: string;
  numero: string;
  status: string;
  data_cotacao: string;
}

/** Minimal estoque_movimentos row */
interface EstoqueMovimentoRow {
  produto_id: string | null;
  quantidade: number | null;
  [key: string]: unknown;
}

/** Minimal financeiro_lancamentos row */
interface FinanceiroLancRow {
  id: string;
  descricao: string | null;
  valor: number | null;
  status: string | null;
  data_vencimento: string | null;
  tipo: string | null;
}

interface PedidoCompraForm {
  fornecedor_id: string;
  data_pedido: string;
  data_entrega_prevista: string;
  data_entrega_real: string;
  frete_valor: string;
  condicao_pagamento: string;
  status: string;
  observacoes: string;
}

const statusLabels: Record<string, string> = Object.fromEntries(
  Object.entries(statusPedidoCompra).map(([k, v]) => [k, v.label]),
);
const DEFAULT_DUE_DAYS = 30;

export interface UsePedidosCompraReturn {
  // Data
  pedidos: PedidoCompra[];
  fornecedoresAtivos: FornecedorOptionRow[];
  fornecedorOptions: { id: string; label: string; sublabel: string }[];
  produtosOptionsData: (ProdutoOptionRow & { id: string; nome: string; codigo_interno: string; preco_venda: number; preco_custo: number; unidade_medida: string })[];
  formasPagamento: { id: string; descricao: string }[];
  loading: boolean;
  fornecedoresLoading: boolean;
  produtosLoading: boolean;
  statusLabels: Record<string, string>;
  kpis: { total: number; totalValue: number; aguardando: number; recebidos: number };

  // Form state
  form: PedidoCompraForm;
  setForm: React.Dispatch<React.SetStateAction<PedidoCompraForm>>;
  items: GridItem[];
  setItems: React.Dispatch<React.SetStateAction<GridItem[]>>;
  saving: boolean;
  mode: "create" | "edit";

  // Selected / view data
  selected: PedidoCompra | null;
  viewItems: PedidoItemRow[];
  viewEstoque: EstoqueMovimentoRow[];
  viewFinanceiro: FinanceiroLancRow[];
  viewCotacao: CotacaoRow | null;

  // Actions
  refreshAll: () => Promise<void>;
  openCreate: () => void;
  openEdit: (p: PedidoCompra) => Promise<void>;
  openView: (p: PedidoCompra) => Promise<void>;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  darEntrada: (p: PedidoCompra) => Promise<void>;
  marcarEnviado: (p: PedidoCompra) => Promise<void>;
  cancelarPedido: (p: PedidoCompra) => Promise<void>;
  deleteSelected: () => Promise<void>;
  setSelected: React.Dispatch<React.SetStateAction<PedidoCompra | null>>;

  // Modal state
  modalOpen: boolean;
  setModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  drawerOpen: boolean;
  setDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function usePedidosCompra(): UsePedidosCompraReturn {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<PedidoCompra | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<PedidoCompraForm>(emptyPedidoForm);
  const [items, setItems] = useState<GridItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewItems, setViewItems] = useState<PedidoItemRow[]>([]);
  const [viewEstoque, setViewEstoque] = useState<EstoqueMovimentoRow[]>([]);
  const [viewFinanceiro, setViewFinanceiro] = useState<FinanceiroLancRow[]>([]);
  const [viewCotacao, setViewCotacao] = useState<CotacaoRow | null>(null);

  const {
    data: pedidosRaw = [],
    isLoading: loading,
    refetch: refetchPedidos,
  } = useQuery({
    queryKey: ["pedidos_compra"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pedidos_compra")
        .select("*, fornecedores(nome_razao_social, cpf_cnpj)")
        .eq("ativo", true)
        .order("id", { ascending: false });
      if (error) throw error;
      return (data || []) as PedidoCompra[];
    },
    select: (data) => data.map((pedido) => ({
      ...pedido,
      fornecedor_nome: pedido.fornecedores?.nome_razao_social ?? null,
      fornecedor_cnpj: pedido.fornecedores?.cpf_cnpj ?? null,
    })),
  });

  const { data: fornecedoresRaw = [], isLoading: fornecedoresLoading } = useQuery({
    queryKey: ["pedidos_compra_fornecedores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fornecedores")
        .select("id, nome_razao_social, cpf_cnpj, ativo")
        .order("id", { ascending: false });
      if (error) throw error;
      return (data || []) as FornecedorOptionRow[];
    },
  });

  const { data: produtosRaw = [], isLoading: produtosLoading } = useQuery({
    queryKey: ["pedidos_compra_produtos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos")
        .select("id, nome, codigo_interno, preco_venda, preco_custo, unidade_medida, ativo")
        .eq("ativo", true)
        .order("id", { ascending: false });
      if (error) throw error;
      return (data || []) as ProdutoOptionRow[];
    },
  });

  const { data: formasPagamentoRaw = [] } = useQuery({
    queryKey: ["pedidos_compra_formas_pagamento"],
    queryFn: async () => {
      const { data, error } = await supabase.from("formas_pagamento")
        .select("id, descricao")
        .eq("ativo", true)
        .order("descricao", { ascending: true });
      if (error) throw error;
      return (data || []) as { id: string; descricao: string }[];
    },
  });

  const pedidos = pedidosRaw;
  const fornecedoresAtivos = fornecedoresRaw.filter((f) => f.ativo !== false);

  const fornecedorOptions = fornecedoresAtivos.map((f) => ({
    id: String(f.id),
    label: f.nome_razao_social || "",
    sublabel: f.cpf_cnpj || "",
  }));

  const produtosOptionsData = produtosRaw.map((p) => ({
    ...p,
    id: String(p.id),
    nome: p.nome || "",
    codigo_interno: p.codigo_interno || "",
    preco_venda: Number(p.preco_venda || 0),
    preco_custo: Number(p.preco_custo || 0),
    unidade_medida: p.unidade_medida || "",
  }));

  const kpis = useMemo(() => {
    const aguardando = pedidos.filter((p) =>
      ["rascunho", "aprovado", "enviado_ao_fornecedor", "aguardando_recebimento"].includes(p.status),
    );
    const recebidos = pedidos.filter((p) => p.status === "recebido");
    const totalValue = pedidos.reduce((s, p) => s + Number(p.valor_total || 0), 0);
    return { total: pedidos.length, totalValue, aguardando: aguardando.length, recebidos: recebidos.length };
  }, [pedidos]);

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["pedidos_compra"] }),
      queryClient.invalidateQueries({ queryKey: ["pedidos_compra_fornecedores"] }),
      queryClient.invalidateQueries({ queryKey: ["pedidos_compra_produtos"] }),
    ]);
    await refetchPedidos();
  };

  const openCreate = () => {
    setMode("create");
    setForm({ ...emptyPedidoForm });
    setItems([]);
    setSelected(null);
    setModalOpen(true);
  };

  const openEdit = async (p: PedidoCompra) => {
    setMode("edit");
    setSelected(p);
    setViewEstoque([]);
    setViewCotacao(null);
    setForm({
      fornecedor_id: p.fornecedor_id ? String(p.fornecedor_id) : "",
      data_pedido: p.data_pedido || new Date().toISOString().split("T")[0],
      data_entrega_prevista: p.data_entrega_prevista || "",
      data_entrega_real: p.data_entrega_real || "",
      frete_valor: String(p.frete_valor ?? ""),
      condicao_pagamento: p.condicao_pagamento || p.condicoes_pagamento || "",
      status: p.status || "rascunho",
      observacoes: p.observacoes || "",
    });

    const { data: itens, error } = await supabase.from("pedidos_compra_itens")
      .select("*, produtos(nome, codigo_interno)")
      .eq("pedido_compra_id", p.id);

    if (error) {
      toast.error(getUserFriendlyError(error));
      return;
    }

    setItems((itens || []).map((i: PedidoItemRow) => ({
      id: String(i.id),
      produto_id: i.produto_id ? String(i.produto_id) : "",
      codigo: i.produtos?.codigo_interno || "",
      descricao: i.produtos?.nome || "",
      quantidade: Number(i.quantidade || 0),
      valor_unitario: Number(i.preco_unitario ?? i.valor_unitario ?? 0),
      valor_total: Number(i.subtotal ?? i.valor_total ?? 0),
    })));

    const estResult = await supabase
      .from("estoque_movimentos")
      .select("produto_id, quantidade")
      .eq("documento_id", String(p.id))
      .eq("documento_tipo", "pedido_compra");
    setViewEstoque((estResult.data as EstoqueMovimentoRow[]) || []);

    if (p.cotacao_compra_id) {
      const { data: cot } = await supabase.from("cotacoes_compra")
        .select("id, numero, status, data_cotacao")
        .eq("id", String(p.cotacao_compra_id))
        .single();
      setViewCotacao(cot || null);
    }

    setModalOpen(true);
  };

  const openView = async (p: PedidoCompra) => {
    setSelected(p);
    setViewItems([]);
    setViewEstoque([]);
    setViewFinanceiro([]);
    setViewCotacao(null);
    setDrawerOpen(true);

    const [itensResult, estResult] = await Promise.all([
      supabase.from("pedidos_compra_itens")
        .select("*, produtos(nome, codigo_interno)")
        .eq("pedido_compra_id", p.id),
      supabase.from("estoque_movimentos")
        .select("*, produtos(nome, codigo_interno)")
        .eq("documento_id", p.id)
        .eq("documento_tipo", "pedido_compra"),
    ]);

    setViewItems((itensResult.data || []) as unknown as PedidoItemRow[]);
    setViewEstoque((estResult.data as EstoqueMovimentoRow[]) || []);

    if (p.cotacao_compra_id) {
      const { data: cot } = await supabase.from("cotacoes_compra")
        .select("id, numero, status, data_cotacao")
        .eq("id", String(p.cotacao_compra_id))
        .single();
      setViewCotacao(cot || null);
    }

    const { data: finLanc } = await supabase
      .from("financeiro_lancamentos")
      .select("id, descricao, valor, status, data_vencimento, tipo")
      .ilike("descricao", `${pedidoNumero(p)}%`)
      .eq("ativo", true);
    setViewFinanceiro((finLanc as FinanceiroLancRow[]) || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (!form.fornecedor_id) {
      toast.error("Fornecedor é obrigatório");
      return;
    }

    // Validate items
    const validItems = items.filter((i) => i.produto_id);
    if (validItems.length === 0) {
      toast.error("Adicione ao menos um item com produto selecionado.");
      return;
    }
    const invalidQty = validItems.findIndex((i) => Number(i.quantidade || 0) <= 0);
    if (invalidQty !== -1) {
      toast.error(`Item ${invalidQty + 1}: quantidade deve ser maior que zero.`);
      return;
    }
    const invalidPrice = validItems.findIndex((i) => Number(i.valor_unitario ?? 0) < 0);
    if (invalidPrice !== -1) {
      toast.error(`Item ${invalidPrice + 1}: preço unitário inválido.`);
      return;
    }

    const fornecedorId = String(form.fornecedor_id);
    setSaving(true);

    const valorProdutos = items.reduce((s, i) => s + Number(i.valor_total || 0), 0);
    const valorTotal = valorProdutos + Number(form.frete_valor || 0);

    const payload = {
      fornecedor_id: fornecedorId,
      data_pedido: form.data_pedido,
      data_entrega_prevista: form.data_entrega_prevista || null,
      data_entrega_real: form.data_entrega_real || null,
      frete_valor: Number(form.frete_valor || 0),
      condicao_pagamento: form.condicao_pagamento || null,
      status: form.status,
      observacoes: form.observacoes || null,
      valor_total: valorTotal,
    };

    let pedidoId: string | number | undefined = selected?.id;

    try {
      if (mode === "create") {
        const { data: rpcNumero } = await supabase.rpc("proximo_numero_pedido_compra");
        const numero = rpcNumero || `PC-${String(Date.now()).slice(-6)}`;
        const { data: newP, error } = await supabase.from("pedidos_compra")
          .insert({ numero, ...payload })
          .select()
          .single();
        if (error) {
          toast.error(getUserFriendlyError(error));
          setSaving(false);
          return;
        }
        pedidoId = newP.id;
      } else if (selected) {
        await Promise.all([
          supabase.from("pedidos_compra").update(payload).eq("id", selected.id),
          supabase.from("pedidos_compra_itens").delete().eq("pedido_compra_id", selected.id),
        ]);
      }

      if (items.length > 0 && pedidoId) {
        const itemsPayload = items
          .filter((i) => i.produto_id)
          .map((i) => ({
            pedido_compra_id: String(pedidoId),
            produto_id: String(i.produto_id),
            quantidade: Number(i.quantidade || 0),
            preco_unitario: Number(i.valor_unitario || 0),
            subtotal: Number(i.valor_total || 0),
          }));

        if (itemsPayload.length > 0) {
          const { error: itemsError } = await supabase.from("pedidos_compra_itens").insert(itemsPayload);
          if (itemsError) {
            if (mode === "create" && pedidoId) {
              await supabase.from("pedidos_compra").delete().eq("id", pedidoId);
            }
            toast.error(getUserFriendlyError(itemsError));
            setSaving(false);
            return;
          }
        }
      }

      toast.success("Pedido de compra salvo!");
      setModalOpen(false);
      setItems([]);
      setForm({ ...emptyPedidoForm });
      await refreshAll();
    } catch (err: unknown) {
      console.error("[pedidos_compra] unexpected error", err);
      toast.error(getUserFriendlyError(err));
    }

    setSaving(false);
  };

  const darEntrada = async (p: PedidoCompra) => {
    const { data: itens } = await supabase.from("pedidos_compra_itens")
      .select("*, produtos(nome, codigo_interno, estoque_atual)")
      .eq("pedido_compra_id", p.id);

    if (!itens || itens.length === 0) {
      toast.error("Pedido sem itens para registrar recebimento.");
      return;
    }

    // Guard: block duplicate receipt
    const { count: movCount } = await supabase
      .from("estoque_movimentos")
      .select("id", { count: "exact", head: true })
      .eq("documento_id", String(p.id))
      .eq("documento_tipo", "pedido_compra");
    if (movCount && movCount > 0) {
      toast.error("Recebimento já registrado para este pedido. Verifique o estoque.");
      return;
    }

    // Guard: block duplicate financial entry (uses observacoes tag for exact match)
    const pedidoTag = `ref:pedido_compra:${p.id}`;
    const { count: lancCount } = await supabase
      .from("financeiro_lancamentos")
      .select("id", { count: "exact", head: true })
      .eq("observacoes", pedidoTag)
      .eq("ativo", true);
    const financeiroDuplicado = lancCount !== null && lancCount > 0;

    let entradaOk = false;
    try {
      // Insert stock movements — DO NOT manually update produtos.estoque_atual;
      // the database trigger handles estoque synchronisation.
      const movements = (itens as unknown as PedidoItemRow[]).map((item) => ({
        produto_id: String(item.produto_id),
        tipo: "entrada" as const,
        quantidade: Number(item.quantidade || 0),
        saldo_anterior: Number(item.produtos?.estoque_atual || 0),
        saldo_atual: Number(item.produtos?.estoque_atual || 0) + Number(item.quantidade || 0),
        documento_tipo: "pedido_compra",
        documento_id: p.id,
        motivo: `Entrada via ${pedidoNumero(p)}`,
      }));
      const { error: movError } = await supabase.from("estoque_movimentos").insert(movements);
      if (movError) throw movError;

      const condicaoPagamento = String(p.condicao_pagamento || "").trim();
      // Business rule: prefer explicit "<n> dias", otherwise fallback to the first isolated number (e.g., "30").
      const diasMatch = condicaoPagamento.match(/(\d+)\s*dias?/i) ?? condicaoPagamento.match(/\b(\d+)\b/);
      const parsedDias = diasMatch ? Number(diasMatch[1]) : Number.NaN;
      const parsedPedidoDate = new Date(p.data_pedido);
      const baseDate = !Number.isNaN(parsedPedidoDate.getTime()) ? parsedPedidoDate : new Date();
      const dueDate = Number.isFinite(parsedDias)
        ? addDays(baseDate, parsedDias)
        : addDays(new Date(), DEFAULT_DUE_DAYS);

      const vTotal = Number(p.valor_total || 0);
      if (vTotal > 0 && !financeiroDuplicado) {
        const { error: lancError } = await supabase.from("financeiro_lancamentos").insert({
          tipo: "pagar",
          descricao: `${pedidoNumero(p)} — ${p.fornecedores?.nome_razao_social || "Fornecedor"}`,
          observacoes: pedidoTag,
          valor: vTotal,
          saldo_restante: vTotal,
          data_vencimento: dueDate.toISOString().split("T")[0],
          status: "aberto",
          fornecedor_id: p.fornecedor_id ? String(p.fornecedor_id) : null,
        });
        if (lancError) throw lancError;
      } else if (financeiroDuplicado) {
        toast.warning("Lançamento financeiro já existente para este pedido — não gerou duplicata.");
      }

      const hoje = new Date().toISOString().split("T")[0];
      const { error: statusError } = await supabase.from("pedidos_compra")
        .update({ status: "recebido", data_entrega_real: hoje })
        .eq("id", p.id);
      if (statusError) throw statusError;

      entradaOk = true;
      toast.success("Recebimento registrado! Estoque atualizado e financeiro gerado.");
      setDrawerOpen(false);
      await refreshAll();
    } catch (err: unknown) {
      console.error("[darEntrada]", err);
      toast.error(getUserFriendlyError(err));
    }

    // Navigate to fiscal only after a successful entry
    if (entradaOk) {
      navigate(`/fiscal?tipo=entrada&fornecedor_id=${p.fornecedor_id || ""}&pedido_compra=${pedidoNumero(p)}`);
    }
  };

  const marcarEnviado = async (p: PedidoCompra) => {
    try {
      await supabase.from("pedidos_compra")
        .update({ status: "enviado_ao_fornecedor" })
        .eq("id", p.id);
      toast.success("Pedido marcado como enviado ao fornecedor.");
      await refreshAll();
    } catch (err: unknown) {
      console.error("[marcarEnviado]", err);
      toast.error(getUserFriendlyError(err));
    }
  };

  const cancelarPedido = async (p: PedidoCompra) => {
    try {
      await supabase.from("pedidos_compra")
        .update({ status: "cancelado" })
        .eq("id", p.id);
      toast.success("Pedido de compra cancelado.");
      setDrawerOpen(false);
      await refreshAll();
    } catch (err: unknown) {
      console.error("[cancelarPedido]", err);
      toast.error(getUserFriendlyError(err));
    }
  };

  const deleteSelected = async () => {
    if (!selected) return;
    await supabase.from("pedidos_compra").update({ ativo: false }).eq("id", selected.id);
    await refreshAll();
    toast.success("Removido!");
  };

  return {
    pedidos,
    fornecedoresAtivos,
    fornecedorOptions,
    produtosOptionsData,
    formasPagamento: formasPagamentoRaw,
    loading,
    fornecedoresLoading,
    produtosLoading,
    statusLabels,
    kpis,
    form,
    setForm,
    items,
    setItems,
    saving,
    mode,
    selected,
    viewItems,
    viewEstoque,
    viewFinanceiro,
    viewCotacao,
    refreshAll,
    openCreate,
    openEdit,
    openView,
    handleSubmit,
    darEntrada,
    marcarEnviado,
    cancelarPedido,
    deleteSelected,
    setSelected,
    modalOpen,
    setModalOpen,
    drawerOpen,
    setDrawerOpen,
  };
}
