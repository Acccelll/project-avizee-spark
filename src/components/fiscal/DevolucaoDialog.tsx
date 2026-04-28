import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/format";
import { getUserFriendlyError, notifyError } from "@/utils/errorMessages";
import { useGerarDevolucaoNF } from "@/pages/fiscal/hooks/useNotaFiscalLifecycle";

/** Minimal shape of the originating NF used by the devolução flow. */
export interface NfSimples {
  id: string;
  numero: string;
  serie?: string;
  cliente_id?: string;
  modelo_documento?: string;
  data_emissao: string;
  valor_total: number;
  clientes?: { nome_razao_social: string } | null;
}

/** One line-item with the extra field for how many units to return. */
export interface NfItemDevolver {
  id: string;
  produto_id?: string;
  nome: string;
  quantidade: number;
  valor_unitario: number;
  qtd_devolver: number;
}

interface DevolucaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  devolucaoNF: NfSimples | null;
  devolucaoItens: NfItemDevolver[];
  setDevolucaoItens: (itens: NfItemDevolver[]) => void;
  onSuccess: () => void;
}

export function DevolucaoDialog({ open, onOpenChange, devolucaoNF, devolucaoItens, setDevolucaoItens, onSuccess }: DevolucaoDialogProps) {
  const [dataDevolucao, setDataDevolucao] = useState(new Date().toISOString().split("T")[0]);
  const [motivoDevolucao, setMotivoDevolucao] = useState("");
  const [processing, setProcessing] = useState(false);
  const gerarDevolucao = useGerarDevolucaoNF();

  const valorTotalDevolucao = devolucaoItens.reduce((s, i) => s + (i.qtd_devolver || 0) * Number(i.valor_unitario), 0);

  const handleDevolucao = async () => {
    if (!devolucaoNF) return;
    const itensDevolver = devolucaoItens.filter((i) => i.qtd_devolver > 0);
    if (itensDevolver.length === 0) { toast.error("Selecione ao menos um item para devolver"); return; }
    if (!motivoDevolucao.trim()) { toast.error("Informe o motivo da devolução"); return; }
    const semProduto = itensDevolver.filter((i) => !i.produto_id);
    if (semProduto.length > 0) {
      toast.error("Itens sem vínculo de produto não podem ser devolvidos via RPC.");
      return;
    }
    setProcessing(true);
    try {
      await gerarDevolucao.mutateAsync({
        nfOrigemId: devolucaoNF.id,
        itens: itensDevolver.map((i) => ({
          produto_id: i.produto_id as string,
          quantidade: i.qtd_devolver,
        })),
      });
      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      console.error("[fiscal] devolução:", err);
      notifyError(err);
    }
    setProcessing(false);
  };

  if (!devolucaoNF) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerar Nota de Devolução</DialogTitle>
          <DialogDescription>
            Selecione os itens e as quantidades que deseja devolver da nota fiscal original.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-3 rounded-lg border bg-muted/30 p-4">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">NF Original</span>
              <p className="mt-0.5 text-sm font-mono font-semibold">{devolucaoNF.numero}</p>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cliente</span>
              <p className="mt-0.5 text-sm font-medium">{devolucaoNF.clientes?.nome_razao_social || "—"}</p>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Data</span>
              <p className="mt-0.5 text-sm">{formatDate(devolucaoNF.data_emissao)}</p>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Valor Total</span>
              <p className="mt-0.5 text-sm font-mono font-semibold">{formatCurrency(Number(devolucaoNF.valor_total))}</p>
            </div>
          </div>

          {/* Mobile: cards verticais com stepper */}
          <div className="md:hidden space-y-2">
            {devolucaoItens.map((item, idx) => (
              <div key={idx} className="rounded-lg border bg-card p-3 space-y-2">
                <div className="font-medium text-sm">{item.nome}</div>
                <div className="text-xs text-muted-foreground">
                  Qtd original: <span className="font-mono">{item.quantidade}</span> · Unit:{" "}
                  <span className="font-mono">{formatCurrency(Number(item.valor_unitario))}</span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs font-medium text-muted-foreground flex-1">Devolver:</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 min-w-11"
                    onClick={() => setDevolucaoItens(devolucaoItens.map((it, i) => i === idx ? { ...it, qtd_devolver: Math.max(0, it.qtd_devolver - 1) } : it))}
                  >
                    −
                  </Button>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={item.quantidade}
                    className="h-11 w-16 text-center font-mono"
                    value={item.qtd_devolver}
                    onChange={(e) => {
                      const val = Math.min(Number(e.target.value), item.quantidade);
                      setDevolucaoItens(devolucaoItens.map((it, i) => i === idx ? { ...it, qtd_devolver: Math.max(0, val) } : it));
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 min-w-11"
                    onClick={() => setDevolucaoItens(devolucaoItens.map((it, i) => i === idx ? { ...it, qtd_devolver: Math.min(it.quantidade, it.qtd_devolver + 1) } : it))}
                  >
                    +
                  </Button>
                </div>
                <div className="text-right text-sm font-mono font-semibold pt-1 border-t border-border/40">
                  Subtotal: {formatCurrency((item.qtd_devolver || 0) * Number(item.valor_unitario))}
                </div>
              </div>
            ))}
            <div className="rounded-lg bg-muted/30 border p-3 flex justify-between items-center">
              <span className="text-sm font-semibold">Total da Devolução</span>
              <span className="font-mono font-bold text-primary">{formatCurrency(valorTotalDevolucao)}</span>
            </div>
          </div>
          <div className="hidden md:block rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Produto</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Qtd Original</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Qtd Devolver</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Vlr Unit.</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {devolucaoItens.map((item, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-muted/20" : ""}>
                    <td className="px-3 py-2 text-xs">{item.nome}</td>
                    <td className="px-3 py-2 text-xs text-right font-mono">{item.quantidade}</td>
                    <td className="px-3 py-2 text-right">
                      <Input type="number" min={0} max={item.quantidade} step={1}
                        className="h-7 w-20 text-xs text-right ml-auto"
                        value={item.qtd_devolver}
                        onChange={(e) => {
                          const val = Math.min(Number(e.target.value), item.quantidade);
                          setDevolucaoItens(devolucaoItens.map((it, i) => i === idx ? { ...it, qtd_devolver: Math.max(0, val) } : it));
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 text-xs text-right font-mono">{formatCurrency(Number(item.valor_unitario))}</td>
                    <td className="px-3 py-2 text-xs text-right font-mono font-semibold">
                      {formatCurrency((item.qtd_devolver || 0) * Number(item.valor_unitario))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30">
                  <td colSpan={4} className="px-3 py-2 text-xs font-semibold">Total da Devolução</td>
                  <td className="px-3 py-2 text-xs font-mono text-right font-bold text-primary">{formatCurrency(valorTotalDevolucao)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data da Devolução *</Label>
              <Input type="date" value={dataDevolucao} onChange={(e) => setDataDevolucao(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Motivo da Devolução *</Label>
            <Textarea value={motivoDevolucao} onChange={(e) => setMotivoDevolucao(e.target.value)} rows={2} placeholder="Descreva o motivo da devolução..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing} aria-label="Cancelar devolução">Cancelar</Button>
          <Button onClick={handleDevolucao} disabled={processing || valorTotalDevolucao <= 0} aria-label="Confirmar geração de nota de devolução">
            {processing ? "Processando..." : "Confirmar Devolução"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
