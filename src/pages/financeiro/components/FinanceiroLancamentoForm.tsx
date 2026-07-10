import type { FormEvent } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AutocompleteSearch } from "@/components/ui/AutocompleteSearch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Barcode, AlertCircle, AlertTriangle } from "lucide-react";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { BoletoReaderModal } from "@/components/financeiro/BoletoReaderModal";
import { formatCurrency } from "@/lib/format";
import type { Cliente, Fornecedor } from "@/types/domain";
import type { ContaContabil, LancamentoForm } from "@/pages/financeiro/types";
import type { ContaBancaria } from "@/types/domain";
import { statusFinanceiro, getStatusLabel } from "@/lib/statusSchema";
import { FORMA_PAGAMENTO_OPTIONS } from "@/lib/financeiro";
import type { CartaoCredito } from "@/services/cartoesCredito.service";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanEditFinanceiroAvancado } from "@/hooks/useCanEditFinanceiroAvancado";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";
import { Sparkles, Loader2 } from "lucide-react";
import { sugerirClassificacao } from "@/services/ia/sugestao.service";
import { QuickAddSupplierModal } from "@/components/QuickAddSupplierModal";
import { QuickAddClientModal } from "@/components/QuickAddClientModal";
import { Plus } from "lucide-react";

interface Props {
  form: LancamentoForm;
  mode: "create" | "edit";
  saving: boolean;
  contasBancarias: ContaBancaria[];
  contasContabeis: ContaContabil[];
  clientes: Cliente[];
  fornecedores: Fornecedor[];
  cartoes?: CartaoCredito[];
  setForm: (next: LancamentoForm) => void;
  onCancel: () => void;
  onSubmit: (e: FormEvent) => void;
  /** Conjunto de campos pré-preenchidos por IA (badge "IA"). Opcional. */
  iaFields?: Set<keyof LancamentoForm>;
}

// Status editáveis no formulário: apenas `aberto` e `cancelado`.
// `pago` e `parcial` são DERIVADOS de baixas (trigger trg_sync_financeiro_saldo).
// `vencido` é estado efetivo derivado, nunca persistido.
const STATUS_READONLY = new Set(["parcial", "pago"]);
const FORMAS_COM_BOLETO = new Set(["", "boleto", "boleto_dda"]);
const STATUS_BADGE_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  parcial: "secondary",
  pago: "default",
};

