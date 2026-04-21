import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, AlertTriangle, Archive, FileText, Edit, Trash2, ShoppingCart, Layers, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { PrecosEspeciaisTab } from "@/components/precos/PrecosEspeciaisTab";
import { RelationalLink } from "@/components/ui/RelationalLink";
import { useRelationalNavigation } from "@/contexts/RelationalNavigationContext";
import { usePublishDrawerSlots } from "@/contexts/RelationalDrawerSlotsContext";
import { useDetailFetch } from "@/hooks/useDetailFetch";
import { useDetailActions } from "@/hooks/useDetailActions";
import { useInvalidateAfterMutation } from "@/hooks/useInvalidateAfterMutation";
import { getUserFriendlyError } from "@/utils/errorMessages";
import { DrawerSummaryCard, DrawerSummaryGrid } from "@/components/ui/DrawerSummaryCard";
import { RecordIdentityCard } from "@/components/ui/RecordIdentityCard";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { DetailLoading, DetailError, DetailEmpty } from "@/components/ui/DetailStates";
import type {
  HistoricoNfItemRow,
  HistoricoNfVendaRow,
  ComposicaoItemRow,
  MovimentoEstoqueRow,
  ProdutoFornecedorViewRow,
} from "@/types/cadastros";

/** Raw shape returned by the produto_composicoes join query */
interface ComposicaoQueryRow {
  quantidade: number;
  ordem: number | null;
  produtos: { id: string; nome: string; sku: string; preco_custo: number | null } | null;
}

interface Props {
  id: string;
}

interface ProdutoDetail {
  produto: Tables<"produtos">;
  grupoNome: string | null;
  historicoCompras: HistoricoNfItemRow[];
  historicoVendas: HistoricoNfVendaRow[];
  composicao: ComposicaoItemRow[];
  movimentos: MovimentoEstoqueRow[];
  fornecedoresProd: ProdutoFornecedorViewRow[];
}

