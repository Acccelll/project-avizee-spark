import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { SummaryCard } from "@/components/SummaryCard";
import { FormModal } from "@/components/FormModal";
import { ViewDrawerV2 } from "@/components/ViewDrawerV2";
import { ViewField, ViewSection } from "@/components/ViewDrawer";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { RelationalLink } from "@/components/ui/RelationalLink";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import {
  Edit,
  Trash2,
  PackageCheck,
  SendHorizontal,
  AlertCircle,
  Calendar,
  Building2,
  FileText,
  Boxes,
  ArrowDownToLine,
  Receipt,
  ShoppingCart,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { AutocompleteSearch } from "@/components/ui/AutocompleteSearch";
import { ItemsGrid, type GridItem } from "@/components/ui/ItemsGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency, formatNumber, formatDate, calculateDaysBetween } from "@/lib/format";
import { useNavigate } from "react-router-dom";
import { LogisticaRastreioSection } from "@/components/logistica/LogisticaRastreioSection";
import { statusPedidoCompra } from "@/lib/statusSchema";

interface PedidoCompra {
  id: string | number;
  numero?: string | null;
  fornecedor_id: string | number | null;
  data_pedido: string;
  data_entrega_prevista: string | null;
  data_entrega_real: string | null;
  valor_total: number | null;
  frete_valor: number | null;
  condicao_pagamento: string | null;
  condicoes_pagamento?: string | null;
  status: string;
  observacoes: string | null;
  cotacao_compra_id: string | number | null;
  ativo?: boolean | null;
  created_at?: string | null;
  fornecedores?: {
    nome_razao_social: string | null;
    cpf_cnpj?: string | null;
  } | null;
}

interface FornecedorOptionRow {
  id: string | number;
  nome_razao_social: string | null;
  cpf_cnpj?: string | null;
  ativo?: boolean | null;
}

interface ProdutoOptionRow {
  id: string | number;
  nome: string | null;
  codigo_interno?: string | null;
  preco_venda?: number | null;
  unidade_medida?: string | null;
  ativo?: boolean | null;
}

const statusLabels: Record<string, string> = Object.fromEntries(
  Object.entries(statusPedidoCompra).map(([k, v]) => [k, v.label]),
);

const ENTREGA_ALERTA_DIAS = 3;
const TERMINAL_STATUS_PC = ["recebido", "cancelado"];

function getEntregaStatus(
  dataEntrega: string | null,
  status: string,
): "atrasado" | "proximo" | "ok" | "sem_prazo" {
  if (!dataEntrega) return "sem_prazo";
  if (TERMINAL_STATUS_PC.includes(status)) return "ok";
  const daysLeft = calculateDaysBetween(new Date(), dataEntrega);
  if (daysLeft < 0) return "atrasado";
  if (daysLeft <= ENTREGA_ALERTA_DIAS) return "proximo";
  return "ok";
}

function EntregaBadge({ dataEntrega, status }: { dataEntrega: string | null; status: string }) {
  if (!dataEntrega) return <span className="text-muted-foreground text-xs">—</span>;
  const es = getEntregaStatus(dataEntrega, status);
  const daysLeft = calculateDaysBetween(new Date(), dataEntrega);

  if (es === "atrasado") {
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
        <span className="text-xs text-destructive font-medium">{formatDate(dataEntrega)}</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-destructive/10 text-destructive border-destructive/20 gap-1">
          <AlertCircle className="h-2.5 w-2.5" />Atrasado
        </Badge>
      </span>
    );
  }
  if (es === "proximo") {
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
        <span className="text-xs text-amber-600 font-medium">{formatDate(dataEntrega)}</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-50 text-amber-600 border-amber-200 gap-1">
          <Clock className="h-2.5 w-2.5" />{daysLeft}d restantes
        </Badge>
      </span>
    );
  }
  return <span className="text-xs">{formatDate(dataEntrega)}</span>;
}

const recebimentoFilterOptions: MultiSelectOption[] = [
  { label: "Aguardando Recebimento", value: "aguardando" },
  { label: "Parcialmente Recebido", value: "parcial" },
  { label: "Recebido", value: "recebido" },
];

function getRecebimentoFilter(status: string): string {
  if (status === "recebido") return "recebido";
  if (status === "parcialmente_recebido") return "parcial";
  if (["aguardando_recebimento", "enviado_ao_fornecedor", "aprovado"].includes(status)) return "aguardando";
  return "";
}

const emptyForm = {
  fornecedor_id: "",
  data_pedido: new Date().toISOString().split("T")[0],
  data_entrega_prevista: "",
  data_entrega_real: "",
  frete_valor: "",
  condicao_pagamento: "",
  status: "rascunho",
  observacoes: "",
};

const pedidoNumero = (p: Pick<PedidoCompra, "id" | "numero">) => p.numero || `PC-${p.id}`;

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

