import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { FormTabsList } from "@/components/FormTabsList";
import { formatCurrency, formatDate, formatWeightKg } from "@/lib/format";
import { RelationalLink } from "@/components/ui/RelationalLink";
import { useRelationalNavigation } from "@/contexts/RelationalNavigationContext";
import { usePublishDrawerSlots } from "@/contexts/RelationalDrawerSlotsContext";
import { Button } from "@/components/ui/button";
import { PermanentDeleteDialog } from "@/components/PermanentDeleteDialog";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useCanHardDelete } from "@/hooks/useCanHardDelete";
import { useCan } from "@/hooks/useCan";
import { useDetailFetch } from "@/hooks/useDetailFetch";
import { useDetailActions } from "@/hooks/useDetailActions";
import { useInvalidateAfterMutation } from "@/hooks/useInvalidateAfterMutation";
import { useAppConfig } from "@/hooks/useAppConfig";
import { useConfirmDestructive } from "@/hooks/useConfirmDestructive";
import { notifyError } from "@/utils/errorMessages";
import { pagamentoLabels, freteTipoLabels } from "@/utils/comercial";
import { DrawerSummaryCard, DrawerSummaryGrid } from "@/components/ui/DrawerSummaryCard";
import { RecordIdentityCard } from "@/components/ui/RecordIdentityCard";
import { DetailLoading, DetailError, DetailEmpty } from "@/components/ui/DetailStates";
import {
  ensurePublicToken,
  cancelarOrcamento,
  criarRevisaoOrcamento,
  fetchOrcamentoDetalhes,
} from "@/services/orcamentos.service";
import { enviarOrcamentoAprovacao } from "@/services/comercial/orcamentosLifecycle.service";
import { canRegistrarPedido, canSendOrcamento, isPedidoOrcamento, normalizeOrcamentoStatus } from "@/lib/comercialWorkflow";
import { RegistrarPedidoDialog } from "@/components/orcamentos/RegistrarPedidoDialog";
import { PedidoClienteResumo } from "@/components/orcamentos/PedidoClienteResumo";
import { FaturamentoBadge, FaturamentoPedido } from "@/components/orcamentos/FaturamentoPedido";
import type { OrcamentoDetail } from "@/types/comercial";
import {
  Edit,
  Trash2,
  FileText,
  Send,
  ClipboardCheck,
  Link2,
  Copy,
  ExternalLink,
  AlertTriangle,
  GitBranch,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { ComercialFlowTimeline } from "@/components/views/ComercialFlowTimeline";
import { AuditTimelineMini } from "@/components/views/AuditTimelineMini";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logger } from "@/lib/logger";

interface Props {
  id: string;
}

