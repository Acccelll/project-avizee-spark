import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate } from "@/lib/format";
import { RelationalLink } from "@/components/ui/RelationalLink";
import { useRelationalNavigation } from "@/contexts/RelationalNavigationContext";
import { usePublishDrawerSlots } from "@/contexts/RelationalDrawerSlotsContext";
import { LogisticaRastreioSection } from "@/components/logistica/LogisticaRastreioSection";
import { Progress } from "@/components/ui/progress";
import { ViewField, ViewSection } from "@/components/ViewDrawer";
import { Button } from "@/components/ui/button";
import { useDetailFetch } from "@/hooks/useDetailFetch";
import { DetailLoading, DetailError, DetailEmpty } from "@/components/ui/DetailStates";
import { RelatedRecordsStrip } from "@/components/views/RelatedRecordsStrip";
import { canonicalPedidoStatus, pedidoRecebimentoLabel } from "@/components/compras/comprasStatus";
import {
  Truck,
  CheckCircle2,
  ArrowDownToLine,
  Clock,
  FileText,
  AlertCircle,
  Calendar,
  Boxes,
  Building2,
  Receipt,
  Edit,
  DollarSign,
} from "lucide-react";

interface Props {
  id: string;
}

interface PedidoCompraRow {
  id: string;
  numero: string | null;
  fornecedor_id: string | null;
  data_pedido: string | null;
  data_entrega_prevista: string | null;
  data_entrega_real: string | null;
  valor_total: number | null;
  frete_valor: number | null;
  condicao_pagamento: string | null;
  condicoes_pagamento?: string | null;
  status: string;
  observacoes: string | null;
  cotacao_compra_id: string | null;
  fornecedores: { id: string; nome_razao_social: string | null; cpf_cnpj: string | null } | null;
}

interface PedidoItemRow {
  id: string;
  produto_id: string | null;
  quantidade: number | null;
  preco_unitario: number | null;
  subtotal: number | null;
  valor_total?: number | null;
  produtos: { id: string; nome: string | null; sku: string | null; codigo_interno: string | null } | null;
}

interface EstoqueMovRow {
  produto_id: string | null;
  quantidade: number | null;
  saldo_anterior: number | null;
  saldo_atual: number | null;
  produtos: { nome: string | null; codigo_interno: string | null } | null;
}

interface CotacaoRow {
  id: string;
  numero: string;
  status: string;
  data_cotacao: string;
}

interface FinanceiroLancRow {
  id: string;
  descricao: string | null;
  valor: number | null;
  status: string | null;
  data_vencimento: string | null;
}

interface PedidoCompraDetail {
  pedido: PedidoCompraRow;
  itens: PedidoItemRow[];
  estoque: EstoqueMovRow[];
  cotacao: CotacaoRow | null;
  financeiro: FinanceiroLancRow[];
}

function itemValorTotal(i: PedidoItemRow): number {
  return Number(i.valor_total ?? i.subtotal ?? 0);
}

/**
 * Returns the canonical "condição de pagamento" text from the row.
 * The DB has historically used both `condicao_pagamento` and the legacy
 * `condicoes_pagamento` column; we read both but ALWAYS write to the
 * canonical singular form. Detail screens just need to display whichever
 * is populated.
 */
function getCondicaoPagamento(p: PedidoCompraRow): string | null {
  return p.condicao_pagamento ?? p.condicoes_pagamento ?? null;
}

