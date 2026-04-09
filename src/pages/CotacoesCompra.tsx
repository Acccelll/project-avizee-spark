import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { SummaryCard } from "@/components/SummaryCard";
import { FormModal } from "@/components/FormModal";
import { ViewDrawerV2, ViewField, ViewSection } from "@/components/ViewDrawerV2";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { RelationalLink } from "@/components/ui/RelationalLink";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AutocompleteSearch } from "@/components/ui/AutocompleteSearch";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency, formatNumber, formatDate } from "@/lib/format";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  ShoppingCart, Edit, Trash2, Plus, CheckCircle2, Clock,
  FileSearch, Trophy, X, PackageSearch, ClipboardList,
  Users2, TrendingDown, AlertCircle, Info,
  ThumbsUp, ThumbsDown, Send, BarChart3, Award, ChevronRight,
} from "lucide-react";

interface CotacaoCompra {
  id: string;
  numero: string;
  data_cotacao: string;
  data_validade: string | null;
  status: string;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
}

interface CotacaoItem {
  id: string;
  cotacao_compra_id: string;
  produto_id: string;
  quantidade: number;
  unidade: string;
  produtos?: { nome: string; codigo_interno: string; sku: string };
}

interface CotacaoSummary {
  itens_count: number;
  fornecedores_count: number;
  vencedor_nome: string | null;
  tem_vencedor: boolean;
}

interface Proposta {
  id?: string;
  cotacao_compra_id: string;
  item_id: string;
  fornecedor_id: string;
  preco_unitario: number;
  prazo_entrega_dias: number | null;
  observacoes: string | null;
  selecionado: boolean;
  fornecedores?: { nome_razao_social: string };
}

const statusLabels: Record<string, string> = {
  aberta: "Aberta",
  em_analise: "Em Análise",
  aguardando_aprovacao: "Aguardando Aprovação",
  aprovada: "Aprovada",
  finalizada: "Concluída",
  convertida: "Convertida em Pedido",
  rejeitada: "Rejeitada",
  cancelada: "Cancelada",
};

/** Maps legacy 'finalizada' status to 'aprovada' for flow/stepper logic */
function normalizeStatus(status: string): string {
  return status === "finalizada" ? "aprovada" : status;
}

const FLOW_STEPS = [
  { key: "aberta", label: "Em Cotação" },
  { key: "em_analise", label: "Em Análise" },
  { key: "aguardando_aprovacao", label: "Aprovação" },
  { key: "aprovada", label: "Aprovada" },
  { key: "convertida", label: "Convertida" },
];

const FLOW_STEP_ORDER = ["aberta", "em_analise", "aguardando_aprovacao", "aprovada", "convertida"];

function getFlowStepIndex(status: string): number {
  return FLOW_STEP_ORDER.indexOf(normalizeStatus(status));
}

const emptyForm = {
  numero: "",
  data_cotacao: new Date().toISOString().split("T")[0],
  data_validade: "",
  observacoes: "",
  status: "aberta",
};

interface LocalItem {
  _localId: string;
  id?: string;
  produto_id: string;
  quantidade: number;
  unidade: string;
}

