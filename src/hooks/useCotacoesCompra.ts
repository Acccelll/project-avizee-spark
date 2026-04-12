
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";
import {
  type CotacaoCompra,
  type CotacaoItem,
  type CotacaoSummary,
  type Proposta,
  type LocalItem,
  emptyForm,
} from "@/components/compras/cotacaoCompraTypes";

export function useCotacoesCompra() {
  const navigate = useNavigate();
  const { data, loading, fetchData, remove } = useSupabaseCrud<CotacaoCompra>({
    table: "cotacoes_compra",
    orderBy: "created_at",
    ascending: false,
  });
  const fornecedoresCrud = useSupabaseCrud<{ id: string; nome_razao_social: string; cpf_cnpj?: string }>({ table: "fornecedores" });
  const produtosCrud = useSupabaseCrud<{ id: string; nome: string; codigo_interno?: string; sku?: string }>({ table: "produtos" });

  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<CotacaoCompra | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState(emptyForm);
  const [localItems, setLocalItems] = useState<LocalItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [viewItems, setViewItems] = useState<CotacaoItem[]>([]);
  const [viewPropostas, setViewPropostas] = useState<Proposta[]>([]);

  const [addingProposal, setAddingProposal] = useState<string | null>(null);
  const [proposalForm, setProposalForm] = useState({
    fornecedor_id: "",
    preco_unitario: 0,
    prazo_entrega_dias: "",
    observacoes: "",
  });

  // KPIs
  const kpis = useMemo(() => {
    const emCotacao = data.filter((c) => c.status === "aberta" || c.status === "em_analise").length;
    const aguardandoAprovacao = data.filter((c) => c.status === "aguardando_aprovacao").length;
    const convertidas = data.filter((c) => c.status === "convertida").length;
    return { total: data.length, emCotacao, aguardandoAprovacao, convertidas };
  }, [data]);

  // Per-row enrichment: items count, supplier count, winner
  const [summaries, setSummaries] = useState<Record<string, CotacaoSummary>>({});

  // Stable string key derived from the loaded IDs
  const enrichmentKey = useMemo(() => data.map((c) => c.id).join(","), [data]);

  useEffect(() => {
    if (!enrichmentKey) return;
    const ids = enrichmentKey.split(",");
    Promise.all([
      supabase
        .from("cotacoes_compra_itens")
        .select("cotacao_compra_id")
        .in("cotacao_compra_id", ids),
      supabase
        .from("cotacoes_compra_propostas")
        .select("cotacao_compra_id, fornecedor_id, selecionado, fornecedores(nome_razao_social)")
        .in("cotacao_compra_id", ids),
    ]).then(([{ data: itens }, { data: propostas }]) => {
      const map: Record<string, CotacaoSummary> = {};
      for (const id of ids) {
        const cItens = (itens || []).filter((i: { cotacao_compra_id: string }) => i.cotacao_compra_id === id);
        const cPropostas = (propostas || []).filter((p: { cotacao_compra_id: string }) => p.cotacao_compra_id === id);
        const fornUniq = new Set(cPropostas.map((p: { fornecedor_id: string }) => p.fornecedor_id)).size;
        const selecionadas = cPropostas.filter((p: { selecionado: boolean }) => p.selecionado);
        const vencIds = [...new Set(selecionadas.map((p: { fornecedor_id: string }) => p.fornecedor_id))];
        const vencNome =
          vencIds.length === 1
            ? ((cPropostas.find(
                (p: { fornecedor_id: string; selecionado: boolean }) =>
                  p.fornecedor_id === vencIds[0] && p.selecionado
              ) as { fornecedores?: { nome_razao_social: string } } | undefined)?.fornecedores?.nome_razao_social ?? null)
            : vencIds.length > 1
            ? `${vencIds.length} fornecedores`
            : null;
        map[id] = {
          itens_count: cItens.length,
          fornecedores_count: fornUniq,
          vencedor_nome: vencNome,
          tem_vencedor: selecionadas.length > 0,
        };
      }
      setSummaries(map);
    }).catch(() => { /* silent – enrichment is best-effort */ });
  }, [enrichmentKey]);

  // Drawer summary stats
  const drawerStats = useMemo(() => {
    const uniqueSuppliers = new Set(viewPropostas.map((p) => p.fornecedor_id)).size;
    const bestTotal = viewItems.reduce((sum, item) => {
      const itemPropostas = viewPropostas.filter((p) => p.item_id === item.id);
      if (itemPropostas.length === 0) return sum;
      const best = Math.min(...itemPropostas.map((p) => Number(p.preco_unitario)));
      return sum + best * item.quantidade;
    }, 0);
    const selectedPropostas = viewPropostas.filter((p) => p.selecionado);
    const selectedSupplierIds = [...new Set(selectedPropostas.map((p) => p.fornecedor_id))];
    const selectedSupplierName =
      selectedSupplierIds.length === 1
        ? viewPropostas.find(
            (p) => p.fornecedor_id === selectedSupplierIds[0] && p.selecionado
          )?.fornecedores?.nome_razao_social ?? null
        : selectedSupplierIds.length > 1
        ? `${selectedSupplierIds.length} fornecedores`
        : null;
    const allItemsHaveSelected =
      viewItems.length > 0 &&
      viewItems.every((item) => viewPropostas.some((p) => p.item_id === item.id && p.selecionado));
    return { uniqueSuppliers, bestTotal, selectedPropostas, selectedSupplierName, allItemsHaveSelected };
  }, [viewItems, viewPropostas]);

  const openCreate = () => {
    setMode("create");
    setForm({ ...emptyForm, numero: `COT-C-${String(data.length + 1).padStart(4, "0")}` });
    setLocalItems([]);
    setSelected(null);
    setModalOpen(true);
  };

  const openEdit = async (c: CotacaoCompra) => {
    setMode("edit");
    setSelected(c);
    setForm({
      numero: c.numero,
      data_cotacao: c.data_cotacao,
      data_validade: c.data_validade || "",
      observacoes: c.observacoes || "",
      status: c.status,
    });
    const { data: itens } = await supabase
      .from("cotacoes_compra_itens")
      .select("*, produtos(nome, codigo_interno, sku)")
      .eq("cotacao_compra_id", c.id);
    setLocalItems(
      (itens || []).map((i: CotacaoItem & { id: string }) => ({
        _localId: i.id,
        id: i.id,
        produto_id: i.produto_id,
        quantidade: i.quantidade,
        unidade: i.unidade || "UN",
      }))
    );
    setModalOpen(true);
  };

  const openView = async (c: CotacaoCompra) => {
    setSelected(c);
    setDrawerOpen(true);
    const [{ data: itens }, { data: propostas }] = await Promise.all([
      supabase
        .from("cotacoes_compra_itens")
        .select("*, produtos(nome, codigo_interno, sku)")
        .eq("cotacao_compra_id", c.id),
      supabase
        .from("cotacoes_compra_propostas")
        .select("*, fornecedores(nome_razao_social)")
        .eq("cotacao_compra_id", c.id),
    ]);
    setViewItems(itens || []);
    setViewPropostas(propostas || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.numero) { toast.error("Número é obrigatório"); return; }
    if (localItems.length === 0) { toast.error("Adicione ao menos um item"); return; }
    setSaving(true);
    try {
      const payload = {
        numero: form.numero,
        data_cotacao: form.data_cotacao,
        data_validade: form.data_validade || null,
        observacoes: form.observacoes || null,
        status: form.status,
      };
      let cotacaoId = selected?.id;
      if (mode === "create") {
        const { data: newC, error } = await supabase.from("cotacoes_compra").insert(payload).select().single();
        if (error) throw error;
        cotacaoId = (newC as CotacaoCompra).id;
      } else if (selected) {
        await Promise.all([
          supabase.from("cotacoes_compra").update(payload).eq("id", selected.id).then(({ error }) => { if (error) throw error; }),
          supabase.from("cotacoes_compra_itens").delete().eq("cotacao_compra_id", selected.id),
        ]);
      }
      if (cotacaoId && localItems.length > 0) {
        const itemsPayload = localItems.filter((i) => i.produto_id).map((i) => ({
          cotacao_compra_id: cotacaoId,
          produto_id: i.produto_id,
          quantidade: i.quantidade,
          unidade: i.unidade,
        }));
        await supabase.from("cotacoes_compra_itens").insert(itemsPayload);
      }
      toast.success("Cotação de compra salva!");
      setModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      console.error("[cotacoes_compra]", err);
      toast.error(getUserFriendlyError(err));
    }
    setSaving(false);
  };

  const addLocalItem = () => {
    setLocalItems([...localItems, { _localId: crypto.randomUUID(), produto_id: "", quantidade: 1, unidade: "UN" }]);
  };

  const updateLocalItem = (localId: string, field: string, value: unknown) => {
    setLocalItems(localItems.map((i) => (i._localId === localId ? { ...i, [field]: value } : i)));
  };

  const removeLocalItem = (localId: string) => {
    setLocalItems(localItems.filter((i) => i._localId !== localId));
  };

  const reloadPropostas = async () => {
    if (!selected) return;
    const { data: propostas } = await supabase
      .from("cotacoes_compra_propostas")
      .select("*, fornecedores(nome_razao_social)")
      .eq("cotacao_compra_id", selected.id);
    setViewPropostas(propostas || []);
  };

  const handleAddProposal = async (itemId: string) => {
    if (!proposalForm.fornecedor_id || !selected) return;
    try {
      await supabase.from("cotacoes_compra_propostas").insert({
        cotacao_compra_id: selected.id,
        item_id: itemId,
        fornecedor_id: proposalForm.fornecedor_id,
        preco_unitario: proposalForm.preco_unitario,
        prazo_entrega_dias: proposalForm.prazo_entrega_dias ? Number(proposalForm.prazo_entrega_dias) : null,
        observacoes: proposalForm.observacoes || null,
        selecionado: false,
      });
      toast.success("Proposta adicionada!");
      setAddingProposal(null);
      setProposalForm({ fornecedor_id: "", preco_unitario: 0, prazo_entrega_dias: "", observacoes: "" });
      await reloadPropostas();
    } catch (err: unknown) {
      toast.error(getUserFriendlyError(err));
    }
  };

  const handleSelectProposal = async (propostaId: string, itemId: string) => {
    if (!selected) return;
    try {
      await Promise.all([
        supabase
          .from("cotacoes_compra_propostas")
          .update({ selecionado: false })
          .eq("cotacao_compra_id", selected.id)
          .eq("item_id", itemId),
        supabase
          .from("cotacoes_compra_propostas")
          .update({ selecionado: true })
          .eq("id", propostaId),
      ]);
      toast.success("Fornecedor selecionado!");
      await reloadPropostas();
    } catch (err: unknown) {
      toast.error(getUserFriendlyError(err));
    }
  };

  const handleDeleteProposal = async (propostaId: string) => {
    if (!selected) return;
    await supabase.from("cotacoes_compra_propostas").delete().eq("id", propostaId);
    toast.success("Proposta removida");
    await reloadPropostas();
  };

  const handleFinalize = async () => {
    if (!selected) return;
    await supabase.from("cotacoes_compra").update({ status: "finalizada" }).eq("id", selected.id);
    toast.success("Cotação finalizada!");
    setDrawerOpen(false);
    fetchData();
  };

  const handleSendForApproval = async () => {
    if (!selected) return;
    try {
      const { error } = await supabase.from("cotacoes_compra").update({ status: "aguardando_aprovacao" }).eq("id", selected.id);
      if (error) throw error;
      setSelected({ ...selected, status: "aguardando_aprovacao" });
      toast.success("Cotação enviada para aprovação!");
      fetchData();
    } catch (err: unknown) {
      toast.error(getUserFriendlyError(err));
    }
  };

  const handleApprove = async () => {
    if (!selected) return;
    try {
      const { error } = await supabase.from("cotacoes_compra").update({ status: "aprovada" }).eq("id", selected.id);
      if (error) throw error;
      setSelected({ ...selected, status: "aprovada" });
      toast.success("Cotação aprovada!");
      fetchData();
    } catch (err: unknown) {
      toast.error(getUserFriendlyError(err));
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    try {
      const { error } = await supabase.from("cotacoes_compra").update({ status: "rejeitada" }).eq("id", selected.id);
      if (error) throw error;
      setSelected({ ...selected, status: "rejeitada" });
      toast.error("Cotação rejeitada.");
      fetchData();
    } catch (err: unknown) {
      toast.error(getUserFriendlyError(err));
    }
  };

  const gerarPedido = async () => {
    if (!selected) return;

    const propostasSelecionadas = viewPropostas.filter((p) => p.selecionado);
    if (propostasSelecionadas.length === 0) {
      toast.error("Selecione ao menos uma proposta antes de gerar o pedido.");
      return;
    }

    const fornecedoresDistintos = [...new Set(propostasSelecionadas.map((p) => p.fornecedor_id))];
    if (fornecedoresDistintos.length > 1) {
      toast.error(
        `As propostas selecionadas pertencem a fornecedores diferentes. Selecione propostas de apenas um fornecedor para gerar o pedido.`,
        { duration: 6000 }
      );
      return;
    }

    const fornecedorId = fornecedoresDistintos[0];

    const itensParaPedido = viewItems
      .map((item) => {
        const proposta = propostasSelecionadas.find(
          (p) => p.item_id === item.id && p.fornecedor_id === fornecedorId
        );
        if (!proposta) return null;
        return {
          produto_id: item.produto_id,
          quantidade: item.quantidade,
          valor_unitario: Number(proposta.preco_unitario || 0),
          valor_total: item.quantidade * Number(proposta.preco_unitario || 0),
        };
      })
      .filter(Boolean);

    if (itensParaPedido.length === 0) {
      toast.error("Nenhum item com proposta válida para gerar pedido.");
      return;
    }

    const valorTotal = itensParaPedido.reduce((s, i) => s + (i?.valor_total || 0), 0);
    const numeroPedido = `PC-${String(Date.now()).slice(-6)}`;

    let pedidoId: string | null = null;
    try {
      const { data: novoPedido, error: erroCabecalho } = await supabase
        .from("pedidos_compra")
        .insert({
          numero: numeroPedido,
          fornecedor_id: fornecedorId,
          cotacao_compra_id: selected.id,
          data_pedido: new Date().toISOString().split("T")[0],
          valor_total: valorTotal,
          status: "aprovado",
          observacoes: `Gerado a partir da cotação ${selected.numero}`,
        })
        .select()
        .single();

      if (erroCabecalho) throw erroCabecalho;

      pedidoId = (novoPedido as { id: string }).id;

      const itemsPayload = itensParaPedido.map((i) => ({ pedido_compra_id: pedidoId, ...i }));
      const { error: erroItens } = await supabase
        .from("pedidos_compra_itens")
        .insert(itemsPayload);

      if (erroItens) {
        const { error: erroRollback } = await supabase
          .from("pedidos_compra")
          .delete()
          .eq("id", pedidoId);
        if (erroRollback) {
          console.error("[gerarPedido] rollback failed:", erroRollback?.message);
        }
        throw erroItens;
      }

      await supabase.from("cotacoes_compra").update({ status: "convertida" }).eq("id", selected.id);

      toast.success(`Pedido ${numeroPedido} gerado com sucesso!`);
      setDrawerOpen(false);
      fetchData();
      navigate("/pedidos-compra");
    } catch (err: unknown) {
      console.error("[gerarPedido]", err);
      toast.error(getUserFriendlyError(err), { duration: 8000 });
    }
  };

  const produtoOptions = produtosCrud.data.map((p) => ({
    id: p.id,
    label: p.nome,
    sublabel: p.codigo_interno || p.sku || "",
  }));

  const fornecedorOptions = fornecedoresCrud.data.map((f) => ({
    id: f.id,
    label: f.nome_razao_social,
    sublabel: f.cpf_cnpj || "",
  }));

  return {
    data,
    loading,
    fetchData,
    remove,
    modalOpen,
    setModalOpen,
    drawerOpen,
    setDrawerOpen,
    selected,
    setSelected,
    mode,
    form,
    setForm,
    localItems,
    saving,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    viewItems,
    viewPropostas,
    addingProposal,
    setAddingProposal,
    proposalForm,
    setProposalForm,
    kpis,
    summaries,
    drawerStats,
    openCreate,
    openEdit,
    openView,
    handleSubmit,
    addLocalItem,
    updateLocalItem,
    removeLocalItem,
    handleAddProposal,
    handleSelectProposal,
    handleDeleteProposal,
    handleFinalize,
    handleSendForApproval,
    handleApprove,
    handleReject,
    gerarPedido,
    produtoOptions,
    fornecedorOptions,
  };
}
