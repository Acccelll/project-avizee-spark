import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate } from "@/lib/format";
import { RelationalLink } from "@/components/ui/RelationalLink";
import { useRelationalNavigation } from "@/contexts/RelationalNavigationContext";
import { LogisticaRastreioSection } from "@/components/logistica/LogisticaRastreioSection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { calcularStatusFaturamentoOV } from "@/lib/fiscal";
import { toast } from "sonner";
import {
  FileOutput,
  DollarSign,
  Package,
  Scale,
  FileText,
  Truck,
  CalendarClock,
  Receipt,
  Link2,
  AlertTriangle,
} from "lucide-react";

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

const statusFaturamentoLabels: Record<string, string> = {
  aguardando: "Aguardando Faturamento",
  parcial: "Faturamento Parcial",
  total: "Faturado",
};

const statusFaturamentoColors: Record<string, string> = {
  aguardando: "bg-warning/10 text-warning border-warning/30",
  parcial: "bg-info/10 text-info border-info/30",
  total: "bg-success/10 text-success border-success/30",
};

const statusFinanceiroColors: Record<string, string> = {
  aberto: "bg-warning/10 text-warning border-warning/30",
  parcial: "bg-info/10 text-info border-info/30",
  pago: "bg-success/10 text-success border-success/30",
  vencido: "bg-destructive/10 text-destructive border-destructive/30",
};

const statusFinanceiroLabels: Record<string, string> = {
  aberto: "Em Aberto",
  parcial: "Pago Parcialmente",
  pago: "Pago",
  vencido: "Vencido",
  cancelado: "Cancelado",
  estornado: "Estornado",
};

const statusNFLabels: Record<string, string> = {
  pendente: "Pendente",
  autorizada: "Autorizada",
  cancelada: "Cancelada",
  denegada: "Denegada",
};

