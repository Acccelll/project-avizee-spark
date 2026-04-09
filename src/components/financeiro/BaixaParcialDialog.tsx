import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";

interface ContaBancaria {
  id: string;
  descricao: string;
  bancos?: { nome: string };
}

interface Baixa {
  id: string;
  valor_pago: number;
  desconto: number;
  juros: number;
  multa: number;
  abatimento: number;
  data_baixa: string;
  forma_pagamento: string;
  observacoes: string;
  created_at: string;
}

interface BaixaParcialDialogProps {
  open: boolean;
  onClose: () => void;
  lancamento: {
    id: string;
    descricao: string;
    valor: number;
    saldo_restante?: number | null;
    status: string;
  } | null;
  contasBancarias: ContaBancaria[];
  onSuccess: () => void;
}

export function BaixaParcialDialog({ open, onClose, lancamento, contasBancarias, onSuccess }: BaixaParcialDialogProps) {
  const [valorPago, setValorPago] = useState(0);
  const [desconto, setDesconto] = useState(0);
  const [juros, setJuros] = useState(0);
  const [multa, setMulta] = useState(0);
  const [abatimento, setAbatimento] = useState(0);
  const [dataBaixa, setDataBaixa] = useState(new Date().toISOString().split("T")[0]);
  const [formaPagamento, setFormaPagamento] = useState("");
  const [contaBancariaId, setContaBancariaId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);
  const [baixasAnteriores, setBaixasAnteriores] = useState<Baixa[]>([]);
  const [loadingBaixas, setLoadingBaixas] = useState(false);

  const saldoAtual = lancamento
    ? (lancamento.saldo_restante != null ? Number(lancamento.saldo_restante) : Number(lancamento.valor))
    : 0;

  const valorLiquido = valorPago - desconto + juros + multa - abatimento;
  const novoSaldo = saldoAtual - valorPago + abatimento;

  useEffect(() => {
    if (open && lancamento) {
      setValorPago(saldoAtual);
      setDesconto(0);
      setJuros(0);
      setMulta(0);
      setAbatimento(0);
      setDataBaixa(new Date().toISOString().split("T")[0]);
      setFormaPagamento("");
      setContaBancariaId("");
      setObservacoes("");
      loadBaixas(lancamento.id);
    }
  }, [open, lancamento?.id]);

  const loadBaixas = async (lancamentoId: string) => {
    setLoadingBaixas(true);
    const { data } = await supabase
      .from("financeiro_baixas")
      .select("*")
      .eq("lancamento_id", lancamentoId)
      .order("data_baixa", { ascending: false });
    setBaixasAnteriores((data as any[]) || []);
    setLoadingBaixas(false);
  };

  const handleSubmit = async () => {
    if (!lancamento) return;
    if (!dataBaixa) { toast.error("Data de baixa é obrigatória"); return; }
    if (valorPago <= 0) { toast.error("Valor pago deve ser maior que zero"); return; }
    if (valorPago > saldoAtual) { toast.error("Valor pago não pode exceder o saldo restante"); return; }
    if (!formaPagamento) { toast.error("Forma de pagamento é obrigatória"); return; }
    if (!contaBancariaId) { toast.error("Conta bancária é obrigatória"); return; }

    setSaving(true);
    try {
      // Insert baixa record
      const { error: baixaError } = await supabase.from("financeiro_baixas" as any).insert({
        lancamento_id: lancamento.id,
        valor_pago: valorPago,
        desconto,
        juros,
        multa,
        abatimento,
        data_baixa: dataBaixa,
        forma_pagamento: formaPagamento,
        conta_bancaria_id: contaBancariaId,
        observacoes: observacoes || null,
      });
      if (baixaError) throw baixaError;

      // Update lancamento saldo and status
      const newSaldo = Math.max(0, novoSaldo);
      const newStatus = newSaldo <= 0.01 ? "pago" : "parcial";
      const { error: updateError } = await supabase
        .from("financeiro_lancamentos")
        .update({
          saldo_restante: newSaldo,
          status: newStatus,
          data_pagamento: newStatus === "pago" ? dataBaixa : null,
        } as any)
        .eq("id", lancamento.id);
      if (updateError) throw updateError;

      toast.success(newStatus === "pago" ? "Título liquidado integralmente!" : "Baixa parcial registrada!");
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("[baixa]", err);
      toast.error("Erro ao registrar baixa");
    }
    setSaving(false);
  };

  const totalJaPago = baixasAnteriores.reduce((s, b) => s + Number(b.valor_pago || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Baixa</DialogTitle>
          <DialogDescription>
            Informe os valores e dados do pagamento para realizar a baixa total ou parcial deste título.
          </DialogDescription>
        </DialogHeader>

        {lancamento && (
          <div className="space-y-5">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-4">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Valor Original</span>
                <p className="mt-0.5 text-sm font-semibold">{formatCurrency(Number(lancamento.valor))}</p>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Já Pago</span>
                <p className="mt-0.5 text-sm font-semibold text-success">{formatCurrency(totalJaPago)}</p>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Saldo Restante</span>
                <p className="mt-0.5 text-sm font-bold text-primary">{formatCurrency(saldoAtual)}</p>
              </div>
            </div>

            {/* Previous baixas */}
            {baixasAnteriores.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Baixas Anteriores</span>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Data</th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Valor Pago</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Forma</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Obs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {baixasAnteriores.map((b, i) => (
                        <tr key={b.id} className={i % 2 === 0 ? "bg-muted/20" : ""}>
                          <td className="px-3 py-1.5">{new Date(b.data_baixa).toLocaleDateString("pt-BR")}</td>
                          <td className="px-3 py-1.5 text-right font-mono font-semibold">{formatCurrency(Number(b.valor_pago))}</td>
                          <td className="px-3 py-1.5">{b.forma_pagamento || "—"}</td>
                          <td className="px-3 py-1.5 truncate max-w-[120px]">{b.observacoes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Form */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Valor a Pagar *</Label>
                <Input type="number" step="0.01" min={0} max={saldoAtual} value={valorPago} onChange={(e) => setValorPago(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Desconto</Label>
                <Input type="number" step="0.01" min={0} value={desconto} onChange={(e) => setDesconto(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Juros</Label>
                <Input type="number" step="0.01" min={0} value={juros} onChange={(e) => setJuros(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Multa</Label>
                <Input type="number" step="0.01" min={0} value={multa} onChange={(e) => setMulta(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Abatimento</Label>
                <Input type="number" step="0.01" min={0} value={abatimento} onChange={(e) => setAbatimento(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Data de Baixa *</Label>
                <Input type="date" value={dataBaixa} onChange={(e) => setDataBaixa(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Forma de Pagamento *</Label>
                <Select value={formaPagamento || "none"} onValueChange={(v) => setFormaPagamento(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione...</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Conta Bancária *</Label>
                <Select value={contaBancariaId || "none"} onValueChange={(v) => setContaBancariaId(v === "none" ? "" : v)}>
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

            <div className="space-y-1.5">
              <Label className="text-xs">Observações</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
            </div>

            {/* Calculated summary */}
            <div className="rounded-lg border bg-accent/20 p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor líquido da baixa</span>
                <span className="font-semibold font-mono">{formatCurrency(valorLiquido)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Novo saldo restante</span>
                <span className={`font-bold font-mono ${novoSaldo <= 0.01 ? "text-success" : "text-primary"}`}>
                  {formatCurrency(Math.max(0, novoSaldo))}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status após baixa</span>
                <Badge variant={novoSaldo <= 0.01 ? "default" : "secondary"}>
                  {novoSaldo <= 0.01 ? "Pago" : "Parcial"}
                </Badge>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Processando..." : "Confirmar Baixa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
