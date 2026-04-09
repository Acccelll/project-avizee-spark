import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { SummaryCard } from "@/components/SummaryCard";
import { EstoqueMovimentacaoDrawer } from "@/components/estoque/EstoqueMovimentacaoDrawer";
import { EstoquePosicaoDrawer } from "@/components/estoque/EstoquePosicaoDrawer";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { Card, CardContent } from "@/components/ui/card";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatNumber, formatCurrency } from "@/lib/format";
import {
  AlertTriangle, ArrowDownCircle, RotateCcw,
  TrendingDown, Package, CheckCircle, XCircle, ShieldAlert,
  DollarSign, SlidersHorizontal,
} from "lucide-react";

interface Movimento {
  id: string; produto_id: string; tipo: string; quantidade: number;
  saldo_anterior: number; saldo_atual: number; motivo: string;
  documento_tipo: string; documento_id: string; created_at: string;
  usuario_id?: string | null;
  produtos?: { nome: string; sku: string };
}

interface ProdutoPosicao {
  id: string; nome: string; sku: string; codigo_interno: string;
  unidade_medida: string; estoque_atual: number; estoque_minimo: number;
  preco_venda: number;
  estoque_reservado?: number;
  estoque_ideal?: number;
  ponto_reposicao?: number;
  ativo?: boolean;
}

type SituacaoEstoque = "normal" | "atencao" | "critico" | "zerado";

function getSituacao(p: ProdutoPosicao): SituacaoEstoque {
  const atual = Number(p.estoque_atual || 0);
  const minimo = Number(p.estoque_minimo || 0);
  if (atual <= 0) return "zerado";
  if (minimo > 0 && atual <= minimo) return "critico";
  if (minimo > 0 && atual <= minimo * 1.2) return "atencao";
  return "normal";
}

const situacaoConfig: Record<SituacaoEstoque, { label: string; icon: typeof CheckCircle; cls: string }> = {
  normal:  { label: "Normal",           icon: CheckCircle,   cls: "bg-success/10 text-success border-success/20" },
  atencao: { label: "Em Atenção",        icon: AlertTriangle, cls: "bg-warning/10 text-warning border-warning/20" },
  critico: { label: "Abaixo do Mínimo", icon: TrendingDown,  cls: "bg-destructive/10 text-destructive border-destructive/20" },
  zerado:  { label: "Sem Estoque",       icon: XCircle,       cls: "bg-destructive/10 text-destructive border-destructive/20" },
};

