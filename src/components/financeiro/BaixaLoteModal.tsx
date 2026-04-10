import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { processarBaixaLote } from "@/services/financeiro.service";

interface ContaBancaria {
  id: string;
  descricao: string;
  bancos?: { nome: string };
}

interface Lancamento {
  id: string;
  descricao: string;
  valor: number;
  saldo_restante: number | null;
  tipo: string;
  data_vencimento: string;
  clientes?: { nome_razao_social: string };
  fornecedores?: { nome_razao_social: string };
}

interface BaixaLoteModalProps {
  open: boolean;
  onClose: () => void;
  selectedLancamentos: Lancamento[];
  contasBancarias: ContaBancaria[];
  onSuccess: () => void;
}

export function BaixaLoteModal({ open, onClose, selectedLancamentos, contasBancarias, onSuccess }: BaixaLoteModalProps) {
  const [baixaDate, setBaixaDate] = useState(new Date().toISOString().split("T")[0]);
  const [formaPagamento, setFormaPagamento] = useState("");
  const [contaBancaria, setContaBancaria] = useState("");
  const [tipoBaixa, setTipoBaixa] = useState<"total" | "parcial">("total");
  const [valorPagoBaixa, setValorPagoBaixa] = useState(0);
  const [processing, setProcessing] = useState(false);

  const totalBaixa = useMemo(() => {
    return selectedLancamentos.reduce((s, l) => s + Number(l.saldo_restante != null ? l.saldo_restante : l.valor || 0), 0);
  }, [selectedLancamentos]);

  useEffect(() => {
    if (open) {
      setBaixaDate(new Date().toISOString().split("T")[0]);
      setFormaPagamento("");
      setContaBancaria("");
      setTipoBaixa("total");
      setValorPagoBaixa(totalBaixa);
    }
  }, [open, totalBaixa]);

  const handleConfirm = async () => {
    if (!baixaDate) return;
    if (!formaPagamento) return;
    if (!contaBancaria) return;
    if (tipoBaixa === "parcial" && (valorPagoBaixa <= 0 || valorPagoBaixa >= totalBaixa)) return;

    setProcessing(true);
    const ok = await processarBaixaLote({
      selectedIds: selectedLancamentos.map(l => l.id),
      selectedLancamentos,
      tipoBaixa,
      valorPagoBaixa,
      totalBaixa,
      baixaDate,
      formaPagamento,
      contaBancariaId: contaBancaria,
    });
    setProcessing(false);
    if (ok) {
      onClose();
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirmar Baixa — {selectedLancamentos.length} título(s)</DialogTitle>
          <DialogDescription>Revise os títulos selecionados e informe os dados do pagamento.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Descrição</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Parceiro</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Valor</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Vencimento</th>
                </tr>
              </thead>
              <tbody>
                {selectedLancamentos.map((l, idx) => (
                  <tr key={l.id} className={idx % 2 === 0 ? "bg-muted/20" : ""}>
                    <td className="px-3 py-2 text-xs">{l.descricao}</td>
                    <td className="px-3 py-2 text-xs">{l.tipo === "receber" ? l.clientes?.nome_razao_social : l.fornecedores?.nome_razao_social || "—"}</td>
                    <td className="px-3 py-2 text-xs font-mono text-right font-semibold">{formatCurrency(Number(l.valor))}</td>
                    <td className="px-3 py-2 text-xs text-right">{new Date(l.data_vencimento).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30">
                  <td colSpan={2} className="px-3 py-2 text-xs font-semibold">Total</td>
                  <td className="px-3 py-2 text-xs font-mono text-right font-bold text-primary">{formatCurrency(totalBaixa)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data de Baixa *</Label>
              <Input type="date" value={baixaDate} onChange={(e) => setBaixaDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Baixa</Label>
              <Select value={tipoBaixa} onValueChange={(v) => setTipoBaixa(v as "total" | "parcial")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="total">Total</SelectItem>
                  <SelectItem value="parcial">Parcial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Forma de Pagamento *</Label>
              <Select value={formaPagamento || "none"} onValueChange={(v) => setFormaPagamento(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Conta Bancária *</Label>
              <Select value={contaBancaria || "none"} onValueChange={(v) => setContaBancaria(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione conta..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  {contasBancarias.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.bancos?.nome} - {c.descricao}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {tipoBaixa === "parcial" && (
            <div className="space-y-2">
              <Label>Valor a Pagar *</Label>
              <Input type="number" step="0.01" min={0.01} max={totalBaixa - 0.01}
                value={valorPagoBaixa} onChange={(e) => setValorPagoBaixa(Number(e.target.value))} />
              <p className="text-xs text-muted-foreground">Total: {formatCurrency(totalBaixa)} — Restante: {formatCurrency(Math.max(0, totalBaixa - valorPagoBaixa))}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={processing}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={processing || !baixaDate}>
            {processing ? "Processando..." : "Confirmar Baixa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
