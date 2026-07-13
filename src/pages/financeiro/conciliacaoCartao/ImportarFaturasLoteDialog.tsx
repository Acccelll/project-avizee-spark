import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers, Upload, Undo2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import {
  desfazerLote, executarLote, preverFatura,
  type LotePreviewItem, type LoteResultado,
} from "@/services/conciliacaoCartao/importacaoLote.service";

function fmt(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);
}

export function ImportarFaturasLoteDialog({ onDone }: { onDone?: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [itens, setItens] = useState<LotePreviewItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState<LoteResultado | null>(null);

  const empresa = useQuery({
    queryKey: ["empresa", "atual"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("current_empresa_id");
      if (error) throw error;
      return data as string;
    },
  });

  const reset = () => { setItens([]); setResultado(null); };

  const handleFiles = async (fs: FileList) => {
    const previews: LotePreviewItem[] = [];
    for (const f of Array.from(fs)) previews.push(await preverFatura(f));
    setItens(previews);
  };

  const executar = async () => {
    if (!empresa.data) return;
    setBusy(true);
    try {
      const res = await executarLote({ empresa_id: empresa.data, itens });
      setResultado(res);
      toast.success(
        `Importadas ${res.faturas.length} faturas · ${res.total_vinculadas} linhas auto‑vinculadas`,
      );
      await qc.invalidateQueries({ queryKey: ["cartao-faturas"] });
      onDone?.();
    } catch (err) {
      logger.error("conciliacao_cartao.lote", { err });
      toast.error(err instanceof Error ? err.message : "Falha ao importar em lote");
    } finally { setBusy(false); }
  };

  const desfazer = async () => {
    if (!resultado) return;
    setBusy(true);
    try {
      await desfazerLote(resultado.lote_id);
      toast.success("Importação desfeita");
      await qc.invalidateQueries({ queryKey: ["cartao-faturas"] });
      onDone?.();
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao desfazer");
    } finally { setBusy(false); }
  };

  const validos = itens.filter((i) => !i.erro && i.cartao_id && i.parsed);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Layers className="mr-2 h-4 w-4" />Importar faturas (lote)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar faturas em lote</DialogTitle>
        </DialogHeader>

        {!resultado ? (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>PDFs das faturas (múltiplos)</Label>
              <input
                type="file"
                accept=".pdf,application/pdf"
                multiple
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                O cartão é resolvido automaticamente pelo emissor (C6, Inter, RecargaPay).
                Uma fatura por banco por competência.
              </p>
            </div>

            {itens.length > 0 && (
              <div className="max-h-80 overflow-auto rounded border">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-1 text-left">Arquivo</th>
                      <th className="p-1 text-left">Emissor</th>
                      <th className="p-1 text-left">Competência</th>
                      <th className="p-1 text-left">Vencimento</th>
                      <th className="p-1 text-right">Total</th>
                      <th className="p-1 text-right">Linhas</th>
                      <th className="p-1 text-left">Situação</th>
                      <th className="p-1 text-left">Aviso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((it, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-1 truncate max-w-[180px]" title={it.file.name}>{it.file.name}</td>
                        <td className="p-1">{it.parsed?.emissor.toUpperCase() ?? "—"}</td>
                        <td className="p-1">{it.parsed?.competencia ?? "—"}</td>
                        <td className="p-1">{it.parsed?.data_vencimento ?? "—"}</td>
                        <td className="p-1 text-right">{it.parsed ? fmt(it.parsed.valor_total) : "—"}</td>
                        <td className="p-1 text-right">{it.parsed?.lancamentos.length ?? 0}</td>
                        <td className="p-1">
                          {it.erro ? (
                            <span className="text-destructive">{it.erro}</span>
                          ) : it.ja_existe ? (
                            <span className="text-amber-600">Atualiza {it.cartao_nome}</span>
                          ) : (
                            <span className="text-emerald-600">Cria em {it.cartao_nome}</span>
                          )}
                        </td>
                        <td className="p-1">
                          {it.parsed?.aviso ? (
                            <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">
                              <AlertCircle className="h-3 w-3" />
                              {it.parsed.aviso}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded border bg-emerald-50 p-3 text-sm">
              <p className="font-medium text-emerald-800">
                <CheckCircle2 className="mr-1 inline h-4 w-4" />
                {resultado.faturas.length} faturas processadas · {resultado.total_vinculadas} auto‑vinculadas de {resultado.total_linhas} linhas
              </p>
            </div>
            <div className="max-h-80 overflow-auto rounded border">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-1 text-left">Fatura</th>
                    <th className="p-1 text-right">Novas</th>
                    <th className="p-1 text-right">Duplicadas</th>
                    <th className="p-1 text-right">Vinculadas</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.faturas.map((f) => (
                    <tr key={f.fatura_id} className="border-t">
                      <td className="p-1">
                        {f.emissor.toUpperCase()} · {f.competencia}
                        {f.criou_fatura ? "" : " (atualizada)"}
                      </td>
                      <td className="p-1 text-right">{f.inseridas}</td>
                      <td className="p-1 text-right">{f.duplicadas}</td>
                      <td className="p-1 text-right">{f.vinculadas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded border border-amber-300 bg-amber-50 p-2 text-xs">
              <AlertCircle className="mr-1 inline h-3.5 w-3.5" />
              Se algo saiu diferente do esperado, clique em <strong>Desfazer importação</strong>.
              As faturas criadas serão removidas e as linhas auto‑vinculadas serão desvinculadas.
            </div>
          </div>
        )}

        <DialogFooter>
          {!resultado ? (
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button>
              <Button onClick={executar} disabled={busy || validos.length === 0}>
                <Upload className="mr-2 h-4 w-4" />
                {busy ? "Importando…" : `Importar ${validos.length} faturas`}
              </Button>
            </>
          ) : (
            <>
              <Button variant="destructive" onClick={desfazer} disabled={busy}>
                <Undo2 className="mr-2 h-4 w-4" />Desfazer importação
              </Button>
              <Button onClick={() => { reset(); setOpen(false); }}>Concluir</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}