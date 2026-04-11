// @ts-nocheck
import { useMemo } from "react";
import { FormModal } from "@/components/FormModal";
import { StatusBadge } from "@/components/StatusBadge";
import { AutocompleteSearch } from "@/components/ui/AutocompleteSearch";
import { ItemsGrid, type GridItem } from "@/components/ui/ItemsGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/format";
import { statusPedidoCompra } from "@/lib/statusSchema";
import {
  AlertCircle,
  ArrowDownToLine,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Receipt,
  XCircle,
} from "lucide-react";
import type { PedidoCompra, ProdutoOptionRow } from "./pedidoCompraTypes";
import { pedidoNumero } from "./pedidoCompraTypes";

interface PedidoCompraFormModalProps {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  selected: PedidoCompra | null;
  form: Record<string, string>;
  setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  items: GridItem[];
  setItems: React.Dispatch<React.SetStateAction<GridItem[]>>;
  saving: boolean;
  fornecedorOptions: { id: string; label: string; sublabel: string }[];
  produtosOptionsData: (ProdutoOptionRow & { id: string; nome: string; codigo_interno: string; preco_venda: number; unidade_medida: string })[];
  formasPagamento: { id: string; descricao: string }[];
  fornecedoresLoading: boolean;
  produtosLoading: boolean;
  viewEstoque: unknown[];
  viewCotacao: { numero: string; status: string } | null;
  statusLabels: Record<string, string>;
  onSubmit: (e: React.FormEvent) => Promise<void>;
}

