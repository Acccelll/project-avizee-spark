import { useState } from "react";
import { FormModal } from "@/components/FormModal";
import { AutocompleteSearch } from "@/components/ui/AutocompleteSearch";
import { ItemsGrid, type GridItem } from "@/components/ui/ItemsGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type { CompraFormValues } from "@/hooks/useCompras";
import type { Database } from "@/integrations/supabase/types";

type FornecedorRow = Database["public"]["Tables"]["fornecedores"]["Row"];
type ProdutoRow = Database["public"]["Tables"]["produtos"]["Row"];

interface CompraFormModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  form: CompraFormValues;
  onFormChange: React.Dispatch<React.SetStateAction<CompraFormValues>>;
  items: GridItem[];
  onItemsChange: React.Dispatch<React.SetStateAction<GridItem[]>>;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  fornecedorOptions: { id: string; label: string; sublabel: string }[];
  selectedFornecedor: FornecedorRow | undefined;
  produtosData: ProdutoRow[];
  valorProdutos: number;
  valorTotal: number;
}

const STEPS = [
  { label: "Dados Gerais" },
  { label: "Itens da Compra" },
  { label: "Informações Adicionais" },
];

function validateStep1(form: CompraFormValues): string | null {
  if (!form.numero.trim()) return "Número é obrigatório.";
  return null;
}

function validateStep2Items(items: GridItem[], status: string): Record<number, string> {
  const receivingStatuses = ["parcial", "entregue"];
  if (!receivingStatuses.includes(status)) return {};
  const errors: Record<number, string> = {};
  items.forEach((item, idx) => {
    if (!item.produto_id) return;
    if (!item.quantidade || item.quantidade <= 0) {
      errors[idx] = "Quantidade recebida deve ser maior que zero.";
    }
  });
  return errors;
}

