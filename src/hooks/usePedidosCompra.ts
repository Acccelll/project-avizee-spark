// @ts-nocheck
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { type GridItem } from "@/components/ui/ItemsGrid";
import {
  type PedidoCompra,
  type FornecedorOptionRow,
  type ProdutoOptionRow,
  emptyPedidoForm,
  pedidoNumero,
} from "@/components/compras/pedidoCompraTypes";
import { statusPedidoCompra } from "@/lib/statusSchema";

const statusLabels: Record<string, string> = Object.fromEntries(
  Object.entries(statusPedidoCompra).map(([k, v]) => [k, v.label]),
);

const MOCK_PEDIDOS: PedidoCompra[] = [
  {
    id: "b3b3b3b3-b003-b003-b003-b00300000001",
    numero: "PC-EX-0001",
    fornecedor_id: "a5a5a5a5-0005-0005-0005-000000000001",
    data_pedido: "2026-03-12",
    data_entrega_prevista: "2026-03-20",
    data_entrega_real: "2026-03-20",
    valor_total: 3190.0,
    frete_valor: 120.0,
    condicao_pagamento: "30 dias",
    status: "recebido",
    observacoes: "Pedido exemplo recebido integralmente.",
    cotacao_compra_id: null,
    ativo: true,
    fornecedores: { nome_razao_social: "BioVet Insumos Ltda", cpf_cnpj: "11.222.333/0001-44" },
  },
  {
    id: "b3b3b3b3-b003-b003-b003-b00300000002",
    numero: "PC-EX-0002",
    fornecedor_id: "a5a5a5a5-0005-0005-0005-000000000002",
    data_pedido: "2026-03-28",
    data_entrega_prevista: "2026-04-10",
    data_entrega_real: null,
    valor_total: 2880.0,
    frete_valor: 85.0,
    condicao_pagamento: "45 dias",
    status: "aguardando_recebimento",
    observacoes: "Pedido exemplo aguardando recebimento do fornecedor.",
    cotacao_compra_id: null,
    ativo: true,
    fornecedores: { nome_razao_social: "Agroinsumos do Sul Ltda", cpf_cnpj: "22.333.444/0001-55" },
  },
  {
    id: "b3b3b3b3-b003-b003-b003-b00300000003",
    numero: "PC-EX-0003",
    fornecedor_id: "a5a5a5a5-0005-0005-0005-000000000003",
    data_pedido: "2026-04-03",
    data_entrega_prevista: "2026-04-18",
    data_entrega_real: null,
    valor_total: 1860.0,
    frete_valor: 60.0,
    condicao_pagamento: "a_vista",
    status: "pedido_emitido",
    observacoes: "Pedido exemplo recém emitido para acompanhamento de recebimento.",
    cotacao_compra_id: null,
    ativo: true,
    fornecedores: { nome_razao_social: "Pack Rural Embalagens Ltda", cpf_cnpj: "33.444.555/0001-66" },
  },
];

export interface UsePedidosCompraReturn {
  // Data
  pedidos: PedidoCompra[];
  fornecedoresAtivos: FornecedorOptionRow[];
  fornecedorOptions: { id: string; label: string; sublabel: string }[];
  produtosOptionsData: (ProdutoOptionRow & { id: string; nome: string; codigo_interno: string; preco_venda: number; unidade_medida: string })[];
  formasPagamento: { id: string; descricao: string }[];
  loading: boolean;
  fornecedoresLoading: boolean;
  produtosLoading: boolean;
  statusLabels: Record<string, string>;
  kpis: { total: number; totalValue: number; aguardando: number; recebidos: number };

  // Form state
  form: Record<string, string>;
  setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  items: GridItem[];
  setItems: React.Dispatch<React.SetStateAction<GridItem[]>>;
  saving: boolean;
  mode: "create" | "edit";