export function PedidoCompraView({ id }: Props) {
  const navigate = useNavigate();
  const { pushView } = useRelationalNavigation();

  const { data, loading, error } = useDetailFetch<PedidoCompraDetail>(id, async (pId, signal) => {
    const { data: p, error: pError } = await supabase
      .from("pedidos_compra")
      .select("*, fornecedores(id, nome_razao_social, cpf_cnpj)")
      .eq("id", pId)
      .abortSignal(signal)
      .maybeSingle();
    if (pError) throw pError;
    if (!p) return null;

    const [itensResult, estResult] = await Promise.all([
      supabase
        .from("pedidos_compra_itens")
        .select("*, produtos(id, nome, sku, codigo_interno)")
        .eq("pedido_compra_id", p.id)
        .abortSignal(signal),
      supabase
        .from("estoque_movimentos")
        .select("*, produtos(nome, codigo_interno)")
        .eq("documento_id", p.id)
        .eq("documento_tipo", "pedido_compra")
        .abortSignal(signal),
    ]);

    let cotacao: CotacaoRow | null = null;
    if (p.cotacao_compra_id) {
      const { data: cot } = await supabase
        .from("cotacoes_compra")
        .select("id, numero, status, data_cotacao")
        .eq("id", p.cotacao_compra_id)
        .abortSignal(signal)
        .maybeSingle();
      cotacao = (cot as CotacaoRow | null) ?? null;
    }

    const { data: finData } = await supabase
      .from("financeiro_lancamentos")
      .select("id, descricao, valor, status, data_vencimento")
      .eq("pedido_compra_id", p.id)
      .eq("ativo", true)
      .abortSignal(signal);

    return {
      pedido: p as PedidoCompraRow,
      itens: (itensResult.data || []) as PedidoItemRow[],
      estoque: (estResult.data || []) as EstoqueMovRow[],
      cotacao,
      financeiro: (finData || []) as FinanceiroLancRow[],
    };
  });

  const selected = data?.pedido ?? null;
  const pedidoStatus = canonicalPedidoStatus(selected?.status);
  const viewItems = data?.itens ?? [];
  const viewEstoque = data?.estoque ?? [];
  const viewCotacao = data?.cotacao ?? null;
  const viewFinanceiro = data?.financeiro ?? [];

  const isOverdue = !!(
    selected &&
    !["recebido", "cancelado"].includes(pedidoStatus) &&
    !!selected.data_entrega_prevista &&
    new Date(selected.data_entrega_prevista) < new Date()
  );

  const recebimentoStatus = (() => {
    if (!selected) return { label: "—", color: "text-muted-foreground", Icon: FileText };
    if (pedidoStatus === "recebido") return { label: "Recebido", color: "text-success", Icon: CheckCircle2 };
    if (pedidoStatus === "parcialmente_recebido") return { label: "Parcial", color: "text-warning", Icon: ArrowDownToLine };
    if (["aguardando_recebimento", "enviado_ao_fornecedor", "aprovado"].includes(pedidoStatus))
      return { label: "Aguardando", color: "text-warning", Icon: Clock };
    if (pedidoStatus === "cancelado") return { label: "Cancelado", color: "text-destructive", Icon: AlertCircle };
    return { label: "Pendente", color: "text-muted-foreground", Icon: FileText };
  })();

  const estoquePorProduto: Record<string, number> = viewEstoque.reduce(
    (acc: Record<string, number>, m: EstoqueMovRow) => {
      const key = String(m.produto_id);
      acc[key] = (acc[key] || 0) + Number(m.quantidade || 0);
      return acc;
    },
    {},
  );
  const totalOrdenado = viewItems.reduce((s, i) => s + Number(i.quantidade || 0), 0);
  const totalRecebido = viewEstoque.reduce((s, m) => s + Number(m.quantidade || 0), 0);
  const pctRecebimento = totalOrdenado > 0 ? Math.min(100, Math.round((totalRecebido / totalOrdenado) * 100)) : 0;

  const pedidoNum = selected?.numero || (selected ? `PC-${selected.id}` : "—");
  const condicaoPagamento = selected ? getCondicaoPagamento(selected) : null;

  usePublishDrawerSlots(`pedido_compra:${id}`, selected ? {
    breadcrumb: `Pedido de Compra · ${pedidoNum}`,
    summary: (
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Boxes className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm leading-tight truncate font-mono">{pedidoNum}</h3>
          <p className="text-[11px] text-muted-foreground">
            {selected.fornecedores?.nome_razao_social || "—"} · {formatDate(selected.data_pedido)}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <StatusBadge status={pedidoStatus} />
            {pctRecebimento > 0 && (
              <span className={`inline-flex items-center rounded-full border bg-muted/50 px-2 py-0.5 text-[10px] font-mono ${pctRecebimento === 100 ? "text-success" : "text-warning"}`}>
                {pctRecebimento}% recebido
              </span>
            )}
            <span className="inline-flex items-center rounded-full border bg-muted/50 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
              {formatCurrency(Number(selected.valor_total || 0))}
            </span>
            {isOverdue && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">
                <AlertCircle className="h-3 w-3" /> Em atraso
              </span>
            )}
          </div>
        </div>
      </div>
    ),
    actions: (
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => navigate(`/pedidos-compra/${selected.id}`)}
      >
        <Edit className="h-3.5 w-3.5" /> Editar
      </Button>
    ),
  } : {});

  if (loading) return <DetailLoading />;
  if (error) return <DetailError message={error.message} />;
  if (!selected) return <DetailEmpty title="Pedido de compra não encontrado" icon={Boxes} />;

  return (
    <div className="space-y-4">
      {/* Strip de registros relacionados — vínculos visíveis sem clicar em "Vínculos". */}
      <RelatedRecordsStrip
        chips={[
          {
            icon: Receipt,
            count: viewCotacao ? 1 : 0,
            label: "Cotação origem",
            tone: "default",
            title: "Cotação que originou este pedido",
          },
          {
            icon: Boxes,
            count: viewEstoque.length,
            label: viewEstoque.length === 1 ? "Movimento estoque" : "Movimentos estoque",
            tone: "success",
            title: "Movimentos de estoque registrados pelo recebimento",
          },
          {
            icon: DollarSign,
            count: viewFinanceiro.length,
            label: viewFinanceiro.length === 1 ? "Lançamento financeiro" : "Lançamentos financeiros",
            tone: "default",
            title: "Lançamentos a pagar gerados pelo recebimento",
          },
        ]}
      />

      <Tabs defaultValue="resumo" className="w-full">
        <TabsList className="w-full grid grid-cols-5">
          <TabsTrigger value="resumo" className="text-[11px]">Resumo</TabsTrigger>
          <TabsTrigger value="itens" className="text-[11px]">Itens ({viewItems.length})</TabsTrigger>
          <TabsTrigger value="recebimento" className="text-[11px]">Recebimento</TabsTrigger>
          <TabsTrigger value="condicoes" className="text-[11px]">Condições</TabsTrigger>
          <TabsTrigger value="vinculos" className="text-[11px]">Vínculos</TabsTrigger>
        </TabsList>

        {/* ── Resumo ────────────────────────────────── */}
        <TabsContent value="resumo" className="space-y-4 mt-3">
          {isOverdue && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Entrega prevista em {formatDate(selected.data_entrega_prevista)} — pedido em atraso.
            </div>
          )}
          <ViewSection title="Pedido">
            <div className="grid grid-cols-2 gap-3">
              <ViewField label="Nº">
                <span className="font-mono font-medium">{pedidoNum}</span>
              </ViewField>
              <ViewField label="Status">
                <StatusBadge status={pedidoStatus} />
              </ViewField>
              <ViewField label="Data Pedido">{formatDate(selected.data_pedido)}</ViewField>
              <ViewField label="Valor Total">
                <span className="font-semibold font-mono text-primary">
                  {formatCurrency(selected.valor_total || 0)}
                </span>
              </ViewField>
            </div>
          </ViewSection>

          <ViewSection title="Fornecedor">
            <ViewField label="Fornecedor">
              {selected.fornecedores?.id ? (
                <RelationalLink onClick={() => pushView("fornecedor", selected.fornecedores!.id)}>
                  {selected.fornecedores.nome_razao_social || "—"}
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
                  <RelationalLink to="/cotacoes-compra">
                    <Receipt className="h-3.5 w-3.5" />
                    {viewCotacao.numero}
                  </RelationalLink>
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
        </TabsContent>

        {/* ── Itens ──────────────────────────────────── */}
        <TabsContent value="itens" className="space-y-3 mt-3">
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-muted-foreground">Produto</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold text-muted-foreground">Qtd</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold text-muted-foreground">Total</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold text-muted-foreground text-success">Rec.</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold text-muted-foreground text-warning">Pend.</th>
                </tr>
              </thead>
              <tbody>
                {viewItems.map((i: PedidoItemRow, idx: number) => {
                  const qtdRec = estoquePorProduto[String(i.produto_id)] || 0;
                  const qtdPend = Math.max(0, Number(i.quantidade) - qtdRec);
                  return (
                    <tr key={idx} className="border-b last:border-b-0 hover:bg-muted/20">
                      <td className="px-2 py-2">
                        <button
                          onClick={() => i.produtos?.id && pushView("produto", i.produtos.id)}
                          className="text-left hover:underline block truncate max-w-[120px]"
                        >
                          {i.produtos?.nome || "—"}
                        </button>
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-xs">{i.quantidade}</td>
                      <td className="px-2 py-2 text-right font-mono text-xs font-medium">
                        {formatCurrency(itemValorTotal(i))}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-xs text-success font-medium">
                        {qtdRec > 0 ? qtdRec : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-xs text-warning font-medium">
                        {qtdPend > 0 ? qtdPend : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── Recebimento ────────────────────────────── */}
        <TabsContent value="recebimento" className="space-y-4 mt-3">
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground uppercase font-semibold mb-2">Situação de Recebimento</p>
            <div className="flex items-center gap-3">
              <recebimentoStatus.Icon className={`h-5 w-5 shrink-0 ${recebimentoStatus.color}`} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{pedidoRecebimentoLabel(pedidoStatus)}</p>
                <p className="text-xs text-muted-foreground">{selected.status}</p>
              </div>
              {pctRecebimento > 0 && (
                <span className={`text-sm font-bold font-mono shrink-0 ${pctRecebimento === 100 ? "text-success" : "text-warning"}`}>
                  {pctRecebimento}%
                </span>
              )}
            </div>
            {pctRecebimento > 0 && <Progress value={pctRecebimento} className="h-1.5 mt-3" />}
          </div>

          {viewItems.length > 0 && (
            <ViewSection title="Progresso por Item">
              <div className="space-y-3">
                {viewItems.map((i: PedidoItemRow, idx: number) => {
                  const qtdRec = estoquePorProduto[String(i.produto_id)] || 0;
                  const qtdPend = Math.max(0, Number(i.quantidade) - qtdRec);
                  const pct = Number(i.quantidade) > 0 ? Math.min(100, Math.round((qtdRec / Number(i.quantidade)) * 100)) : 0;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-medium truncate max-w-[180px]">{i.produtos?.nome || "—"}</span>
                        <span className="font-mono text-muted-foreground shrink-0 ml-2 flex items-center gap-1">
                          <span className="text-success font-medium">{qtdRec}</span>
                          <span>/</span>
                          <span>{i.quantidade}</span>
                          {qtdPend > 0 && <span className="text-warning ml-1">({qtdPend} pend.)</span>}
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
              <div className="grid grid-cols-2 gap-3">
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
                      <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Produto</th>
                      <th className="px-2 py-2 text-right font-semibold text-muted-foreground">Qtd</th>
                      <th className="px-2 py-2 text-right font-semibold text-muted-foreground">Saldo Ant.</th>
                      <th className="px-2 py-2 text-right font-semibold text-muted-foreground">Saldo Atu.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewEstoque.map((m: EstoqueMovRow, idx: number) => (
                      <tr key={idx} className="border-b last:border-b-0 hover:bg-muted/20">
                        <td className="px-2 py-2 font-medium">{m.produtos?.nome || "—"}</td>
                        <td className="px-2 py-2 text-right font-mono text-success font-semibold">+{m.quantidade}</td>
                        <td className="px-2 py-2 text-right font-mono text-muted-foreground">{m.saldo_anterior}</td>
                        <td className="px-2 py-2 text-right font-mono font-medium">{m.saldo_atual}</td>
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
              {["recebido", "parcialmente_recebido"].includes(pedidoStatus)
                ? "Movimentações de estoque não encontradas."
                : "Nenhum recebimento registrado ainda."}
            </div>
          )}

          <ViewSection title="Logística / Rastreamento">
            <LogisticaRastreioSection pedidoCompraId={selected.id} />
          </ViewSection>
        </TabsContent>

        {/* ── Condições ──────────────────────────────── */}
        <TabsContent value="condicoes" className="space-y-4 mt-3">
          <ViewSection title="Pagamento">
            <div className="grid grid-cols-2 gap-3">
              <ViewField label="Cond. Pagamento">
                {condicaoPagamento || (
                  <span className="text-muted-foreground">Não informado</span>
                )}
              </ViewField>
              <ViewField label="Frete">
                <span className="font-mono">
                  {selected.frete_valor ? formatCurrency(Number(selected.frete_valor)) : "—"}
                </span>
              </ViewField>
            </div>
          </ViewSection>

          <ViewSection title="Entregas">
            <div className="grid grid-cols-2 gap-3">
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
                  {formatCurrency(viewItems.reduce((s, i) => s + itemValorTotal(i), 0))}
                </span>
              </div>
              {Number(selected.frete_valor) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Truck className="h-3.5 w-3.5" /> Frete
                  </span>
                  <span className="font-mono">{formatCurrency(Number(selected.frete_valor))}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold border-t pt-2">
                <span>Total</span>
                <span className="font-mono text-primary">{formatCurrency(Number(selected.valor_total || 0))}</span>
              </div>
            </div>
          </ViewSection>

          {selected.observacoes && (
            <ViewSection title="Observações">
              <p className="text-sm text-muted-foreground italic">{selected.observacoes}</p>
            </ViewSection>
          )}
        </TabsContent>

        {/* ── Vínculos ───────────────────────────────── */}
        <TabsContent value="vinculos" className="space-y-4 mt-3">
          <ViewSection title="Fornecedor">
            <ViewField label="Fornecedor">
              {selected.fornecedores?.id ? (
                <RelationalLink onClick={() => pushView("fornecedor", selected.fornecedores!.id)}>
                  <Building2 className="h-3.5 w-3.5" />
                  {selected.fornecedores.nome_razao_social || "—"}
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

          <ViewSection title="Estoque">
            {viewEstoque.length > 0 ? (
              <p className="text-sm text-success flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                {viewEstoque.length} {viewEstoque.length !== 1 ? "entradas de estoque registradas" : "entrada de estoque registrada"}.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma movimentação de estoque registrada.</p>
            )}
          </ViewSection>

          <ViewSection title="Lançamentos Financeiros">
            {viewFinanceiro.length > 0 ? (
              <div className="space-y-2">
                {viewFinanceiro.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{l.descricao || "—"}</p>
                      <p className="text-muted-foreground">
                        Venc. {formatDate(l.data_vencimento)}
                      </p>
                    </div>
                    {l.status && <StatusBadge status={l.status} />}
                    <span className="font-mono font-semibold shrink-0">
                      {formatCurrency(Number(l.valor || 0))}
                    </span>
                  </div>
                ))}
                <RelationalLink to={`/financeiro?pedido_compra_id=${selected.id}`}>
                  <DollarSign className="h-3.5 w-3.5" />
                  Abrir no Financeiro
                </RelationalLink>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum lançamento financeiro vinculado.</p>
            )}
          </ViewSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}
