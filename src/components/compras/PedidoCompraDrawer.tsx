
import { ViewDrawerV2 } from "@/components/ViewDrawerV2";
import { ViewField, ViewSection } from "@/components/ViewDrawer";
import { StatusBadge } from "@/components/StatusBadge";
import { RelationalLink } from "@/components/ui/RelationalLink";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { LogisticaRastreioSection } from "@/components/logistica/LogisticaRastreioSection";
import { formatCurrency, formatDate } from "@/lib/format";
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
  CheckCircle2,
  Clock,
  Truck,
  XCircle,
} from "lucide-react";
import { PedidoCompra, pedidoNumero } from "./pedidoCompraTypes";

interface PedidoCompraDrawerProps {
  open: boolean;
  onClose: () => void;
  selected: PedidoCompra;
  viewItems: unknown[];
  viewEstoque: unknown[];
  viewFinanceiro: unknown[];
  viewCotacao: { numero: string; status: string; data_cotacao: string } | null;
  onEdit: () => void;
  onDelete: () => void;
  onSend: (p: PedidoCompra) => void;
  onReceive: (p: PedidoCompra) => void;
  onCancel: (p: PedidoCompra) => void;
  statusLabels: Record<string, string>;
}

export function PedidoCompraDrawer({
  open,
  onClose,
  selected,
  viewItems,
  viewEstoque,
  viewFinanceiro,
  viewCotacao,
  onEdit,
  onDelete,
  onSend,
  onReceive,
  onCancel,
  statusLabels,
}: PedidoCompraDrawerProps) {
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

  const estoquePorProduto: Record<string, number> = (viewEstoque as Array<Record<string, unknown>>).reduce<Record<string, number>>(
    (acc: Record<string, number>, m) => {
      const key = String(m.produto_id);
      acc[key] = (acc[key] || 0) + Number(m.quantidade || 0);
      return acc;
    },
    {},
  );

  const totalOrdenado = (viewItems as Array<Record<string, unknown>>).reduce(
    (s, i) => s + Number(i.quantidade || 0),
    0,
  );
  const totalRecebido = (viewEstoque as Array<Record<string, unknown>>).reduce(
    (s, m) => s + Number(m.quantidade || 0),
    0,
  );
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
            <RelationalLink type="fornecedor" id={String(selected.fornecedor_id)}>
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
      {(viewItems as Array<Record<string, unknown>>).length > 0 ? (
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
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Vlr. Unit.</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Total</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground text-success">Rec.</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground text-warning">Pend.</th>
                </tr>
              </thead>
              <tbody>
                {(viewItems as Array<Record<string, unknown>>).map((i, idx) => {
                  const produtos = i.produtos as Record<string, unknown> | null | undefined;
                  const qtdRec = estoquePorProduto[String(i.produto_id)] || 0;
                  const qtdPend = Math.max(0, Number(i.quantidade) - qtdRec);
                  return (
                    <tr key={idx} className="border-b last:border-b-0 hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium">{String(produtos?.nome ?? "—")}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground font-mono hidden sm:table-cell">
                        {String(produtos?.codigo_interno ?? "—")}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{String(i.quantidade)}</td>
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
                      (viewItems as Array<Record<string, unknown>>).reduce(
                        (s, i) => s + Number(i.valor_total || 0),
                        0,
                      ),
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
        {pctRecebimento > 0 && <Progress value={pctRecebimento} className="h-1.5 mt-3" />}
      </div>

      {(viewItems as Array<Record<string, unknown>>).length > 0 && (
        <ViewSection title="Progresso por Item">
          <div className="space-y-3">
            {(viewItems as Array<Record<string, unknown>>).map((i, idx) => {
              const qtdRec = estoquePorProduto[String(i.produto_id)] || 0;
              const qtdPend = Math.max(0, Number(i.quantidade) - qtdRec);
              const pct =
                Number(i.quantidade) > 0
                  ? Math.min(100, Math.round((qtdRec / Number(i.quantidade)) * 100))
                  : 0;
              const produtos = i.produtos as Record<string, unknown> | null | undefined;
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium truncate max-w-[200px]">{String(produtos?.nome ?? "—")}</span>
                    <span className="font-mono text-muted-foreground shrink-0 ml-2 flex items-center gap-1">
                      <span className="text-success font-medium">{qtdRec}</span>
                      <span>/</span>
                      <span>{String(i.quantidade)}</span>
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

      {(viewEstoque as Array<Record<string, unknown>>).length > 0 ? (
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
                {(viewEstoque as Array<Record<string, unknown>>).map((m, idx) => {
                  const produtos = m.produtos as Record<string, unknown> | null | undefined;
                  return (
                    <tr key={idx} className="border-b last:border-b-0 hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium">{String(produtos?.nome ?? "—")}</td>
                      <td className="px-3 py-2 text-right font-mono text-success font-semibold">
                        +{String(m.quantidade)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                        {String(m.saldo_anterior)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-medium">{String(m.saldo_atual)}</td>
                    </tr>
                  );
                })}
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
              {formatCurrency(
                (viewItems as Array<Record<string, unknown>>).reduce(
                  (s, i) => s + Number(i.valor_total || 0),
                  0,
                ),
              )}
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
            <RelationalLink type="fornecedor" id={String(selected.fornecedor_id)}>
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
        {(viewFinanceiro as Array<Record<string, unknown>>).length > 0 ? (
          <div className="space-y-2">
            {(viewFinanceiro as Array<Record<string, unknown>>).map((l, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-md bg-accent/20 px-3 py-2 text-sm"
              >
                <span className="truncate text-xs">{String(l.descricao)}</span>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <StatusBadge status={String(l.status)} />
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

  const canReceive = ["aprovado", "enviado_ao_fornecedor", "aguardando_recebimento", "parcialmente_recebido"].includes(
    selected.status,
  );
  const canSend = selected.status === "aprovado";
  const canCancel = ["rascunho", "aprovado", "enviado_ao_fornecedor", "aguardando_recebimento"].includes(
    selected.status,
  );

  const drawerFooter =
    canReceive || canSend || canCancel ? (
      <div className="flex gap-2 w-full">
        {canCancel && (
          <Button
            variant="outline"
            className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => onCancel(selected)}
          >
            <XCircle className="w-4 h-4" /> Cancelar
          </Button>
        )}
        <div className="flex gap-2 flex-1 justify-end">
          {canSend && (
            <Button variant="outline" className="gap-2" onClick={() => onSend(selected)}>
              <SendHorizontal className="w-4 h-4" /> Marcar como Enviado
            </Button>
          )}
          {canReceive && (
            <Button className="gap-2" onClick={() => onReceive(selected)}>
              <PackageCheck className="w-4 h-4" /> Registrar Recebimento
            </Button>
          )}
        </div>
      </div>
    ) : undefined;

  return (
    <ViewDrawerV2
      open={open}
      onClose={onClose}
      title={pedidoNumero(selected)}
      subtitle={`${selected.fornecedores?.nome_razao_social || "Fornecedor não informado"} · ${formatDate(selected.data_pedido)}`}
      badge={<StatusBadge status={selected.status} label={statusLabels[selected.status] || selected.status} />}
      actions={
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar pedido" onClick={onEdit}>
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
                aria-label="Excluir pedido"
                onClick={onDelete}
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
}