export function CompraFormModal({
  open,
  onClose,
  title,
  form,
  onFormChange,
  items,
  onItemsChange,
  saving,
  onSubmit,
  fornecedorOptions,
  selectedFornecedor,
  produtosData,
  valorProdutos,
  valorTotal,
}: CompraFormModalProps) {
  const [step, setStep] = useState(0);
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [step2Errors, setStep2Errors] = useState<Record<number, string>>({});

  function handleClose() {
    setStep(0);
    setStep1Error(null);
    setStep2Errors({});
    onClose();
  }

  function goNext() {
    if (step === 0) {
      const err = validateStep1(form);
      if (err) { setStep1Error(err); return; }
      setStep1Error(null);
    }
    if (step === 1) {
      const errors = validateStep2Items(items, form.status);
      if (Object.keys(errors).length > 0) { setStep2Errors(errors); return; }
      setStep2Errors({});
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goPrev() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err1 = validateStep1(form);
    if (err1) { setStep1Error(err1); setStep(0); return; }
    const err2 = validateStep2Items(items, form.status);
    if (Object.keys(err2).length > 0) { setStep2Errors(err2); setStep(1); return; }
    await onSubmit(e);
    setStep(0);
  }

  return (
    <FormModal open={open} onClose={handleClose} title={title} size="xl">
      {/* Stepper header */}
      <div className="mb-6 flex items-center gap-0">
        {STEPS.map((s, idx) => (
          <div key={idx} className="flex flex-1 items-center">
            <button
              type="button"
              onClick={() => { if (idx < step) setStep(idx); }}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                idx < step
                  ? "cursor-pointer border-primary bg-primary text-primary-foreground"
                  : idx === step
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-muted bg-muted text-muted-foreground",
              )}
            >
              {idx + 1}
            </button>
            <span
              className={cn(
                "ml-2 hidden text-sm font-medium sm:block",
                idx === step ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-3 h-px flex-1",
                  idx < step ? "bg-primary" : "bg-muted",
                )}
              />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-5">
        {/* ── Step 1: Dados Gerais ─────────────────────────────────── */}
        {step === 0 && (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Número *</Label>
                <Input
                  value={form.numero}
                  onChange={(e) => {
                    onFormChange({ ...form, numero: e.target.value });
                    if (step1Error) setStep1Error(null);
                  }}
                  required
                  className={cn("font-mono", step1Error && "border-destructive")}
                />
                {step1Error && (
                  <p className="text-xs text-destructive">{step1Error}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Data Compra</Label>
                <Input
                  type="date"
                  value={form.data_compra}
                  onChange={(e) => onFormChange({ ...form, data_compra: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => onFormChange({ ...form, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">Cotação</SelectItem>
                    <SelectItem value="confirmado">Pedido Confirmado</SelectItem>
                    <SelectItem value="parcial">Recebimento Parcial</SelectItem>
                    <SelectItem value="entregue">Entregue</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3 rounded-lg bg-accent/30 p-4">
              <Label className="text-sm font-semibold">Fornecedor</Label>
              <AutocompleteSearch
                options={fornecedorOptions}
                value={form.fornecedor_id}
                onChange={(id) => onFormChange({ ...form, fornecedor_id: id })}
                placeholder="Buscar por nome ou CNPJ..."
              />
              {selectedFornecedor && (
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <p>
                    <span className="text-xs text-muted-foreground">Razão Social:</span>
                    <br />
                    {selectedFornecedor.nome_razao_social}
                  </p>
                  <p>
                    <span className="text-xs text-muted-foreground">CNPJ:</span>
                    <br />
                    <span className="font-mono">{selectedFornecedor.cpf_cnpj || "—"}</span>
                  </p>
                  <p>
                    <span className="text-xs text-muted-foreground">Contato:</span>
                    <br />
                    {selectedFornecedor.telefone || "—"}
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Step 2: Itens da Compra ───────────────────────────────── */}
        {step === 1 && (
          <>
            <ItemsGrid
              items={items}
              onChange={(newItems) => {
                onItemsChange(newItems);
                if (Object.keys(step2Errors).length > 0) setStep2Errors({});
              }}
              produtos={produtosData}
              title="Itens da Compra"
              itemErrors={step2Errors}
            />
            {Object.keys(step2Errors).length > 0 && (
              <p className="text-xs text-destructive">
                Verifique as quantidades dos itens antes de continuar.
              </p>
            )}
          </>
        )}

        {/* ── Step 3: Informações Adicionais ───────────────────────── */}
        {step === 2 && (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Frete</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.frete_valor}
                  onChange={(e) =>
                    onFormChange({ ...form, frete_valor: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Impostos</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.impostos_valor}
                  onChange={(e) =>
                    onFormChange({ ...form, impostos_valor: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Entrega Prevista</Label>
                <Input
                  type="date"
                  value={form.data_entrega_prevista}
                  onChange={(e) =>
                    onFormChange({ ...form, data_entrega_prevista: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Entrega Real</Label>
                <Input
                  type="date"
                  value={form.data_entrega_real}
                  onChange={(e) =>
                    onFormChange({ ...form, data_entrega_real: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-accent/50 p-4">
              <div className="text-sm">
                <span className="text-muted-foreground">Produtos:</span>{" "}
                <span className="font-mono font-semibold">{formatCurrency(valorProdutos)}</span>
                <span className="mx-3 text-muted-foreground">|</span>
                <span className="text-muted-foreground">Frete:</span>{" "}
                <span className="font-mono">{formatCurrency(form.frete_valor || 0)}</span>
                <span className="mx-3 text-muted-foreground">|</span>
                <span className="text-muted-foreground">Impostos:</span>{" "}
                <span className="font-mono">{formatCurrency(form.impostos_valor || 0)}</span>
              </div>
              <div>
                <span className="mr-2 text-sm text-muted-foreground">TOTAL:</span>
                <span className="text-lg font-bold font-mono text-primary">
                  {formatCurrency(valorTotal)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={form.observacoes}
                onChange={(e) => onFormChange({ ...form, observacoes: e.target.value })}
              />
            </div>
          </>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between gap-2">
          <div>
            {step > 0 && (
              <Button type="button" variant="outline" onClick={goPrev}>
                Voltar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={goNext}>
                Próximo
              </Button>
            ) : (
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </FormModal>
  );
}