function SituacaoEstoqueBadge({ situacao }: { situacao: SituacaoEstoque }) {
  const cfg = situacaoConfig[situacao];
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`text-xs font-medium gap-1 ${cfg.cls}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

const tipoMovConfig: Record<string, { label: string; status: string }> = {
  entrada:          { label: "Entrada",           status: "confirmado" },
  saida:            { label: "Saída",             status: "cancelado" },
  ajuste:           { label: "Ajuste Manual",     status: "pendente" },
  transferencia:    { label: "Transferência",     status: "pendente" },
  reserva:          { label: "Reserva",           status: "pendente" },
  liberacao_reserva:{ label: "Lib. Reserva",      status: "confirmado" },
  estorno:          { label: "Estorno",           status: "pendente" },
  inventario:       { label: "Inventário",        status: "pendente" },
  perda_avaria:     { label: "Perda / Avaria",    status: "cancelado" },
};

const Estoque = () => {
  const { data, loading, create } = useSupabaseCrud<Movimento>({
    table: "estoque_movimentos", select: "*, produtos(nome, sku)", hasAtivo: false,
  });
  const produtosCrud = useSupabaseCrud<any>({ table: "produtos" });
  const [activeTab, setActiveTab] = useState("saldos");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<Movimento | null>(null);
  const [posicaoDrawerOpen, setPosicaoDrawerOpen] = useState(false);
  const [selectedPosicao, setSelectedPosicao] = useState<ProdutoPosicao | null>(null);
  const [form, setForm] = useState({ produto_id: "", tipo: "ajuste", quantidade: 0, motivo: "" });
  const [saving, setSaving] = useState(false);
  // Saldos filters
  const [searchPosicao, setSearchPosicao] = useState("");
  const [situacaoFilters, setSituacaoFilters] = useState<string[]>([]);
  // Movimentações filters
  const [searchMovimentacao, setSearchMovimentacao] = useState("");
  const [tipoFilters, setTipoFilters] = useState<string[]>([]);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  // Produtos abaixo do mínimo
  const abaixoMinimo = useMemo(() =>
    produtosCrud.data.filter((p: any) => p.ativo && p.estoque_minimo > 0 && Number(p.estoque_atual || 0) <= Number(p.estoque_minimo)),
    [produtosCrud.data]
  );

  // KPIs operacionais
  const kpis = useMemo(() => {
    const ativos = produtosCrud.data.filter((p: any) => p.ativo);
    const totalItens = ativos.length;
    const valorEstoque = ativos.reduce((s: number, p: any) => s + (Number(p.estoque_atual || 0) * Number(p.preco_venda || 0)), 0);
    const itensZerados = ativos.filter((p: any) => Number(p.estoque_atual || 0) <= 0).length;
    const itensCriticos = abaixoMinimo.length + itensZerados;
    const ajustesManuais = data.filter((m) => m.tipo === "ajuste").length;
    return { totalItens, valorEstoque, itensCriticos, ajustesManuais };
  }, [produtosCrud.data, abaixoMinimo, data]);

  // Posição atual / Saldos
  const posicaoAtual = useMemo(() => {
    const q = searchPosicao.toLowerCase();
    return (produtosCrud.data as ProdutoPosicao[])
      .filter((p) => p.ativo !== false)
      .filter((p) => Number(p.estoque_atual || 0) !== 0 || Number(p.estoque_minimo || 0) > 0)
      .filter((p) => {
        if (!q) return true;
        return p.nome?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.codigo_interno?.toLowerCase().includes(q);
      })
      .filter((p) => {
        if (!situacaoFilters.length) return true;
        return situacaoFilters.includes(getSituacao(p));
      });
  }, [produtosCrud.data, searchPosicao, situacaoFilters]);

  // Movimentações filtradas
  const filteredData = useMemo(() => {
    const q = searchMovimentacao.toLowerCase();
    return data.filter((m) => {
      if (tipoFilters.length > 0 && !tipoFilters.includes(m.tipo)) return false;
      if (dataInicio && m.created_at < dataInicio) return false;
      if (dataFim && m.created_at > dataFim + "T23:59:59") return false;
      if (q) {
        const nome = (m as any).produtos?.nome?.toLowerCase() || "";
        const sku = (m as any).produtos?.sku?.toLowerCase() || "";
        if (!nome.includes(q) && !sku.includes(q)) return false;
      }
      return true;
    });
  }, [data, tipoFilters, dataInicio, dataFim, searchMovimentacao]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.produto_id || !form.quantidade) { toast.error("Produto e quantidade são obrigatórios"); return; }
    if (!form.motivo.trim()) { toast.error("Motivo é obrigatório para ajuste manual"); return; }
    setSaving(true);
    try {
      const produto = produtosCrud.data.find((p: any) => p.id === form.produto_id);
      const saldo_anterior = Number(produto?.estoque_atual || 0);
      const qty = form.tipo === "saida" ? -form.quantidade : form.tipo === "ajuste" ? form.quantidade - saldo_anterior : form.quantidade;
      const saldo_atual = form.tipo === "ajuste" ? form.quantidade : saldo_anterior + qty;

      await create({ ...form, quantidade: Math.abs(qty), saldo_anterior, saldo_atual, documento_tipo: "manual" });
      await supabase.from("produtos").update({ estoque_atual: saldo_atual }).eq("id", form.produto_id);
      produtosCrud.fetchData();
      setForm({ produto_id: "", tipo: "ajuste", quantidade: 0, motivo: "" });
      toast.success("Ajuste registrado com sucesso");
    } catch (err) {
      console.error('[estoque] erro ao salvar:', err);
      toast.error("Erro ao registrar movimentação de estoque");
    }
    setSaving(false);
  };

  // Saldos filter chips
  const saldosActiveFilters = useMemo((): FilterChip[] => {
    return situacaoFilters.map((s) => ({
      key: "situacao",
      label: "Situação",
      value: [s],
      displayValue: situacaoConfig[s as SituacaoEstoque]?.label ?? s,
    }));
  }, [situacaoFilters]);

  const handleRemoveSaldoFilter = (key: string, value?: string) => {
    if (key === "situacao") setSituacaoFilters((prev) => prev.filter((v) => v !== value));
  };

  // Movimentações filter chips
  const movActiveFilters = useMemo((): FilterChip[] => {
    return tipoFilters.map((f) => ({
      key: "tipo",
      label: "Tipo",
      value: [f],
      displayValue: tipoMovConfig[f]?.label ?? f,
    }));
  }, [tipoFilters]);

  const handleRemoveMovFilter = (key: string, value?: string) => {
    if (key === "tipo") setTipoFilters((prev) => prev.filter((v) => v !== value));
  };

  const tipoOptions: MultiSelectOption[] = [
    { label: "Entrada", value: "entrada" },
    { label: "Saída", value: "saida" },
    { label: "Ajuste Manual", value: "ajuste" },
    { label: "Transferência", value: "transferencia" },
    { label: "Reserva", value: "reserva" },
    { label: "Lib. de Reserva", value: "liberacao_reserva" },
    { label: "Estorno", value: "estorno" },
    { label: "Inventário", value: "inventario" },
    { label: "Perda/Avaria", value: "perda_avaria" },
  ];

  const situacaoOptions: MultiSelectOption[] = [
    { label: "Normal", value: "normal" },
    { label: "Em Atenção", value: "atencao" },
    { label: "Abaixo do Mínimo", value: "critico" },
    { label: "Sem Estoque", value: "zerado" },
  ];

  const origemLabel = (m: Movimento) => {
    if (!m.documento_tipo) return "—";
    const labels: Record<string, string> = { manual: "Manual", fiscal: "Fiscal", compra: "Compra", venda: "Venda", ajuste: "Ajuste", estorno_fiscal: "Estorno", pedido: "Pedido", pedido_compra: "Compra", nota_fiscal: "Nota Fiscal" };
    return labels[m.documento_tipo] || m.documento_tipo;
  };

  const movColumns = [
    { key: "produto", label: "Produto", render: (m: Movimento) => (
      <div><span className="font-medium">{(m as any).produtos?.nome || "—"}</span><br/><span className="text-xs text-muted-foreground font-mono">{(m as any).produtos?.sku}</span></div>
    )},
    { key: "tipo", label: "Tipo", render: (m: Movimento) => {
      const cfg = tipoMovConfig[m.tipo] ?? { label: m.tipo, status: "pendente" };
      return <StatusBadge status={cfg.status} label={cfg.label} />;
    }},
    { key: "quantidade", label: "Qtd", render: (m: Movimento) => {
      const neg = m.tipo === "saida" || m.tipo === "perda_avaria";
      return <span className={`font-mono font-semibold ${neg ? "text-destructive" : "text-success"}`}>{neg ? "-" : "+"}{formatNumber(m.quantidade)}</span>;
    }},
    { key: "saldo_atual", label: "Saldo", render: (m: Movimento) => <span className="font-semibold font-mono">{formatNumber(m.saldo_atual)}</span> },
    { key: "origem", label: "Origem", render: origemLabel },
    { key: "motivo", label: "Motivo / Observação", render: (m: Movimento) => m.motivo || <span className="text-muted-foreground">—</span> },
    { key: "created_at", label: "Data", render: (m: Movimento) => new Date(m.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) },
  ];

  const posColumns = [
    { key: "nome", label: "Produto", render: (p: ProdutoPosicao) => (
      <div><span className="font-medium">{p.nome}</span>{p.sku && <><br/><span className="text-xs text-muted-foreground font-mono">{p.sku}</span></>}</div>
    )},
    { key: "unidade", label: "Unid.", render: (p: ProdutoPosicao) => p.unidade_medida || "UN" },
    { key: "estoque_atual", label: "Estoque Atual", render: (p: ProdutoPosicao) => <span className="font-semibold font-mono">{formatNumber(Number(p.estoque_atual || 0))}</span> },
    { key: "estoque_reservado", label: "Reservado", render: (p: ProdutoPosicao) => <span className="font-mono text-muted-foreground">{formatNumber(Number(p.estoque_reservado || 0))}</span>, hidden: true },
    { key: "estoque_disponivel", label: "Disponível", render: (p: ProdutoPosicao) => <span className="font-mono font-semibold">{formatNumber(Number(p.estoque_atual || 0) - Number(p.estoque_reservado || 0))}</span> },
    { key: "estoque_minimo", label: "Mínimo", render: (p: ProdutoPosicao) => <span className="font-mono text-muted-foreground">{p.estoque_minimo > 0 ? formatNumber(p.estoque_minimo) : "—"}</span> },
    { key: "situacao", label: "Situação", render: (p: ProdutoPosicao) => <SituacaoEstoqueBadge situacao={getSituacao(p)} /> },
    { key: "valor_estoque", label: "Valor Est.", render: (p: ProdutoPosicao) => <span className="font-mono font-medium">{formatCurrency(Number(p.estoque_atual || 0) * Number(p.preco_venda || 0))}</span>, hidden: true },
  ];

  // Preview do ajuste para o produto selecionado
  const produtoSelecionado = produtosCrud.data.find((p: any) => p.id === form.produto_id);
  const saldoAtualPreview = Number(produtoSelecionado?.estoque_atual || 0);
  const qty = isNaN(form.quantidade) ? 0 : form.quantidade;
  const novoSaldoPreview = form.tipo === "ajuste"
    ? qty
    : form.tipo === "saida"
    ? saldoAtualPreview - qty
    : saldoAtualPreview + qty;

  return (
    <AppLayout>
      <ModulePage
        title="Estoque"
        subtitle="Central de saúde do estoque — saldos, rastreabilidade e ajustes controlados"
        headerActions={
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setActiveTab("ajuste")}>
            <SlidersHorizontal className="h-4 w-4" />
            Ajuste Manual
          </Button>
        }
        summaryCards={
          <>
            <SummaryCard
              title="Itens em Estoque"
              value={formatNumber(kpis.totalItens)}
              icon={Package}
              variation="produtos ativos"
              variationType="neutral"
            />
            <SummaryCard
              title="Valor em Estoque"
              value={formatCurrency(kpis.valorEstoque)}
              icon={DollarSign}
              variation="R$ × quantidade"
              variationType="neutral"
              variant="info"
            />
            <SummaryCard
              title="Itens Críticos"
              value={formatNumber(kpis.itensCriticos)}
              icon={TrendingDown}
              variation={kpis.itensCriticos > 0 ? "exigem atenção" : "estoque saudável"}
              variationType={kpis.itensCriticos > 0 ? "negative" : "positive"}
              variant={kpis.itensCriticos > 0 ? "danger" : undefined}
              onClick={kpis.itensCriticos > 0 ? () => { setActiveTab("saldos"); setSituacaoFilters(["critico", "zerado"]); } : undefined}
            />
            <SummaryCard
              title="Ajustes Manuais"
              value={formatNumber(kpis.ajustesManuais)}
              icon={RotateCcw}
              variation="registros no histórico"
              variationType="neutral"
              variant="warning"
            />
          </>
        }
      >

        {abaixoMinimo.length > 0 && (
          <Card className="mb-4 border-destructive/50 bg-destructive/5">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2 text-destructive text-sm font-medium mb-1">
                <AlertTriangle className="w-4 h-4" /> {abaixoMinimo.length} produto(s) abaixo do estoque mínimo
              </div>
              <div className="flex flex-wrap gap-2">
                {abaixoMinimo.slice(0, 8).map((p: any) => (
                  <button
                    key={p.id}
                    className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium hover:bg-destructive/20 transition-colors"
                    onClick={() => { setSelectedPosicao(p as ProdutoPosicao); setPosicaoDrawerOpen(true); }}
                  >
                    {p.nome} ({p.estoque_atual}/{p.estoque_minimo})
                  </button>
                ))}
                {abaixoMinimo.length > 8 && <span className="text-xs text-muted-foreground">+{abaixoMinimo.length - 8} mais</span>}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="saldos" className="gap-1.5">
              <Package className="h-3.5 w-3.5" />Saldos
            </TabsTrigger>
            <TabsTrigger value="movimentacoes" className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />Movimentações
            </TabsTrigger>
            <TabsTrigger value="ajuste" className="gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" />Ajuste Manual
            </TabsTrigger>
          </TabsList>

          {/* ── ABA SALDOS ─────────────────────────────────────── */}
          <TabsContent value="saldos">
            <div className="mb-2">
              <p className="text-xs text-muted-foreground">Estado atual do estoque — posição de cada item, criticidade e valor.</p>
            </div>
            <AdvancedFilterBar
              searchValue={searchPosicao}
              onSearchChange={setSearchPosicao}
              searchPlaceholder="Buscar produto por nome, SKU ou código..."
              activeFilters={saldosActiveFilters}
              onRemoveFilter={handleRemoveSaldoFilter}
              onClearAll={() => setSituacaoFilters([])}
              count={posicaoAtual.length}
            >
              <MultiSelect
                options={situacaoOptions}
                selected={situacaoFilters}
                onChange={setSituacaoFilters}
                placeholder="Situação"
                className="w-[180px]"
              />
            </AdvancedFilterBar>
            <DataTable
              columns={posColumns}
              data={posicaoAtual}
              loading={produtosCrud.loading}
              moduleKey="estoque-saldos"
              showColumnToggle={true}
              onView={(p) => { setSelectedPosicao(p as ProdutoPosicao); setPosicaoDrawerOpen(true); }}
              emptyTitle="Nenhum item encontrado"
              emptyDescription="Ajuste os filtros ou verifique se há produtos com estoque ou mínimo cadastrado."
            />
          </TabsContent>

          {/* ── ABA MOVIMENTAÇÕES ──────────────────────────────── */}
          <TabsContent value="movimentacoes">
            <div className="mb-2">
              <p className="text-xs text-muted-foreground">Auditoria rápida — entradas, saídas, ajustes e origem de cada movimentação.</p>
            </div>
            <AdvancedFilterBar
              searchValue={searchMovimentacao}
              onSearchChange={setSearchMovimentacao}
              searchPlaceholder="Buscar produto por nome ou SKU..."
              activeFilters={movActiveFilters}
              onRemoveFilter={handleRemoveMovFilter}
              onClearAll={() => { setTipoFilters([]); setSearchMovimentacao(""); setDataInicio(""); setDataFim(""); }}
              count={filteredData.length}
            >
              <MultiSelect
                options={tipoOptions}
                selected={tipoFilters}
                onChange={setTipoFilters}
                placeholder="Tipo de Movimento"
                className="w-[200px]"
              />
              <div className="flex items-end gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">De</Label>
                  <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="h-9 w-36 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Até</Label>
                  <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-9 w-36 text-xs" />
                </div>
                {(dataInicio || dataFim) && (
                  <Button size="sm" variant="ghost" className="h-9 text-xs" onClick={() => { setDataInicio(""); setDataFim(""); }}>Limpar Datas</Button>
                )}
              </div>
            </AdvancedFilterBar>
            <DataTable
              columns={movColumns}
              data={filteredData}
              loading={loading}
              moduleKey="estoque-movimentacoes"
              showColumnToggle={true}
              onView={(m) => { setSelected(m); setDrawerOpen(true); }}
              emptyTitle="Nenhuma movimentação encontrada"
              emptyDescription="Ajuste os filtros de tipo, data ou busque por produto."
            />
          </TabsContent>

          {/* ── ABA AJUSTE MANUAL ─────────────────────────────── */}
          <TabsContent value="ajuste">
            <div className="max-w-lg space-y-5">
              {/* Aviso de operação sensível */}
              <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 flex gap-3">
                <ShieldAlert className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-warning mb-1">Operação administrativa controlada</p>
                  <p className="text-xs text-muted-foreground">
                    Ajustes manuais alteram diretamente o saldo do estoque e geram rastreabilidade.
                    Use apenas quando houver necessidade real e registre o motivo com clareza.
                    Todas as operações são registradas com responsável e data.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Produto *</Label>
                  <Select value={form.produto_id} onValueChange={(v) => setForm({ ...form, produto_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o produto..." /></SelectTrigger>
                    <SelectContent>
                      {produtosCrud.data.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                          {p.sku && <span className="ml-1 text-muted-foreground font-mono text-xs">({p.sku})</span>}
                          <span className="ml-2 text-muted-foreground text-xs">Est: {formatNumber(p.estoque_atual)}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Preview do saldo atual */}
                {produtoSelecionado && (
                  <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-center gap-6 text-sm">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">Saldo Atual</p>
                      <p className="font-bold font-mono text-base">{formatNumber(saldoAtualPreview)}</p>
                    </div>
                    {form.quantidade > 0 && (
                      <>
                        <ArrowDownCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">Novo Saldo</p>
                          <p className={`font-bold font-mono text-base ${novoSaldoPreview < 0 ? "text-destructive" : novoSaldoPreview === 0 ? "text-warning" : "text-success"}`}>
                            {formatNumber(novoSaldoPreview)}
                          </p>
                        </div>
                        {novoSaldoPreview < 0 && (
                          <p className="text-xs text-destructive font-medium flex items-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5" />Saldo ficará negativo
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Operação *</Label>
                    <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entrada">Entrada — adicionar ao saldo</SelectItem>
                        <SelectItem value="saida">Saída — reduzir do saldo</SelectItem>
                        <SelectItem value="ajuste">Ajuste — definir novo saldo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{form.tipo === "ajuste" ? "Novo Saldo *" : "Quantidade *"}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.quantidade || ""}
                      onChange={(e) => setForm({ ...form, quantidade: Number(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>
                    Motivo / Justificativa *{" "}
                    <span className="text-xs font-normal text-muted-foreground">(obrigatório — será registrado no histórico)</span>
                  </Label>
                  <Textarea
                    value={form.motivo}
                    onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                    placeholder="Descreva o motivo do ajuste (ex: contagem física, correção de lançamento, perda identificada...)"
                    rows={3}
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setForm({ produto_id: "", tipo: "ajuste", quantidade: 0, motivo: "" })}
                  >
                    Limpar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Registrando..." : "Registrar Ajuste"}
                  </Button>
                </div>
              </form>
            </div>
          </TabsContent>
        </Tabs>

      </ModulePage>

      <EstoqueMovimentacaoDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelected(null); }}
        movimentacao={selected}
      />

      <EstoquePosicaoDrawer
        open={posicaoDrawerOpen}
        onClose={() => setPosicaoDrawerOpen(false)}
        produto={selectedPosicao}
        movimentos={data}
      />
    </AppLayout>
  );
};

export default Estoque;