export function OrdemVendaView({ id }: Props) {
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [notasFiscais, setNotasFiscais] = useState<any[]>([]);
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [generateNfOpen, setGenerateNfOpen] = useState(false);
  const [generatingNf, setGeneratingNf] = useState(false);
  const { pushView } = useRelationalNavigation();

  const fetchData = useCallback(async () => {
    setLoading(true);

    const { data: ov } = await supabase
      .from("ordens_venda")
      .select(
        "*, clientes(id, nome_razao_social), orcamentos(id, numero, pagamento, prazo_pagamento, prazo_entrega, frete_tipo, observacoes)"
      )
      .eq("id", id)
      .maybeSingle();

    if (!ov) {
      setSelected(null);
      setItems([]);
      setLoading(false);
      return;
    }
    setSelected(ov);

    const [{ data: itens }, { data: nfs }] = await Promise.all([
      supabase
        .from("ordens_venda_itens")
        .select("*, produtos(id, nome, sku)")
        .eq("ordem_venda_id", ov.id),
      supabase
        .from("notas_fiscais")
        .select("id, numero, status, valor_total, data_emissao")
        .eq("ordem_venda_id", ov.id)
        .eq("ativo", true),
    ]);

    setItems(itens || []);
    const nfList = nfs || [];
    setNotasFiscais(nfList);

    if (nfList.length > 0) {
      const nfIds = nfList.map((n: any) => n.id);
      const { data: lanc } = await supabase
        .from("financeiro_lancamentos")
        .select("id, descricao, valor, status, data_vencimento, data_pagamento, forma_pagamento, parcela_numero, parcela_total")
        .in("nota_fiscal_id", nfIds)
        .eq("ativo", true)
        .order("data_vencimento", { ascending: true });
      setLancamentos(lanc || []);
    } else {
      setLancamentos([]);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerateNF = async () => {
    if (!selected) return;
    setGeneratingNf(true);
    try {
      const { data: pedidoItems } = await supabase
        .from("ordens_venda_itens")
        .select("*")
        .eq("ordem_venda_id", selected.id);

      const { count } = await supabase
        .from("notas_fiscais")
        .select("*", { count: "exact", head: true });
      const nfNumero = String((count || 0) + 1).padStart(6, "0");

      const totalProdutos = (pedidoItems || []).reduce(
        (s: number, i: any) => s + Number(i.valor_total || 0),
        0
      );

      const { data: newNF, error } = await supabase
        .from("notas_fiscais")
        .insert({
          numero: nfNumero,
          tipo: "saida",
          data_emissao: new Date().toISOString().split("T")[0],
          cliente_id: selected.cliente_id,
          ordem_venda_id: selected.id,
          valor_total: totalProdutos,
          status: "pendente",
          movimenta_estoque: true,
          gera_financeiro: true,
          observacoes: `Gerada a partir do Pedido ${selected.numero}`,
        })
        .select()
        .single();

      if (error) throw error;

      if (pedidoItems && pedidoItems.length > 0 && newNF) {
        const nfItems = pedidoItems.map((i: any) => ({
          nota_fiscal_id: newNF.id,
          produto_id: i.produto_id,
          quantidade: i.quantidade,
          valor_unitario: i.valor_unitario,
        }));
        await supabase.from("notas_fiscais_itens").insert(nfItems);
      }

      if (pedidoItems) {
        await Promise.all(
          pedidoItems.map((item: any) =>
            supabase
              .from("ordens_venda_itens")
              .update({ quantidade_faturada: (item.quantidade_faturada || 0) + item.quantidade })
              .eq("id", item.id)
          )
        );
      }

      const { data: updatedItems } = await supabase
        .from("ordens_venda_itens")
        .select("quantidade, quantidade_faturada")
        .eq("ordem_venda_id", selected.id);
      const totalQ = (updatedItems || []).reduce((s: number, i: any) => s + Number(i.quantidade), 0);
      const totalF = (updatedItems || []).reduce(
        (s: number, i: any) => s + Number(i.quantidade_faturada || 0),
        0
      );
      const newFatStatus = calcularStatusFaturamentoOV(totalQ, totalF);
      await supabase
        .from("ordens_venda")
        .update({ status_faturamento: newFatStatus })
        .eq("id", selected.id);

      toast.success(`NF ${nfNumero} gerada a partir do Pedido ${selected.numero}!`);
      await fetchData();
    } catch (err: any) {
      console.error("[OrdemVendaView] gerar NF:", err);
      toast.error("Erro ao gerar Nota Fiscal.");
    } finally {
      setGeneratingNf(false);
      setGenerateNfOpen(false);
    }
  };

  if (loading) return <div className="p-8 text-center animate-pulse">Carregando pedido...</div>;
  if (!selected) return <div className="p-8 text-center text-destructive">Pedido não encontrado</div>;

  const pesoTotal = items.reduce((s: number, i: any) => s + Number(i.peso_total || 0), 0);
  const qtdTotal = items.reduce((s: number, i: any) => s + Number(i.quantidade || 0), 0);
  const canGenerateNF =
    ["aprovada", "em_separacao", "separado"].includes(selected.status) &&
    selected.status_faturamento !== "total";

  const valorFaturado = notasFiscais.reduce((s: number, n: any) => s + Number(n.valor_total || 0), 0);
  const valorPendente = Math.max(0, Number(selected.valor_total || 0) - valorFaturado);

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center gap-1.5 flex-wrap border-b pb-3">
        {canGenerateNF && (
          <Button
            size="sm"
            variant="default"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setGenerateNfOpen(true)}
            disabled={generatingNf}
          >
            <FileOutput className="h-3.5 w-3.5" /> Gerar NF
          </Button>
        )}
        {notasFiscais.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={() => pushView("nota_fiscal", notasFiscais[0].id)}
          >
            <FileText className="h-3.5 w-3.5" /> Ver NF {notasFiscais[0].numero}
          </Button>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="bg-muted/30 rounded-lg p-3 text-center">
          <p className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center justify-center gap-1 mb-1">
            <DollarSign className="h-3 w-3" /> Valor Total
          </p>
          <p className="text-sm font-bold font-mono text-primary">{formatCurrency(selected.valor_total || 0)}</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-3 text-center">
          <p className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center justify-center gap-1 mb-1">
            <Package className="h-3 w-3" /> Itens / Qtd
          </p>
          <p className="text-sm font-bold font-mono">{items.length} / {qtdTotal}</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-3 text-center">
          <p className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center justify-center gap-1 mb-1">
            <Scale className="h-3 w-3" /> Peso Total
          </p>
          <p className="text-sm font-bold font-mono">{pesoTotal > 0 ? `${pesoTotal.toFixed(2)} kg` : "—"}</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-3 text-center">
          <p className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center justify-center gap-1 mb-1">
            <Receipt className="h-3 w-3" /> Faturamento
          </p>
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0.5 ${statusFaturamentoColors[selected.status_faturamento] || ""}`}
          >
            {statusFaturamentoLabels[selected.status_faturamento] || selected.status_faturamento}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="resumo" className="w-full">
        <TabsList className="w-full justify-start mb-1">
          <TabsTrigger value="resumo" className="text-xs">Resumo</TabsTrigger>
          <TabsTrigger value="itens" className="text-xs">Itens</TabsTrigger>
          <TabsTrigger value="logistica" className="text-xs">Logística</TabsTrigger>
          <TabsTrigger value="faturamento" className="text-xs">Faturamento</TabsTrigger>
          <TabsTrigger value="vinculos" className="text-xs">Vínculos</TabsTrigger>
        </TabsList>

        {/* ── Resumo ─────────────────────────────────────── */}
        <TabsContent value="resumo" className="space-y-4 mt-3 text-sm">
          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Status Operacional</p>
              <div className="mt-0.5">
                <StatusBadge status={selected.status} />
              </div>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Cliente</p>
              <RelationalLink onClick={() => pushView("cliente", selected.clientes?.id)}>
                {selected.clientes?.nome_razao_social || "—"}
              </RelationalLink>
            </div>
            {selected.cotacao_id && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Cotação de Origem</p>
                <RelationalLink type="orcamento" id={selected.cotacao_id}>
                  {selected.orcamentos?.numero ? `Cotação ${selected.orcamentos.numero}` : "Ver cotação"}
                </RelationalLink>
              </div>
            )}
            {selected.po_number && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">PO do Cliente</p>
                <p className="font-mono">{selected.po_number}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Data de Emissão</p>
                <p>{formatDate(selected.data_emissao)}</p>
              </div>
              {selected.data_aprovacao && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Data de Aprovação</p>
                  <p>{formatDate(selected.data_aprovacao)}</p>
                </div>
              )}
              {selected.data_prometida_despacho && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                    <CalendarClock className="inline h-3 w-3 mr-0.5" /> Despacho Prometido
                  </p>
                  <p>{formatDate(selected.data_prometida_despacho)}</p>
                </div>
              )}
              {selected.prazo_despacho_dias != null && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Prazo Despacho</p>
                  <p>{selected.prazo_despacho_dias} dias</p>
                </div>
              )}
            </div>
            {selected.orcamentos?.pagamento && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Condição de Pagamento</p>
                <p>{pagamentoLabels[selected.orcamentos.pagamento] || selected.orcamentos.pagamento}
                  {selected.orcamentos.prazo_pagamento ? ` — ${selected.orcamentos.prazo_pagamento}` : ""}
                </p>
              </div>
            )}
            {selected.orcamentos?.frete_tipo && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Tipo de Frete</p>
                <p>{freteTipoLabels[selected.orcamentos.frete_tipo] || selected.orcamentos.frete_tipo}</p>
              </div>
            )}
            {selected.orcamentos?.prazo_entrega && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Prazo de Entrega (Cotação)</p>
                <p>{selected.orcamentos.prazo_entrega}</p>
              </div>
            )}
            {selected.observacoes && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Observações</p>
                <p className="text-xs text-muted-foreground italic">{selected.observacoes}</p>
              </div>
            )}
            {selected.status === "cancelada" && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                <p className="text-xs text-destructive">Este pedido foi cancelado.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Itens ──────────────────────────────────────── */}
        <TabsContent value="itens" className="space-y-3 mt-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum item encontrado.</p>
          ) : (
            <>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="px-2 py-2 text-left text-[10px] font-semibold text-muted-foreground">Produto</th>
                      <th className="px-2 py-2 text-left text-[10px] font-semibold text-muted-foreground hidden sm:table-cell">Un.</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold text-muted-foreground">Qtd</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold text-muted-foreground hidden sm:table-cell">Unit.</th>
                      <th className="px-2 py-2 text-right text-[10px] font-semibold text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i: any, idx: number) => (
                      <tr key={idx} className="border-b last:border-b-0 hover:bg-muted/20">
                        <td className="px-2 py-2">
                          <button
                            onClick={() => i.produtos?.id && pushView("produto", i.produtos.id)}
                            className="text-left hover:underline block"
                          >
                            <span className="truncate max-w-[110px] block text-xs font-medium">
                              {i.produtos?.nome || i.descricao_snapshot || "—"}
                            </span>
                            {i.produtos?.sku && (
                              <span className="text-[10px] text-muted-foreground font-mono">{i.produtos.sku}</span>
                            )}
                            {i.variacao && (
                              <span className="text-[10px] text-muted-foreground"> · {i.variacao}</span>
                            )}
                          </button>
                        </td>
                        <td className="px-2 py-2 text-xs text-muted-foreground hidden sm:table-cell">
                          {i.unidade || "—"}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-xs">{i.quantidade}</td>
                        <td className="px-2 py-2 text-right font-mono text-xs hidden sm:table-cell">
                          {formatCurrency(i.valor_unitario)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-xs font-medium">
                          {formatCurrency(i.valor_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center rounded-lg border bg-muted/30 px-3 py-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Total do Pedido</span>
                <span className="font-mono text-sm font-bold text-primary">{formatCurrency(selected.valor_total || 0)}</span>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Logística ─────────────────────────────────── */}
        <TabsContent value="logistica" className="space-y-4 mt-3">
          <h4 className="text-xs font-semibold flex items-center gap-2 px-1 text-muted-foreground uppercase">
            <Truck className="w-3.5 h-3.5" /> Rastreamento / Remessas
          </h4>
          <LogisticaRastreioSection ordemVendaId={selected.id} />
        </TabsContent>

        {/* ── Faturamento ───────────────────────────────── */}
        <TabsContent value="faturamento" className="space-y-4 mt-3 text-sm">
          {/* Status summary */}
          <div className="rounded-lg border p-3 space-y-2 bg-muted/10">
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">Situação</span>
              <Badge
                variant="outline"
                className={`text-xs ${statusFaturamentoColors[selected.status_faturamento] || ""}`}
              >
                {statusFaturamentoLabels[selected.status_faturamento] || selected.status_faturamento}
              </Badge>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Valor do Pedido</span>
              <span className="font-mono font-medium">{formatCurrency(selected.valor_total || 0)}</span>
            </div>
            {valorFaturado > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Valor Faturado</span>
                <span className="font-mono text-success font-medium">{formatCurrency(valorFaturado)}</span>
              </div>
            )}
            {valorPendente > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">A Faturar</span>
                <span className="font-mono text-warning font-medium">{formatCurrency(valorPendente)}</span>
              </div>
            )}
          </div>

          {/* Notas Fiscais */}
          {notasFiscais.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">Notas Fiscais Vinculadas</p>
              {notasFiscais.map((nf: any) => (
                <div
                  key={nf.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-muted/20"
                >
                  <div>
                    <p className="font-mono text-xs font-medium">NF {nf.numero}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(nf.data_emissao)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{formatCurrency(nf.valor_total || 0)}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5">
                      {statusNFLabels[nf.status] || nf.status}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => pushView("nota_fiscal", nf.id)}
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center border rounded-lg bg-muted/10">
              <Receipt className="w-7 h-7 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">Nenhuma Nota Fiscal emitida ainda.</p>
              {canGenerateNF && (
                <Button
                  size="sm"
                  variant="default"
                  className="mt-3 h-7 text-xs gap-1"
                  onClick={() => setGenerateNfOpen(true)}
                >
                  <FileOutput className="h-3 w-3" /> Gerar NF
                </Button>
              )}
            </div>
          )}

          {/* Lançamentos Financeiros */}
          {lancamentos.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">Lançamentos Financeiros</p>
              {lancamentos.map((l: any) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <div>
                    <p className="text-xs font-medium truncate max-w-[150px]">{l.descricao}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Venc.: {formatDate(l.data_vencimento)}
                      {l.parcela_total && l.parcela_numero
                        ? ` · Parc. ${l.parcela_numero}/${l.parcela_total}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{formatCurrency(l.valor)}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 ${statusFinanceiroColors[l.status] || ""}`}
                    >
                      {statusFinanceiroLabels[l.status] || l.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Vínculos / Histórico ──────────────────────── */}
        <TabsContent value="vinculos" className="space-y-4 mt-3 text-sm">
          <div className="space-y-3">
            <p className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1.5">
              <Link2 className="h-3 w-3" /> Entidades Relacionadas
            </p>

            {selected.clientes && (
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Cliente</p>
                  <RelationalLink onClick={() => pushView("cliente", selected.clientes.id)}>
                    {selected.clientes.nome_razao_social}
                  </RelationalLink>
                </div>
              </div>
            )}

            {selected.cotacao_id && (
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Cotação de Origem</p>
                  <RelationalLink type="orcamento" id={selected.cotacao_id}>
                    {selected.orcamentos?.numero ? `Cotação ${selected.orcamentos.numero}` : "Ver cotação"}
                  </RelationalLink>
                </div>
              </div>
            )}

            {notasFiscais.map((nf: any) => (
              <div key={nf.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Nota Fiscal</p>
                  <RelationalLink onClick={() => pushView("nota_fiscal", nf.id)}>
                    NF {nf.numero} · {formatDate(nf.data_emissao)}
                  </RelationalLink>
                </div>
                <Badge variant="outline" className="text-[10px] px-1.5">
                  {statusNFLabels[nf.status] || nf.status}
                </Badge>
              </div>
            ))}

            <div className="border rounded-lg p-3 space-y-2 bg-muted/10">
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">Histórico de Datas</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Emissão</span>
                  <span>{formatDate(selected.data_emissao)}</span>
                </div>
                {selected.data_aprovacao && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Aprovação</span>
                    <span>{formatDate(selected.data_aprovacao)}</span>
                  </div>
                )}
                {selected.data_prometida_despacho && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Despacho Prometido</span>
                    <span>{formatDate(selected.data_prometida_despacho)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Última Atualização</span>
                  <span>{formatDate(selected.updated_at)}</span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={generateNfOpen}
        onClose={() => setGenerateNfOpen(false)}
        onConfirm={handleGenerateNF}
        title="Gerar Nota Fiscal"
        description={`Deseja gerar uma Nota Fiscal de saída para o Pedido ${selected.numero}? Todos os itens serão incluídos.`}
      />
    </div>
  );
}
