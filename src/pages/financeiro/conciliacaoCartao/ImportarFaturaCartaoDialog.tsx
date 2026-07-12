import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  const [open, setOpen] = useState(false);
  const [cartaoId, setCartaoId] = useState("");
  const [parsed, setParsed] = useState<FaturaImportInput | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [ignorarUltimos4, setIgnorarUltimos4] = useState(false);

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

  /** Retorna o `ultimos4` predominante nos lançamentos do PDF (moda). */
  const ultimos4Pdf = (() => {
    if (!parsed) return null;
    const contagem = new Map<string, number>();
    parsed.lancamentos.forEach((l) => {
      if (!l.ultimos4) return;
      contagem.set(l.ultimos4, (contagem.get(l.ultimos4) ?? 0) + 1);
    });
    let melhor: string | null = null;
    let max = 0;
    contagem.forEach((v, k) => { if (v > max) { max = v; melhor = k; } });
    return melhor;
  })();

  const cartaoSelecionado = cartoes.data?.find((c) => c.id === cartaoId) ?? null;
  const ultimos4Cartao = cartaoSelecionado?.ultimos4 ?? null;
  const ultimos4Divergente = Boolean(
    ultimos4Pdf && ultimos4Cartao && ultimos4Pdf !== ultimos4Cartao,
  );

  const empresa = useQuery({
    queryKey: ["empresa", "atual"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("current_empresa_id");
      if (error) throw error;
      return data as string;
    },
  });

  const reset = () => { setFile(null); setParsed(null); setIgnorarUltimos4(false); };

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
    if (ultimos4Divergente && !ignorarUltimos4) {
      toast.error(
        `Cartão selecionado (•••• ${ultimos4Cartao}) diverge do PDF (•••• ${ultimos4Pdf}). Marque "Importar mesmo assim" para continuar.`,
      );
      return;
    }
    setBusy(true);
    try {
      const res = await importarFaturaCartao({ ...parsed, empresa_id: empresa.data, cartao_id: cartaoId });
      toast.success(`Fatura importada: ${res.inseridas} novas, ${res.duplicadas} duplicadas`);
      await qc.invalidateQueries({ queryKey: ["conciliacao-cartao"] });
      await qc.invalidateQueries({ queryKey: ["cartao-faturas"] });
      onImported?.();
      reset();
      setOpen(false);
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
            {ultimos4Divergente && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs">
                <p className="font-medium text-destructive">
                  Cartão diverge: PDF é •••• {ultimos4Pdf}, selecionado é •••• {ultimos4Cartao}.
                </p>
                <label className="mt-1 flex items-center gap-2 text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={ignorarUltimos4}
                    onChange={(e) => setIgnorarUltimos4(e.target.checked)}
                  />
                  Importar mesmo assim
                </label>
              </div>
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