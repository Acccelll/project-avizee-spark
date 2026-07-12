import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { parseOFXFaturaCartao } from "@/services/conciliacaoCartao/ofxCartaoAdapter";
import { importarFaturaCartao } from "@/services/conciliacaoCartao/importService";
import type { FaturaImportInput } from "@/services/conciliacaoCartao/types";

export function ImportarOfxCartaoDialog({ onImported }: { onImported?: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [cartaoId, setCartaoId] = useState("");
  const [parsed, setParsed] = useState<FaturaImportInput | null>(null);
  const [busy, setBusy] = useState(false);

  const cartoes = useQuery({
    queryKey: ["cartoes-credito", "ativos"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cartoes_credito")
        .select("id, nome, ultimos4")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const empresa = useQuery({
    queryKey: ["empresa", "atual"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("current_empresa_id");
      if (error) throw error;
      return data as string;
    },
  });

  const reset = () => setParsed(null);

  const handleFile = async (f: File) => {
    try {
      const res = await parseOFXFaturaCartao(f);
      setParsed(res);
      if (res.lancamentos.length === 0) toast.warning("Nenhum lançamento no OFX");
    } catch (err) {
      logger.error("cartao_ofx.parse", { err });
      toast.error(err instanceof Error ? err.message : "Falha ao ler OFX");
    }
  };

  const confirmar = async () => {
    if (!parsed || !cartaoId || !empresa.data) {
      toast.error("Selecione cartão e um OFX válido");
      return;
    }
    setBusy(true);
    try {
      const res = await importarFaturaCartao({
        ...parsed,
        empresa_id: empresa.data,
        cartao_id: cartaoId,
        origem: "ofx_cartao",
      });
      toast.success(`Fatura OFX importada: ${res.inseridas} novas, ${res.duplicadas} duplicadas`);
      await qc.invalidateQueries({ queryKey: ["cartao-faturas"] });
      onImported?.();
      reset();
      setOpen(false);
    } catch (err) {
      logger.error("cartao_ofx.importar", { err });
      toast.error(err instanceof Error ? err.message : "Falha ao importar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><FileUp className="mr-2 h-4 w-4" />Importar fatura (OFX)</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Importar fatura de cartão (OFX)</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>Cartão</Label>
            <Select value={cartaoId} onValueChange={setCartaoId}>
              <SelectTrigger><SelectValue placeholder="Selecione o cartão" /></SelectTrigger>
              <SelectContent>
                {cartoes.data?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} {c.ultimos4 ? `•••• ${c.ultimos4}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Arquivo OFX (bloco CCSTMTRS)</Label>
            <input
              type="file"
              accept=".ofx,.qfx"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="text-sm"
            />
            {parsed && (
              <p className="text-xs text-muted-foreground">
                Competência {parsed.competencia} · Venc. {parsed.data_vencimento} ·
                Total R$ {parsed.valor_total.toFixed(2)} · {parsed.lancamentos.length} lançamentos
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={confirmar} disabled={busy || !parsed || !cartaoId}>
            {busy ? "Importando…" : `Importar ${parsed?.lancamentos.length ?? 0} lançamentos`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}