export default function CotacoesCompra() {
  const navigate = useNavigate();
  const { data, loading, fetchData, remove } = useSupabaseCrud<CotacaoCompra>({
    table: "cotacoes_compra",
    orderBy: "created_at",
    ascending: false,
  });
  const fornecedoresCrud = useSupabaseCrud<any>({ table: "fornecedores" });
  const produtosCrud = useSupabaseCrud<any>({ table: "produtos" });

  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<CotacaoCompra | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState(emptyForm);
  const [localItems, setLocalItems] = useState<LocalItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // View drawer state
  const [viewItems, setViewItems] = useState<CotacaoItem[]>([]);
  const [viewPropostas, setViewPropostas] = useState<Proposta[]>([]);

  // Proposal add inline
  const [addingProposal, setAddingProposal] = useState<string | null>(null); // item_id
  const [proposalForm, setProposalForm] = useState({ fornecedor_id: "", preco_unitario: 0, prazo_entrega_dias: "", observacoes: "" });

  // KPIs
  const kpis = useMemo(() => {
    const emCotacao = data.filter((c) => c.status === "aberta" || c.status === "em_analise").length;
    const aguardandoAprovacao = data.filter((c) => c.status === "aguardando_aprovacao").length;
    const convertidas = data.filter((c) => c.status === "convertida").length;
    return { total: data.length, emCotacao, aguardandoAprovacao, convertidas };
  }, [data]);

  // Search & filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Per-row enrichment: items count, supplier count, winner
  const [summaries, setSummaries] = useState<Record<string, CotacaoSummary>>({});

  // Stable string key derived from the loaded IDs — avoids re-firing when the
  // array reference changes but the actual data hasn't (the `?? []` fallback in
  // useSupabaseCrud creates a new [] reference on every render while loading,
  // which would otherwise cause an infinite update loop via setSummaries).
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
        const cItens = (itens || []).filter((i: any) => i.cotacao_compra_id === id);
        const cPropostas = (propostas || []).filter((p: any) => p.cotacao_compra_id === id);
        const fornUniq = new Set(cPropostas.map((p: any) => p.fornecedor_id)).size;
        const selecionadas = cPropostas.filter((p: any) => p.selecionado);
        const vencIds = [...new Set(selecionadas.map((p: any) => p.fornecedor_id))];
        const vencNome =
          vencIds.length === 1
            ? ((cPropostas.find(
                (p: any) => p.fornecedor_id === vencIds[0] && p.selecionado
              ) as any)?.fornecedores?.nome_razao_social ?? null)
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

  // Filtered data (search + status)
  const filteredData = useMemo(() => {
    return data.filter((c) => {
      if (statusFilters.length > 0 && !statusFilters.includes(c.status)) return false;
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        if (
          !c.numero.toLowerCase().includes(q) &&
          !(c.observacoes || "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [data, statusFilters, debouncedSearch]);

  // Active filter chips
  const activeFilters = useMemo<FilterChip[]>(() => {
    return statusFilters.map((s) => ({
      key: "status",
      label: "Status",
      value: [s],
      displayValue: statusLabels[s] || s,
    }));
  }, [statusFilters]);

  const handleRemoveFilter = (key: string, value?: string) => {
    if (key === "status") setStatusFilters((prev) => prev.filter((v) => v !== value));
  };

  const statusOptions: MultiSelectOption[] = Object.entries(statusLabels).map(
    ([value, label]) => ({ value, label })
  );

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
      (itens || []).map((i: any) => ({
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
        cotacaoId = newC.id;
      } else if (selected) {
        const { error } = await supabase.from("cotacoes_compra").update(payload).eq("id", selected.id);
        if (error) throw error;
        // Delete old items (cascade deletes propostas too)
        await supabase.from("cotacoes_compra_itens").delete().eq("cotacao_compra_id", selected.id);
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
    } catch (err: any) {
      console.error("[cotacoes_compra]", err);
      toast.error("Erro ao salvar. Tente novamente.");
    }
    setSaving(false);
  };

  // Local items management
  const addLocalItem = () => {
    setLocalItems([...localItems, { _localId: crypto.randomUUID(), produto_id: "", quantidade: 1, unidade: "UN" }]);
  };
  const updateLocalItem = (localId: string, field: string, value: any) => {
    setLocalItems(localItems.map((i) => (i._localId === localId ? { ...i, [field]: value } : i)));
  };
  const removeLocalItem = (localId: string) => {
    setLocalItems(localItems.filter((i) => i._localId !== localId));
  };

  // Propostas management in drawer
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
      // Reload propostas
      const { data: propostas } = await supabase
        .from("cotacoes_compra_propostas")
        .select("*, fornecedores(nome_razao_social)")
        .eq("cotacao_compra_id", selected.id);
      setViewPropostas(propostas || []);
    } catch (err) {
      toast.error("Erro ao adicionar proposta");
    }
  };

  const handleSelectProposal = async (propostaId: string, itemId: string) => {
    if (!selected) return;
    try {
      // Deselect all proposals for this item first
      await supabase
        .from("cotacoes_compra_propostas")
        .update({ selecionado: false })
        .eq("cotacao_compra_id", selected.id)
        .eq("item_id", itemId);
      // Select the chosen one
      await supabase
        .from("cotacoes_compra_propostas")
        .update({ selecionado: true })
        .eq("id", propostaId);
      toast.success("Fornecedor selecionado!");
      const { data: propostas } = await supabase
        .from("cotacoes_compra_propostas")
        .select("*, fornecedores(nome_razao_social)")
        .eq("cotacao_compra_id", selected.id);
      setViewPropostas(propostas || []);
    } catch {
      toast.error("Erro ao selecionar proposta");
    }
  };

  const handleDeleteProposal = async (propostaId: string) => {
    if (!selected) return;
    await supabase.from("cotacoes_compra_propostas").delete().eq("id", propostaId);
    toast.success("Proposta removida");
    const { data: propostas } = await supabase
      .from("cotacoes_compra_propostas")
      .select("*, fornecedores(nome_razao_social)")
      .eq("cotacao_compra_id", selected.id);
    setViewPropostas(propostas || []);
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
    } catch {
      toast.error("Erro ao enviar para aprovação.");
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
    } catch {
      toast.error("Erro ao aprovar cotação.");
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
    } catch {
      toast.error("Erro ao rejeitar cotação.");
    }
  };

  const gerarPedido = async () => {
    if (!selected) return;

    // Gather selected proposals
    const propostasSelecionadas = viewPropostas.filter((p) => p.selecionado);
    if (propostasSelecionadas.length === 0) {
      toast.error("Selecione ao menos uma proposta antes de gerar o pedido.");
      return;
    }

    // Validate: all selected proposals must belong to the same supplier
    const fornecedoresDistintos = [...new Set(propostasSelecionadas.map((p) => p.fornecedor_id))];
    if (fornecedoresDistintos.length > 1) {
      toast.error(
        `As propostas selecionadas pertencem a fornecedores diferentes. Selecione propostas de apenas um fornecedor para gerar o pedido.`,
        { duration: 6000 }
      );
      return;
    }

    const fornecedorId = fornecedoresDistintos[0];

    // Build items strictly from the selected proposals of the single supplier
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

    // pedidoId is declared outside try so it is accessible in the rollback block
    // inside the catch, in case the item insert fails after the header is created.
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

      pedidoId = (novoPedido as any).id;

      const itemsPayload = itensParaPedido.map((i) => ({ pedido_compra_id: pedidoId, ...i }));
      const { error: erroItens } = await supabase
        .from("pedidos_compra_itens")
        .insert(itemsPayload);

      if (erroItens) {
        // Rollback: remove the orphan purchase order header
        const { error: erroRollback } = await supabase
          .from("pedidos_compra")
          .delete()
          .eq("id", pedidoId);
        if (erroRollback) {
          console.error("[gerarPedido] rollback failed:", erroRollback?.message);
        }
        throw erroItens;
      }

      // Mark quotation as converted
      await supabase.from("cotacoes_compra").update({ status: "convertida" }).eq("id", selected.id);

      toast.success(`Pedido ${numeroPedido} gerado com sucesso!`);
      setDrawerOpen(false);
      fetchData();
      navigate("/pedidos-compra");
    } catch (err: any) {
      console.error("[gerarPedido] message:", err?.message);
      console.error("[gerarPedido] details:", err?.details);
      console.error("[gerarPedido] hint:", err?.hint);
      console.error("[gerarPedido] code:", err?.code);
      const detalhe = err?.message ? ` (${err.message})` : "";
      toast.error(`Erro ao gerar pedido de compra.${detalhe}`, { duration: 8000 });
    }
  };

  const produtoOptions = produtosCrud.data.map((p: any) => ({
    id: p.id,
    label: p.nome,
    sublabel: p.codigo_interno || p.sku || "",
  }));
  const fornecedorOptions = fornecedoresCrud.data.map((f: any) => ({
    id: f.id,
    label: f.nome_razao_social,
    sublabel: f.cpf_cnpj || "",
  }));

  const columns = [
    {
      key: "numero",
      label: "Cotação",
      render: (c: CotacaoCompra) => (
        <div>
          <span className="font-mono text-xs font-semibold text-primary">{c.numero}</span>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {new Date(c.data_cotacao).toLocaleDateString("pt-BR")}
          </p>
        </div>
      ),
    },
    {
      key: "itens",
      label: "Itens",
      render: (c: CotacaoCompra) => {
        const s = summaries[c.id];
        if (!s) return <span className="text-muted-foreground/40 text-xs font-mono">—</span>;
        return (
          <span className="font-mono text-sm font-semibold">
            {s.itens_count}
          </span>
        );
      },
    },
    {
      key: "fornecedores",
      label: "Fornecedores",
      render: (c: CotacaoCompra) => {
        const s = summaries[c.id];
        if (!s) return <span className="text-muted-foreground/40 text-xs">—</span>;
        if (s.fornecedores_count === 0) {
          return <span className="text-xs text-muted-foreground italic">Sem propostas</span>;
        }
        return (
          <div>
            <span className="text-sm font-mono font-semibold">{s.fornecedores_count}</span>
            {s.vencedor_nome ? (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 mt-0.5">
                <Trophy className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate max-w-[110px]">{s.vencedor_nome}</span>
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground mt-0.5">Sem vencedor</p>
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (c: CotacaoCompra) => (
        <StatusBadge status={c.status} label={statusLabels[c.status] || c.status} />
      ),
    },
    {
      key: "data_validade",
      label: "Validade",
      render: (c: CotacaoCompra) =>
        c.data_validade
          ? new Date(c.data_validade).toLocaleDateString("pt-BR")
          : "—",
    },
  ];

  return (
    <AppLayout>
      <ModulePage
        title="Cotações de Compra"
        subtitle="Central de consulta e negociação de compra — propostas, comparação e aprovação."
        addLabel="Nova Cotação de Compra"
        onAdd={openCreate}
        count={data.length}
      >
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SummaryCard title="Total" value={formatNumber(kpis.total)} icon={ShoppingCart} variationType="neutral" variation="cotações" />
          <SummaryCard title="Em Cotação" value={formatNumber(kpis.emCotacao)} icon={Clock} variationType={kpis.emCotacao > 0 ? "negative" : "positive"} variation="abertas ou em análise" />
          <SummaryCard title="Aguardando Aprovação" value={formatNumber(kpis.aguardandoAprovacao)} icon={FileSearch} variationType={kpis.aguardandoAprovacao > 0 ? "negative" : "positive"} variation="pendentes de decisão" />
          <SummaryCard title="Convertidas" value={formatNumber(kpis.convertidas)} icon={CheckCircle2} variationType="positive" variation="viraram pedidos" />
        </div>

        {/* Search + Filters */}
        <AdvancedFilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar por número ou observações..."
          activeFilters={activeFilters}
          onRemoveFilter={handleRemoveFilter}
          onClearAll={() => setStatusFilters([])}
          count={filteredData.length}
        >
          <MultiSelect
            options={statusOptions}
            selected={statusFilters}
            onChange={setStatusFilters}
            placeholder="Status"
            className="w-[180px]"
          />
        </AdvancedFilterBar>

        <DataTable
          columns={columns}
          data={filteredData}
          loading={loading}
          moduleKey="cotacoes_compra"
          showColumnToggle={true}
          onView={openView}
          onEdit={openEdit}
        />
      </ModulePage>

      {/* Create/Edit Modal */}
      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={mode === "create" ? "Nova Cotação de Compra" : "Editar Cotação de Compra"} size="xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Edit context banner */}
          {mode === "edit" && selected && (
            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 px-4 py-3">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  Editando <span className="font-mono text-primary">{selected.numero}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {localItems.length} {localItems.length === 1 ? "item" : "itens"} •{" "}
                  Criada em {formatDate(selected.data_cotacao)}
                </p>
              </div>
              <StatusBadge status={selected.status} label={statusLabels[selected.status] || selected.status} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Número *</Label>
              <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} required className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label>Data Cotação</Label>
              <Input type="date" value={form.data_cotacao} onChange={(e) => setForm({ ...form, data_cotacao: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Validade</Label>
              <Input type="date" value={form.data_validade} onChange={(e) => setForm({ ...form, data_validade: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aberta">Aberta</SelectItem>
                  <SelectItem value="em_analise">Em Análise</SelectItem>
                  <SelectItem value="aguardando_aprovacao">Aguardando Aprovação</SelectItem>
                  <SelectItem value="aprovada">Aprovada</SelectItem>
                  <SelectItem value="rejeitada">Rejeitada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Itens Solicitados</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLocalItem} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Adicionar Item
              </Button>
            </div>
            {localItems.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhum item adicionado. Clique em "Adicionar Item" para começar.
              </div>
            ) : (
              <div className="space-y-2">
                {localItems.map((item, idx) => (
                  <div key={item._localId} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                    <span className="text-xs text-muted-foreground font-mono w-6">{idx + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <AutocompleteSearch
                        options={produtoOptions}
                        value={item.produto_id}
                        onChange={(id) => updateLocalItem(item._localId, "produto_id", id)}
                        placeholder="Buscar produto..."
                      />
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={item.quantidade}
                      onChange={(e) => updateLocalItem(item._localId, "quantidade", Number(e.target.value))}
                      className="w-24 font-mono"
                      placeholder="Qtd"
                    />
                    <Input
                      value={item.unidade}
                      onChange={(e) => updateLocalItem(item._localId, "unidade", e.target.value)}
                      className="w-16 text-center"
                      placeholder="UN"
                    />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeLocalItem(item._localId)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </FormModal>

      {/* View Drawer — Decision Panel */}
      <ViewDrawerV2
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setAddingProposal(null); }}
        title={selected?.numero ?? "Cotação de Compra"}
        badge={
          selected ? (
            <StatusBadge status={selected.status} label={statusLabels[selected.status] || selected.status} />
          ) : undefined
        }
        actions={
          selected ? (
            <>
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setDrawerOpen(false); openEdit(selected); }}><Edit className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Editar</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirmOpen(true)}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Excluir</TooltipContent></Tooltip>
            </>
          ) : undefined
        }
        summary={
          selected ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center justify-center gap-1">
                    <PackageSearch className="h-3 w-3" /> Itens
                  </p>
                  <p className="text-xl font-bold font-mono mt-0.5">{viewItems.length}</p>
                </div>
                <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center justify-center gap-1">
                    <Users2 className="h-3 w-3" /> Fornecedores
                  </p>
                  <p className="text-xl font-bold font-mono mt-0.5">{drawerStats.uniqueSuppliers}</p>
                </div>
                <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center justify-center gap-1">
                    <TrendingDown className="h-3 w-3" /> Melhor Total
                  </p>
                  <p className="text-sm font-bold font-mono mt-0.5 text-emerald-600 dark:text-emerald-400 leading-tight">
                    {drawerStats.bestTotal > 0 ? formatCurrency(drawerStats.bestTotal) : "—"}
                  </p>
                </div>
              </div>
              {/* Flow stepper */}
              {selected.status !== "rejeitada" && selected.status !== "cancelada" ? (
                <div className="rounded-lg bg-muted/30 border px-3 py-2">
                  <div className="flex items-center">
                    {FLOW_STEPS.map((step, i) => {
                      const currentIdx = getFlowStepIndex(selected.status);
                      const stepIdx = getFlowStepIndex(step.key);
                      const isActive = normalizeStatus(selected.status) === step.key;
                      const isPast = currentIdx > stepIdx;
                      return (
                        <div key={step.key} className="flex items-center flex-1 min-w-0">
                          <div className="flex flex-col items-center gap-0.5 min-w-0">
                            <div className={`h-2 w-2 rounded-full shrink-0 ${isActive ? "bg-primary" : isPast ? "bg-emerald-500" : "bg-muted-foreground/25"}`} />
                            <span className={`text-[9px] font-medium truncate max-w-[48px] ${isActive ? "text-primary" : isPast ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/50"}`}>
                              {step.label}
                            </span>
                          </div>
                          {i < FLOW_STEPS.length - 1 && (
                            <div className={`flex-1 h-px mx-1 ${isPast || isActive ? "bg-emerald-500/40" : "bg-muted-foreground/15"}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className={`rounded-lg border px-3 py-2 text-xs font-medium flex items-center gap-2 ${selected.status === "rejeitada" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-muted text-muted-foreground"}`}>
                  <X className="h-3.5 w-3.5" />
                  {selected.status === "rejeitada" ? "Cotação rejeitada — processo encerrado" : "Cotação cancelada"}
                </div>
              )}
            </div>
          ) : undefined
        }
        defaultTab={viewPropostas.length > 0 ? "propostas" : "resumo"}
        tabs={
          selected
            ? [
                /* ── TAB RESUMO ──────────────────────────── */
                {
                  value: "resumo",
                  label: "Resumo",
                  content: (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Data da Cotação</p>
                          <p className="text-sm mt-0.5">{formatDate(selected.data_cotacao)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Validade</p>
                          <p className="text-sm mt-0.5">
                            {selected.data_validade ? formatDate(selected.data_validade) : "—"}
                          </p>
                        </div>
                      </div>

                      {selected.observacoes && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Observações</p>
                          <p className="text-sm text-muted-foreground mt-1 italic">{selected.observacoes}</p>
                        </div>
                      )}

                      {/* Contextual alerts */}
                      <div className="space-y-2">
                        {viewItems.length === 0 && (
                          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                            <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                            Nenhum item cadastrado nesta cotação.
                          </div>
                        )}
                        {viewItems.length > 0 && viewPropostas.length === 0 && (
                          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                            <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                            Nenhuma proposta recebida. Acesse a aba Propostas para adicionar.
                          </div>
                        )}
                        {viewItems.length > 0 &&
                          viewPropostas.length > 0 &&
                          !drawerStats.allItemsHaveSelected &&
                          selected.status !== "finalizada" &&
                          selected.status !== "convertida" &&
                          selected.status !== "cancelada" && (
                            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                              <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                              Aguardando seleção de fornecedor para todos os itens.
                            </div>
                          )}
                        {drawerStats.selectedSupplierName && (
                          <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
                            <Trophy className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                            Fornecedor selecionado: <strong className="ml-1">{drawerStats.selectedSupplierName}</strong>
                          </div>
                        )}
                        {selected.status === "convertida" && (
                          <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
                            <ClipboardList className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                            Esta cotação foi convertida em Pedido de Compra.
                          </div>
                        )}
                      </div>
                    </div>
                  ),
                },

                /* ── TAB ITENS ───────────────────────────── */
                {
                  value: "itens",
                  label: `Itens (${viewItems.length})`,
                  content: (
                    <div>
                      {viewItems.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                          Nenhum item cadastrado nesta cotação.
                        </div>
                      ) : (
                        <div className="rounded-lg border overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-muted/50 border-b">
                                <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">#</th>
                                <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">Produto</th>
                                <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">Cód.</th>
                                <th className="px-3 py-2 text-right text-[10px] font-semibold text-muted-foreground uppercase">Qtd</th>
                                <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase">Un</th>
                              </tr>
                            </thead>
                            <tbody>
                              {viewItems.map((item, idx) => (
                                <tr key={item.id} className="border-b last:border-b-0 hover:bg-muted/20">
                                  <td className="px-3 py-2 text-xs text-muted-foreground font-mono">{idx + 1}</td>
                                  <td className="px-3 py-2 font-medium max-w-[180px]">
                                    <span className="truncate block">{item.produtos?.nome || "—"}</span>
                                  </td>
                                  <td className="px-3 py-2 text-xs font-mono text-muted-foreground">
                                    {item.produtos?.codigo_interno || item.produtos?.sku || "—"}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-xs font-semibold">{item.quantidade}</td>
                                  <td className="px-3 py-2 text-center text-xs text-muted-foreground">{item.unidade || "UN"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ),
                },

                /* ── TAB PROPOSTAS ───────────────────────── */
                {
                  value: "propostas",
                  label: `Propostas (${drawerStats.uniqueSuppliers} forn.)`,
                  content: (
                    <div className="space-y-4">
                      {viewItems.length === 0 && (
                        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                          Adicione itens à cotação antes de registrar propostas.
                        </div>
                      )}

                      {/* Comparative table: items × suppliers */}
                      {viewItems.length > 0 && drawerStats.uniqueSuppliers > 1 && (() => {
                        const supplierIds = [...new Set(viewPropostas.map((p) => p.fornecedor_id))];
                        const supplierNames = supplierIds.map(
                          (id) => viewPropostas.find((p) => p.fornecedor_id === id)?.fornecedores?.nome_razao_social || id
                        );
                        const colTotals = supplierIds.map((sid) =>
                          viewItems.reduce((sum, item) => {
                            const p = viewPropostas.find((pp) => pp.item_id === item.id && pp.fornecedor_id === sid);
                            return sum + (p ? Number(p.preco_unitario) * item.quantidade : 0);
                          }, 0)
                        );
                        const bestColTotal = Math.min(...colTotals.filter((t) => t > 0));
                        return (
                          <div className="rounded-lg border overflow-hidden">
                            <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
                              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                                Comparativo de Fornecedores
                              </span>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b bg-muted/20">
                                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Produto</th>
                                    {supplierNames.map((name, si) => (
                                      <th key={supplierIds[si]} className="px-3 py-2 text-right font-semibold text-muted-foreground min-w-[100px]">
                                        <span className="truncate block max-w-[90px] ml-auto">{name}</span>
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {viewItems.map((item) => {
                                    const rowPrices = supplierIds.map((sid) => {
                                      const p = viewPropostas.find((pp) => pp.item_id === item.id && pp.fornecedor_id === sid);
                                      return p ? Number(p.preco_unitario) : null;
                                    });
                                    const validPrices = rowPrices.filter((v): v is number => v !== null);
                                    const bestRow = validPrices.length > 0 ? Math.min(...validPrices) : null;
                                    return (
                                      <tr key={item.id} className="border-b last:border-b-0 hover:bg-muted/10">
                                        <td className="px-3 py-2 font-medium max-w-[110px]">
                                          <span className="truncate block">{item.produtos?.nome || "—"}</span>
                                          <span className="text-muted-foreground font-normal">
                                            {item.quantidade} {item.unidade || "UN"}
                                          </span>
                                        </td>
                                        {supplierIds.map((sid, si) => {
                                          const p = viewPropostas.find((pp) => pp.item_id === item.id && pp.fornecedor_id === sid);
                                          const isBestRow = p && Number(p.preco_unitario) === bestRow;
                                          return (
                                            <td key={sid} className={`px-3 py-2 text-right ${p?.selecionado ? "bg-primary/5 font-semibold" : isBestRow ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                                              {p ? (
                                                <div>
                                                  <div className="flex items-center justify-end gap-1">
                                                    {p.selecionado && <Trophy className="h-3 w-3 text-primary" />}
                                                    {isBestRow && !p.selecionado && <Award className="h-3 w-3 text-emerald-500" />}
                                                    <span className="font-mono">{formatCurrency(Number(p.preco_unitario))}</span>
                                                  </div>
                                                  {p.prazo_entrega_dias && (
                                                    <span className="text-muted-foreground text-[10px]">{p.prazo_entrega_dias}d</span>
                                                  )}
                                                </div>
                                              ) : (
                                                <span className="text-muted-foreground/40">—</span>
                                              )}
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    );
                                  })}
                                  <tr className="border-t bg-muted/30 font-semibold">
                                    <td className="px-3 py-2 text-muted-foreground text-[10px] uppercase">Total</td>
                                    {colTotals.map((total, si) => (
                                      <td key={supplierIds[si]} className={`px-3 py-2 text-right font-mono ${total > 0 && total === bestColTotal ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                                        {total > 0 ? formatCurrency(total) : "—"}
                                        {total > 0 && total === bestColTotal && (
                                          <div className="text-[9px] font-normal text-emerald-500 uppercase">menor</div>
                                        )}
                                      </td>
                                    ))}
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })()}
                      {viewItems.map((item) => {
                        const itemPropostas = viewPropostas.filter((p) => p.item_id === item.id);
                        const bestPrice =
                          itemPropostas.length > 0
                            ? Math.min(...itemPropostas.map((p) => Number(p.preco_unitario)))
                            : null;

                        return (
                          <Card key={item.id} className="border">
                            <CardHeader className="py-3 px-4">
                              <CardTitle className="text-sm flex items-center justify-between">
                                <span>
                                  {item.produtos?.nome || "—"}
                                  <span className="ml-2 text-xs text-muted-foreground font-mono">
                                    {item.produtos?.codigo_interno || item.produtos?.sku || ""}
                                  </span>
                                </span>
                                <Badge variant="outline" className="font-mono shrink-0">
                                  {item.quantidade} {item.unidade || "UN"}
                                </Badge>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 pb-3 space-y-2">
                              {itemPropostas.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">Nenhuma proposta cadastrada.</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {itemPropostas.map((p) => {
                                    const isBest = Number(p.preco_unitario) === bestPrice;
                                    const totalProposta = Number(p.preco_unitario) * item.quantidade;
                                    return (
                                      <div
                                        key={p.id}
                                        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                                          p.selecionado
                                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                            : isBest
                                            ? "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20"
                                            : ""
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          {p.selecionado && <Trophy className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                                          {isBest && !p.selecionado && (
                                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">MENOR</span>
                                          )}
                                          <span className="truncate font-medium">{p.fornecedores?.nome_razao_social || "—"}</span>
                                        </div>
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                          <div className="text-right">
                                            <p className="font-mono font-semibold">
                                              {formatCurrency(Number(p.preco_unitario))}
                                              <span className="text-muted-foreground">/un</span>
                                            </p>
                                            <p className="text-[10px] text-muted-foreground font-mono">
                                              Total: {formatCurrency(totalProposta)}
                                            </p>
                                          </div>
                                          {p.prazo_entrega_dias && (
                                            <Badge variant="secondary" className="text-[10px]">
                                              {p.prazo_entrega_dias}d
                                            </Badge>
                                          )}
                                          <div className="flex gap-1">
                                            {!p.selecionado &&
                                              selected.status !== "finalizada" &&
                                              selected.status !== "convertida" && (
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <Button
                                                      variant="ghost"
                                                      size="icon"
                                                      className="h-7 w-7"
                                                      onClick={() => handleSelectProposal(p.id!, item.id)}
                                                    >
                                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                                    </Button>
                                                  </TooltipTrigger>
                                                  <TooltipContent>Selecionar</TooltipContent>
                                                </Tooltip>
                                              )}
                                            {selected.status !== "finalizada" &&
                                              selected.status !== "convertida" && (
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <Button
                                                      variant="ghost"
                                                      size="icon"
                                                      className="h-7 w-7 text-destructive"
                                                      onClick={() => handleDeleteProposal(p.id!)}
                                                    >
                                                      <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                  </TooltipTrigger>
                                                  <TooltipContent>Remover</TooltipContent>
                                                </Tooltip>
                                              )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Inline add proposal form */}
                              {selected.status !== "finalizada" &&
                                selected.status !== "convertida" &&
                                selected.status !== "cancelada" && (
                                  <>
                                    {addingProposal === item.id ? (
                                      <div className="rounded-lg border border-dashed p-3 space-y-3 bg-muted/30">
                                        <div className="space-y-2">
                                          <Label className="text-xs">Fornecedor</Label>
                                          <AutocompleteSearch
                                            options={fornecedorOptions}
                                            value={proposalForm.fornecedor_id}
                                            onChange={(id) =>
                                              setProposalForm({ ...proposalForm, fornecedor_id: id })
                                            }
                                            placeholder="Selecionar fornecedor..."
                                          />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                          <div className="space-y-1">
                                            <Label className="text-xs">Preço Unitário</Label>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              value={proposalForm.preco_unitario}
                                              onChange={(e) =>
                                                setProposalForm({
                                                  ...proposalForm,
                                                  preco_unitario: Number(e.target.value),
                                                })
                                              }
                                              className="h-8 font-mono"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">Prazo (dias)</Label>
                                            <Input
                                              type="number"
                                              value={proposalForm.prazo_entrega_dias}
                                              onChange={(e) =>
                                                setProposalForm({
                                                  ...proposalForm,
                                                  prazo_entrega_dias: e.target.value,
                                                })
                                              }
                                              className="h-8 font-mono"
                                            />
                                          </div>
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-xs">Observações</Label>
                                          <Input
                                            value={proposalForm.observacoes}
                                            onChange={(e) =>
                                              setProposalForm({
                                                ...proposalForm,
                                                observacoes: e.target.value,
                                              })
                                            }
                                            className="h-8 text-xs"
                                            placeholder="Condições, validade da proposta..."
                                          />
                                        </div>
                                        <div className="flex gap-2">
                                          <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => handleAddProposal(item.id)}
                                            disabled={!proposalForm.fornecedor_id}
                                          >
                                            Salvar
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setAddingProposal(null)}
                                          >
                                            Cancelar
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="w-full gap-1.5 text-xs"
                                        onClick={() => {
                                          setAddingProposal(item.id);
                                          setProposalForm({
                                            fornecedor_id: "",
                                            preco_unitario: 0,
                                            prazo_entrega_dias: "",
                                            observacoes: "",
                                          });
                                        }}
                                      >
                                        <Plus className="h-3 w-3" /> Adicionar Proposta
                                      </Button>
                                    )}
                                  </>
                                )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  ),
                },

                /* ── TAB DECISÃO ─────────────────────────── */
                {
                  value: "decisao",
                  label: "Decisão",
                  content: (
                    <div className="space-y-4">
                      {/* Approval state banner */}
                      {selected.status === "rejeitada" && (
                        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                          <ThumbsDown className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold">Cotação rejeitada</p>
                            <p className="text-xs mt-0.5 opacity-80">Esta cotação foi reprovada e não pode ser convertida em pedido.</p>
                          </div>
                        </div>
                      )}
                      {selected.status === "aguardando_aprovacao" && (
                        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
                          <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold">Aguardando aprovação</p>
                            <p className="text-xs mt-0.5 opacity-80">A cotação está em análise. Use os botões abaixo para aprovar ou reprovar.</p>
                          </div>
                        </div>
                      )}
                      {(selected.status === "aprovada" || selected.status === "finalizada") && (
                        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
                          <ThumbsUp className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold">Cotação aprovada</p>
                            <p className="text-xs mt-0.5 opacity-80">Pronta para conversão em Pedido de Compra.</p>
                          </div>
                        </div>
                      )}
                      {selected.status === "convertida" && (
                        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
                          <ClipboardList className="h-4 w-4 flex-shrink-0" />
                          <div>
                            <p className="font-semibold">Convertida em Pedido de Compra</p>
                            <button className="text-xs underline font-semibold hover:opacity-70 mt-0.5" onClick={() => navigate("/pedidos-compra")}>
                              Ver pedidos de compra →
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Selected proposals summary */}
                      {drawerStats.selectedPropostas.length > 0 ? (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-2 flex items-center gap-1">
                            <Trophy className="h-3 w-3" />{" "}
                            {drawerStats.selectedPropostas.length === 1 ? "Fornecedor Selecionado" : "Fornecedores Selecionados"}
                          </p>
                          <div className="rounded-lg border overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-muted/50 border-b">
                                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">Produto</th>
                                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">Fornecedor</th>
                                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-muted-foreground uppercase">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {drawerStats.selectedPropostas.map((p) => {
                                  const item = viewItems.find((i) => i.id === p.item_id);
                                  return (
                                    <tr key={p.id} className="border-b last:border-b-0 hover:bg-muted/20">
                                      <td className="px-3 py-2 text-xs max-w-[120px]">
                                        <span className="truncate block">{item?.produtos?.nome || "—"}</span>
                                      </td>
                                      <td className="px-3 py-2 text-xs font-medium max-w-[130px]">
                                        <span className="truncate block">{p.fornecedores?.nome_razao_social || "—"}</span>
                                      </td>
                                      <td className="px-3 py-2 text-right font-mono text-xs font-semibold">
                                        {item ? formatCurrency(Number(p.preco_unitario) * item.quantidade) : "—"}
                                      </td>
                                    </tr>
                                  );
                                })}
                                {/* Grand total row */}
                                <tr className="bg-muted/30 border-t">
                                  <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Total aprovado</td>
                                  <td className="px-3 py-2 text-right font-mono text-sm font-bold text-primary">
                                    {formatCurrency(drawerStats.selectedPropostas.reduce((sum, p) => {
                                      const item = viewItems.find((i) => i.id === p.item_id);
                                      return sum + (item ? Number(p.preco_unitario) * item.quantidade : 0);
                                    }, 0))}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-3 text-xs text-warning">
                          <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                          Nenhum fornecedor selecionado. Acesse a aba Propostas para selecionar as melhores condições.
                        </div>
                      )}

                      {/* Process status */}
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-2">
                          Situação do Processo
                        </p>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Itens com proposta selecionada</span>
                            <span className={`font-mono font-semibold ${drawerStats.allItemsHaveSelected ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                              {drawerStats.selectedPropostas.length} / {viewItems.length}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Status atual</span>
                            <StatusBadge status={selected.status} label={statusLabels[selected.status] || selected.status} />
                          </div>
                          {drawerStats.selectedSupplierName && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Fornecedor vencedor</span>
                              <span className="font-medium text-xs text-right max-w-[160px] truncate">{drawerStats.selectedSupplierName}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Readiness guidance */}
                      {selected.status !== "finalizada" &&
                        selected.status !== "aprovada" &&
                        selected.status !== "convertida" &&
                        selected.status !== "rejeitada" &&
                        selected.status !== "cancelada" &&
                        drawerStats.allItemsHaveSelected && (
                          <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
                            <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                            Todos os itens têm fornecedor selecionado. Envie para aprovação ou aprove diretamente.
                          </div>
                        )}
                    </div>
                  ),
                },
              ]
            : undefined
        }
        footer={
          selected ? (
            <div className="flex gap-2 flex-wrap">
              {/* Active: send for approval when all items selected */}
              {(selected.status === "aberta" || selected.status === "em_analise") &&
                drawerStats.allItemsHaveSelected && (
                  <Button className="flex-1 gap-2" variant="outline" onClick={handleSendForApproval}>
                    <Send className="h-4 w-4" /> Enviar para Aprovação
                  </Button>
                )}
              {/* Active: direct approve (shortcut) */}
              {(selected.status === "aberta" || selected.status === "em_analise") &&
                drawerStats.allItemsHaveSelected && (
                  <Button className="flex-1 gap-2" onClick={handleApprove}>
                    <ThumbsUp className="h-4 w-4" /> Aprovar
                  </Button>
                )}
              {/* Waiting approval: approve or reject */}
              {selected.status === "aguardando_aprovacao" && (
                <>
                  <Button className="flex-1 gap-2" variant="destructive" onClick={handleReject}>
                    <ThumbsDown className="h-4 w-4" /> Reprovar
                  </Button>
                  <Button className="flex-1 gap-2" onClick={handleApprove}>
                    <ThumbsUp className="h-4 w-4" /> Aprovar
                  </Button>
                </>
              )}
              {/* Approved or legacy finalizada: generate order */}
              {(selected.status === "aprovada" || selected.status === "finalizada") && (
                <Button className="flex-1 gap-2" onClick={gerarPedido}>
                  <ClipboardList className="h-4 w-4" /> Gerar Pedido de Compra
                </Button>
              )}
              {/* Already converted */}
              {selected.status === "convertida" && (
                <Button className="flex-1 gap-2" variant="outline" onClick={() => navigate("/pedidos-compra")}>
                  <ChevronRight className="h-4 w-4" /> Ver Pedidos de Compra
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => { if (selected) { setDrawerOpen(false); remove(selected.id); } setDeleteConfirmOpen(false); }}
        title="Excluir cotação"
        description={`Tem certeza que deseja excluir a cotação ${selected?.numero || ""}? Esta ação não pode ser desfeita.`}
      />
    </AppLayout>
  );
}