export function PedidoCompraFormModal({
  open,
  onClose,
  mode,
  selected,
  form,
  setForm,
  items,
  setItems,
  saving,
  fornecedorOptions,
  produtosOptionsData,
  formasPagamento,
  fornecedoresLoading,
  produtosLoading,
  viewEstoque,
  viewCotacao,
  statusLabels,
  onSubmit,
}: PedidoCompraFormModalProps) {
  const valorProdutos = items.reduce((s, i) => s + Number(i.valor_total || 0), 0);
  const valorTotal = valorProdutos + Number(form.frete_valor || 0);

  const dataEntregaError = useMemo(() => {
    if (!form.data_pedido || !form.data_entrega_prevista) return null;
    if (form.data_entrega_prevista < form.data_pedido) {
      return "A data de entrega prevista não pode ser anterior à data do pedido.";
    }
    return null;
  }, [form.data_pedido, form.data_entrega_prevista]);

  const editBanner = mode === "edit" && selected
    ? (() => {
        const estoquePorProdutoEdit: Record<string, number> = (viewEstoque as Record<string, unknown>[]).reduce(
          (acc: Record<string, number>, m) => {
            const key = String(m.produto_id);
            acc[key] = (acc[key] || 0) + Number(m.quantidade || 0);
            return acc;
          },
          {},
        );
        const totalOrdenadoEdit = items.reduce((s, i) => s + Number(i.quantidade || 0), 0);
        const totalRecebidoEdit = Object.values(estoquePorProdutoEdit).reduce((s, v) => s + v, 0);
        const pctEdit = totalOrdenadoEdit > 0 ? Math.min(100, Math.round((totalRecebidoEdit / totalOrdenadoEdit) * 100)) : 0;

        const recStatusEdit = (() => {
          const s = form.status;
          if (s === "recebido") return { label: "Recebido", colorClass: "text-success", Icon: CheckCircle2 };
          if (s === "parcialmente_recebido") return { label: "Parcial", colorClass: "text-warning", Icon: ArrowDownToLine };
          if (["aguardando_recebimento", "enviado_ao_fornecedor", "aprovado"].includes(s))
            return { label: "Aguardando", colorClass: "text-warning", Icon: Clock };
          if (s === "cancelado") return { label: "Cancelado", colorClass: "text-destructive", Icon: XCircle };
          return { label: "Rascunho", colorClass: "text-muted-foreground", Icon: FileText };
        })();
        const RecStatusIcon = recStatusEdit.Icon;

        const isEditOverdue =
          !["recebido", "cancelado"].includes(form.status) &&
          !!selected.data_entrega_prevista &&
          new Date(selected.data_entrega_prevista) < new Date();

        return (
          <div className="rounded-lg border bg-accent/20 p-4 space-y-3">
            {isEditOverdue && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Entrega prevista em {formatDate(selected.data_entrega_prevista)} — pedido em atraso.
              </div>
            )}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-base text-primary">{pedidoNumero(selected)}</span>
                  <StatusBadge status={form.status} label={statusLabels[form.status] || form.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <Building2 className="inline h-3 w-3 mr-1" />
                  {selected.fornecedores?.nome_razao_social || "—"}
                  {selected.fornecedores?.cpf_cnpj && (
                    <span className="ml-1 opacity-60">· {selected.fornecedores.cpf_cnpj}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  <Calendar className="inline h-3 w-3 mr-1" />
                  Pedido em {formatDate(selected.data_pedido)}
                  {selected.data_entrega_prevista && (
                    <span className={isEditOverdue ? "text-destructive font-medium" : ""}>
                      {" "}· Entrega prevista {formatDate(selected.data_entrega_prevista)}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 border-t pt-3">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total</p>
                <p className="font-mono font-semibold text-sm text-primary">{formatCurrency(valorTotal)}</p>
                {Number(form.frete_valor || 0) > 0 && (
                  <p className="text-[10px] text-muted-foreground font-mono">
                    + {formatCurrency(Number(form.frete_valor))} frete
                  </p>
                )}
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Recebimento</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <RecStatusIcon className={`h-3.5 w-3.5 shrink-0 ${recStatusEdit.colorClass}`} />
                  <p className={`font-semibold text-xs ${recStatusEdit.colorClass}`}>
                    {pctEdit > 0 ? `${pctEdit}%` : recStatusEdit.label}
                  </p>
                </div>
                {pctEdit > 0 && <Progress value={pctEdit} className="h-1 mt-1" />}
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Cotação</p>
                {viewCotacao ? (
                  <p className="font-mono font-semibold text-xs flex items-center gap-1 mt-0.5">
                    <Receipt className="h-3 w-3 text-muted-foreground" />
                    {viewCotacao.numero}
                  </p>
                ) : selected.cotacao_compra_id ? (
                  <p className="font-mono text-xs text-muted-foreground mt-0.5">Carregando...</p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">Avulso</p>
                )}
              </div>
            </div>
          </div>
        );
      })()
    : null;

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={
        mode === "create"
          ? "Novo Pedido de Compra"
          : `Editando ${selected ? pedidoNumero(selected) : "Pedido"}`
      }
      size="xl"
    >
      <form onSubmit={onSubmit} className="space-y-5">
        {editBanner}

        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Datas e Status
          </p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Data do Pedido</Label>
              <Input
                type="date"
                value={form.data_pedido}
                onChange={(e) => setForm({ ...form, data_pedido: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Entrega Prevista</Label>
              <Input
                type="date"
                value={form.data_entrega_prevista}
                onChange={(e) => setForm({ ...form, data_entrega_prevista: e.target.value })}
                className={dataEntregaError ? "border-destructive" : ""}
              />
              {dataEntregaError && (
                <p className="text-xs text-destructive">{dataEntregaError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Status do Pedido</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(statusPedidoCompra).map(([value, { label }]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-lg bg-accent/30 p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Fornecedor
          </p>
          <AutocompleteSearch
            options={fornecedorOptions}
            value={String(form.fornecedor_id || "")}
            onChange={(id) => setForm({ ...form, fornecedor_id: id })}
            placeholder={fornecedoresLoading ? "Carregando fornecedores..." : "Buscar por nome ou CNPJ..."}
          />
          {!fornecedoresLoading && fornecedorOptions.length === 0 && (
            <p className="text-xs text-warning">
              Nenhum fornecedor disponível. Verifique cadastro/ativo no banco legado.
            </p>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {mode === "edit" ? "Itens Fechados" : "Itens do Pedido"}
          </p>
          {!produtosLoading && produtosOptionsData.length === 0 && (
            <p className="text-xs text-warning">
              Nenhum produto disponível para seleção. Verifique cadastro/ativo no banco legado.
            </p>
          )}
          <ItemsGrid
            items={items}
            onChange={setItems}
            produtos={produtosOptionsData}
            title={produtosLoading ? "Carregando produtos..." : ""}
          />
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {mode === "edit" ? "Condições Finais" : "Condições"}
          </p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Frete (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.frete_valor}
                onChange={(e) => setForm({ ...form, frete_valor: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>Condição de Pagamento</Label>
              <Select
                value={form.condicao_pagamento || ""}
                onValueChange={(v) => setForm({ ...form, condicao_pagamento: v === "__none__" ? "" : v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhuma —</SelectItem>
                  {formasPagamento.map((fp) => (
                    <SelectItem key={fp.id} value={fp.descricao}>{fp.descricao}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data de Entrega Real</Label>
              <Input
                type="date"
                value={form.data_entrega_real}
                onChange={(e) => setForm({ ...form, data_entrega_real: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end rounded-lg bg-accent/50 p-4 gap-6">
          <span className="text-sm text-muted-foreground">
            Produtos: <span className="font-mono font-medium">{formatCurrency(valorProdutos)}</span>
          </span>
          <span className="text-sm text-muted-foreground">
            Frete: <span className="font-mono font-medium">{formatCurrency(Number(form.frete_valor || 0))}</span>
          </span>
          <span className="ml-2 text-sm text-muted-foreground">TOTAL:</span>
          <span className="text-lg font-bold font-mono text-primary">{formatCurrency(valorTotal)}</span>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Observações</p>
          <Textarea
            value={form.observacoes}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving || fornecedoresLoading || produtosLoading || !!dataEntregaError}>
            {saving ? "Salvando..." : mode === "edit" ? "Salvar Alterações" : "Criar Pedido"}
          </Button>
        </div>
      </form>
    </FormModal>
  );
}
