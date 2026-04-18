import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate } from "@/lib/format";
import { RelationalLink } from "@/components/ui/RelationalLink";
import { useRelationalNavigation } from "@/contexts/RelationalNavigationContext";
import { usePublishDrawerSlots } from "@/contexts/RelationalDrawerSlotsContext";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useDetailFetch } from "@/hooks/useDetailFetch";
import { useDetailActions } from "@/hooks/useDetailActions";
import { useInvalidateAfterMutation } from "@/hooks/useInvalidateAfterMutation";
import { getUserFriendlyError } from "@/utils/errorMessages";
import { pagamentoLabels, freteTipoLabels } from "@/utils/comercial";
import { DrawerSummaryCard, DrawerSummaryGrid } from "@/components/ui/DrawerSummaryCard";
import { RecordIdentityCard } from "@/components/ui/RecordIdentityCard";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { DetailLoading, DetailError, DetailEmpty } from "@/components/ui/DetailStates";
import { EmptyState } from "@/components/ui/empty-state";
import {
  sendForApproval,
  approveOrcamento,
  ensurePublicToken,
} from "@/services/orcamentos.service";
import { useConverterOrcamento } from "@/pages/comercial/hooks/useConverterOrcamento";
import { useCrossModuleToast } from "@/hooks/useCrossModuleToast";
import { CrossModuleActionDialog, type ImpactItem } from "@/components/CrossModuleActionDialog";
import {
  Edit,
  Trash2,
  FileText,
  Send,
  CheckCircle,
  ArrowRightCircle,
  Link2,
  Copy,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  id: string;
}

interface OrcamentoDetail {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orcamento: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  linkedOV: any | null;
}

