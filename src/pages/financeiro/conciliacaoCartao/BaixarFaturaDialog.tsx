import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listContasBancarias } from "@/services/contasBancarias.service";
import { baixarFaturaCartao } from "@/services/cartoesCredito.service";
import { logger } from "@/lib/logger";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  faturaId: string | null;
  faturaLabel?: string;
  valorTotal?: number;
  dataVencimento?: string;
}

const FORMAS = [
  { v: "boleto_dda", l: "Boleto/DDA" },
  { v: "debito_automatico", l: "Débito automático" },
  { v: "pix", l: "PIX" },
  { v: "transferencia", l: "Transferência" },
];

export function BaixarFaturaDialog({ open, onOpenChange, faturaId, faturaLabel, valorTotal, dataVencimento }: Props) {
  const qc = useQueryClient();
  const [contaId, setContaId] = useState("");
  const [forma, setForma] = useState("boleto_dda");
  const [data, setData] = useState<string>(dataVencimento ?? new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);

  const contas = useQuery({
    queryKey: ["contas_bancarias", "baixar-fatura"],
    enabled: open,
    queryFn: listContasBancarias,
  });

  const submit = async () => {
    if (!faturaId || !contaId) {
      toast.error("Selecione a conta bancária");
      return;
    }
    setBusy(true);
    try {
      const res = await baixarFaturaCartao(faturaId, contaId, data, forma, obs || null);
      toast.success(`Fatura baixada: ${res.processados} lançamento(s) — R$ ${Number(res.valor_total).toFixed(2)}`);
      await qc.invalidateQueries({ queryKey: ["conciliacao-cartao"] });
      await qc.invalidateQueries({ queryKey: ["financeiro_lancamentos"] });
      await qc.invalidateQueries({ queryKey: ["cartao-faturas"] });
      onOpenChange(false);
    } catch (err) {
      logger.error("conciliacao_cartao.baixar", { err });
      toast.error(err instanceof Error ? err.message : "Falha ao baixar fatura");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Baixar fatura {faturaLabel ? `— ${faturaLabel}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {typeof valorTotal === "number" && (
            <p className="text-sm text-muted-foreground">
              Valor a pagar: <strong>R$ {valorTotal.toFixed(2)}</strong>
            </p>
          )}
          <div className="grid gap-2">
            <Label>Conta bancária</Label>
            <Select value={contaId} onValueChange={setContaId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {contas.data?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} {c.agencia ? `— ag ${c.agencia}` : ""} {c.conta ? `cc ${c.conta}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Data do pagamento</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Forma de pagamento</Label>
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FORMAS.map((f) => <SelectItem key={f.v} value={f.v}>{f.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Observações</Label>
            <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy || !contaId}>
            {busy ? "Processando…" : "Confirmar baixa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}