export function OrcamentoView({ id }: Props) {
  const navigate = useNavigate();
  const [permDeleteOpen, setPermDeleteOpen] = useState(false);
  const [pedidoDialog, setPedidoDialog] = useState<"registrar" | "editar" | null>(null);
  const { pushView, clearStack } = useRelationalNavigation();
  const { isAdmin } = useIsAdmin();
  const { canHardDelete } = useCanHardDelete();
  const { can } = useCan();
  const canCancelar = can("orcamentos:cancelar") || isAdmin;
  const canEditar = can("orcamentos:editar") || isAdmin;
  const { run, locked, isAnyLocked } = useDetailActions();
  const invalidate = useInvalidateAfterMutation();
  const { confirm: confirmCancel, dialog: cancelDialog } = useConfirmDestructive({ verb: "Cancelar" });
  // B-03: motivo obrigatório de cancelamento de orçamento (paralelo ao do pedido).
  const { value: comercialFlags } = useAppConfig<{
    exigir_motivo_cancelamento_orcamento?: boolean;
  }>("comercial", { exigir_motivo_cancelamento_orcamento: false });
  const exigirMotivoCancel = Boolean(comercialFlags?.exigir_motivo_cancelamento_orcamento);

  const { data, loading, error, reload } = useDetailFetch<OrcamentoDetail>(
    id,
    fetchOrcamentoDetalhes,
  );

  const selected = data?.orcamento ?? null;
  const items = data?.items ?? [];
  const linkedOV = data?.linkedOV ?? null;
  // C-01: pedido vinculado só bloqueia cancelamento se ainda estiver ATIVO.
  // Se o pedido derivado foi cancelado, o orçamento de origem deve poder
  // ser cancelado normalmente.
  const linkedOVAtivo = !!linkedOV && linkedOV.status !== "cancelada";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isExpired = !!(
    selected?.validade &&
    !["aprovado", "convertido"].includes(normalizeOrcamentoStatus(selected.status)) &&
    new Date(selected.validade) < today
  );

  const publicLink = selected?.public_token
    ? `${window.location.origin}/orcamento-publico?token=${selected.public_token}`
    : null;

  const handleSendForApproval = () =>
    run("send_approval", async () => {
      // F-03: usa serviço canônico (RPC com tipagem oficial).
      await enviarOrcamentoAprovacao(selected.id);
      await reload();
      invalidate(["orcamentos"]);
      toast.success(`Orçamento ${selected.numero} marcado como enviado ao cliente.`);
    }).catch(() => {});

  const handleGeneratePublicToken = () =>
    run("token", async () => {
      await ensurePublicToken(selected.id);
      await reload(); // refetch para pegar token + side-effects do DB
      toast.success("Link público gerado!");
    }).catch(() => {});

  const handleCopyLink = async () => {
    if (publicLink) {
      try {
        await navigator.clipboard.writeText(publicLink);
        toast.success("Link copiado!");
      } catch {
        toast.error("Não foi possível copiar o link. Copie manualmente.", { description: publicLink });
      }
    }
  };

  const handleCriarRevisao = () =>
    run("revisao", async () => {
      const novoId = await criarRevisaoOrcamento(selected.id);
      toast.success("Revisão criada!");
      invalidate(["orcamentos"]);
      if (novoId) navigate(`/orcamentos/${novoId}`);
    }).catch(() => {});

  const handleCancelOrcamento = () => {
    if (!selected) return;
    if (linkedOVAtivo) {
      toast.error("Não é possível cancelar um orçamento com pedido vinculado.", {
        description: `Pedido ${linkedOV?.numero} está ativo. Cancele o pedido antes.`,
      });
      return;
    }
    const sideEffects: React.ReactNode[] = [
      "Status muda para Cancelado e não pode mais avançar no fluxo comercial.",
    ];
    if (selected.public_token) {
      sideEffects.push("O link público continuará válido — revogue manualmente se necessário.");
    }
    if (normalizeOrcamentoStatus(selected.status) === "aprovado") {
      sideEffects.push("A aprovação atual será descartada.");
    }
    void confirmCancel(
      {
        verb: "Cancelar",
        entity: `orçamento ${selected.numero}`,
        sideEffects,
        requireReason: exigirMotivoCancel,
        confirmLabel: "Cancelar orçamento",
      },
      async (motivo) => {
        try {
          await cancelarOrcamento(selected.id, motivo || undefined);
          invalidate(["orcamentos"]);
          await reload();
        } catch (err) {
          logger.error("[OrcamentoView] erro ao cancelar:", err);
          notifyError(err);
          throw err;
        }
      },
    );
  };

  const itemsSubtotal = items.reduce((s, i) => s + Number(i.valor_total || 0), 0);
  const kpiItens = items.length;
  const kpiQtd = items.reduce((s, i) => s + Number(i.quantidade || 0), 0);
  const kpiPeso = Number(selected?.peso_total || 0);
  const kpiValor = Number(selected?.valor_total || 0);

  // Publica slots do header padronizado (sempre — hook deve rodar incondicionalmente)
  usePublishDrawerSlots(`orcamento:${id}`, selected ? {
    breadcrumb: `Orçamento · ${selected.numero}${selected.revisao ? ` (rev ${selected.revisao})` : ""}`,
    summary: (
      <RecordIdentityCard
        icon={FileText}
        title={selected.numero}
        titleMono
        subtitle={`${formatDate(selected.data_orcamento)}${selected.clientes?.nome_razao_social ? ` · ${selected.clientes.nome_razao_social}` : ""}`}
        badges={
          <>
            <StatusBadge status={selected.status} />
            {["aprovado", "convertido"].includes(normalizeOrcamentoStatus(selected.status)) && (
              <FaturamentoBadge status={selected.faturamento_status} />
            )}
            {isExpired && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-warning bg-warning/10 px-1.5 py-0.5 rounded-full">
                <AlertTriangle className="h-3 w-3" /> Expirada
              </span>
            )}
            <span className="inline-flex items-center rounded-full border bg-muted/50 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
              {formatCurrency(Number(selected.valor_total || 0))}
            </span>
          </>
        }
      />
    ),
    actions: (
      <>
        {/* MB-02: em mobile só mostra ações primárias; secundárias vão para dropdown abaixo. */}
        {canSendOrcamento(selected.status) && (
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs hidden md:inline-flex" onClick={handleSendForApproval} disabled={isAnyLocked}>
            <Send className="h-3.5 w-3.5" /> Marcar como enviado
          </Button>
        )}
        {canRegistrarPedido(selected.status, selected.pedido_registrado_em) && (
          <Button size="sm" variant="default" className="h-8 min-h-11 gap-1.5 text-xs sm:min-h-0" onClick={() => setPedidoDialog("registrar")} disabled={isAnyLocked}>
            <ClipboardCheck className="h-3.5 w-3.5" /> Registrar pedido
          </Button>
        )}
        {/* Desktop: ações secundárias inline */}
        {/* M-01: também permite revisão durante `pendente` (cliente pediu ajustes). */}
        {["pendente", "aprovado", "rejeitado", "expirado", "convertido"].includes(normalizeOrcamentoStatus(selected.status)) && (
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs hidden md:inline-flex" onClick={handleCriarRevisao} disabled={isAnyLocked}>
            <GitBranch className="h-3.5 w-3.5" /> Criar revisão
          </Button>
        )}
        {normalizeOrcamentoStatus(selected.status) === "convertido" && linkedOV && (
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs hidden md:inline-flex" onClick={() => pushView("ordem_venda", linkedOV.id)}>
            <ExternalLink className="h-3.5 w-3.5" /> Ver Pedido {linkedOV.numero}
          </Button>
        )}
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs hidden md:inline-flex" onClick={() => { clearStack(); navigate(`/orcamentos/${id}?preview=1`); }}>
          <FileText className="h-3.5 w-3.5" /> PDF
        </Button>
        {canEditar && (
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs hidden md:inline-flex" aria-label="Editar orçamento" onClick={() => { clearStack(); navigate(`/orcamentos/${id}`); }}>
            <Edit className="h-3.5 w-3.5" /> Editar
          </Button>
        )}

        {/* Kebab para ações destrutivas (desktop e mobile). Em mobile, também agrega Editar/PDF/Revisão. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              aria-label="Mais ações"
              disabled={isAnyLocked}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {canEditar && (
              <DropdownMenuItem className="md:hidden" onClick={() => { clearStack(); navigate(`/orcamentos/${id}`); }}>
                <Edit className="h-4 w-4 mr-2" /> Editar
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="md:hidden" onClick={() => { clearStack(); navigate(`/orcamentos/${id}?preview=1`); }}>
              <FileText className="h-4 w-4 mr-2" /> PDF
            </DropdownMenuItem>
            {canSendOrcamento(selected.status) && (
              <DropdownMenuItem className="md:hidden" onClick={handleSendForApproval}>
                <Send className="h-4 w-4 mr-2" /> Marcar como enviado
              </DropdownMenuItem>
            )}
            {["pendente", "aprovado", "rejeitado", "expirado", "convertido"].includes(normalizeOrcamentoStatus(selected.status)) && (
              <DropdownMenuItem className="md:hidden" onClick={handleCriarRevisao}>
                <GitBranch className="h-4 w-4 mr-2" /> Criar revisão
              </DropdownMenuItem>
            )}
            {normalizeOrcamentoStatus(selected.status) === "convertido" && linkedOV && (
              <DropdownMenuItem className="md:hidden" onClick={() => pushView("ordem_venda", linkedOV.id)}>
                <ExternalLink className="h-4 w-4 mr-2" /> Ver Pedido {linkedOV.numero}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="md:hidden" />
            {canCancelar && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              disabled={linkedOVAtivo}
              onClick={handleCancelOrcamento}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Cancelar orçamento
            </DropdownMenuItem>
            )}
            {canHardDelete && (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                disabled={!!linkedOV}
                title={linkedOV ? "Existe pedido vinculado — não é possível excluir definitivamente" : undefined}
                onClick={() => {
                  if (linkedOV) {
                    toast.error("Existe pedido vinculado — não é possível excluir definitivamente.", {
                      description: `Pedido ${linkedOV.numero}.`,
                    });
                    return;
                  }
                  setPermDeleteOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Excluir definitivamente
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    ),
  } : {});

  if (loading) return <DetailLoading />;
  if (error) return <DetailError message={error.message} />;
  if (!selected) return <DetailEmpty title="Orçamento não encontrado" icon={FileText} />;

  return (
    <div className="space-y-4">
      {/* Timeline do fluxo Orçamento → Pedido → NF */}
      <ComercialFlowTimeline
        steps={[
          {
            key: "orcamento",
            label: `Orçamento ${selected.numero}`,
            shortLabel: "Orçamento",
            done: true,
            current: !linkedOV && !isPedidoOrcamento(selected.status),
            hint: "Etapa atual",
          },
          {
            key: "pedido",
            label: selected.pedido_cliente ? `Pedido ${selected.pedido_cliente}` : linkedOV ? `Pedido ${linkedOV.numero}` : "Pedido do cliente",
            shortLabel: "Pedido",
            done: isPedidoOrcamento(selected.status) || !!linkedOV,
            hint: isPedidoOrcamento(selected.status) || linkedOV ? "Pedido registrado" : "Use 'Registrar pedido' quando o cliente confirmar",
            onClick: linkedOV ? () => pushView("ordem_venda", linkedOV.id) : undefined,
          },
          {
            key: "nf",
            label: "Nota Fiscal",
            shortLabel: "NF",
            done: false,
            hint: "Ligada ao pedido na importação do XML",
          },
        ]}
      />

      {/* KPI strip */}
      <DrawerSummaryGrid cols={4}>
        <DrawerSummaryCard label="Itens" value={String(kpiItens)} align="center" />
        <DrawerSummaryCard label="Qtd Total" value={String(kpiQtd)} align="center" />
        <DrawerSummaryCard label="Peso" value={formatWeightKg(kpiPeso)} align="center" />
        <DrawerSummaryCard label="Total" value={formatCurrency(kpiValor)} tone="primary" align="center" />
      </DrawerSummaryGrid>

      {/* Tabs */}
      <Tabs defaultValue="resumo" className="w-full">
        <FormTabsList
          tabs={[
            { value: "resumo", label: "Resumo" },
            { value: "itens", label: "Itens", count: items.length },
            { value: "totais", label: "Totais" },
            { value: "condicoes", label: "Condições" },
            { value: "vinculos", label: "Vínculos", count: linkedOV ? 1 : 0 },
          ]}
        />

        {/* --- RESUMO --- */}
        <TabsContent value="resumo" className="space-y-3 mt-3 text-sm">
          {isExpired && (
            <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Este orçamento está expirado (validade: {formatDate(selected.validade)}).</span>
            </div>
          )}
          {selected.status === "rejeitado" && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Este orçamento foi rejeitado. Edite-o para reenviar.</span>
            </div>
          )}
          {(selected as { cliente_resposta_comentario?: string | null; cliente_resposta_em?: string | null }).cliente_resposta_comentario && (
            <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs space-y-1">
              <div className="font-semibold text-warning uppercase tracking-wide text-[10px]">
                Resposta do cliente {(selected as { cliente_resposta_em?: string | null }).cliente_resposta_em ? `· ${formatDate((selected as { cliente_resposta_em?: string }).cliente_resposta_em!)}` : ""}
              </div>
              <div className="whitespace-pre-wrap text-foreground">
                «{(selected as { cliente_resposta_comentario?: string }).cliente_resposta_comentario}»
              </div>
            </div>
          )}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            <div className="flex justify-between sm:block">
              <dt className="text-muted-foreground sm:text-[10px] sm:uppercase sm:font-semibold">Número</dt>
              <dd className="font-mono font-medium">{selected.numero}</dd>
            </div>
            <div className="flex justify-between sm:block">
              <dt className="text-muted-foreground sm:text-[10px] sm:uppercase sm:font-semibold">Data</dt>
              <dd>{formatDate(selected.data_orcamento)}</dd>
            </div>
            {selected.clientes && (
              <div className="flex justify-between sm:block">
                <dt className="text-muted-foreground sm:text-[10px] sm:uppercase sm:font-semibold">Cliente</dt>
                <dd className="text-right sm:text-left">
                  <RelationalLink onClick={() => pushView("cliente", selected.clientes?.id)}>
                    {selected.clientes.nome_razao_social || "—"}
                  </RelationalLink>
                </dd>
              </div>
            )}
            <div className="flex justify-between sm:block">
              <dt className="text-muted-foreground sm:text-[10px] sm:uppercase sm:font-semibold">Status</dt>
              <dd><StatusBadge status={selected.status} /></dd>
            </div>
            {selected.validade && (
              <div className="flex justify-between sm:block">
                <dt className="text-muted-foreground sm:text-[10px] sm:uppercase sm:font-semibold">Validade</dt>
                <dd className={isExpired ? "text-warning font-medium" : ""}>{formatDate(selected.validade)}</dd>
              </div>
            )}
            {(selected.pagamento || selected.prazo_pagamento) && (
              <div className="flex justify-between sm:block">
                <dt className="text-muted-foreground sm:text-[10px] sm:uppercase sm:font-semibold">Pagamento</dt>
                <dd>
                  {selected.pagamento
                    ? `${pagamentoLabels[selected.pagamento] || selected.pagamento}${selected.prazo_pagamento ? ` · ${selected.prazo_pagamento}` : ""}`
                    : selected.prazo_pagamento}
                </dd>
              </div>
            )}
            {selected.prazo_entrega && (
              <div className="flex justify-between sm:block">
                <dt className="text-muted-foreground sm:text-[10px] sm:uppercase sm:font-semibold">Entrega</dt>
                <dd>{selected.prazo_entrega}</dd>
              </div>
            )}
            {selected.frete_tipo && (
              <div className="flex justify-between sm:block">
                <dt className="text-muted-foreground sm:text-[10px] sm:uppercase sm:font-semibold">Frete</dt>
                <dd>
                  {freteTipoLabels[selected.frete_tipo] || selected.frete_tipo}
                  {selected.modalidade ? ` · ${selected.modalidade}` : ""}
                </dd>
              </div>
            )}
            {selected.updated_at && (
              <div className="flex justify-between sm:block">
                <dt className="text-muted-foreground sm:text-[10px] sm:uppercase sm:font-semibold">Atualizado</dt>
                <dd>{formatDate(selected.updated_at)}</dd>
              </div>
            )}
            {normalizeOrcamentoStatus(selected.status) === "convertido" && linkedOV && (
              <div className="flex justify-between sm:block">
                <dt className="text-muted-foreground sm:text-[10px] sm:uppercase sm:font-semibold">Convertido em Pedido</dt>
                <dd>
                  <RelationalLink onClick={() => pushView("ordem_venda", linkedOV.id)}>
                    {linkedOV.numero}
                  </RelationalLink>
                </dd>
              </div>
            )}
          </dl>
          {selected.observacoes && (
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Observações</p>
              <p className="text-xs text-muted-foreground italic">{selected.observacoes}</p>
            </div>
          )}
        </TabsContent>

        {/* --- ITENS --- */}
        <TabsContent value="itens" className="space-y-3 mt-3">
          {/* Tabela: telas ≥sm */}
          <div className="rounded-lg border overflow-hidden hidden sm:block">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-muted-foreground">Cód.</th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-muted-foreground">Descrição</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold text-muted-foreground">Qtd</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold text-muted-foreground">Unit.</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-2 py-4 text-center text-muted-foreground text-xs">Nenhum item</td>
                  </tr>
                )}
                {items.map((i, idx: number) => (
                  <tr key={idx} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="px-2 py-2 font-mono text-[10px] text-muted-foreground">
                      {i.codigo_snapshot || i.produtos?.sku || "—"}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => pushView("produto", i.produtos?.id)}
                        className="text-left hover:underline block"
                      >
                        <span className="line-clamp-1">{i.descricao_snapshot || i.produtos?.nome || "—"}</span>
                        {i.variacao && (
                          <span className="text-[10px] text-muted-foreground block">{i.variacao}</span>
                        )}
                      </button>
                    </td>
                    <td className="px-2 py-2 text-right font-mono">
                      {i.quantidade}{i.unidade ? ` ${i.unidade}` : ""}
                    </td>
                    <td className="px-2 py-2 text-right font-mono">
                      {formatCurrency(i.valor_unitario)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono font-medium">
                      {formatCurrency(i.valor_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Cards: telas estreitas */}
          <div className="sm:hidden space-y-2">
            {items.length === 0 && (
              <div className="rounded-lg border p-4 text-center text-xs text-muted-foreground">
                Nenhum item
              </div>
            )}
            {items.map((i, idx) => (
              <button
                key={idx}
                onClick={() => i.produtos?.id && pushView("produto", i.produtos.id)}
                className="w-full text-left rounded-lg border bg-card p-3 space-y-1.5 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {i.codigo_snapshot || i.produtos?.sku || "—"}
                  </span>
                  <span className="font-mono text-sm font-semibold">
                    {formatCurrency(i.valor_total)}
                  </span>
                </div>
                <p className="text-xs line-clamp-2">
                  {i.descricao_snapshot || i.produtos?.nome || "—"}
                </p>
                {i.variacao && (
                  <p className="text-[10px] text-muted-foreground">{i.variacao}</p>
                )}
                <p className="text-[11px] text-muted-foreground font-mono">
                  Qtd: {i.quantidade}{i.unidade ? ` ${i.unidade}` : ""} · Unit.: {formatCurrency(i.valor_unitario)}
                </p>
              </button>
            ))}
          </div>
        </TabsContent>

        {/* --- TOTAIS --- */}
        <TabsContent value="totais" className="space-y-2 mt-3 text-sm">
          {[
            { label: "Subtotal dos itens", value: itemsSubtotal, negative: false },
            { label: "Desconto", value: Number(selected.desconto || 0), negative: true },
            { label: "Imposto IPI", value: Number(selected.imposto_ipi || 0), negative: false },
            { label: "Imposto ST", value: Number(selected.imposto_st || 0), negative: false },
            { label: "Frete", value: Number(selected.frete_valor || 0), negative: false },
            { label: "Outras despesas", value: Number(selected.outras_despesas || 0), negative: false },
          ]
            .filter((row) => row.value !== 0)
            .map((row, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{row.label}</span>
                <span className={`font-mono ${row.negative ? "text-destructive" : ""}`}>
                  {row.negative
                    ? `-${formatCurrency(row.value)}`
                    : formatCurrency(row.value)}
                </span>
              </div>
            ))}
          <div className="flex justify-between font-bold border-t pt-2 mt-2">
            <span>Total</span>
            <span className="font-mono text-primary">{formatCurrency(kpiValor)}</span>
          </div>
        </TabsContent>

        {/* --- CONDIÇÕES --- */}
        <TabsContent value="condicoes" className="space-y-4 mt-3 text-sm">
          <div className="grid grid-cols-2 gap-4">
            {selected.pagamento ? (
              <>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Forma de pagamento</p>
                  <p>{pagamentoLabels[selected.pagamento] || selected.pagamento}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Prazo de pagamento</p>
                  <p>{selected.prazo_pagamento || "—"}</p>
                </div>
              </>
            ) : selected.prazo_pagamento ? (
              <div className="col-span-2">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Condição de pagamento</p>
                <p>{selected.prazo_pagamento}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Forma de pagamento não definida.</p>
              </div>
            ) : (
              <div className="col-span-2">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Pagamento</p>
                <p className="text-muted-foreground">Não definida</p>
              </div>
            )}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Prazo de Entrega</p>
              <p>{selected.prazo_entrega || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Frete</p>
              <p>{freteTipoLabels[selected.frete_tipo] || selected.frete_tipo || "—"}</p>
            </div>
            {selected.modalidade && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Modalidade</p>
                <p className="capitalize">{selected.modalidade}</p>
              </div>
            )}
            {selected.validade && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Validade</p>
                <p className={isExpired ? "text-warning font-medium" : ""}>{formatDate(selected.validade)}</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* --- VÍNCULOS --- */}
        <TabsContent value="vinculos" className="space-y-4 mt-3 text-sm">
          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Cliente</p>
              <RelationalLink onClick={() => pushView("cliente", selected.clientes?.id)}>
                {selected.clientes?.nome_razao_social || "—"}
              </RelationalLink>
            </div>

            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Pedido</p>
              {selected.pedido_cliente ? (
                <PedidoClienteResumo
                  orcamento={selected}
                  onEditar={isPedidoOrcamento(selected.status) ? () => setPedidoDialog("editar") : undefined}
                />
              ) : linkedOV ? (
                <RelationalLink onClick={() => pushView("ordem_venda", linkedOV.id)}>
                  {linkedOV.numero}
                </RelationalLink>
              ) : canRegistrarPedido(selected.status, selected.pedido_registrado_em) ? (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">O cliente ainda não confirmou o pedido.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => setPedidoDialog("registrar")}
                    disabled={isAnyLocked}
                  >
                    <ClipboardCheck className="h-3 w-3" /> Registrar pedido do cliente
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhum pedido registrado.</p>
              )}
            </div>

            {["aprovado", "convertido", "historico"].includes(normalizeOrcamentoStatus(selected.status)) && (
              <div className="border-t pt-3">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-2">Faturamento</p>
                <FaturamentoPedido
                  orcamento={selected}
                  onChanged={() => {
                    void reload();
                    invalidate(["orcamentos"]);
                  }}
                />
              </div>
            )}

            <div className="border-t pt-3">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-2">Link Público</p>
              {publicLink ? (
                <div className="space-y-2">
                  <p className="text-xs font-mono bg-muted rounded px-2 py-1.5 break-all" title="Token mascarado por segurança. Use Copiar/Abrir.">
                    {`${window.location.origin}/orcamento-publico?token=••••••••${(selected.public_token || "").slice(-8)}`}
                  </p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" /> Link ativo
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 flex-1" onClick={handleCopyLink}>
                      <Copy className="h-3 w-3" /> Copiar link
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5 flex-1"
                      onClick={() => window.open(publicLink, "_blank")}
                    >
                      <ExternalLink className="h-3 w-3" /> Abrir
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5"
                  onClick={handleGeneratePublicToken}
                  disabled={locked("token")}
                >
                  <Link2 className="h-3 w-3" />
                  {locked("token") ? "Gerando..." : "Gerar link público"}
                </Button>
              )}
            </div>

            <div className="border-t pt-3 space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Histórico</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Criado em</span>
                  <span>{formatDate(selected.created_at)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Atualizado em</span>
                  <span>{formatDate(selected.updated_at)}</span>
                </div>
                {normalizeOrcamentoStatus(selected.status) === "convertido" && linkedOV && (
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Convertido em Pedido</span>
                    <RelationalLink onClick={() => pushView("ordem_venda", linkedOV.id)}>
                      {linkedOV.numero}
                    </RelationalLink>
                  </div>
                )}
              </div>
            </div>

            {/* M-04: mini-timeline de auditoria (admins) */}
            <AuditTimelineMini tabela="orcamentos" registroId={id} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Cancel confirm — padronizado via ConfirmDestructiveDialog */}
      {cancelDialog}

      <RegistrarPedidoDialog
        open={!!pedidoDialog}
        modo={pedidoDialog ?? "registrar"}
        onClose={() => setPedidoDialog(null)}
        orcamento={selected ? {
          id: selected.id,
          numero: selected.numero,
          cliente_id: selected.cliente_id,
          clienteNome: selected.clientes?.nome_razao_social,
          clienteCpfCnpj: (selected.clientes as { cpf_cnpj?: string | null } | null)?.cpf_cnpj ?? null,
          valor_total: selected.valor_total,
          prazo_entrega_dias: selected.prazo_entrega_dias,
          pedido_cliente: selected.pedido_cliente,
          data_pedido_cliente: selected.data_pedido_cliente,
          previsao_despacho: selected.previsao_despacho,
        } : null}
        onDone={() => {
          void reload();
          invalidate(["orcamentos"]);
        }}
      />

      <PermanentDeleteDialog
        open={permDeleteOpen}
        onClose={() => setPermDeleteOpen(false)}
        table="orcamentos"
        id={id}
        entityLabel="orçamento"
        recordName={selected?.numero || id}
        warning="Ação administrativa. Remove o registro do banco de dados — não é cancelamento."
        sideEffects={[
          "Itens do orçamento",
          linkedOV ? `Pedido vinculado ${linkedOV.numero} e suas notas fiscais` : "Nenhum pedido vinculado",
        ]}
        onDeleted={() => {
          invalidate(["orcamentos"]);
          clearStack();
        }}
      />
    </div>
  );
}
