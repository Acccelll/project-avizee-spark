/**
 * CotacaoCompraDrawer — drawer wrapper com estado orquestrado pelo parent.
 *
 * Subcomponentes extraídos:
 * - CotacaoCompraHeaderSummary (stepper + stats)
 * - CotacaoCompraItensTable
 * - CotacaoCompraPropostasPanel (comparativo + propostas por item)
 */
import { ViewDrawerV2 } from "@/components/ViewDrawerV2";
import { StatusBadge } from "@/components/StatusBadge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import {
  ShoppingCart, Edit, Trash2, CheckCircle2, Clock,
  ClipboardList, AlertCircle, Info,
  ThumbsUp, ThumbsDown, Send, ChevronRight, Trophy, X,
} from "lucide-react";
import {
  type CotacaoCompra,
  type CotacaoItem,
  type Proposta,
  statusLabels,
} from "./cotacaoCompraTypes";
import { CotacaoCompraHeaderSummary } from "./CotacaoCompraHeader";
import { CotacaoCompraItensTable } from "./CotacaoCompraItensTable";
import { CotacaoCompraPropostasPanel } from "./CotacaoCompraPropostasPanel";
import { formatDate } from "@/lib/format";

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
  open, onClose, selected, viewItems, viewPropostas, drawerStats,
  fornecedorOptions, addingProposal, setAddingProposal, proposalForm, setProposalForm,
  onEdit, onDeleteOpen, onSelectProposal, onDeleteProposal, onAddProposal,
  onSendForApproval, onApprove, onReject, onGerarPedido, onNavigatePedidos,
}: CotacaoCompraDrawerProps) {
  return (
    <ViewDrawerV2
      open={open}
      onClose={onClose}
      title={selected?.numero ?? "Cotação de Compra"}
      badge={selected ? <StatusBadge status={selected.status} label={statusLabels[selected.status] || selected.status} /> : undefined}
      actions={
        selected ? (
          <>
            {/* Block edit/delete once the quotation is in a terminal state */}
            {!["convertida", "cancelada"].includes(selected.status) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar cotação" onClick={() => { onClose(); onEdit(selected); }}>
                    <Edit className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Editar</TooltipContent>
              </Tooltip>
            )}
            {!["convertida", "cancelada"].includes(selected.status) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" aria-label="Excluir cotação" onClick={onDeleteOpen}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Excluir</TooltipContent>
              </Tooltip>
            )}
          </>
        ) : undefined
      }
      summary={
        selected ? (
          <CotacaoCompraHeaderSummary selected={selected} viewItems={viewItems} viewPropostas={viewPropostas} drawerStats={drawerStats} />
        ) : undefined
      }
      defaultTab={viewPropostas.length > 0 ? "propostas" : "resumo"}
      tabs={
        selected
          ? [
              /* Resumo */
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
                        <p className="text-sm mt-0.5">{selected.data_validade ? formatDate(selected.data_validade) : "—"}</p>
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
                          <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" /> Nenhum item cadastrado nesta cotação.
                        </div>
                      )}
                      {viewItems.length > 0 && viewPropostas.length === 0 && (
                        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                          <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" /> Nenhuma proposta recebida. Acesse a aba Propostas para adicionar.
                        </div>
                      )}
                      {viewItems.length > 0 && viewPropostas.length > 0 && !drawerStats.allItemsHaveSelected &&
                        selected.status !== "finalizada" && selected.status !== "convertida" && selected.status !== "cancelada" && (
                        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                          <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" /> Aguardando seleção de fornecedor para todos os itens.
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
                          <ClipboardList className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" /> Esta cotação foi convertida em Pedido de Compra.
                        </div>
                      )}
                    </div>
                  </div>
                ),
              },
              /* Itens */
              {
                value: "itens",
                label: `Itens (${viewItems.length})`,
                content: <CotacaoCompraItensTable items={viewItems} />,
              },
              /* Propostas */
              {
                value: "propostas",
                label: `Propostas (${drawerStats.uniqueSuppliers} forn.)`,
                content: (
                  <CotacaoCompraPropostasPanel
                    selected={selected} viewItems={viewItems} viewPropostas={viewPropostas}
                    uniqueSuppliers={drawerStats.uniqueSuppliers} fornecedorOptions={fornecedorOptions}
                    addingProposal={addingProposal} setAddingProposal={setAddingProposal}
                    proposalForm={proposalForm} setProposalForm={setProposalForm}
                    onSelectProposal={onSelectProposal} onDeleteProposal={onDeleteProposal} onAddProposal={onAddProposal}
                  />
                ),
              },
              /* Decisão */
              {
                value: "decisao",
                label: "Decisão",
                content: (
                  <div className="space-y-4">
                    {selected.status === "rejeitada" && (
                      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                        <ThumbsDown className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div><p className="font-semibold">Cotação rejeitada</p><p className="text-xs mt-0.5 opacity-80">Esta cotação foi reprovada e não pode ser convertida em pedido.</p></div>
                      </div>
                    )}
                    {selected.status === "aguardando_aprovacao" && (
                      <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
                        <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div><p className="font-semibold">Aguardando aprovação</p><p className="text-xs mt-0.5 opacity-80">A cotação está em análise. Use os botões abaixo para aprovar ou reprovar.</p></div>
                      </div>
                    )}
                    {(selected.status === "aprovada" || selected.status === "finalizada") && (
                      <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
                        <ThumbsUp className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div><p className="font-semibold">Cotação aprovada</p><p className="text-xs mt-0.5 opacity-80">Pronta para conversão em Pedido de Compra.</p></div>
                      </div>
                    )}
                    {selected.status === "convertida" && (
                      <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
                        <ClipboardList className="h-4 w-4 flex-shrink-0" />
                        <div>
                          <p className="font-semibold">Convertida em Pedido de Compra</p>
                          <button className="text-xs underline font-semibold hover:opacity-70 mt-0.5" onClick={onNavigatePedidos}>Ver pedidos de compra →</button>
                        </div>
                      </div>
                    )}

                    {drawerStats.selectedPropostas.length > 0 ? (
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-2 flex items-center gap-1">
                          <Trophy className="h-3 w-3" /> {drawerStats.selectedPropostas.length === 1 ? "Fornecedor Selecionado" : "Fornecedores Selecionados"}
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
                                    <td className="px-3 py-2 text-xs max-w-[120px]"><span className="truncate block">{item?.produtos?.nome || "—"}</span></td>
                                    <td className="px-3 py-2 text-xs font-medium max-w-[130px]"><span className="truncate block">{p.fornecedores?.nome_razao_social || "—"}</span></td>
                                    <td className="px-3 py-2 text-right font-mono text-xs font-semibold">{item ? formatCurrency(Number(p.preco_unitario) * item.quantidade) : "—"}</td>
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
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-2">Situação do Processo</p>
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

                    {selected.status !== "finalizada" && selected.status !== "aprovada" && selected.status !== "convertida" &&
                      selected.status !== "rejeitada" && selected.status !== "cancelada" && drawerStats.allItemsHaveSelected && (
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
            {(selected.status === "aberta" || selected.status === "em_analise") && drawerStats.allItemsHaveSelected && (
              <Button className="flex-1 gap-2" variant="outline" onClick={onSendForApproval}><Send className="h-4 w-4" /> Enviar para Aprovação</Button>
            )}
            {(selected.status === "aberta" || selected.status === "em_analise") && drawerStats.allItemsHaveSelected && (
              <Button className="flex-1 gap-2" onClick={onApprove}><ThumbsUp className="h-4 w-4" /> Aprovar</Button>
            )}
            {selected.status === "aguardando_aprovacao" && (
              <>
                <Button className="flex-1 gap-2" variant="destructive" onClick={onReject}><ThumbsDown className="h-4 w-4" /> Reprovar</Button>
                <Button className="flex-1 gap-2" onClick={onApprove}><ThumbsUp className="h-4 w-4" /> Aprovar</Button>
              </>
            )}
            {(selected.status === "aprovada" || selected.status === "finalizada") && (
              <Button className="flex-1 gap-2" onClick={onGerarPedido}><ClipboardList className="h-4 w-4" /> Gerar Pedido de Compra</Button>
            )}
            {selected.status === "convertida" && (
              <Button className="flex-1 gap-2" variant="outline" onClick={onNavigatePedidos}><ChevronRight className="h-4 w-4" /> Ver Pedidos de Compra</Button>
            )}
          </div>
        ) : undefined
      }
    />
  );
}

export { ShoppingCart };
