/**
 * Sprint 2 — Aba de histórico de importações de extrato.
 * Lista os lotes carregados com progresso de conciliação e ações
 * de retomar/excluir.
 */
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, ArrowRight, FileText, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import {
  excluirLoteImportacao,
  listarLotesImportacao,
  type LoteResumo,
} from "@/services/financeiro/extratoImportacoes.service";
import { notifyError } from "@/utils/errorMessages";
import { confirmAsync } from "@/lib/globalConfirm";

interface Props {
  contaBancariaId?: string;
  onAbrirLote: (lote: LoteResumo) => void;
}

export function HistoricoImportacoesTab({ contaBancariaId, onAbrirLote }: Props) {
  const [loading, setLoading] = useState(false);
  const [lotes, setLotes] = useState<LoteResumo[]>([]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listarLotesImportacao(
        contaBancariaId ? { contaBancariaId } : undefined,
      );
      setLotes(rows);
    } catch (err) {
      notifyError(err);
    } finally {
      setLoading(false);
    }
  }, [contaBancariaId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const excluir = async (id: string) => {
    const ok = await confirmAsync({
      title: "Excluir lote",
      description: "Excluir este lote e todas as suas transações pendentes?",
      confirmLabel: "Excluir",
      confirmVariant: "destructive",
    });
    if (!ok) return;
    try {
      await excluirLoteImportacao(id);
      toast.success("Lote excluído.");
      await carregar();
    } catch (err) {
      notifyError(err);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
        Carregando histórico...
      </div>
    );
  }

  if (lotes.length === 0) {
    return (
      <div className="py-12 text-center border rounded-xl bg-muted/10">
        <FileText className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          Nenhum extrato importado ainda{contaBancariaId ? " para esta conta" : ""}.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="text-xs text-muted-foreground text-left">
            <th className="px-3 py-2 font-medium">Data</th>
            <th className="px-3 py-2 font-medium">Arquivo</th>
            <th className="px-3 py-2 font-medium">Conta</th>
            <th className="px-3 py-2 font-medium text-right">Transações</th>
            <th className="px-3 py-2 font-medium text-right">Conciliadas</th>
            <th className="px-3 py-2 font-medium text-right">Pendentes</th>
            <th className="px-3 py-2 font-medium text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {lotes.map((l) => (
            <tr key={l.id} className="border-t hover:bg-muted/20">
              <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                {formatDate(l.created_at)}
              </td>
              <td className="px-3 py-2 font-medium truncate max-w-[240px]" title={l.arquivo_nome}>
                {l.arquivo_nome}
                <Badge variant="outline" className="ml-2 text-[10px] uppercase">
                  {l.origem}
                </Badge>
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {l.conta_nome ?? "—"}
                {l.banco_nome ? ` · ${l.banco_nome}` : ""}
              </td>
              <td className="px-3 py-2 text-right font-mono">{l.total_transacoes}</td>
              <td className="px-3 py-2 text-right font-mono text-success">{l.conciliadas}</td>
              <td className="px-3 py-2 text-right font-mono text-warning">{l.pendentes}</td>
              <td className="px-3 py-2 text-right">
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => onAbrirLote(l)}>
                    <ArrowRight className="w-3 h-3" /> Abrir
                  </Button>
                  {l.conciliadas === 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => excluir(l.id)}
                      title="Excluir lote"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}