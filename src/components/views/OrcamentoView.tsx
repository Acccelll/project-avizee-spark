import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate } from "@/lib/format";
import { RelationalLink } from "@/components/ui/RelationalLink";
import { useRelationalNavigation } from "@/contexts/RelationalNavigationContext";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  sendForApproval,
  approveOrcamento,
  convertToPedido,
  ensurePublicToken,
} from "@/services/orcamentos.service";
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
  Package,
  Scale,
  Layers,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  id: string;
}

const pagamentoLabels: Record<string, string> = {
  a_vista: "À Vista",
  a_prazo: "A Prazo",
  pix: "Pix",
  boleto: "Boleto",
  cartao: "Cartão",
  cheque: "Cheque",
  transferencia: "Transferência",
};

const freteTipoLabels: Record<string, string> = {
  cif: "CIF (por conta do remetente)",
  fob: "FOB (por conta do destinatário)",
  terceiros: "Por conta de terceiros",
  sem_frete: "Sem frete",
};

export function OrcamentoView({ id }: Props) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [linkedOV, setLinkedOV] = useState<any | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [convertConfirmOpen, setConvertConfirmOpen] = useState(false);
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [poNumberCliente, setPoNumberCliente] = useState("");
  const [dataPoCliente, setDataPoCliente] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [generatingToken, setGeneratingToken] = useState(false);
  const { pushView, clearStack } = useRelationalNavigation();
  const { isAdmin } = useIsAdmin();

  const fetchData = useCallback(async () => {
    if (!supabase) {
      setFetchError("Serviço de banco de dados não disponível.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setFetchError(null);
    try {
      const { data: orc, error: orcError } = await supabase
        .from("orcamentos")
        .select("*, clientes(id, nome_razao_social)")
        .eq("id", id)
        .maybeSingle();

      if (orcError) {
        setFetchError(`Erro ao carregar cotação: ${orcError.message}`);
        setSelected(null);
        return;
      }
      if (!orc) {
        setSelected(null);
        setItems([]);
        return;
      }
      setSelected(orc);

      const [{ data: it }, { data: ov }] = await Promise.all([
        supabase
          .from("orcamentos_itens")
          .select("*, produtos(id, nome, sku)")
          .eq("orcamento_id", orc.id),
        supabase
          .from("ordens_venda")
          .select("id, numero")
          .eq("cotacao_id", orc.id)
          .maybeSingle(),
      ]);

      setItems(it || []);
      setLinkedOV(ov || null);
    } catch (error) {
      setFetchError(`Erro inesperado: ${error instanceof Error ? error.message : String(error)}`);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <div className="p-8 text-center animate-pulse">Carregando cotação...</div>;
  if (fetchError) return (
    <div className="p-8 text-center text-destructive space-y-1">
      <p className="font-semibold">Erro ao carregar dados</p>
      <p className="text-xs text-muted-foreground">{fetchError}</p>
    </div>
  );
  if (!selected) return <div className="p-8 text-center text-destructive">Cotação não encontrada</div>;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isExpired =
    selected.validade &&
    selected.status !== "convertido" &&
    new Date(selected.validade) < today;

  const publicLink = selected.public_token
    ? `${window.location.origin}/orcamento-publico?token=${selected.public_token}`
    : null;

  const handleSendForApproval = async () => {
    setActionLoading(true);
    try {
      await sendForApproval(selected);
      await fetchData();
    } catch {
      toast.error("Erro ao enviar cotação para aprovação.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await approveOrcamento(selected);
      await fetchData();
    } catch {
      toast.error("Erro ao aprovar cotação.");
    } finally {
      setActionLoading(false);
      setApproveConfirmOpen(false);
    }
  };

  const handleConvertToOV = async () => {
    setActionLoading(true);
    try {
      await convertToPedido(selected, {
        poNumber: poNumberCliente,
        dataPo: dataPoCliente,
      });
      setPoNumberCliente("");
      setDataPoCliente("");
      await fetchData();
      clearStack();
      navigate(`/pedidos`);
    } catch {
      toast.error("Erro ao converter cotação em pedido.");
    } finally {
      setActionLoading(false);
      setConvertConfirmOpen(false);
    }
  };

  const handleGeneratePublicToken = async () => {
    setGeneratingToken(true);
    try {
      const token = await ensurePublicToken(selected.id);
      setSelected((prev: any) => ({ ...prev, public_token: token }));
      toast.success("Link público gerado!");
    } catch {
      toast.error("Erro ao gerar link público.");
    } finally {
      setGeneratingToken(false);
    }
  };

  const handleCopyLink = () => {
    if (publicLink) {
      navigator.clipboard.writeText(publicLink);
      toast.success("Link copiado!");
    }
  };

  const itemsSubtotal = items.reduce((s, i) => s + Number(i.valor_total || 0), 0);
  const kpiItens = items.length;
  const kpiQtd = items.reduce((s, i) => s + Number(i.quantidade || 0), 0);
  const kpiPeso = Number(selected.peso_total || 0);
  const kpiValor = Number(selected.valor_total || 0);

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between gap-1 border-b pb-3">
        <div className="flex items-center gap-1 flex-wrap">
          {selected.status === "rascunho" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={handleSendForApproval}
              disabled={actionLoading}
            >
              <Send className="h-3.5 w-3.5" /> Enviar p/ Aprovação
            </Button>
          )}
          {selected.status === "confirmado" && isAdmin && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setApproveConfirmOpen(true)}
              disabled={actionLoading}
            >
              <CheckCircle className="h-3.5 w-3.5" /> Aprovar
            </Button>
          )}
          {selected.status === "aprovado" && (
            <Button
              size="sm"
              variant="default"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setConvertConfirmOpen(true)}
              disabled={actionLoading}
            >
              <ArrowRightCircle className="h-3.5 w-3.5" /> Gerar Pedido
            </Button>
          )}
          {selected.status === "convertido" && linkedOV && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => pushView("ordem_venda", linkedOV.id)}
            >
              <ExternalLink className="h-3.5 w-3.5" /> Ver Pedido {linkedOV.numero}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => { clearStack(); navigate(`/orcamentos/${id}?preview=1`); }}
              >
                <FileText className="h-3.5 w-3.5" /> PDF
              </Button>
            </TooltipTrigger>
            <TooltipContent>Abrir visualização do PDF</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => { clearStack(); navigate(`/orcamentos/${id}`); }}
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
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Excluir</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Identity header */}
      <div className="bg-muted/30 rounded-lg p-4 text-sm">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-semibold text-lg font-mono text-primary">{selected.numero}</h3>
            <p className="text-xs text-muted-foreground">{formatDate(selected.data_orcamento)}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <StatusBadge status={selected.status} />
            {isExpired && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                <AlertTriangle className="h-3 w-3" /> Expirada
              </span>
            )}
          </div>
        </div>
        <div className="border-t pt-2 text-xs text-muted-foreground">
          <RelationalLink onClick={() => pushView("cliente", selected.clientes?.id)}>
            {selected.clientes?.nome_razao_social || "—"}
          </RelationalLink>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-lg border bg-card p-2.5 text-center space-y-0.5">
          <div className="flex justify-center text-muted-foreground"><Layers className="h-3.5 w-3.5" /></div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Itens</p>
          <p className="font-mono font-bold text-sm">{kpiItens}</p>
        </div>
        <div className="rounded-lg border bg-card p-2.5 text-center space-y-0.5">
          <div className="flex justify-center text-muted-foreground"><Package className="h-3.5 w-3.5" /></div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Qtd Total</p>
          <p className="font-mono font-bold text-sm">{kpiQtd}</p>
        </div>
        <div className="rounded-lg border bg-card p-2.5 text-center space-y-0.5">
          <div className="flex justify-center text-muted-foreground"><Scale className="h-3.5 w-3.5" /></div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Peso (kg)</p>
          <p className="font-mono font-bold text-sm">{kpiPeso.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border bg-card p-2.5 text-center space-y-0.5">
          <div className="flex justify-center text-muted-foreground"><DollarSign className="h-3.5 w-3.5" /></div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Total</p>
          <p className="font-mono font-bold text-sm text-primary">{formatCurrency(kpiValor)}</p>
        </div>
      </div>

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
                  disabled={generatingToken}
                >
                  <Link2 className="h-3 w-3" />
                  {generatingToken ? "Gerando..." : "Gerar link público"}
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
            const { error } = await supabase.from("orcamentos").delete().eq("id", id);
            if (error) throw error;
            toast.success("Cotação excluída com sucesso.");
            clearStack();
          } catch (err) {
            console.error("[OrcamentoView] erro ao excluir:", err);
            toast.error("Erro ao excluir cotação.");
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
        loading={actionLoading}
      />

      {/* Gerar Pedido confirm */}
      <ConfirmDialog
        open={convertConfirmOpen}
        onClose={() => {
          setConvertConfirmOpen(false);
          setPoNumberCliente("");
          setDataPoCliente("");
        }}
        onConfirm={handleConvertToOV}
        title="Gerar Pedido"
        description={`Isso criará o pedido e irá marcar a cotação ${selected?.numero} como convertida.`}
        confirmLabel="Gerar Pedido"
        confirmVariant="default"
        loading={actionLoading}
      >
        <div className="grid grid-cols-2 gap-3 mt-3">
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
      </ConfirmDialog>
    </div>
  );
}