  // Selected / view data
  selected: PedidoCompra | null;
  viewItems: unknown[];
  viewEstoque: unknown[];
  viewFinanceiro: unknown[];
  viewCotacao: unknown | null;

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
  const [form, setForm] = useState<Record<string, string>>(emptyPedidoForm);
  const [items, setItems] = useState<GridItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewItems, setViewItems] = useState<unknown[]>([]);
  const [viewEstoque, setViewEstoque] = useState<unknown[]>([]);
  const [viewFinanceiro, setViewFinanceiro] = useState<unknown[]>([]);
  const [viewCotacao, setViewCotacao] = useState<unknown | null>(null);

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)("fornecedores")
        .select("id, nome_razao_social, cpf_cnpj, ativo")
        .order("id", { ascending: false });
      if (error) throw error;
      return (data || []) as FornecedorOptionRow[];
    },
  });

  const { data: produtosRaw = [], isLoading: produtosLoading } = useQuery({
    queryKey: ["pedidos_compra_produtos"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)("produtos")
        .select("id, nome, codigo_interno, preco_venda, unidade_medida, ativo")
        .eq("ativo", true)
        .order("id", { ascending: false });
      if (error) throw error;
      return (data || []) as ProdutoOptionRow[];
    },
  });

  const { data: formasPagamentoRaw = [] } = useQuery({
    queryKey: ["pedidos_compra_formas_pagamento"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)("formas_pagamento")
        .select("id, descricao")
        .eq("ativo", true)
        .order("descricao", { ascending: true });
      if (error) throw error;
      return (data || []) as { id: string; descricao: string }[];
    },
  });

  const pedidos = pedidosRaw.length > 0 ? pedidosRaw : MOCK_PEDIDOS;
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
    await queryClient.invalidateQueries({ queryKey: ["pedidos_compra"] });
    await queryClient.invalidateQueries({ queryKey: ["pedidos_compra_fornecedores"] });
    await queryClient.invalidateQueries({ queryKey: ["pedidos_compra_produtos"] });
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
      toast.error("Erro ao carregar itens do pedido.");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setItems((itens || []).map((i: any) => ({
      id: String(i.id),
      produto_id: i.produto_id ? String(i.produto_id) : "",
      codigo: i.produtos?.codigo_interno || "",
      descricao: i.produtos?.nome || "",
      quantidade: Number(i.quantidade || 0),
      valor_unitario: Number(i.valor_unitario || 0),
      valor_total: Number(i.valor_total || 0),
    })));

    const estResult = await supabase
      .from("estoque_movimentos")
      .select("produto_id, quantidade")
      .eq("documento_id", String(p.id))
      .eq("documento_tipo", "pedido_compra");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setViewEstoque((estResult.data as any[]) || []);

    if (p.cotacao_compra_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cot } = await (supabase.from as any)("cotacoes_compra")
        .select("id, numero, status, data_cotacao")
        .eq("id", p.cotacao_compra_id)
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

    setViewItems(itensResult.data || []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setViewEstoque((estResult.data as any[]) || []);

    if (p.cotacao_compra_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cot } = await (supabase.from as any)("cotacoes_compra")
        .select("id, numero, status, data_cotacao")
        .eq("id", p.cotacao_compra_id)
        .single();
      setViewCotacao(cot || null);
    }

    const { data: finLanc } = await supabase
      .from("financeiro_lancamentos")
      .select("id, descricao, valor, status, data_vencimento, tipo")
      .ilike("descricao", `${pedidoNumero(p)}%`)
      .eq("ativo", true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setViewFinanceiro((finLanc as any[]) || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (!form.fornecedor_id) {
      toast.error("Fornecedor é obrigatório");
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
        const numero = `PC-${String(Date.now()).slice(-6)}`;
        const { data: newP, error } = await supabase.from("pedidos_compra")
          .insert({ numero, ...payload })
          .select()
          .single();
        if (error) {
          toast.error(`Erro ao criar pedido: ${error.message}`);
          setSaving(false);
          return;
        }
        pedidoId = newP.id;
      } else if (selected) {
        const { error } = await supabase.from("pedidos_compra")
          .update(payload)
          .eq("id", selected.id);
        if (error) {
          toast.error(`Erro ao atualizar pedido: ${error.message}`);
          setSaving(false);
          return;
        }
        await supabase.from("pedidos_compra_itens").delete().eq("pedido_compra_id", selected.id);
      }

      if (items.length > 0 && pedidoId) {
        const itemsPayload = items
          .filter((i) => i.produto_id)
          .map((i) => ({
            pedido_compra_id: String(pedidoId),
            produto_id: String(i.produto_id),
            quantidade: Number(i.quantidade || 0),
            valor_unitario: Number(i.valor_unitario || 0),
            valor_total: Number(i.valor_total || 0),
          }));

        if (itemsPayload.length > 0) {
          const { error: itemsError } = await supabase.from("pedidos_compra_itens").insert(itemsPayload);
          if (itemsError) {
            if (mode === "create" && pedidoId) {
              await supabase.from("pedidos_compra").delete().eq("id", pedidoId);
            }
            toast.error(`Erro ao salvar itens: ${itemsError.message}`);
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
      const msg = err instanceof Error ? err.message : "Erro inesperado";
      console.error("[pedidos_compra] unexpected error", msg);
      toast.error("Erro inesperado ao salvar. Tente novamente.");
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

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const item of itens as any[]) {
        const saldoAnterior = Number(item.produtos?.estoque_atual || 0);
        const qtd = Number(item.quantidade || 0);

        await supabase.from("estoque_movimentos").insert({
          produto_id: item.produto_id,
          tipo: "entrada" as const,
          quantidade: qtd,
          saldo_anterior: saldoAnterior,
          saldo_atual: saldoAnterior + qtd,
          documento_tipo: "pedido_compra",
          documento_id: p.id,
          motivo: `Entrada via ${pedidoNumero(p)}`,
        });

        await supabase.from("produtos").update({ estoque_atual: saldoAnterior + qtd }).eq("id", item.produto_id);
      }

      const vTotal = Number(p.valor_total || 0);
      if (vTotal > 0) {
        await supabase.from("financeiro_lancamentos").insert({
          tipo: "pagar" as const,
          descricao: `${pedidoNumero(p)} — ${p.fornecedores?.nome_razao_social || "Fornecedor"}`,
          valor: vTotal,
          saldo_restante: vTotal,
          data_vencimento: p.data_entrega_prevista || new Date().toISOString().split("T")[0],
          status: "aberto" as const,
          fornecedor_id: p.fornecedor_id || null,
        });
      }

      const hoje = new Date().toISOString().split("T")[0];
      await supabase.from("pedidos_compra")
        .update({ status: "recebido", data_entrega_real: hoje })
        .eq("id", p.id);

      toast.success("Recebimento registrado! Estoque atualizado e financeiro gerado.");
      setDrawerOpen(false);
      await refreshAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("[darEntrada]", msg);
      toast.error("Erro ao processar recebimento.");
    }

    navigate(`/fiscal?tipo=entrada&fornecedor_id=${p.fornecedor_id || ""}&pedido_compra=${pedidoNumero(p)}`);
  };

  const marcarEnviado = async (p: PedidoCompra) => {
    try {
      await supabase.from("pedidos_compra")
        .update({ status: "enviado_ao_fornecedor" })
        .eq("id", p.id);
      toast.success("Pedido marcado como enviado ao fornecedor.");
      await refreshAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("[marcarEnviado]", msg);
      toast.error("Erro ao atualizar status.");
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
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("[cancelarPedido]", msg);
      toast.error(`Erro ao cancelar pedido: ${msg}`);
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
