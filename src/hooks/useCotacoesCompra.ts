
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { useSubmitLock } from "@/hooks/useSubmitLock";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";
import { validateForm } from "@/lib/validationSchemas";
import { cotacaoCompraSchema, validateCotacaoItems } from "@/lib/cotacaoCompraSchema";
import { useGerarPedidoCompra } from "@/pages/comercial/hooks/useGerarPedidoCompra";
import type { Database } from "@/integrations/supabase/types";
import {
  type CotacaoCompra,
  type CotacaoItem,
  type CotacaoSummary,
  type Proposta,
  type LocalItem,
  buildEmptyForm,
} from "@/components/compras/cotacaoCompraTypes";
import { canonicalCotacaoStatus } from "@/components/compras/comprasStatus";

export function useCotacoesCompra() {
  const navigate = useNavigate();
  const gerarPedidoCompra = useGerarPedidoCompra();
  const queryClient = useQueryClient();
  const { data, loading, fetchData, remove } = useSupabaseCrud({
    table: "cotacoes_compra",
    orderBy: "created_at",
    ascending: false,
  });
  const fornecedoresCrud = useSupabaseCrud({ table: "fornecedores" });
  const produtosCrud = useSupabaseCrud({ table: "produtos" });

  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<CotacaoCompra | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState(buildEmptyForm());
  const [localItems, setLocalItems] = useState<LocalItem[]>([]);
  const { saving, submit } = useSubmitLock({ errorPrefix: "Erro ao salvar cotação" });
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
    const emCotacao = data.filter((c) => ["aberta", "em_analise"].includes(canonicalCotacaoStatus(c.status))).length;
    const aguardandoAprovacao = data.filter((c) => canonicalCotacaoStatus(c.status) === "aguardando_aprovacao").length;
    const convertidas = data.filter((c) => canonicalCotacaoStatus(c.status) === "convertida").length;
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

  const openCreate = async () => {
    setMode("create");
    const { data: rpcNumero, error: rpcErr } = await supabase.rpc("proximo_numero_cotacao_compra");
    // Numeração crítica deve sempre vir do PostgreSQL SEQUENCE.
    // Se falhar, abortamos a criação para não gerar números duplicáveis.
    if (rpcErr || !rpcNumero) {
      console.error("[cotacoes_compra] proximo_numero_cotacao_compra falhou:", rpcErr);
      toast.error("Não foi possível gerar o número da cotação. Tente novamente.");
      return;
    }
    setForm({ ...buildEmptyForm(), numero: rpcNumero });
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
      status: canonicalCotacaoStatus(c.status),
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
    setSelected({ ...c, status: canonicalCotacaoStatus(c.status) });
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

    // Schema-driven validation (centraliza obrigatórios + status terminal).
    const result = validateForm(cotacaoCompraSchema, form);
    if (!result.success) {
      const firstError = Object.values(result.errors)[0];
      toast.error(firstError || "Corrija os erros do formulário");
      return;
    }
    const itemError = validateCotacaoItems(localItems);
    if (itemError) { toast.error(itemError); return; }

    await submit(async () => {
      const payload = {
        numero: form.numero,
        data_cotacao: form.data_cotacao,
        data_validade: form.data_validade || null,
        observacoes: form.observacoes || null,
        status: form.status,
      };
      let cotacaoId = selected?.id;
      if (mode === "create") {
        const { data: newC, error } = await supabase
          .from("cotacoes_compra")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        cotacaoId = (newC as CotacaoCompra).id;
      } else if (selected) {
        // Sequential update -> delete: evita race onde Promise.all
        // apaga itens mesmo se o update do cabeçalho falhar.
        const { error: updErr } = await supabase
          .from("cotacoes_compra")
          .update(payload)
          .eq("id", selected.id);
        if (updErr) throw updErr;
        const { error: delErr } = await supabase
          .from("cotacoes_compra_itens")
          .delete()
          .eq("cotacao_compra_id", selected.id);
        if (delErr) throw delErr;
      }
      if (cotacaoId) {
        const itemsPayload = localItems
          .filter((i) => i.produto_id)
          .map((i) => ({
            cotacao_compra_id: cotacaoId,
            produto_id: i.produto_id,
            quantidade: i.quantidade,
            unidade: i.unidade,
          }));
        if (itemsPayload.length === 0) {
          toast.error("A cotação precisa de pelo menos 1 item.");
          throw new Error("Cotação sem itens válidos");
        }
        const { error: insErr } = await supabase
          .from("cotacoes_compra_itens")
          .insert(itemsPayload);
        if (insErr) throw insErr;
      }
      toast.success("Cotação de compra salva!");
      setModalOpen(false);
      fetchData();
    });
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
    if (!proposalForm.fornecedor_id || !selected) {
      toast.error("Selecione um fornecedor.");
      return;
    }
    if (Number(proposalForm.preco_unitario) <= 0) {
      toast.error("Preço unitário deve ser maior que zero.");
      return;
    }
    // Block duplicate: same supplier + same item
    const duplicado = viewPropostas.some(
      (p) => p.item_id === itemId && p.fornecedor_id === proposalForm.fornecedor_id,
    );
    if (duplicado) {
      toast.error("Este fornecedor já tem uma proposta para este item. Edite a proposta existente.");
      return;
    }
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

  const handleSendForApproval = async () => {
    if (!selected) return;
    try {
      const { error } = await supabase.rpc("enviar_cotacao_aprovacao", { p_id: selected.id });
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
      const { error } = await supabase.rpc("aprovar_cotacao_compra", { p_id: selected.id });
      if (error) throw error;
      setSelected({ ...selected, status: "aprovada" });
      toast.success("Cotação aprovada!");
      fetchData();
    } catch (err: unknown) {
      toast.error(getUserFriendlyError(err));
    }
  };

  const handleReject = async (motivo?: string) => {
    if (!selected) return;
    const motivoTrim = (motivo ?? "").trim();
    if (!motivoTrim) {
      toast.error("Informe o motivo da rejeição.");
      return;
    }
    try {
      const { error } = await supabase.rpc("rejeitar_cotacao_compra", { p_id: selected.id, p_motivo: motivoTrim });
      if (error) throw error;
      setSelected({ ...selected, status: "rejeitada" });
      toast.error("Cotação rejeitada.");
      fetchData();
    } catch (err: unknown) {
      toast.error(getUserFriendlyError(err));
    }
  };

  const handleCancel = async (motivo: string) => {
    if (!selected) return;
    const motivoTrim = (motivo ?? "").trim();
    if (!motivoTrim) {
      toast.error("Informe o motivo do cancelamento.");
      return;
    }
    try {
      const { error } = await supabase.rpc("cancelar_cotacao_compra", { p_id: selected.id, p_motivo: motivoTrim });
      if (error) throw error;
      setSelected({ ...selected, status: "cancelada" });
      toast.success("Cotação cancelada.");
      setDrawerOpen(false);
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

    // Delega para a RPC transacional `gerar_pedido_compra` via mutation hook.
    // O hook já invalida `cotacoes_compra` + `pedidos_compra` cross-módulo.
    try {
      await gerarPedidoCompra.mutateAsync({
        id: selected.id,
        observacoes: `Gerado a partir da cotação ${selected.numero}`,
      });
      setDrawerOpen(false);
      fetchData();
      navigate("/pedidos-compra");
    } catch (err: unknown) {
      console.error("[gerarPedido]", err);
      // toast já emitido pelo hook
    }
  };

  const produtoOptions = (produtosCrud.data as Database["public"]["Tables"]["produtos"]["Row"][]).map((p) => ({
    id: p.id,
    label: p.nome,
    sublabel: p.codigo_interno || p.sku || "",
  }));

  const fornecedorOptions = (fornecedoresCrud.data as Database["public"]["Tables"]["fornecedores"]["Row"][]).map((f) => ({
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
    handleSendForApproval,
    handleApprove,
    handleReject,
    handleCancel,
    gerarPedido,
    produtoOptions,
    fornecedorOptions,
  };
}
