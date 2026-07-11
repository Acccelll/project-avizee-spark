import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { parseFaturaPdf } from "@/services/conciliacaoCartao/faturaParser";
import { importarFaturaCartao } from "@/services/conciliacaoCartao/importService";
import type { FaturaImportInput } from "@/services/conciliacaoCartao/types";

export function ImportarFaturaCartaoDialog({ onImported }: { onImported?: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [cartaoId, setCartaoId] = useState("");
  const [parsed, setParsed] = useState<FaturaImportInput | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const cartoes = useQuery({
    queryKey: ["cartoes-credito", "ativos"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cartoes_credito")
        .select("id, nome, ultimos4, bandeira")
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

  const reset = () => { setFile(null); setParsed(null); };

  const handleFile = async (f: File) => {
    setFile(f);
    try {
      const res = await parseFaturaPdf(f);
      setParsed(res);
      if (res.lancamentos.length === 0) toast.warning("Nenhum lançamento encontrado no PDF");
    } catch (err) {
      logger.error("conciliacao_cartao.parse", { err });
      toast.error(err instanceof Error ? err.message : "Falha ao ler PDF");
    }
  };

  const confirmar = async () => {
    if (!parsed || !cartaoId || !empresa.data) {
      toast.error("Selecione cartão e um PDF válido");
      return;
    }
    setBusy(true);
    try {
      const res = await importarFaturaCartao({ ...parsed, empresa_id: empresa.data, cartao_id: cartaoId });
      toast.success(`Fatura importada: ${res.inseridas} novas, ${res.duplicadas} duplicadas`);
      await qc.invalidateQueries({ queryKey: ["conciliacao-cartao"] });
      onImported?.();
      reset();
      setOpen(false);
      // filtra dashboard pelo período da fatura
      const datas = parsed.lancamentos.map((l) => l.data_compra).sort();
      if (datas.length) {
        navigate(`/financeiro/conciliacao-cartao/dashboard?inicio=${datas[0]}&fim=${datas[datas.length - 1]}&cartao=${cartaoId}`);
      }
    } catch (err) {
      logger.error("conciliacao_cartao.importar", { err });
      toast.error(err instanceof Error ? err.message : "Falha ao importar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm"><Upload className="mr-2 h-4 w-4" />Importar fatura (PDF)</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Importar fatura de cartão (PDF)</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>Cartão</Label>
            <Select value={cartaoId} onValueChange={setCartaoId}>
              <SelectTrigger><SelectValue placeholder="Selecione o cartão" /></SelectTrigger>
              <SelectContent>
                {cartoes.data?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} {c.ultimos4 ? `•••• ${c.ultimos4}` : ""} {c.bandeira ? `(${c.bandeira})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Arquivo PDF (C6, Inter ou RecargaPay)</Label>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="text-sm"
            />
            {parsed && (
              <p className="text-xs text-muted-foreground">
                Emissor: <strong>{parsed.emissor.toUpperCase()}</strong> · Competência {parsed.competencia} ·
                Venc. {parsed.data_vencimento} · Total R$ {parsed.valor_total.toFixed(2)} ·
                {parsed.lancamentos.length} lançamentos
              </p>
            )}
          </div>
          {parsed && parsed.lancamentos.length > 0 && (
            <div className="max-h-64 overflow-auto rounded border">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-1 text-left">Data</th>
                    <th className="p-1 text-left">Descrição</th>
                    <th className="p-1 text-left">Cartão</th>
                    <th className="p-1 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.lancamentos.slice(0, 10).map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-1">{l.data_compra}</td>
                      <td className="p-1">{l.descricao.slice(0, 55)}</td>
                      <td className="p-1">{l.ultimos4 ?? "-"}</td>
                      <td className="p-1 text-right">{l.valor.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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