export function ProdutoView({ id }: Props) {
  const navigate = useNavigate();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const { pushView, clearStack } = useRelationalNavigation();
  const { run, locked } = useDetailActions();
  const invalidate = useInvalidateAfterMutation();

  const { data, loading, error } = useDetailFetch<ProdutoDetail>(id, async (pId, signal) => {
    const { data: p, error: pError } = await supabase
      .from("produtos")
      .select("*")
      .eq("id", pId)
      .abortSignal(signal)
      .maybeSingle();
    if (pError) throw pError;
    if (!p) return null;

    // A4 fix: settled em vez de all — falha em uma query não silencia as outras.
    const [comprasRes, vendasRes, compRes, movRes, fornRes, grupoRes] = await Promise.allSettled([
      supabase.from("notas_fiscais_itens")
        .select("quantidade, valor_unitario, notas_fiscais!inner(id, numero, tipo, data_emissao, fornecedores(id, nome_razao_social))")
        .eq("produto_id", p.id)
        .in("notas_fiscais.tipo", ["entrada", "compra"])
        .order("data_emissao", { foreignTable: "notas_fiscais", ascending: false })
        .abortSignal(signal).limit(30),
      supabase.from("notas_fiscais_itens")
        .select("quantidade, valor_unitario, notas_fiscais!inner(id, numero, tipo, data_emissao, clientes(id, nome_razao_social))")
        .eq("produto_id", p.id)
        .in("notas_fiscais.tipo", ["saida", "venda"])
        .order("data_emissao", { foreignTable: "notas_fiscais", ascending: false })
        .abortSignal(signal).limit(30),
      p.eh_composto ? supabase.from("produto_composicoes")
        .select("quantidade, ordem, produtos:produto_filho_id(id, nome, sku, preco_custo)")
        .eq("produto_pai_id", p.id).abortSignal(signal).order("ordem")
        : Promise.resolve({ data: [] }),
      supabase.from("estoque_movimentos")
        .select("tipo, quantidade, motivo, created_at, saldo_anterior, saldo_atual")
        .eq("produto_id", p.id).abortSignal(signal).order("created_at", { ascending: false }).limit(20),
      supabase.from("produtos_fornecedores")
        .select("preco_compra, lead_time_dias, referencia_fornecedor, eh_principal, unidade_fornecedor, fornecedores:fornecedor_id(id, nome_razao_social)")
        .eq("produto_id", p.id).abortSignal(signal),
      p.grupo_id
        ? supabase.from("grupos_produto").select("nome").eq("id", p.grupo_id).abortSignal(signal).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const pickData = <T,>(r: PromiseSettledResult<unknown>, fallback: T): T => {
      if (r.status !== "fulfilled") return fallback;
      const v = r.value as { data?: T | null } | null;
      return (v?.data ?? fallback) as T;
    };

    const comprasData = pickData(comprasRes, [] as unknown[]);
    const vendasData = pickData(vendasRes, [] as unknown[]);
    const compData = pickData(compRes, [] as unknown[]);
    const movData = pickData(movRes, [] as unknown[]);
    const fornData = pickData(fornRes, [] as unknown[]);
    const grupoData = pickData(grupoRes, null as Record<string, unknown> | null);

    return {
      produto: p,
      grupoNome: (grupoData as Record<string, unknown> | null)?.nome as string ?? null,
      historicoCompras: comprasData as HistoricoNfItemRow[],
      historicoVendas: vendasData as HistoricoNfVendaRow[],
      composicao: (compData as ComposicaoQueryRow[]).map((c) => ({
        id: c.produtos?.id ?? null,
        nome: c.produtos?.nome ?? null,
        sku: c.produtos?.sku ?? null,
        preco_custo: c.produtos?.preco_custo ?? null,
        quantidade: c.quantidade,
        ordem: c.ordem,
      })),
      movimentos: movData as MovimentoEstoqueRow[],
      fornecedoresProd: fornData as ProdutoFornecedorViewRow[],
    };
  });

  const selected = data?.produto ?? null;
  const grupoNome = data?.grupoNome ?? null;
  const historico = data?.historico ?? [];
  const composicao = data?.composicao ?? [];
  const movimentos = data?.movimentos ?? [];
  const fornecedoresProd = data?.fornecedoresProd ?? [];

  const selectedMargem = selected && (selected.preco_custo || 0) > 0 ? (selected.preco_venda / (selected.preco_custo || 1) - 1) * 100 : 0;
  const lucroBruto = selected ? selected.preco_venda - (selected.preco_custo || 0) : 0;
  const custoCompostoView = composicao.reduce((s, c) => s + c.quantidade * (c.preco_custo || 0), 0);
  const estoqueValor = selected ? (selected.estoque_atual || 0) * (selected.preco_custo || 0) : 0;
  const estoqueBaixo = selected ? Number(selected.estoque_atual) <= Number(selected.estoque_minimo) && Number(selected.estoque_minimo) > 0 : false;
  const fiscalCompleto = !!(selected?.ncm && selected?.cst && selected?.cfop_padrao);
  const fornecedorPrincipal = fornecedoresProd.find((f) => f.eh_principal);
  const ultimaEntrada = movimentos.find((m) => m.tipo === 'entrada');
  const ultimaSaida = movimentos.find((m) => m.tipo === 'saida');

  // ── PUBLISH DRAWER SLOTS (header padronizado via DrawerHeaderShell) ──
  usePublishDrawerSlots(`produto:${id}`, {
    breadcrumb: selected?.sku ? `Produto · ${selected.sku}` : undefined,
    summary: selected ? (
      <RecordIdentityCard
        icon={Package}
        title={selected.nome}
        meta={
          <>
            {selected.sku && <span className="font-mono">SKU: {selected.sku}</span>}
            {selected.codigo_interno && <span className="font-mono">Cód: {selected.codigo_interno}</span>}
          </>
        }
        badges={
          <>
            <StatusBadge status={selected.ativo ? "ativo" : "inativo"} />
            <StatusBadge status={selected.eh_composto ? "composto" : "simples"} />
            <StatusBadge status={selected.tipo_item || "produto"} />
            {grupoNome && (
              <span className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground font-medium">
                <Layers className="h-2.5 w-2.5" />
                {grupoNome}
              </span>
            )}
          </>
        }
      />
    ) : undefined,
    actions: selected ? (
      <>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          aria-label="Editar produto"
          onClick={() => {
            navigate(`/produtos?editId=${id}`);
            window.setTimeout(() => clearStack(), 0);
          }}
        >
          <Edit className="h-3.5 w-3.5" /> Editar
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              aria-label="Excluir produto"
              onClick={() => setDeleteConfirmOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </Button>
          </TooltipTrigger>
          <TooltipContent>Excluir produto</TooltipContent>
        </Tooltip>
      </>
    ) : undefined,
  });

  if (loading) return <DetailLoading />;
  if (error) return <DetailError message={error.message} />;
  if (!selected) return <DetailEmpty title="Produto não encontrado" icon={Package} />;

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <DrawerSummaryCard label="Venda" value={formatCurrency(selected.preco_venda)} align="center" />
        <DrawerSummaryCard label="Custo" value={formatCurrency(selected.preco_custo || 0)} align="center" />
        <DrawerSummaryCard
          label="Lucro Bruto"
          value={formatCurrency(lucroBruto)}
          tone={lucroBruto > 0 ? "success" : lucroBruto < 0 ? "destructive" : "neutral"}
          align="center"
        />
        <DrawerSummaryCard
          label="Margem"
          value={(selected.preco_custo || 0) > 0 ? `${selectedMargem.toFixed(1)}%` : "—"}
          tone={selectedMargem > 0 ? "success" : selectedMargem < 0 ? "destructive" : "neutral"}
          align="center"
        />
        <DrawerSummaryCard
          label="Estoque"
          value={`${selected.estoque_atual ?? 0} ${selected.unidade_medida}`}
          tone={estoqueBaixo ? "destructive" : "neutral"}
          hint={estoqueBaixo ? "Abaixo do mínimo" : undefined}
          align="center"
        />
      </div>

      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="w-full grid grid-cols-7">
          <TabsTrigger value="geral" className="text-xs px-0.5">Geral</TabsTrigger>
          <TabsTrigger value="compras" className="text-xs px-0.5">Compras</TabsTrigger>
          <TabsTrigger value="preco" className="text-xs px-0.5">Preço</TabsTrigger>
          <TabsTrigger value="estoque" className="text-xs px-0.5">Estoque</TabsTrigger>
          <TabsTrigger value="fiscal" className="text-xs px-0.5">Fiscal</TabsTrigger>
          <TabsTrigger value="precos" className="text-xs px-0.5">Espec.</TabsTrigger>
          <TabsTrigger value="historico" className="text-xs px-0.5">Hist.</TabsTrigger>
        </TabsList>

        {/* Tab: Geral */}
        <TabsContent value="geral" className="space-y-3 mt-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">SKU</span>
              <p className="font-mono text-sm">{selected.sku || "—"}</p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Código</span>
              <p className="font-mono text-sm">{selected.codigo_interno || "—"}</p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Unidade</span>
              <p className="text-sm">{selected.unidade_medida}</p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Peso</span>
              <p className="font-mono text-sm">{selected.peso ? `${selected.peso} kg` : "—"}</p>
            </div>
            {grupoNome && (
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Grupo</span>
                <p className="text-sm">{grupoNome}</p>
              </div>
            )}
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Tipo</span>
              <p className="text-sm">{selected.eh_composto ? "Composto" : "Simples"}</p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Classificação</span>
            <p className="text-sm capitalize">{selected.tipo_item || "produto"}</p>
            </div>
          </div>
          {selected.descricao && (
            <div className="pt-1 border-t">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Descrição</span>
              <p className="text-sm mt-0.5 text-foreground/80">{selected.descricao}</p>
            </div>
          )}
          {selected.eh_composto && composicao.length > 0 && (
            <div className="border-t pt-3">
              <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                <Package className="w-3.5 h-3.5" /> Composição
              </h4>
              <div className="space-y-1">
                {composicao.map((c, idx) => (
                  <div key={idx} className="flex justify-between text-sm py-1.5 border-b last:border-b-0">
                    <button onClick={() => pushView("produto", c.id)} className="text-left text-primary font-medium hover:underline flex items-center gap-1">
                      {c.nome} <span className="text-muted-foreground font-mono text-[10px]">({c.sku})</span>
                    </button>
                    <div className="text-right text-xs">
                      <span className="font-mono">× {c.quantidade}</span>
                      {c.preco_custo != null && <p className="text-muted-foreground">{formatCurrency(c.preco_custo * c.quantidade)}</p>}
                    </div>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold pt-2">
                  <span>Custo Composto</span>
                  <span className="font-mono text-primary">{formatCurrency(custoCompostoView)}</span>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab: Compras / Fornecedores */}
        <TabsContent value="compras" className="space-y-3 mt-3">
          <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <ShoppingCart className="w-3.5 h-3.5" /> Fornecedores Vinculados
          </h4>
          {fornecedoresProd.length === 0 ? (
            <EmptyState icon={ShoppingCart} title="Nenhum fornecedor vinculado" description="Nenhum fornecedor vinculado a este produto" />
          ) : (
            <div className="space-y-2">
            {fornecedoresProd.map((f, idx: number) => (
                <div key={idx} className={`rounded-lg border p-3 bg-card hover:bg-muted/30 transition-colors ${f.eh_principal ? "border-primary/30" : ""}`}>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <RelationalLink onClick={() => pushView("fornecedor", f.fornecedores?.id)} className="font-medium text-sm">
                      {f.fornecedores?.nome_razao_social || "—"}
                    </RelationalLink>
                    {f.eh_principal && (
                      <span className="inline-flex items-center text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold">Principal</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {f.referencia_fornecedor && (
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Ref. Fornecedor</p>
                        <p className="font-mono text-xs">{f.referencia_fornecedor}</p>
                      </div>
                    )}
                    {f.unidade_fornecedor && (
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Unidade</p>
                        <p className="text-xs">{f.unidade_fornecedor}</p>
                      </div>
                    )}
                    {f.lead_time_dias != null && (
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Lead Time</p>
                        <p className="text-xs font-mono">{f.lead_time_dias}d</p>
                      </div>
                    )}
                    {f.preco_compra != null && (
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Preço Compra</p>
                        <p className="text-xs font-mono font-semibold">{formatCurrency(f.preco_compra)}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        {historico.filter((h) => h.notas_fiscais?.tipo === 'entrada' || h.notas_fiscais?.tipo === 'compra').length > 0 && (
            <div className="border-t pt-3">
              <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> Últimas Compras
              </h4>
              <div className="space-y-1.5">
                {historico
                  .filter((h) => h.notas_fiscais?.tipo === 'entrada' || h.notas_fiscais?.tipo === 'compra')
                  .slice(0, 10)
                  .map((h, idx: number) => (
                    <div key={idx} className="flex justify-between text-xs py-1.5 border-b last:border-b-0">
                      <div>
                        <RelationalLink onClick={() => pushView("nota_fiscal", h.notas_fiscais?.id)} mono className="text-xs">{h.notas_fiscais?.numero}</RelationalLink>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[150px]">{h.notas_fiscais?.fornecedores?.nome_razao_social || "—"}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono">{formatCurrency(h.valor_unitario)}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(h.notas_fiscais?.data_emissao)}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab: Preço */}
        <TabsContent value="preco" className="space-y-3 mt-3">
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Custo</span>
                <p className="font-mono font-semibold text-lg">{formatCurrency(selected.preco_custo || 0)}</p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Margem</span>
                <p className={`font-mono font-semibold text-lg ${selectedMargem > 0 ? "text-success" : selectedMargem < 0 ? "text-destructive" : ""}`}>
                  {(selected.preco_custo || 0) > 0 ? `${selectedMargem.toFixed(1)}%` : "—"}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Venda</span>
                <p className="font-mono font-semibold text-lg text-primary">{formatCurrency(selected.preco_venda)}</p>
              </div>
            </div>
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground text-xs">Lucro Bruto</span>
                <span className={`font-mono font-semibold text-sm ${lucroBruto > 0 ? "text-primary" : "text-destructive"}`}>{formatCurrency(lucroBruto)}</span>
              </div>
              {fornecedorPrincipal?.preco_compra != null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground text-xs">Últ. Custo (Fornec. Principal)</span>
                  <span className="font-mono text-xs">{formatCurrency(fornecedorPrincipal.preco_compra)}</span>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab: Estoque */}
        <TabsContent value="estoque" className="space-y-3 mt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-lg border p-3 text-center ${estoqueBaixo ? "border-destructive/40 bg-destructive/5" : ""}`}>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Estoque Atual</p>
              <p className={`text-2xl font-bold font-mono ${estoqueBaixo ? "text-destructive" : ""}`}>{selected.estoque_atual ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">{selected.unidade_medida}</p>
              {estoqueBaixo && (
                <div className="flex items-center justify-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3 text-destructive" />
                  <p className="text-[9px] text-destructive font-semibold">Abaixo do mínimo</p>
                </div>
              )}
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Estoque Mínimo</p>
              <p className="text-2xl font-bold font-mono">{selected.estoque_minimo ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">{selected.unidade_medida}</p>
            </div>
          </div>
          {estoqueValor > 0 && (
            <div className="rounded-lg border bg-card p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Valor em Estoque</span>
              </div>
              <span className="font-mono font-semibold text-sm">{formatCurrency(estoqueValor)}</span>
            </div>
          )}
          {(ultimaEntrada || ultimaSaida) && (
            <div className="grid grid-cols-2 gap-3">
              {ultimaEntrada && (
                <div className="rounded-lg border p-3 space-y-0.5">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Última Entrada</p>
                  <p className="font-mono font-semibold text-sm text-success">+{ultimaEntrada.quantidade}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDate(ultimaEntrada.created_at)}</p>
                  {ultimaEntrada.motivo && <p className="text-[9px] text-muted-foreground truncate">{ultimaEntrada.motivo}</p>}
                </div>
              )}
              {ultimaSaida && (
                <div className="rounded-lg border p-3 space-y-0.5">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Última Saída</p>
                  <p className="font-mono font-semibold text-sm text-destructive">-{ultimaSaida.quantidade}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDate(ultimaSaida.created_at)}</p>
                  {ultimaSaida.motivo && <p className="text-[9px] text-muted-foreground truncate">{ultimaSaida.motivo}</p>}
                </div>
              )}
            </div>
          )}
          {movimentos.length > 0 && (
            <div>
              <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                <Archive className="w-3.5 h-3.5" /> Últimas Movimentações
              </h4>
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {movimentos.map((m, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-1.5 border-b last:border-b-0 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${m.tipo === 'entrada' ? 'bg-success/10 text-success' : m.tipo === 'saida' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}`}>
                        {m.tipo === 'entrada' ? '↑' : m.tipo === 'saida' ? '↓' : '↔'} {m.quantidade}
                      </span>
                      <span className="text-muted-foreground text-[10px]">{m.motivo || m.tipo}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground">{formatDate(m.created_at)}</span>
                      {m.saldo_atual != null && <p className="text-[9px] text-muted-foreground">Saldo: {m.saldo_atual}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab: Fiscal */}
        <TabsContent value="fiscal" className="space-y-3 mt-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Dados Fiscais</h4>
            {fiscalCompleto ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-success inline-block" /> Cadastro Completo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-warning bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-full font-medium">
                <AlertTriangle className="h-2.5 w-2.5" /> Cadastro Incompleto
              </span>
            )}
          </div>
          <div className="space-y-2">
            <div className="rounded-lg border bg-card p-3">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">NCM</p>
              <p className="font-mono text-sm font-medium">{selected.ncm || <span className="text-muted-foreground text-xs italic">Não informado</span>}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">CST</p>
              <p className="font-mono text-sm font-medium">{selected.cst || <span className="text-muted-foreground text-xs italic">Não informado</span>}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">CFOP Padrão</p>
              <p className="font-mono text-sm font-medium">{selected.cfop_padrao || <span className="text-muted-foreground text-xs italic">Não informado</span>}</p>
            </div>
          </div>
        </TabsContent>

        {/* Tab: Preços Especiais */}
        <TabsContent value="precos" className="space-y-3 mt-3">
          <PrecosEspeciaisTab produtoId={selected.id} />
        </TabsContent>

        {/* Tab: Histórico */}
        <TabsContent value="historico" className="space-y-3 mt-3">
          <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" /> Histórico de Notas Fiscais
          </h4>
          {historico.length === 0 ? (
            <EmptyState icon={FileText} title="Nenhum histórico de notas" description="Nenhum histórico de notas fiscais para este produto" />
          ) : (
            <div className="space-y-2 max-h-[350px] overflow-y-auto">
            {historico.map((h, idx: number) => (
                <div key={idx} className="text-sm py-1.5 border-b last:border-b-0">
                  <div className="flex justify-between items-center">
                    <RelationalLink onClick={() => pushView("nota_fiscal", h.notas_fiscais?.id)} mono className="text-xs">{h.notas_fiscais?.numero}</RelationalLink>
                    <span className="text-[10px] text-muted-foreground">{formatDate(h.notas_fiscais?.data_emissao)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] mt-1">
                    <span className="truncate max-w-[150px] text-muted-foreground">{h.notas_fiscais?.fornecedores?.nome_razao_social || "—"}</span>
                    <span className="font-mono">Qtd: {h.quantidade} × {formatCurrency(h.valor_unitario)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={async () => {
          try {
            const { error } = await supabase.from("produtos").delete().eq("id", id);
            if (error) throw error;
            toast.success("Produto excluído com sucesso.");
            clearStack();
          } catch (err) {
            toast.error(getUserFriendlyError(err));
          } finally {
            setDeleteConfirmOpen(false);
          }
        }}
        title="Excluir produto"
        description={[
          `Tem certeza que deseja excluir "${selected?.nome || ""}"${selected?.sku ? ` (SKU: ${selected.sku})` : ""}?`,
          "Esta ação não pode ser desfeita.",
          fornecedoresProd.length > 0 ? `Este produto possui ${fornecedoresProd.length} fornecedor(es) vinculado(s).` : "",
          composicao.length > 0 ? "Este produto possui itens de composição." : "",
          historico.length > 0 ? "Este produto possui histórico de notas fiscais." : "",
        ].filter(Boolean).join(" ")}
      />
    </div>
  );
}
