/**
 * Página de detalhe e edição de Pedido de Compra.
 * Rota: /pedidos-compra/:id
 *
 * Reaprovecha subcomponentes existentes e a lógica de usePedidosCompra,
 * expondo-os em rota dedicada para melhor usabilidade e rastreabilidade.
 */
import { useCallback, useEffect, useState, type SetStateAction } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { AutocompleteSearch } from "@/components/ui/AutocompleteSearch";
import { ItemsGrid, type GridItem } from "@/components/ui/ItemsGrid";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";
import { formatCurrency, formatDate } from "@/lib/format";
import { statusPedidoCompra } from "@/lib/statusSchema";
import type { PedidoCompra } from "@/components/compras/pedidoCompraTypes";
import { pedidoNumero } from "@/components/compras/pedidoCompraTypes";
import type { Database } from "@/integrations/supabase/types";
import { useSubmitLock } from "@/hooks/useSubmitLock";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";

type ProdutoRow = Database["public"]["Tables"]["produtos"]["Row"] & { preco_custo?: number | null };
type FornecedorRow = Database["public"]["Tables"]["fornecedores"]["Row"];
type FormasPagRow = Database["public"]["Tables"]["formas_pagamento"]["Row"];

/** Statuses that can only be assigned via workflow actions, not the form. */
const WORKFLOW_ONLY_STATUSES = ["recebido", "parcialmente_recebido", "cancelado", "aguardando_recebimento", "enviado_ao_fornecedor"];