export function FinanceiroLancamentoForm({
  form,
  mode,
  saving,
  contasBancarias,
  contasContabeis,
  clientes,
  fornecedores,
  cartoes = [],
  setForm,
  onCancel,
  onSubmit,
  iaFields,
}: Props) {
  const updateField = <K extends keyof LancamentoForm>(field: K, value: LancamentoForm[K]) => {
    setForm({ ...form, [field]: value });
  };

  // ── IA: sugestão de conta contábil / centro de custo ─────────────────
  const [iaSuggesting, setIaSuggesting] = useState(false);
  const [iaJustificativa, setIaJustificativa] = useState<string | null>(null);
  const [quickAddSupplierOpen, setQuickAddSupplierOpen] = useState(false);
  const [quickAddClienteOpen, setQuickAddClienteOpen] = useState(false);
  const handleSugerirClassificacao = async () => {
    if (!form.descricao?.trim()) {
      toast.error("Preencha a descrição antes de pedir a sugestão.");
      return;
    }
    setIaSuggesting(true);
    try {
      const fornecedor = fornecedores.find((f) => f.id === form.fornecedor_id) as
        | (typeof fornecedores)[number]
        | undefined;
      const fornecedorNome =
        (fornecedor as unknown as { nome_razao_social?: string; razao_social?: string } | undefined)
          ?.nome_razao_social ??
        (fornecedor as unknown as { razao_social?: string } | undefined)?.razao_social ??
        null;
      const res = await sugerirClassificacao({
        descricao: form.descricao,
        valor: form.valor,
        fornecedor_nome: fornecedorNome,
        tipo: form.tipo === "receber" ? "receber" : "pagar",
      });
      if (!res.conta_contabil_id) {
        toast.warning("IA não conseguiu sugerir uma conta com confiança suficiente.");
        setIaJustificativa(res.justificativa || null);
      } else {
        setForm({
          ...form,
          conta_contabil_id: res.conta_contabil_id,
        });
        setIaJustificativa(res.justificativa || null);
        toast.success(`Conta sugerida (${res.confianca}).`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na sugestão da IA.");
    } finally {
      setIaSuggesting(false);
    }
  };

  const iaBadge = (field: keyof LancamentoForm) =>
    iaFields?.has(field) ? (
      <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px] gap-0.5">
        <Sparkles className="h-2.5 w-2.5" /> IA
      </Badge>
    ) : null;

  const { canEditAvancado } = useCanEditFinanceiroAvancado();
  // Admin/Financeiro podem editar mesmo em status pago/parcial — backend
  // (RPC `editar_lancamento_financeiro_admin`) estorna baixas automaticamente
  // quando valor/forma/cartão/vencimento mudam.
  const statusOriginalmenteReadonly = STATUS_READONLY.has(form.status);
  const isStatusReadonly = statusOriginalmenteReadonly && !canEditAvancado;
  const showPrivilegedBanner =
    statusOriginalmenteReadonly && canEditAvancado && mode === "edit";
  const selectStatusValue = form.status === "vencido" ? "aberto" : form.status;
  const [boletoOpen, setBoletoOpen] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const showCancelMotivo = form.status === "cancelado" && !isStatusReadonly;
  const canSubmitCancel = !showCancelMotivo || cancelMotivo.trim().length >= 10;

  const isCartaoCredito = form.forma_pagamento === "cartao_credito";
  const dataPagamentoEditable = form.status === "pago" || form.status === "parcial";
  const showDataPagamento = mode === "edit" || dataPagamentoEditable;
  const showBoleto = form.tipo === "pagar" && FORMAS_COM_BOLETO.has(form.forma_pagamento);
  const showContaBancaria = !isCartaoCredito;
  const isMobile = useIsMobile();
  const [pagamentoOpen, setPagamentoOpen] = useState(false);
  const [avancadoOpen, setAvancadoOpen] = useState(false);
  const showPagamento = !isMobile || pagamentoOpen;
  const showAvancado = !isMobile || avancadoOpen;

  const handleSubmit = (e: FormEvent) => {
    if (isCartaoCredito && !form.cartao_id) {
      e.preventDefault();
      toast.error("Cartão obrigatório", {
        description: "Selecione um cartão cadastrado para forma 'Cartão de Crédito'.",
      });
      return;
    }
    if (showCancelMotivo && !canSubmitCancel) {
      e.preventDefault();
      toast.error("Motivo obrigatório", {
        description: "Informe o motivo do cancelamento (mínimo 10 caracteres).",
      });
      return;
    }
    if (showCancelMotivo) {
      const motivo = cancelMotivo.trim();
      const tag = `[Cancelado: ${motivo}]`;
      const base = (form.observacoes ?? "").trim();
      if (!base.includes(tag)) {
        setForm({ ...form, observacoes: base ? `${tag}\n${base}` : tag });
      }
    }
    onSubmit(e);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {showPrivilegedBanner && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Edição privilegiada</AlertTitle>
          <AlertDescription>
            Este lançamento está <strong>{form.status}</strong>. Alterações em valor,
            forma de pagamento, cartão ou vencimento <strong>estornam automaticamente
            as baixas registradas</strong> e reabrem o lançamento — será necessário
            registrar a nova baixa em seguida. Informe o motivo no campo Observações.
          </AlertDescription>
        </Alert>
      )}
      {/* ── Grupo 1: Essencial (sempre visível) ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="space-y-2"><Label>Tipo</Label>
          <Select value={form.tipo} onValueChange={(v) => updateField("tipo", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="receber">A Receber</SelectItem><SelectItem value="pagar">A Pagar</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="col-span-2 md:col-span-3 space-y-2"><Label>Descrição *</Label><Input value={form.descricao} onChange={(e) => updateField("descricao", e.target.value)} required /></div>
        <div className="space-y-2">
          <Label>Valor *</Label>
          <CurrencyInput
            value={form.valor}
            onChange={(v) => updateField("valor", v)}
            required
          />
        </div>
        <div className="space-y-2"><Label>Vencimento *</Label><Input type="date" value={form.data_vencimento} onChange={(e) => updateField("data_vencimento", e.target.value)} required /></div>
        {form.tipo === "receber" && (
          <div className="col-span-2 md:col-span-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label>Cliente</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setQuickAddClienteOpen(true)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Novo
              </Button>
            </div>
            <AutocompleteSearch
              options={clientes.map((c) => ({
                id: c.id,
                label: c.nome_razao_social,
                sublabel: c.cpf_cnpj ?? undefined,
              }))}
              value={form.cliente_id ?? ""}
              onChange={(v) => updateField("cliente_id", v)}
              placeholder="Buscar cliente por nome ou CNPJ..."
            />
          </div>
        )}
        {form.tipo === "pagar" && (
          <div className="col-span-2 md:col-span-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label>Fornecedor</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setQuickAddSupplierOpen(true)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Novo
              </Button>
            </div>
            <AutocompleteSearch
              options={fornecedores.map((f) => ({
                id: f.id,
                label: f.nome_razao_social,
                sublabel: f.cpf_cnpj ?? undefined,
              }))}
              value={form.fornecedor_id ?? ""}
              onChange={(v) => updateField("fornecedor_id", v)}
              placeholder="Buscar fornecedor por nome ou CNPJ..."
            />
          </div>
        )}
      </div>

      {/* ── Grupo 2: Pagamento (colapsável no mobile) ── */}
      {isMobile && (
        <button
          type="button"
          onClick={() => setPagamentoOpen((v) => !v)}
          className="w-full min-h-11 flex items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-muted/30 text-left text-sm font-medium"
          aria-expanded={pagamentoOpen}
        >
          <span className="flex items-center gap-2">
            <ChevronDown className={cn("h-4 w-4 transition-transform", pagamentoOpen && "rotate-180")} />
            Pagamento
          </span>
          {!pagamentoOpen && (
            <span className="text-xs text-muted-foreground truncate max-w-[55%]">
              {[
                FORMA_PAGAMENTO_OPTIONS.find((o) => o.value === form.forma_pagamento)?.label,
                contasBancarias.find((c) => c.id === form.conta_bancaria_id)?.descricao,
              ]
                .filter(Boolean)
                .join(" · ") || "conta, forma..."}
            </span>
          )}
        </button>
      )}
      {showPagamento && (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="space-y-2"><Label>Forma de Pagamento</Label>
          <Select value={form.forma_pagamento || "nenhum"} onValueChange={(v) => updateField("forma_pagamento", v === "nenhum" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nenhum">Selecione...</SelectItem>
              {FORMA_PAGAMENTO_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {showContaBancaria && (
          <div className="space-y-2"><Label>Conta Bancária</Label>
            <Select value={form.conta_bancaria_id || "nenhum"} onValueChange={(v) => updateField("conta_bancaria_id", v === "nenhum" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione conta..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Selecione...</SelectItem>
                {contasBancarias.map(c => (<SelectItem key={c.id} value={c.id}>{c.bancos?.nome} - {c.descricao}</SelectItem>))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Conta prevista para liquidação. Não obrigatório.</p>
          </div>
        )}
        {isCartaoCredito && (
          <div className="space-y-2">
            <Label>Cartão *</Label>
            {cartoes.filter((c) => c.ativo).length > 0 ? (
              <Select
                value={form.cartao_id || "nenhum"}
                onValueChange={(v) => {
                  if (v === "nenhum") {
                    setForm({ ...form, cartao_id: "", cartao: "" });
                    return;
                  }
                  const sel = cartoes.find((c) => c.id === v);
                  setForm({ ...form, cartao_id: v, cartao: sel?.nome ?? "" });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione cartão..." />
                </SelectTrigger>
                <SelectContent>
                  {cartoes
                    .filter((c) => c.ativo)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                        {c.ultimos4 ? ` •••• ${c.ultimos4}` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-2 text-xs">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-warning shrink-0" />
                <div>
                  Nenhum cartão cadastrado.{" "}
                  <Link to="/cartoes-credito" className="underline font-medium">Cadastrar cartão</Link> para usar esta forma de pagamento.
                </div>
              </div>
            )}
          </div>
        )}
        {showDataPagamento && (
          <div className="space-y-2">
            <Label>Data Pagamento</Label>
            <Input
              type="date"
              value={form.data_pagamento}
              onChange={(e) => updateField("data_pagamento", e.target.value)}
              disabled={!dataPagamentoEditable}
              placeholder="Preenchida na baixa"
            />
            <p className="text-[11px] text-muted-foreground">
              Preenchida automaticamente ao registrar baixa.
            </p>
          </div>
        )}
      </div>
      )}

      {/* ── Grupo 3: Avançado (colapsável no mobile) ── */}
      {isMobile && (
        <button
          type="button"
          onClick={() => setAvancadoOpen((v) => !v)}
          className="w-full min-h-11 flex items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-muted/30 text-left text-sm font-medium"
          aria-expanded={avancadoOpen}
        >
          <span className="flex items-center gap-2">
            <ChevronDown className={cn("h-4 w-4 transition-transform", avancadoOpen && "rotate-180")} />
            Avançado
          </span>
          {!avancadoOpen && (
            <span className="text-xs text-muted-foreground">status, conta contábil, parcelas...</span>
          )}
        </button>
      )}
      {showAvancado && (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Status</Label>
          {isStatusReadonly ? (
            <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-muted/30">
              <Badge variant={STATUS_BADGE_VARIANTS[form.status] ?? "outline"}>
                {getStatusLabel(statusFinanceiro, form.status)}
              </Badge>
              <span className="text-xs text-muted-foreground">(somente leitura)</span>
            </div>
          ) : (
            <Select value={selectStatusValue} onValueChange={(v) => updateField("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aberto">Aberto</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            <strong>Pago/Parcial</strong> são definidos automaticamente pelas baixas. Para liquidar, use <strong>Registrar Baixa</strong>.
          </p>
          {form.status === "vencido" && (
            <p className="text-[11px] text-warning mt-1">Status efetivo: <strong>Vencido</strong> (salvo como Aberto)</p>
          )}
          {showCancelMotivo && (
            <div className="space-y-1 mt-2">
              <Label className="text-xs flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-warning" /> Motivo do cancelamento *
              </Label>
              <Textarea
                value={cancelMotivo}
                onChange={(e) => setCancelMotivo(e.target.value)}
                placeholder="Descreva o motivo do cancelamento (mínimo 10 caracteres)..."
                rows={2}
                className="text-xs border-warning/40 focus:border-warning"
              />
              {cancelMotivo.trim().length > 0 && cancelMotivo.trim().length < 10 && (
                <p className="text-[11px] text-warning">
                  {10 - cancelMotivo.trim().length} caractere(s) ainda necessário(s)
                </p>
              )}
            </div>
          )}
        </div>
        {contasContabeis.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1">
              Conta Contábil (opcional)
              {iaBadge("conta_contabil_id")}
            </Label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1"
              onClick={handleSugerirClassificacao}
              disabled={iaSuggesting || !form.descricao?.trim()}
              title={!form.descricao?.trim() ? "Preencha a descrição primeiro" : "Sugerir classificação por IA"}
            >
              {iaSuggesting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              Sugerir (IA)
            </Button>
          </div>
          <Select value={form.conta_contabil_id || "none"} onValueChange={(v) => updateField("conta_contabil_id", v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Vincular conta contábil..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma</SelectItem>
              {contasContabeis.map((c) => (<SelectItem key={c.id} value={c.id}>{c.codigo} - {c.descricao}</SelectItem>))}
            </SelectContent>
          </Select>
          {iaJustificativa && (
            <p className="text-[11px] text-muted-foreground italic">
              <Sparkles className="inline h-3 w-3 mr-0.5" /> {iaJustificativa}
            </p>
          )}
        </div>
        )}

        {mode === "create" && (
        <div className="space-y-3 rounded-lg border p-4">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input type="checkbox" checked={form.gerar_parcelas} onChange={(e) => updateField("gerar_parcelas", e.target.checked)} className="rounded" />
            Gerar parcelas automaticamente
          </label>
          {form.gerar_parcelas && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label className="text-xs">Nº de Parcelas</Label><Input type="number" min={2} max={48} value={form.num_parcelas} onChange={(e) => updateField("num_parcelas", Number(e.target.value))} className="h-9" /></div>
              <div className="space-y-1"><Label className="text-xs">Intervalo (dias)</Label><Input type="number" min={1} max={365} value={form.intervalo_dias} onChange={(e) => updateField("intervalo_dias", Number(e.target.value))} className="h-9" /></div>
              <div className="col-span-2 text-xs text-muted-foreground">
                {form.num_parcelas > 1 && form.valor > 0 && (<span>{form.num_parcelas}× de <strong>{formatCurrency(form.valor / form.num_parcelas)}</strong> a cada {form.intervalo_dias} dias</span>)}
              </div>
              {form.forma_pagamento === "cartao_credito" && form.cartao_id && (
                <div className="col-span-2 text-xs text-primary bg-primary/5 border border-primary/20 rounded-md p-2">
                  💳 Cada parcela será alocada na fatura correspondente do cartão e o vencimento usará a data da fatura.
                </div>
              )}
            </div>
          )}
        </div>
        )}

        <div className="space-y-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => updateField("observacoes", e.target.value)} /></div>
      </div>
      )}

      <div className="flex justify-between items-center gap-2">
        {showBoleto ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setBoletoOpen(true)}>
            <Barcode className="w-3.5 h-3.5 mr-1" /> Ler boleto
          </Button>
        ) : <span />}
        <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={saving || isStatusReadonly || !canSubmitCancel}>{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
      <BoletoReaderModal
        open={boletoOpen}
        onClose={() => setBoletoOpen(false)}
        onApply={(r) => {
          setForm({
            ...form,
            valor: r.valor,
            data_vencimento: r.vencimento,
            forma_pagamento: form.forma_pagamento || "boleto_dda",
            observacoes: form.observacoes
              ? `${form.observacoes}\nLinha digitável: ${r.linhaDigitavel}`
              : `Linha digitável: ${r.linhaDigitavel}`,
          });
        }}
      />
    </form>
  );
}