export function OrcamentoView({ id }: Props) {
  const navigate = useNavigate();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [convertConfirmOpen, setConvertConfirmOpen] = useState(false);
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [poNumberCliente, setPoNumberCliente] = useState("");
  const [dataPoCliente, setDataPoCliente] = useState("");
  const { pushView, clearStack } = useRelationalNavigation();
  const { isAdmin } = useIsAdmin();
  const { run, locked, isAnyLocked } = useDetailActions();
  const invalidate = useInvalidateAfterMutation();
  const converterOrcamento = useConverterOrcamento();
  const crossToast = useCrossModuleToast();

  const { data, loading, error, reload } = useDetailFetch<OrcamentoDetail>(id, async (oId, signal) => {
    const { data: orc, error: orcError } = await supabase
      .from("orcamentos")
      .select("*, clientes(id, nome_razao_social)")
      .eq("id", oId)
      .abortSignal(signal)
      .maybeSingle();
    if (orcError) throw orcError;
    if (!orc) return null;

    const [{ data: it }, { data: ov }] = await Promise.all([
      supabase
        .from("orcamentos_itens")
        .select("*, produtos(id, nome, sku)")
        .eq("orcamento_id", orc.id)
        .abortSignal(signal),
      supabase
        .from("ordens_venda")
        .select("id, numero")
        .eq("cotacao_id", orc.id)
        .abortSignal(signal)
        .maybeSingle(),
    ]);

    return {
      orcamento: orc,
      items: it || [],
      linkedOV: ov || null,
    };
  });

  const selected = data?.orcamento ?? null;
  const items = data?.items ?? [];
  const linkedOV = data?.linkedOV ?? null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isExpired = !!(
    selected?.validade &&
    selected.status !== "convertido" &&
    new Date(selected.validade) < today
  );

  const publicLink = selected?.public_token
    ? `${window.location.origin}/orcamento-publico?token=${selected.public_token}`
    : null;

  const handleSendForApproval = () =>
    run("send_approval", async () => {
      await sendForApproval(selected);
      await reload();
      invalidate(["orcamentos"]);
    }).catch(() => {});

  const handleApprove = () =>
    run("approve", async () => {
      await approveOrcamento(selected);
      await reload();
      invalidate(["orcamentos"]);
      setApproveConfirmOpen(false);
    }).catch(() => {});

  const handleConvertToOV = () =>
    run("convert", async () => {
      // RPC transacional + invalidação cross-módulo via hook.
      const result = await converterOrcamento.mutateAsync({
        orcamento: selected,
        options: { poNumber: poNumberCliente, dataPo: dataPoCliente },
      });
      setPoNumberCliente("");
      setDataPoCliente("");
      await reload();
      setConvertConfirmOpen(false);
      // Toast com CTA contextual: usuário abre o pedido recém-criado em 1 clique.
      crossToast.success({
        title: "Pedido gerado!",
        description: `OV ${result.ovNumero} criada a partir da cotação ${selected.numero}.`,
        actionLabel: "Abrir pedido",
        action: { drawer: { type: "ordem_venda", id: result.ovId } },
      });
      // Mantém o usuário na visualização para ver o pedido vinculado
      // (em vez de navegar para fora — divergência intencional vs grid).
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

  const itemsSubtotal = items.reduce((s, i) => s + Number(i.valor_total || 0), 0);
  const kpiItens = items.length;
  const kpiQtd = items.reduce((s, i) => s + Number(i.quantidade || 0), 0);
  const kpiPeso = Number(selected?.peso_total || 0);
  const kpiValor = Number(selected?.valor_total || 0);

  // Publica slots do header padronizado (sempre — hook deve rodar incondicionalmente)
  usePublishDrawerSlots(`orcamento:${id}`, selected ? {
    breadcrumb: `Cotação · ${selected.numero}`,
    summary: (
      <RecordIdentityCard
        icon={FileText}
        title={selected.numero}
        titleMono
        subtitle={`${formatDate(selected.data_orcamento)}${selected.clientes?.nome_razao_social ? ` · ${selected.clientes.nome_razao_social}` : ""}`}
        badges={
          <>
            <StatusBadge status={selected.status} />
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
        {selected.status === "rascunho" && (
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handleSendForApproval} disabled={isAnyLocked}>
            <Send className="h-3.5 w-3.5" /> Enviar p/ Aprovação
          </Button>
        )}
        {selected.status === "confirmado" && isAdmin && (
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setApproveConfirmOpen(true)} disabled={isAnyLocked}>
            <CheckCircle className="h-3.5 w-3.5" /> Aprovar
          </Button>
        )}
        {selected.status === "aprovado" && (
          <Button size="sm" variant="default" className="h-8 gap-1.5 text-xs" onClick={() => setConvertConfirmOpen(true)} disabled={isAnyLocked}>
            <ArrowRightCircle className="h-3.5 w-3.5" /> Gerar Pedido
          </Button>
        )}
        {selected.status === "convertido" && linkedOV && (
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => pushView("ordem_venda", linkedOV.id)}>
            <ExternalLink className="h-3.5 w-3.5" /> Ver Pedido {linkedOV.numero}
          </Button>
        )}
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => { clearStack(); navigate(`/orcamentos/${id}?preview=1`); }}>
          <FileText className="h-3.5 w-3.5" /> PDF
        </Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" aria-label="Editar cotação" onClick={() => { clearStack(); navigate(`/orcamentos/${id}`); }}>
          <Edit className="h-3.5 w-3.5" /> Editar
        </Button>
        <Button
          variant="ghost" size="sm"
          className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
          aria-label="Excluir cotação"
          onClick={() => {
            if (linkedOV) {
              toast.error("Não é possível excluir uma cotação com pedido vinculado.", {
                description: `Pedido ${linkedOV.numero} está vinculado a esta cotação.`,
              });
              return;
            }
            setDeleteConfirmOpen(true);
          }}
          disabled={Boolean(linkedOV)}
        >
          <Trash2 className="h-3.5 w-3.5" /> Excluir
        </Button>
      </>
    ),
  } : {});

  if (loading) return <DetailLoading />;
  if (error) return <DetailError message={error.message} />;
  if (!selected) return <DetailEmpty title="Cotação não encontrada" icon={FileText} />;

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <DrawerSummaryGrid cols={4}>
        <DrawerSummaryCard label="Itens" value={String(kpiItens)} align="center" />
        <DrawerSummaryCard label="Qtd Total" value={String(kpiQtd)} align="center" />
        <DrawerSummaryCard label="Peso (kg)" value={kpiPeso.toFixed(2)} align="center" />
        <DrawerSummaryCard label="Total" value={formatCurrency(kpiValor)} tone="primary" align="center" />
      </DrawerSummaryGrid>

      {/* Tabs */}
      <Tabs defaultValue="resumo" className="w-full">
        <TabsList className="w-full grid grid-cols-5">
          <TabsTrigger value="resumo" className="text-[10px]">Resumo</TabsTrigger>
          <TabsTrigger value="itens" className="text-[10px]">Itens</TabsTrigger>
          <TabsTrigger value="totais" className="text-[10px]">Totais</TabsTrigger>
          <TabsTrigger value="condicoes" className="text-[10px]">Condições</TabsTrigger>
          <TabsTrigger value="vinculos" className="text-[10px]">Vínculos</TabsTrigger>
        </TabsList>

        {/* --- RESUMO --- */}
        <TabsContent value="resumo" className="space-y-3 mt-3 text-sm">
          {isExpired && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Esta cotação está expirada (validade: {formatDate(selected.validade)}).</span>
            </div>
          )}
          {selected.status === "rejeitado" && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Esta cotação foi rejeitada. Edite-a para reenviar.</span>
            </div>
          )}
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Número</span>
              <span className="font-mono font-medium">{selected.numero}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data</span>
              <span>{formatDate(selected.data_orcamento)}</span>
            </div>
            {selected.validade && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Validade</span>
                <span className={isExpired ? "text-amber-600 font-medium" : ""}>{formatDate(selected.validade)}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={selected.status} />
            </div>
            {selected.status === "convertido" && linkedOV && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Convertida em Pedido</span>
                <RelationalLink onClick={() => pushView("ordem_venda", linkedOV.id)}>
                  {linkedOV.numero}
                </RelationalLink>
              </div>
            )}
          </div>
          {selected.observacoes && (
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Observações</p>
              <p className="text-xs text-muted-foreground italic">{selected.observacoes}</p>
            </div>
          )}
        </TabsContent>

        {/* --- ITENS --- */}
        <TabsContent value="itens" className="space-y-3 mt-3">
          <div className="rounded-lg border overflow-hidden">
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
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {items.map((i: any, idx: number) => (
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
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Pagamento</p>
              <p>{pagamentoLabels[selected.pagamento] || selected.pagamento || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Prazo de Pagamento</p>
              <p>{selected.prazo_pagamento || "—"}</p>
            </div>
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
                <p className={isExpired ? "text-amber-600 font-medium" : ""}>{formatDate(selected.validade)}</p>
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
              {linkedOV ? (
                <RelationalLink onClick={() => pushView("ordem_venda", linkedOV.id)}>
                  {linkedOV.numero}
                </RelationalLink>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhum pedido vinculado</p>
              )}
            </div>

            <div className="border-t pt-3">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-2">Link Público</p>
              {publicLink ? (
                <div className="space-y-2">
                  <p className="text-xs font-mono bg-muted rounded px-2 py-1.5 break-all">{publicLink}</p>
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
                {selected.status === "convertido" && linkedOV && (
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Convertida em Pedido</span>
                    <RelationalLink onClick={() => pushView("ordem_venda", linkedOV.id)}>
                      {linkedOV.numero}
                    </RelationalLink>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={async () => {
          try {
            const { error: delErr } = await supabase.from("orcamentos").delete().eq("id", id);
            if (delErr) throw delErr;
            toast.success("Cotação excluída com sucesso.");
            invalidate(["orcamentos"]);
            clearStack();
          } catch (err: unknown) {
            console.error("[OrcamentoView] erro ao excluir:", err);
            toast.error(getUserFriendlyError(err));
          } finally {
            setDeleteConfirmOpen(false);
          }
        }}
        title="Excluir cotação"
        description={`Tem certeza que deseja excluir a cotação ${selected?.numero || ""}? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        confirmVariant="destructive"
      />

      {/* Approve confirm */}
      <ConfirmDialog
        open={approveConfirmOpen}
        onClose={() => setApproveConfirmOpen(false)}
        onConfirm={handleApprove}
        title="Aprovar cotação?"
        description="A cotação ficará disponível para gerar uma Pedido."
        confirmLabel="Aprovar"
        confirmVariant="default"
        loading={locked("approve")}
      />

      {/* Gerar Pedido — preview de impacto cross-módulo */}
      <CrossModuleActionDialog
        open={convertConfirmOpen}
        onClose={() => {
          setConvertConfirmOpen(false);
          setPoNumberCliente("");
          setDataPoCliente("");
        }}
        onConfirm={handleConvertToOV}
        title="Gerar Pedido"
        description={`Confirma a conversão da cotação ${selected?.numero} em Pedido?`}
        confirmLabel="Gerar Pedido"
        loading={locked("convert")}
        impacts={[
          {
            label: "Cria 1 Pedido em /pedidos",
            detail: `${items.length} ${items.length === 1 ? "item" : "itens"} · ${formatCurrency(kpiValor)}`,
            tone: "primary",
          },
          {
            label: "Cotação muda para “convertido”",
            detail: `Nº ${selected?.numero}`,
            tone: "info",
          },
          {
            label: "Pedido fica disponível para faturamento",
            tone: "success",
          },
        ] satisfies ImpactItem[]}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs">Nº Pedido do Cliente (PO)</Label>
            <Input
              value={poNumberCliente}
              onChange={(e) => setPoNumberCliente(e.target.value)}
              placeholder="Ex: PO-2026-00123"
              className="h-9"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Data do Pedido do Cliente</Label>
            <Input
              type="date"
              value={dataPoCliente}
              onChange={(e) => setDataPoCliente(e.target.value)}
              className="h-9"
            />
          </div>
        </div>
      </CrossModuleActionDialog>
    </div>
  );
}