export default function PedidoCompraForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const { saving, submit } = useSubmitLock({ errorPrefix: "Erro ao salvar pedido" });
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [pedido, setPedido] = useState<PedidoCompra | null>(null);
  const [form, setForm] = useState({
    fornecedor_id: "",
    data_pedido: new Date().toISOString().split("T")[0],
    data_entrega_prevista: "",
    data_entrega_real: "",
    frete_valor: "",
    condicao_pagamento: "",
    status: "rascunho",
    observacoes: "",
  });
  const [items, setItems] = useState<GridItem[]>([]);
  const [fornecedorOptions, setFornecedorOptions] = useState<{ id: string; label: string; sublabel: string }[]>([]);
  const [produtosOptionsData, setProdutosOptionsData] = useState<ProdutoRow[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FormasPagRow[]>([]);
  const [viewCotacao, setViewCotacao] = useState<{ numero: string; status: string } | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const updateForm = useCallback((next: SetStateAction<typeof form>) => {
    setForm(next);
    setIsDirty(true);
  }, []);

  const updateItems = useCallback((next: SetStateAction<GridItem[]>) => {
    setItems(next);
    setIsDirty(true);
  }, []);

  useEffect(() => {
    async function load() {
      if (!id) { navigate("/pedidos-compra"); return; }
      setLoading(true);

      const [{ data: ped }, { data: itens }, { data: fors }, { data: prods }, { data: fps }] =
        await Promise.all([
          supabase.from("pedidos_compra").select("*, fornecedores(nome_razao_social, cpf_cnpj)").eq("id", id).single(),
          supabase.from("pedidos_compra_itens").select("*, produtos(nome, codigo_interno)").eq("pedido_compra_id", id),
          supabase.from("fornecedores").select("id, nome_razao_social, cpf_cnpj").eq("ativo", true).order("nome_razao_social"),
          supabase.from("produtos").select("id, nome, codigo_interno, preco_venda, preco_custo, unidade_medida").eq("ativo", true).order("nome"),
          supabase.from("formas_pagamento").select("id, descricao").eq("ativo", true).order("descricao"),
        ]);

      if (!ped) { toast.error("Pedido não encontrado."); navigate("/pedidos-compra"); return; }

      setPedido(ped as PedidoCompra);
      updateForm({
        fornecedor_id: ped.fornecedor_id ? String(ped.fornecedor_id) : "",
        data_pedido: ped.data_pedido || new Date().toISOString().split("T")[0],
        data_entrega_prevista: ped.data_entrega_prevista || "",
        data_entrega_real: ped.data_entrega_real || "",
        frete_valor: String(ped.frete_valor ?? ""),
        condicao_pagamento: ped.condicao_pagamento || ped.condicoes_pagamento || "",
        status: ped.status || "rascunho",
        observacoes: ped.observacoes || "",
      });
      updateItems(
        (itens || []).map((i: Record<string, unknown>) => {
          const produtos = i.produtos as Record<string, unknown> | null;
          return {
            id: String(i.id),
            produto_id: i.produto_id ? String(i.produto_id) : "",
            codigo: String(produtos?.codigo_interno || ""),
            descricao: String(produtos?.nome || ""),
            quantidade: Number(i.quantidade || 0),
            valor_unitario: Number((i.preco_unitario as number) ?? (i.valor_unitario as number) ?? 0),
            valor_total: Number((i.subtotal as number) ?? (i.valor_total as number) ?? 0),
          };
        })
      );
      setFornecedorOptions(
        (fors || []).map((f: FornecedorRow) => ({
          id: f.id,
          label: f.nome_razao_social || "",
          sublabel: f.cpf_cnpj || "",
        }))
      );
      setProdutosOptionsData((prods || []) as ProdutoRow[]);
      setFormasPagamento((fps || []) as FormasPagRow[]);

      if (ped.cotacao_compra_id) {
        const { data: cot } = await supabase.from("cotacoes_compra")
          .select("numero, status")
          .eq("id", String(ped.cotacao_compra_id))
          .single();
        setViewCotacao(cot || null);
      }

      setIsDirty(false);
      setLoading(false);
    }
    load();
  }, [id, navigate, updateForm, updateItems]);

  const isTerminal = pedido ? ["recebido", "cancelado"].includes(pedido.status) : false;

  const dataEntregaError =
    form.data_pedido && form.data_entrega_prevista && form.data_entrega_prevista < form.data_pedido
      ? "A data de entrega prevista não pode ser anterior à data do pedido."
      : null;

  const valorProdutos = items.reduce((s, i) => s + Number(i.valor_total || 0), 0);
  const valorTotal = valorProdutos + Number(form.frete_valor || 0);

  const handleSave = async () => {
    if (!pedido) return;

    if (!form.fornecedor_id) { toast.error("Fornecedor é obrigatório."); return; }
    const validItems = items.filter((i) => i.produto_id);
    if (validItems.length === 0) { toast.error("Adicione ao menos um item com produto selecionado."); return; }
    const invalidQty = validItems.findIndex((i) => Number(i.quantidade || 0) <= 0);
    if (invalidQty !== -1) { toast.error(`Item ${invalidQty + 1}: quantidade deve ser maior que zero.`); return; }
    const invalidPrice = validItems.findIndex((i) => Number(i.valor_unitario ?? 0) < 0);
    if (invalidPrice !== -1) { toast.error(`Item ${invalidPrice + 1}: preço unitário inválido.`); return; }
    if (dataEntregaError) { toast.error(dataEntregaError); return; }

    // Block terminal/workflow statuses from form
    if (WORKFLOW_ONLY_STATUSES.includes(form.status) && form.status !== pedido.status) {
      toast.error("Este status só pode ser definido por ações do fluxo (receber, enviar, cancelar).");
      return;
    }

    await submit(async () => {
      const payload = {
        fornecedor_id: form.fornecedor_id,
        data_pedido: form.data_pedido,
        data_entrega_prevista: form.data_entrega_prevista || null,
        data_entrega_real: form.data_entrega_real || null,
        frete_valor: Number(form.frete_valor || 0),
        condicao_pagamento: form.condicao_pagamento || null,
        status: form.status,
        observacoes: form.observacoes || null,
        valor_total: valorTotal,
      };

      const { error: updErr } = await supabase.from("pedidos_compra").update(payload).eq("id", pedido.id);
      if (updErr) throw updErr;

      // Substituição atômica dos itens via RPC (delete+insert em uma única transação no servidor).
      const itensPayload = validItems.map((i) => ({
        produto_id: String(i.produto_id),
        quantidade: Number(i.quantidade || 0),
        preco_unitario: Number(i.valor_unitario || 0),
        subtotal: Number(i.valor_total || 0),
      }));
      const { error: rpcErr } = await supabase.rpc("replace_pedido_compra_itens", {
        p_pedido_id: pedido.id,
        p_itens: itensPayload as unknown as never,
      });
      if (rpcErr) throw rpcErr;

      toast.success("Pedido de compra salvo!");
      setPedido({ ...pedido, ...payload } as PedidoCompra);
      setIsDirty(false);
    });
  };

  const handleBack = async () => {
    if (isDirty) {
      const ok = await confirm();
      if (!ok) return;
    }
    navigate("/pedidos-compra");
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!pedido) return null;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              aria-label="Voltar"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold font-mono">{pedidoNumero(pedido)}</h1>
                <StatusBadge
                  status={pedido.status}
                  label={statusPedidoCompra[pedido.status as keyof typeof statusPedidoCompra]?.label ?? pedido.status}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Pedido em {formatDate(pedido.data_pedido)}
                {pedido.fornecedores?.nome_razao_social && (
                  <span className="ml-1">· {pedido.fornecedores.nome_razao_social}</span>
                )}
                {viewCotacao && (
                  <span className="ml-1">· Cotação: <strong className="font-mono">{viewCotacao.numero}</strong></span>
                )}
              </p>
            </div>
          </div>
          {!isTerminal && (
            <Button onClick={handleSave} disabled={saving || !!dataEntregaError} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          )}
        </div>

        {isTerminal && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
            Este pedido está em status <strong>
              {statusPedidoCompra[pedido.status as keyof typeof statusPedidoCompra]?.label ?? pedido.status}
            </strong> e não pode ser editado aqui. Use as ações do drawer.
          </div>
        )}

        {/* Form */}
        <div className="rounded-lg border bg-card p-5 space-y-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Datas e Status</p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Data do Pedido</Label>
              <Input
                type="date"
                value={form.data_pedido}
                onChange={(e) => updateForm({ ...form, data_pedido: e.target.value })}
                disabled={isTerminal}
              />
            </div>
            <div className="space-y-2">
              <Label>Entrega Prevista</Label>
              <Input
                type="date"
                value={form.data_entrega_prevista}
                onChange={(e) => updateForm({ ...form, data_entrega_prevista: e.target.value })}
                className={dataEntregaError ? "border-destructive" : ""}
                disabled={isTerminal}
              />
              {dataEntregaError && <p className="text-xs text-destructive">{dataEntregaError}</p>}
            </div>
            <div className="space-y-2">
              <Label>Status do Pedido</Label>
              {/* Only allow non-terminal, non-workflow statuses to be set via form */}
              <Select
                value={form.status}
                onValueChange={(v) => updateForm({ ...form, status: v })}
                disabled={isTerminal}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["rascunho", "aprovado"] as const).map((value) => (
                    <SelectItem key={value} value={value}>
                      {statusPedidoCompra[value]?.label ?? value}
                    </SelectItem>
                  ))}
                  {!["rascunho", "aprovado"].includes(form.status) && (
                    <SelectItem value={form.status} disabled>
                      {statusPedidoCompra[form.status as keyof typeof statusPedidoCompra]?.label ?? form.status}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fornecedor</p>
          <AutocompleteSearch
            options={fornecedorOptions}
            value={form.fornecedor_id}
            onChange={(val) => updateForm({ ...form, fornecedor_id: val })}
            placeholder="Buscar por nome ou CNPJ..."
          />
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Itens do Pedido</p>
          <ItemsGrid
            items={items}
            onChange={updateItems}
            produtos={produtosOptionsData}
            readOnly={isTerminal}
            getDefaultUnitPrice={(prod) => Number((prod as ProdutoRow).preco_custo || 0)}
          />
        </div>

        <div className="rounded-lg border bg-card p-5 space-y-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Condições</p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Frete (R$)</Label>
              <Input
                type="number" min="0" step="0.01"
                value={form.frete_valor}
                onChange={(e) => updateForm({ ...form, frete_valor: e.target.value })}
                placeholder="0,00"
                disabled={isTerminal}
              />
            </div>
            <div className="space-y-2">
              <Label>Condição de Pagamento</Label>
              <Select
                value={form.condicao_pagamento || ""}
                onValueChange={(v) => updateForm({ ...form, condicao_pagamento: v === "__none__" ? "" : v })}
                disabled={isTerminal}
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
                onChange={(e) => updateForm({ ...form, data_entrega_real: e.target.value })}
                disabled={isTerminal}
              />
            </div>
          </div>
        </div>

        {/* Totals */}
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

        <div className="rounded-lg border bg-card p-5 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Observações</p>
          <Textarea
            value={form.observacoes}
            onChange={(e) => updateForm({ ...form, observacoes: e.target.value })}
            disabled={isTerminal}
          />
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={handleBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar para Pedidos
          </Button>
          {!isTerminal && (
            <Button onClick={handleSave} disabled={saving || !!dataEntregaError} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          )}
        </div>
      </div>
      {confirmDialog}
    </AppLayout>
  );
}
