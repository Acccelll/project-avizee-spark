import { ViewDrawerV2 } from "@/components/ViewDrawerV2";
import { StatusBadge } from "@/components/StatusBadge";
import { AutocompleteSearch } from "@/components/ui/AutocompleteSearch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  ShoppingCart, Edit, Trash2, Plus, CheckCircle2, Clock,
  PackageSearch, ClipboardList, Users2, TrendingDown, AlertCircle, Info,
  ThumbsUp, ThumbsDown, Send, BarChart3, Award, ChevronRight, Trophy, X,
} from "lucide-react";
import {
  type CotacaoCompra,
  type CotacaoItem,
  type Proposta,
  statusLabels,
  FLOW_STEPS,
  getFlowStepIndex,
  normalizeStatus,
} from "./cotacaoCompraTypes";

interface DrawerStats {
  uniqueSuppliers: number;
  bestTotal: number;
  selectedPropostas: Proposta[];
  selectedSupplierName: string | null;
  allItemsHaveSelected: boolean;
}

interface FornecedorOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface CotacaoCompraDrawerProps {
  open: boolean;
  onClose: () => void;
  selected: CotacaoCompra | null;
  viewItems: CotacaoItem[];
  viewPropostas: Proposta[];
  drawerStats: DrawerStats;
  fornecedorOptions: FornecedorOption[];
  addingProposal: string | null;
  setAddingProposal: (id: string | null) => void;
  proposalForm: { fornecedor_id: string; preco_unitario: number; prazo_entrega_dias: string; observacoes: string };
  setProposalForm: (f: { fornecedor_id: string; preco_unitario: number; prazo_entrega_dias: string; observacoes: string }) => void;
  onEdit: (c: CotacaoCompra) => void;
  onDeleteOpen: () => void;
  onSelectProposal: (propostaId: string, itemId: string) => void;
  onDeleteProposal: (propostaId: string) => void;
  onAddProposal: (itemId: string) => void;
  onSendForApproval: () => void;
  onApprove: () => void;
  onReject: () => void;
  onGerarPedido: () => void;
  onNavigatePedidos: () => void;
}

export function CotacaoCompraDrawer({
  open,
  onClose,
  selected,
  viewItems,
  viewPropostas,
  drawerStats,
  fornecedorOptions,
  addingProposal,
  setAddingProposal,
  proposalForm,
  setProposalForm,
  onEdit,
  onDeleteOpen,
  onSelectProposal,
  onDeleteProposal,
  onAddProposal,
  onSendForApproval,
  onApprove,
  onReject,
  onGerarPedido,
  onNavigatePedidos,
}: CotacaoCompraDrawerProps) {
  return (
    <ViewDrawerV2
      open={open}
      onClose={onClose}
      title={selected?.numero ?? "Cotação de Compra"}
      badge={
        selected ? (
          <StatusBadge status={selected.status} label={statusLabels[selected.status] || selected.status} />
        ) : undefined
      }
      actions={
        selected ? (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { onClose(); onEdit(selected); }}>
                  <Edit className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Editar</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDeleteOpen}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Excluir</TooltipContent>
            </Tooltip>
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

                    {/* Comparative table */}
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
                                                    onClick={() => onSelectProposal(p.id!, item.id)}
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
                                                    onClick={() => onDeleteProposal(p.id!)}
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
                                          onChange={(id) => setProposalForm({ ...proposalForm, fornecedor_id: id })}
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
                                            onChange={(e) => setProposalForm({ ...proposalForm, preco_unitario: Number(e.target.value) })}
                                            className="h-8 font-mono"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-xs">Prazo (dias)</Label>
                                          <Input
                                            type="number"
                                            value={proposalForm.prazo_entrega_dias}
                                            onChange={(e) => setProposalForm({ ...proposalForm, prazo_entrega_dias: e.target.value })}
                                            className="h-8 font-mono"
                                          />
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Observações</Label>
                                        <Input
                                          value={proposalForm.observacoes}
                                          onChange={(e) => setProposalForm({ ...proposalForm, observacoes: e.target.value })}
                                          className="h-8 text-xs"
                                          placeholder="Condições, validade da proposta..."
                                        />
                                      </div>
                                      <div className="flex gap-2">
                                        <Button
                                          type="button"
                                          size="sm"
                                          onClick={() => onAddProposal(item.id)}
                                          disabled={!proposalForm.fornecedor_id}
                                        >
                                          Salvar
                                        </Button>
                                        <Button type="button" size="sm" variant="ghost" onClick={() => setAddingProposal(null)}>
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
                                        setProposalForm({ fornecedor_id: "", preco_unitario: 0, prazo_entrega_dias: "", observacoes: "" });
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
                          <button className="text-xs underline font-semibold hover:opacity-70 mt-0.5" onClick={onNavigatePedidos}>
                            Ver pedidos de compra →
                          </button>
                        </div>
                      </div>
                    )}

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
            {(selected.status === "aberta" || selected.status === "em_analise") &&
              drawerStats.allItemsHaveSelected && (
                <Button className="flex-1 gap-2" variant="outline" onClick={onSendForApproval}>
                  <Send className="h-4 w-4" /> Enviar para Aprovação
                </Button>
              )}
            {(selected.status === "aberta" || selected.status === "em_analise") &&
              drawerStats.allItemsHaveSelected && (
                <Button className="flex-1 gap-2" onClick={onApprove}>
                  <ThumbsUp className="h-4 w-4" /> Aprovar
                </Button>
              )}
            {selected.status === "aguardando_aprovacao" && (
              <>
                <Button className="flex-1 gap-2" variant="destructive" onClick={onReject}>
                  <ThumbsDown className="h-4 w-4" /> Reprovar
                </Button>
                <Button className="flex-1 gap-2" onClick={onApprove}>
                  <ThumbsUp className="h-4 w-4" /> Aprovar
                </Button>
              </>
            )}
            {(selected.status === "aprovada" || selected.status === "finalizada") && (
              <Button className="flex-1 gap-2" onClick={onGerarPedido}>
                <ClipboardList className="h-4 w-4" /> Gerar Pedido de Compra
              </Button>
            )}
            {selected.status === "convertida" && (
              <Button className="flex-1 gap-2" variant="outline" onClick={onNavigatePedidos}>
                <ChevronRight className="h-4 w-4" /> Ver Pedidos de Compra
              </Button>
            )}
          </div>
        ) : undefined
      }
    />
  );
}

// Re-export unused icons to satisfy TypeScript (ShoppingCart used in parent)
export { ShoppingCart };