const PedidosCompra = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<PedidoCompra | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<Record<string, any>>(emptyForm);
  const [items, setItems] = useState<GridItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewItems, setViewItems] = useState<any[]>([]);
  const [viewEstoque, setViewEstoque] = useState<any[]>([]);
  const [viewFinanceiro, setViewFinanceiro] = useState<any[]>([]);
  const [viewCotacao, setViewCotacao] = useState<any | null>(null);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [fornecedorFilters, setFornecedorFilters] = useState<string[]>([]);
  const [recebimentoFilters, setRecebimentoFilters] = useState<string[]>([]);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

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

      if (error) {
        console.error("[pedidos_compra] fetch error", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }

      return (data || []) as PedidoCompra[];
    },
  });

  const {
    data: fornecedoresRaw = [],
    isLoading: fornecedoresLoading,
  } = useQuery({
    queryKey: ["pedidos_compra_fornecedores"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("fornecedores")
        .select("id, nome_razao_social, cpf_cnpj, ativo")
        .order("id", { ascending: false });

      if (error) {
        console.error("[pedidos_compra] fornecedores fetch error", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }

      return (data || []) as FornecedorOptionRow[];
    },
  });

  const {
    data: produtosRaw = [],
    isLoading: produtosLoading,
  } = useQuery({
    queryKey: ["pedidos_compra_produtos"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("produtos")
        .select("id, nome, codigo_interno, preco_venda, unidade_medida, ativo")
        .eq("ativo", true)
        .order("id", { ascending: false });

      if (error) {
        console.error("[pedidos_compra] produtos fetch error", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }

      return (data || []) as ProdutoOptionRow[];
    },
  });

  const { data: formasPagamentoRaw = [] } = useQuery({
    queryKey: ["pedidos_compra_formas_pagamento"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("formas_pagamento")
        .select("id, descricao")
        .eq("ativo", true)
        .order("descricao", { ascending: true });
      if (error) throw error;
      return (data || []) as { id: string; descricao: string }[];
    },
  });

  const data = pedidosRaw.length > 0 ? pedidosRaw : MOCK_PEDIDOS;

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

  const valorProdutos = items.reduce((s, i) => s + Number(i.valor_total || 0), 0);
  const valorTotal = valorProdutos + Number(form.frete_valor || 0);

  const kpis = useMemo(() => {
    const aguardando = data.filter((p) =>
      ["rascunho", "aprovado", "enviado_ao_fornecedor", "aguardando_recebimento"].includes(p.status),
    );
    const recebidos = data.filter((p) => p.status === "recebido");
    const totalValue = data.reduce((s, p) => s + Number(p.valor_total || 0), 0);

    return {
      total: data.length,
      totalValue,
      aguardando: aguardando.length,
      recebidos: recebidos.length,
    };
  }, [data]);

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ["pedidos_compra"] });
    await queryClient.invalidateQueries({ queryKey: ["pedidos_compra_fornecedores"] });
    await queryClient.invalidateQueries({ queryKey: ["pedidos_compra_produtos"] });
    await refetchPedidos();
  };

  const openCreate = () => {
    setMode("create");
    setForm({ ...emptyForm });
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
      frete_valor: p.frete_valor ?? "",
      condicao_pagamento: p.condicao_pagamento || p.condicoes_pagamento || "",
      status: p.status || "rascunho",
      observacoes: p.observacoes || "",
    });

    const { data: itens, error } = await supabase.from("pedidos_compra_itens")
      .select("*, produtos(nome, codigo_interno)")
      .eq("pedido_compra_id", p.id);

    if (error) {
      console.error("[pedidos_compra] load edit items error", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      toast.error("Erro ao carregar itens do pedido.");
      return;
    }

    setItems(
      (itens || []).map((i: any) => ({
        id: String(i.id),
        produto_id: i.produto_id ? String(i.produto_id) : "",
        codigo: i.produtos?.codigo_interno || "",
        descricao: i.produtos?.nome || "",
        quantidade: Number(i.quantidade || 0),
        valor_unitario: Number(i.valor_unitario || 0),
        valor_total: Number(i.valor_total || 0),
      })),
    );

    // Load estoque and cotação for the contextual edit header
    const estResult = await supabase
      .from("estoque_movimentos")
      .select("produto_id, quantidade")
      .eq("documento_id", String(p.id))
      .eq("documento_tipo", "pedido_compra");
    setViewEstoque((estResult.data as any[]) || []);

    if (p.cotacao_compra_id) {
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
      supabase
        .from("estoque_movimentos")
        .select("*, produtos(nome, codigo_interno)")
        .eq("documento_id", p.id)
        .eq("documento_tipo", "pedido_compra"),
    ]);

    setViewItems(itensResult.data || []);
    setViewEstoque((estResult.data as any[]) || []);

    if (p.cotacao_compra_id) {
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

    setViewFinanceiro((finLanc as any[]) || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (!form.fornecedor_id) {
      toast.error("Fornecedor é obrigatório");
      return;
    }

    // fornecedor_id is a UUID string; keep it as-is (no numeric conversion)
    const fornecedorId = String(form.fornecedor_id);

    setSaving(true);

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

    let pedidoId = selected?.id;

    try {
      if (mode === "create") {
        const numero = `PC-${String(Date.now()).slice(-6)}`;
        const { data: newP, error } = await supabase.from("pedidos_compra")
          .insert({ numero, ...payload })
          .select()
          .single();

        if (error) {
          console.error("[pedidos_compra] insert error", {
            code: error.code,
            message: error.message,
          });
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
          console.error("[pedidos_compra] update error", {
            code: error.code,
            message: error.message,
          });
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
              const { error: rollbackError } = await supabase.from("pedidos_compra")
                .delete()
                .eq("id", pedidoId);

              if (rollbackError) {
                toast.error(
                  `Erro ao salvar itens: ${itemsError.message}. O pedido foi criado mas os itens não foram salvos — apague o pedido manualmente.`,
                );
                setSaving(false);
                return;
              }
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
      setForm({ ...emptyForm });
      await refreshAll();
    } catch (err: any) {
      console.error("[pedidos_compra] unexpected error", err);
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
      for (const item of itens as any[]) {
        const saldoAnterior = Number(item.produtos?.estoque_atual || 0);
        const qtd = Number(item.quantidade || 0);

        await supabase.from("estoque_movimentos").insert({
          produto_id: item.produto_id,
          tipo: "entrada" as any,
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
          tipo: "pagar" as any,
          descricao: `${pedidoNumero(p)} — ${p.fornecedores?.nome_razao_social || "Fornecedor"}`,
          valor: vTotal,
          saldo_restante: vTotal,
          data_vencimento: p.data_entrega_prevista || new Date().toISOString().split("T")[0],
          status: "aberto" as any,
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
    } catch (err: any) {
      console.error("[darEntrada]", err);
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
    } catch (err: any) {
      console.error("[marcarEnviado]", err);
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
    } catch (err: any) {
      console.error("[cancelarPedido]", err);
      toast.error(`Erro ao cancelar pedido: ${err?.message || "tente novamente."}`);
    }
  };

  const columns = [
    {
      key: "id",
      label: "Nº Pedido",
      sortable: true,
      render: (p: PedidoCompra) => (
        <span className="font-mono text-xs font-semibold text-primary">{pedidoNumero(p)}</span>
      ),
    },
    {
      key: "fornecedor",
      label: "Fornecedor",
      render: (p: PedidoCompra) => (
        <span className="font-medium text-sm">{p.fornecedores?.nome_razao_social || "—"}</span>
      ),
    },
    {
      key: "data_pedido",
      label: "Data Pedido",
      sortable: true,
      render: (p: PedidoCompra) => <span className="text-xs">{formatDate(p.data_pedido)}</span>,
    },
    {
      key: "data_entrega_prevista",
      label: "Entrega Prevista",
      render: (p: PedidoCompra) => (
        <EntregaBadge dataEntrega={p.data_entrega_prevista} status={p.status} />
      ),
    },
    {
      key: "condicao_pagamento",
      label: "Condição de Pagamento",
      hidden: true,
      render: (p: PedidoCompra) => (
        <span className="text-xs text-muted-foreground">{p.condicao_pagamento || "—"}</span>
      ),
    },
    {
      key: "valor_total",
      label: "Total",
      sortable: true,
      render: (p: PedidoCompra) => (
        <span className="font-semibold font-mono text-sm">{formatCurrency(Number(p.valor_total || 0))}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (p: PedidoCompra) => (
        <StatusBadge status={p.status} label={statusLabels[p.status] || p.status} />
      ),
    },
    {
      key: "recebimento",
      label: "Recebimento",
      render: (p: PedidoCompra) => {
        if (p.status === "recebido") {
          return (
            <Badge variant="outline" className="text-[11px] bg-success/10 text-success border-success/30 gap-1">
              <CheckCircle2 className="h-3 w-3" />Recebido
            </Badge>
          );
        }
        if (p.status === "parcialmente_recebido") {
          return (
            <Badge variant="outline" className="text-[11px] bg-warning/10 text-warning border-warning/30 gap-1">
              <ArrowDownToLine className="h-3 w-3" />Parcial
            </Badge>
          );
        }
        if (["aguardando_recebimento", "enviado_ao_fornecedor", "aprovado"].includes(p.status)) {
          return (
            <Badge variant="outline" className="text-[11px] bg-warning/10 text-warning border-warning/30 gap-1">
              <Clock className="h-3 w-3" />Aguardando
            </Badge>
          );
        }
        if (p.status === "cancelado") {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <Badge variant="outline" className="text-[11px] gap-1">
            <FileText className="h-3 w-3" />Rascunho
          </Badge>
        );
      },
    },
    {
      key: "cotacao_origem",
      label: "Cotação Origem",
      hidden: true,
      render: (p: PedidoCompra) =>
        p.cotacao_compra_id ? (
          <span className="text-xs font-mono text-muted-foreground">{String(p.cotacao_compra_id).slice(-6)}</span>
        ) : (
          <span className="text-xs text-muted-foreground">Avulso</span>
        ),
    },
    {
      key: "acoes_pc",
      label: "Ações",
      sortable: false,
      render: (p: PedidoCompra) => {
        const canSend = p.status === "aprovado";
        const canReceive = ["aprovado", "enviado_ao_fornecedor", "aguardando_recebimento", "parcialmente_recebido"].includes(p.status);
        return (
          <div className="flex items-center gap-1">
            {canSend && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={(e) => { e.stopPropagation(); marcarEnviado(p); }}
              >
                <SendHorizontal className="w-3 h-3" /> Enviar
              </Button>
            )}
            {canReceive && !canSend && (
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs gap-1"
                onClick={(e) => { e.stopPropagation(); darEntrada(p); }}
              >
                <PackageCheck className="w-3 h-3" /> Receber
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const filteredData = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return data.filter((p) => {
      if (statusFilters.length > 0 && !statusFilters.includes(p.status)) return false;
      if (fornecedorFilters.length > 0 && !fornecedorFilters.includes(String(p.fornecedor_id || ""))) return false;

      if (recebimentoFilters.length > 0) {
        const rf = getRecebimentoFilter(p.status);
        if (!recebimentoFilters.includes(rf)) return false;
      }

      if (dataInicio && p.data_pedido < dataInicio) return false;
      if (dataFim && p.data_pedido > dataFim) return false;

      if (!query) return true;
      return [
        pedidoNumero(p),
        p.fornecedores?.nome_razao_social,
        p.observacoes,
        p.condicao_pagamento,
      ].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }, [data, searchTerm, statusFilters, fornecedorFilters, recebimentoFilters, dataInicio, dataFim]);

  const activeFilters = useMemo(() => {
    const chips: FilterChip[] = [];
    statusFilters.forEach((f) => {
      chips.push({ key: "status", label: "Status", value: [f], displayValue: statusLabels[f] || f });
    });
    fornecedorFilters.forEach((f) => {
      const forn = fornecedoresAtivos.find((x) => String(x.id) === f);
      chips.push({ key: "fornecedor", label: "Fornecedor", value: [f], displayValue: forn?.nome_razao_social || f });
    });
    recebimentoFilters.forEach((f) => {
      const opt = recebimentoFilterOptions.find((x) => x.value === f);
      chips.push({ key: "recebimento", label: "Recebimento", value: [f], displayValue: opt?.label || f });
    });
    if (dataInicio) chips.push({ key: "dataInicio", label: "Pedido desde", value: [dataInicio], displayValue: formatDate(dataInicio) });
    if (dataFim) chips.push({ key: "dataFim", label: "Pedido até", value: [dataFim], displayValue: formatDate(dataFim) });
    return chips;
  }, [statusFilters, fornecedorFilters, recebimentoFilters, dataInicio, dataFim, fornecedoresAtivos]);

  const handleRemoveFilter = (key: string, value?: string) => {
    if (key === "status") setStatusFilters((prev) => prev.filter((v) => v !== value));
    if (key === "fornecedor") setFornecedorFilters((prev) => prev.filter((v) => v !== value));
    if (key === "recebimento") setRecebimentoFilters((prev) => prev.filter((v) => v !== value));
    if (key === "dataInicio") setDataInicio("");
    if (key === "dataFim") setDataFim("");
  };

  const handleClearAllFilters = () => {
    setStatusFilters([]);
    setFornecedorFilters([]);
    setRecebimentoFilters([]);
    setDataInicio("");
    setDataFim("");
  };

  const statusOptions: MultiSelectOption[] = Object.entries(statusLabels).map(([k, v]) => ({ label: v, value: k }));
  const fornecedorOptions2: MultiSelectOption[] = fornecedoresAtivos.map((f) => ({
    label: f.nome_razao_social || "",
    value: String(f.id),
  }));

  return (
    <AppLayout>
      <ModulePage
        title="Pedidos de Compra"
        subtitle="Central de consulta e acompanhamento operacional de pedidos de compra"
        addLabel="Novo Pedido"
        onAdd={openCreate}
        count={filteredData.length}
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SummaryCard
            title="Total"
            value={formatNumber(kpis.total)}
            icon={ShoppingCart}
            variationType="neutral"
            variation="pedidos"
          />
          <SummaryCard
            title="Valor Total"
            value={formatCurrency(kpis.totalValue)}
            icon={ShoppingCart}
            variationType="neutral"
            variation="acumulado"
          />
          <SummaryCard
            title="Aguardando"
            value={formatNumber(kpis.aguardando)}
            icon={Clock}
            variationType={kpis.aguardando > 0 ? "negative" : "positive"}
            variant={kpis.aguardando > 0 ? "warning" : undefined}
            variation="em andamento"
          />
          <SummaryCard
            title="Recebidos"
            value={formatNumber(kpis.recebidos)}
            icon={CheckCircle2}
            variationType="positive"
            variation="concluídos"
          />
        </div>

        <AdvancedFilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar por número, fornecedor ou observações..."
          activeFilters={activeFilters}
          onRemoveFilter={handleRemoveFilter}
          onClearAll={handleClearAllFilters}
          count={filteredData.length}
        >
          <MultiSelect
            options={statusOptions}
            selected={statusFilters}
            onChange={setStatusFilters}
            placeholder="Status"
            className="w-[200px]"
          />
          <MultiSelect
            options={recebimentoFilterOptions}
            selected={recebimentoFilters}
            onChange={setRecebimentoFilters}
            placeholder="Recebimento"
            className="w-[200px]"
          />
          <MultiSelect
            options={fornecedorOptions2}
            selected={fornecedorFilters}
            onChange={setFornecedorFilters}
            placeholder="Fornecedor"
            className="w-[220px]"
          />
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="h-9 w-[140px] text-xs"
              title="Pedido desde"
            />
            <span className="text-xs text-muted-foreground">até</span>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="h-9 w-[140px] text-xs"
              title="Pedido até"
            />
          </div>
        </AdvancedFilterBar>

        <DataTable
          columns={columns}
          data={filteredData}
          loading={loading}
          moduleKey="pedidos-compra"
          showColumnToggle={true}
          onView={openView}
          onEdit={openEdit}
        />
      </ModulePage>

      <FormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          mode === "create"
            ? "Novo Pedido de Compra"
            : `Editando ${selected ? pedidoNumero(selected) : "Pedido"}`
        }
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Banner de contexto operacional (apenas edição) ─────────── */}
          {mode === "edit" && selected && (() => {
            const estoquePorProdutoEdit: Record<string, number> = viewEstoque.reduce(
              (acc: Record<string, number>, m: any) => {
                const key = String(m.produto_id);
                acc[key] = (acc[key] || 0) + Number(m.quantidade || 0);
                return acc;
              },
              {},
            );
            const totalOrdenadoEdit = items.reduce((s, i) => s + Number(i.quantidade || 0), 0);
            const totalRecebidoEdit = Object.values(estoquePorProdutoEdit).reduce((s, v) => s + v, 0);
            const pctEdit =
              totalOrdenadoEdit > 0
                ? Math.min(100, Math.round((totalRecebidoEdit / totalOrdenadoEdit) * 100))
                : 0;

            const recStatusEdit = (() => {
              const s = form.status;
              if (s === "recebido") return { label: "Recebido", colorClass: "text-success", Icon: CheckCircle2 };
              if (s === "parcialmente_recebido") return { label: "Parcial", colorClass: "text-warning", Icon: ArrowDownToLine };
              if (["aguardando_recebimento", "enviado_ao_fornecedor", "aprovado"].includes(s))
                return { label: "Aguardando", colorClass: "text-warning", Icon: Clock };
              if (s === "cancelado") return { label: "Cancelado", colorClass: "text-destructive", Icon: XCircle };
              return { label: "Rascunho", colorClass: "text-muted-foreground", Icon: FileText };
            })();
            const RecStatusIcon = recStatusEdit.Icon;

            const isEditOverdue =
              !["recebido", "cancelado"].includes(form.status) &&
              !!selected.data_entrega_prevista &&
              new Date(selected.data_entrega_prevista) < new Date();

            return (
              <div className="rounded-lg border bg-accent/20 p-4 space-y-3">
                {isEditOverdue && (
                  <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Entrega prevista em {formatDate(selected.data_entrega_prevista)} — pedido em atraso.
                  </div>
                )}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-base text-primary">{pedidoNumero(selected)}</span>
                      <StatusBadge status={form.status} label={statusLabels[form.status] || form.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <Building2 className="inline h-3 w-3 mr-1" />
                      {selected.fornecedores?.nome_razao_social || "—"}
                      {selected.fornecedores?.cpf_cnpj && (
                        <span className="ml-1 opacity-60">· {selected.fornecedores.cpf_cnpj}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <Calendar className="inline h-3 w-3 mr-1" />
                      Pedido em {formatDate(selected.data_pedido)}
                      {selected.data_entrega_prevista && (
                        <span className={isEditOverdue ? "text-destructive font-medium" : ""}>
                          {" "}· Entrega prevista {formatDate(selected.data_entrega_prevista)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 border-t pt-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total</p>
                    <p className="font-mono font-semibold text-sm text-primary">{formatCurrency(valorTotal)}</p>
                    {Number(form.frete_valor || 0) > 0 && (
                      <p className="text-[10px] text-muted-foreground font-mono">
                        + {formatCurrency(Number(form.frete_valor))} frete
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Recebimento</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <RecStatusIcon className={`h-3.5 w-3.5 shrink-0 ${recStatusEdit.colorClass}`} />
                      <p className={`font-semibold text-xs ${recStatusEdit.colorClass}`}>
                        {pctEdit > 0 ? `${pctEdit}%` : recStatusEdit.label}
                      </p>
                    </div>
                    {pctEdit > 0 && <Progress value={pctEdit} className="h-1 mt-1" />}
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Cotação</p>
                    {viewCotacao ? (
                      <p className="font-mono font-semibold text-xs flex items-center gap-1 mt-0.5">
                        <Receipt className="h-3 w-3 text-muted-foreground" />
                        {viewCotacao.numero}
                      </p>
                    ) : selected.cotacao_compra_id ? (
                      <p className="font-mono text-xs text-muted-foreground mt-0.5">Carregando...</p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5">Avulso</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Seção: Datas e Status ─────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Datas e Status
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Data do Pedido</Label>
                <Input
                  type="date"
                  value={form.data_pedido}
                  onChange={(e) => setForm({ ...form, data_pedido: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Entrega Prevista</Label>
                <Input
                  type="date"
                  value={form.data_entrega_prevista}
                  onChange={(e) => setForm({ ...form, data_entrega_prevista: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Status do Pedido</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusPedidoCompra).map(([value, { label }]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* ── Seção: Fornecedor ─────────────────────────────────────── */}
          <div className="space-y-3 rounded-lg bg-accent/30 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Fornecedor
            </p>
            <AutocompleteSearch
              options={fornecedorOptions}
              value={String(form.fornecedor_id || "")}
              onChange={(id) => setForm({ ...form, fornecedor_id: id })}
              placeholder={fornecedoresLoading ? "Carregando fornecedores..." : "Buscar por nome ou CNPJ..."}
            />
            {!fornecedoresLoading && fornecedorOptions.length === 0 && (
              <p className="text-xs text-warning">
                Nenhum fornecedor disponível. Verifique cadastro/ativo no banco legado.
              </p>
            )}
          </div>

          {/* ── Seção: Itens do Pedido ────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {mode === "edit" ? "Itens Fechados" : "Itens do Pedido"}
            </p>
            {!produtosLoading && produtosOptionsData.length === 0 && (
              <p className="text-xs text-warning">
                Nenhum produto disponível para seleção. Verifique cadastro/ativo no banco legado.
              </p>
            )}
            <ItemsGrid
              items={items}
              onChange={setItems}
              produtos={produtosOptionsData}
              title={produtosLoading ? "Carregando produtos..." : ""}
            />
          </div>

          {/* ── Seção: Condições Finais ───────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {mode === "edit" ? "Condições Finais" : "Condições"}
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Frete (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.frete_valor}
                  onChange={(e) => setForm({ ...form, frete_valor: e.target.value })}
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-2">
                <Label>Condição de Pagamento</Label>
                <Select
                  value={form.condicao_pagamento || ""}
                  onValueChange={(v) => setForm({ ...form, condicao_pagamento: v === "__none__" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Nenhuma —</SelectItem>
                    {formasPagamentoRaw.map((fp) => (
                      <SelectItem key={fp.id} value={fp.descricao}>
                        {fp.descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data de Entrega Real</Label>
                <Input
                  type="date"
                  value={form.data_entrega_real}
                  onChange={(e) => setForm({ ...form, data_entrega_real: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* ── Totalizador ───────────────────────────────────────────── */}
          <div className="flex items-center justify-end rounded-lg bg-accent/50 p-4 gap-6">
            <span className="text-sm text-muted-foreground">
              Produtos: <span className="font-mono font-medium">{formatCurrency(valorProdutos)}</span>
            </span>
            <span className="text-sm text-muted-foreground">
              Frete:{" "}
              <span className="font-mono font-medium">{formatCurrency(Number(form.frete_valor || 0))}</span>
            </span>
            <span className="ml-2 text-sm text-muted-foreground">TOTAL:</span>
            <span className="text-lg font-bold font-mono text-primary">{formatCurrency(valorTotal)}</span>
          </div>

          {/* ── Seção: Observações ────────────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Observações
            </p>
            <Textarea
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || fornecedoresLoading || produtosLoading}>
              {saving
                ? "Salvando..."
                : mode === "edit"
                ? "Salvar Alterações"
                : "Criar Pedido"}
            </Button>
          </div>
        </form>
      </FormModal>

      {selected &&
        (() => {
          const isOverdue =
            !["recebido", "cancelado"].includes(selected.status) &&
            !!selected.data_entrega_prevista &&
            new Date(selected.data_entrega_prevista) < new Date();

          const recebimentoStatus = (() => {
            if (selected.status === "recebido") return { label: "Recebido", color: "success" };
            if (selected.status === "parcialmente_recebido") return { label: "Parcial", color: "warning" };
            if (selected.status === "aguardando_recebimento") return { label: "Aguardando", color: "warning" };
            if (selected.status === "cancelado") return { label: "Cancelado", color: "destructive" };
            return { label: "Pendente", color: "secondary" };
          })();

          const recebimentoColorClass: Record<string, string> = {
            success: "text-success",
            warning: "text-warning",
            destructive: "text-destructive",
            secondary: "text-muted-foreground",
          };

          // Per-item receipt progress (cross-reference items × stock movements)
          const estoquePorProduto: Record<string, number> = viewEstoque.reduce(
            (acc: Record<string, number>, m: any) => {
              const key = String(m.produto_id);
              acc[key] = (acc[key] || 0) + Number(m.quantidade || 0);
              return acc;
            },
            {},
          );
          const totalOrdenado = viewItems.reduce((s: number, i: any) => s + Number(i.quantidade || 0), 0);
          const totalRecebido = viewEstoque.reduce((s: number, m: any) => s + Number(m.quantidade || 0), 0);
          const pctRecebimento =
            totalOrdenado > 0 ? Math.min(100, Math.round((totalRecebido / totalOrdenado) * 100)) : 0;

          const tabResumo = (
            <div className="space-y-5">
              {isOverdue && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Entrega prevista em {formatDate(selected.data_entrega_prevista)} — pedido em atraso.
                </div>
              )}

              <ViewSection title="Pedido">
                <div className="grid grid-cols-2 gap-4">
                  <ViewField label="Nº">
                    <span className="font-mono font-medium">{pedidoNumero(selected)}</span>
                  </ViewField>
                  <ViewField label="Status">
                    <StatusBadge status={selected.status} label={statusLabels[selected.status] || selected.status} />
                  </ViewField>
                  <ViewField label="Data Pedido">{formatDate(selected.data_pedido)}</ViewField>
                  <ViewField label="Valor Total">
                    <span className="font-semibold font-mono text-primary">
                      {formatCurrency(Number(selected.valor_total || 0))}
                    </span>
                  </ViewField>
                </div>
              </ViewSection>

              <ViewSection title="Fornecedor">
                <ViewField label="Fornecedor">
                  {selected.fornecedor_id ? (
                    <RelationalLink type="fornecedor" id={selected.fornecedor_id}>
                      {selected.fornecedores?.nome_razao_social || "—"}
                    </RelationalLink>
                  ) : (
                    <span className="text-muted-foreground">Não informado</span>
                  )}
                </ViewField>
              </ViewSection>

              {selected.cotacao_compra_id && (
                <ViewSection title="Cotação de Origem">
                  <ViewField label="Cotação">
                    {viewCotacao ? (
                      <RelationalLink to="/cotacoes-compra">{viewCotacao.numero}</RelationalLink>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">{selected.cotacao_compra_id}</span>
                    )}
                  </ViewField>
                  {viewCotacao?.status && (
                    <ViewField label="Status da Cotação">
                      <StatusBadge status={viewCotacao.status} />
                    </ViewField>
                  )}
                </ViewSection>
              )}

              {selected.observacoes && (
                <ViewSection title="Observações">
                  <p className="text-sm text-muted-foreground italic">{selected.observacoes}</p>
                </ViewSection>
              )}
            </div>
          );

          const tabItens = (
            <div className="space-y-3">
              {viewItems.length > 0 ? (
                <>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Produto</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground hidden sm:table-cell">
                            Código
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Qtd</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                            Vlr. Unit.
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Total</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground text-success">Rec.</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground text-warning">Pend.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewItems.map((i: any, idx: number) => {
                          const qtdRec = estoquePorProduto[String(i.produto_id)] || 0;
                          const qtdPend = Math.max(0, Number(i.quantidade) - qtdRec);
                          return (
                            <tr key={idx} className="border-b last:border-b-0 hover:bg-muted/20">
                              <td className="px-3 py-2 font-medium">{i.produtos?.nome || "—"}</td>
                              <td className="px-3 py-2 text-xs text-muted-foreground font-mono hidden sm:table-cell">
                                {i.produtos?.codigo_interno || "—"}
                              </td>
                              <td className="px-3 py-2 text-right font-mono">{i.quantidade}</td>
                              <td className="px-3 py-2 text-right font-mono text-muted-foreground text-xs">
                                {formatCurrency(Number(i.valor_unitario))}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-medium">
                                {formatCurrency(Number(i.valor_total))}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-xs text-success font-medium">
                                {qtdRec > 0 ? qtdRec : "—"}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-xs text-warning font-medium">
                                {qtdPend > 0 ? qtdPend : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/30 border-t">
                          <td colSpan={4} className="px-3 py-2 text-xs font-semibold text-muted-foreground text-right">
                            Total dos Itens
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-primary">
                            {formatCurrency(
                              viewItems.reduce((s: number, i: any) => s + Number(i.valor_total || 0), 0),
                            )}
                          </td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {Number(selected.frete_valor) > 0 && (
                    <div className="flex justify-between items-center rounded-lg bg-accent/20 px-3 py-2 text-sm">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Truck className="h-3.5 w-3.5" /> Frete
                      </span>
                      <span className="font-mono">{formatCurrency(Number(selected.frete_valor))}</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum item cadastrado</p>
              )}
            </div>
          );

          const tabRecebimento = (
            <div className="space-y-5">
              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-2">Situação de Recebimento</p>
                <div className="flex items-center gap-3">
                  {selected.status === "recebido" && <CheckCircle2 className="h-5 w-5 text-success shrink-0" />}
                  {selected.status === "parcialmente_recebido" && (
                    <ArrowDownToLine className="h-5 w-5 text-warning shrink-0" />
                  )}
                  {["aguardando_recebimento", "enviado_ao_fornecedor", "aprovado"].includes(selected.status) && (
                    <Clock className="h-5 w-5 text-warning shrink-0" />
                  )}
                  {selected.status === "rascunho" && <FileText className="h-5 w-5 text-muted-foreground shrink-0" />}
                  {selected.status === "cancelado" && (
                    <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{recebimentoStatus.label}</p>
                    <p className="text-xs text-muted-foreground">{statusLabels[selected.status] || selected.status}</p>
                  </div>
                  {pctRecebimento > 0 && (
                    <span
                      className={`text-sm font-bold font-mono shrink-0 ${pctRecebimento === 100 ? "text-success" : "text-warning"}`}
                    >
                      {pctRecebimento}%
                    </span>
                  )}
                </div>
                {pctRecebimento > 0 && (
                  <Progress value={pctRecebimento} className="h-1.5 mt-3" />
                )}
              </div>

              {viewItems.length > 0 && (
                <ViewSection title="Progresso por Item">
                  <div className="space-y-3">
                    {viewItems.map((i: any, idx: number) => {
                      const qtdRec = estoquePorProduto[String(i.produto_id)] || 0;
                      const qtdPend = Math.max(0, Number(i.quantidade) - qtdRec);
                      const pct =
                        Number(i.quantidade) > 0
                          ? Math.min(100, Math.round((qtdRec / Number(i.quantidade)) * 100))
                          : 0;
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-medium truncate max-w-[200px]">{i.produtos?.nome || "—"}</span>
                            <span className="font-mono text-muted-foreground shrink-0 ml-2 flex items-center gap-1">
                              <span className="text-success font-medium">{qtdRec}</span>
                              <span>/</span>
                              <span>{i.quantidade}</span>
                              {qtdPend > 0 && (
                                <span className="text-warning ml-1">({qtdPend} pend.)</span>
                              )}
                            </span>
                          </div>
                          <Progress value={pct} className="h-1" />
                        </div>
                      );
                    })}
                  </div>
                </ViewSection>
              )}

              {(selected.data_entrega_prevista || selected.data_entrega_real) && (
                <ViewSection title="Datas de Entrega">
                  <div className="grid grid-cols-2 gap-4">
                    {selected.data_entrega_prevista && (
                      <ViewField label="Entrega Prevista">
                        <span className={`flex items-center gap-1 ${isOverdue ? "text-destructive font-medium" : ""}`}>
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(selected.data_entrega_prevista)}
                        </span>
                      </ViewField>
                    )}
                    {selected.data_entrega_real && (
                      <ViewField label="Entrega Real">
                        <span className="flex items-center gap-1 text-success font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {formatDate(selected.data_entrega_real)}
                        </span>
                      </ViewField>
                    )}
                  </div>
                </ViewSection>
              )}

              {viewEstoque.length > 0 ? (
                <ViewSection title="Movimentações de Estoque">
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Produto</th>
                          <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Qtd</th>
                          <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Saldo Ant.</th>
                          <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Saldo Atu.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewEstoque.map((m: any, idx: number) => (
                          <tr key={idx} className="border-b last:border-b-0 hover:bg-muted/20">
                            <td className="px-3 py-2 font-medium">{m.produtos?.nome || "—"}</td>
                            <td className="px-3 py-2 text-right font-mono text-success font-semibold">
                              +{m.quantidade}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                              {m.saldo_anterior}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-medium">{m.saldo_atual}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-success" />
                    {viewEstoque.length} moviment{viewEstoque.length === 1 ? "ação registrada" : "ações registradas"}
                  </p>
                </ViewSection>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  <Boxes className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  {["recebido", "parcialmente_recebido"].includes(selected.status)
                    ? "Movimentações de estoque não encontradas."
                    : "Nenhum recebimento registrado ainda."}
                </div>
              )}

              <ViewSection title="Logística / Rastreamento">
                <LogisticaRastreioSection pedidoCompraId={selected.id} />
              </ViewSection>
            </div>
          );

          const tabCondicoes = (
            <div className="space-y-5">
              <ViewSection title="Pagamento">
                <div className="grid grid-cols-2 gap-4">
                  <ViewField label="Cond. Pagamento">
                    {selected.condicao_pagamento || <span className="text-muted-foreground">Não informado</span>}
                  </ViewField>
                  <ViewField label="Frete">
                    <span className="font-mono">
                      {selected.frete_valor ? formatCurrency(Number(selected.frete_valor)) : "—"}
                    </span>
                  </ViewField>
                </div>
              </ViewSection>

              <ViewSection title="Entregas">
                <div className="grid grid-cols-2 gap-4">
                  <ViewField label="Data do Pedido">{formatDate(selected.data_pedido)}</ViewField>
                  {selected.data_entrega_prevista && (
                    <ViewField label="Entrega Prevista">
                      <span className={isOverdue ? "text-destructive font-medium" : ""}>
                        {formatDate(selected.data_entrega_prevista)}
                      </span>
                    </ViewField>
                  )}
                  {selected.data_entrega_real && (
                    <ViewField label="Entrega Real">
                      <span className="text-success font-medium">{formatDate(selected.data_entrega_real)}</span>
                    </ViewField>
                  )}
                </div>
              </ViewSection>

              <ViewSection title="Totais">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Produtos</span>
                    <span className="font-mono">
                      {formatCurrency(viewItems.reduce((s: number, i: any) => s + Number(i.valor_total || 0), 0))}
                    </span>
                  </div>
                  {Number(selected.frete_valor) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Frete</span>
                      <span className="font-mono">{formatCurrency(Number(selected.frete_valor))}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-semibold border-t pt-2">
                    <span>Total</span>
                    <span className="font-mono text-primary">
                      {formatCurrency(Number(selected.valor_total || 0))}
                    </span>
                  </div>
                </div>
              </ViewSection>

              {selected.observacoes && (
                <ViewSection title="Observações">
                  <p className="text-sm text-muted-foreground italic">{selected.observacoes}</p>
                </ViewSection>
              )}
            </div>
          );

          const tabVinculos = (
            <div className="space-y-5">
              <ViewSection title="Fornecedor">
                <ViewField label="Fornecedor">
                  {selected.fornecedor_id ? (
                    <RelationalLink type="fornecedor" id={selected.fornecedor_id}>
                      <Building2 className="h-3.5 w-3.5" />
                      {selected.fornecedores?.nome_razao_social || "—"}
                    </RelationalLink>
                  ) : (
                    <span className="text-muted-foreground">Não vinculado</span>
                  )}
                </ViewField>
              </ViewSection>

              <ViewSection title="Cotação de Origem">
                {selected.cotacao_compra_id ? (
                  <ViewField label="Cotação">
                    {viewCotacao ? (
                      <RelationalLink to="/cotacoes-compra">
                        <Receipt className="h-3.5 w-3.5" />
                        {viewCotacao.numero}
                      </RelationalLink>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">{selected.cotacao_compra_id}</span>
                    )}
                  </ViewField>
                ) : (
                  <p className="text-sm text-muted-foreground">Pedido criado sem cotação de origem.</p>
                )}
              </ViewSection>

              <ViewSection title="Financeiro">
                {viewFinanceiro.length > 0 ? (
                  <div className="space-y-2">
                    {viewFinanceiro.map((l: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-md bg-accent/20 px-3 py-2 text-sm"
                      >
                        <span className="truncate text-xs">{l.descricao}</span>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <StatusBadge status={l.status} />
                          <span className="font-mono font-medium">{formatCurrency(Number(l.valor))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {["recebido", "parcialmente_recebido"].includes(selected.status)
                      ? "Lançamento financeiro não encontrado para este pedido."
                      : "Lançamento gerado automaticamente ao registrar o recebimento."}
                  </p>
                )}
              </ViewSection>

              <ViewSection title="Estoque">
                {viewEstoque.length > 0 ? (
                  <p className="text-sm text-success flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    {viewEstoque.length} entrada{viewEstoque.length !== 1 ? "s" : ""} de estoque registrada
                    {viewEstoque.length !== 1 ? "s" : ""}.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma movimentação de estoque registrada.</p>
                )}
              </ViewSection>
            </div>
          );

          const canReceive = ["aprovado", "enviado_ao_fornecedor", "aguardando_recebimento", "parcialmente_recebido"].includes(selected.status);
          const canSend = selected.status === "aprovado";
          const canCancel = ["rascunho", "aprovado", "enviado_ao_fornecedor", "aguardando_recebimento"].includes(selected.status);

          const drawerFooter =
            canReceive || canSend || canCancel ? (
              <div className="flex gap-2 w-full">
                {canCancel && (
                  <Button
                    variant="outline"
                    className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => cancelarPedido(selected)}
                  >
                    <XCircle className="w-4 h-4" /> Cancelar
                  </Button>
                )}
                <div className="flex gap-2 flex-1 justify-end">
                  {canSend && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => {
                        marcarEnviado(selected);
                        setSelected({ ...selected, status: "enviado_ao_fornecedor" });
                      }}
                    >
                      <SendHorizontal className="w-4 h-4" /> Marcar como Enviado
                    </Button>
                  )}

                  {canReceive && (
                    <Button
                      className="gap-2"
                      onClick={() => {
                        setDrawerOpen(false);
                        darEntrada(selected);
                      }}
                    >
                      <PackageCheck className="w-4 h-4" /> Registrar Recebimento
                    </Button>
                  )}
                </div>
              </div>
            ) : undefined;

          return (
            <ViewDrawerV2
              open={drawerOpen}
              onClose={() => setDrawerOpen(false)}
              title={pedidoNumero(selected)}
              subtitle={`${selected.fornecedores?.nome_razao_social || "Fornecedor não informado"} · ${formatDate(selected.data_pedido)}`}
              badge={<StatusBadge status={selected.status} label={statusLabels[selected.status] || selected.status} />}
              actions={
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setDrawerOpen(false);
                          openEdit(selected);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Editar</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={async () => {
                          setDrawerOpen(false);
                          await supabase.from("pedidos_compra")
                            .update({ ativo: false })
                            .eq("id", selected.id);
                          await refreshAll();
                          toast.success("Removido!");
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Excluir</TooltipContent>
                  </Tooltip>
                </>
              }
              summary={
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-accent/30 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">Itens</p>
                    <p className="font-semibold text-sm font-mono">{viewItems.length}</p>
                  </div>
                  <div className="bg-accent/30 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">Recebimento</p>
                    {pctRecebimento > 0 ? (
                      <p
                        className={`font-semibold text-sm font-mono mt-0.5 ${pctRecebimento === 100 ? "text-success" : "text-warning"}`}
                      >
                        {pctRecebimento}%
                      </p>
                    ) : (
                      <p
                        className={`font-semibold text-xs leading-tight mt-0.5 ${recebimentoColorClass[recebimentoStatus.color] ?? "text-muted-foreground"}`}
                      >
                        {recebimentoStatus.label}
                      </p>
                    )}
                  </div>
                  <div className="bg-accent/30 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="font-semibold text-sm font-mono">
                      {formatCurrency(Number(selected.valor_total || 0))}
                    </p>
                  </div>
                  <div className="bg-accent/30 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">Cotação</p>
                    <p className="font-semibold text-xs leading-tight mt-0.5 font-mono">
                      {viewCotacao ? viewCotacao.numero : selected.cotacao_compra_id ? "—" : "Avulso"}
                    </p>
                  </div>
                </div>
              }
              tabs={[
                { value: "resumo", label: "Resumo", content: tabResumo },
                { value: "itens", label: `Itens (${viewItems.length})`, content: tabItens },
                { value: "recebimento", label: "Recebimento", content: tabRecebimento },
                { value: "condicoes", label: "Condições", content: tabCondicoes },
                { value: "vinculos", label: "Vínculos", content: tabVinculos },
              ]}
              footer={drawerFooter}
            />
          );
        })()}
    </AppLayout>
  );
};

export default PedidosCompra;
