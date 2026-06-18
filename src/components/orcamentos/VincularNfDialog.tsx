import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { notifyError } from "@/utils/errorMessages";
import { toast } from "sonner";
import { Link2 } from "lucide-react";
import {
  listNotasFiscaisVinculaveis,
  vincularOrcamentoNf,
  type NfVinculavelRow,
} from "@/services/orcamentos.service";

type NfRow = NfVinculavelRow;

interface Props {
  open: boolean;
  onClose: () => void;
  orcamento: {
    id: string;
    numero: string;
    cliente_id: string | null;
    valor_total: number | null;
  } | null;
  onLinked?: (result: { nfId: string; ovId: string }) => void;
}

/**
 * Permite vincular um orçamento (que ainda não tem NF) a uma NF de saída já
 * emitida. Chama a RPC `vincular_orcamento_nf` que cria a OV-ponte quando
 * necessário e atualiza `notas_fiscais.ordem_venda_id`.
 */
export function VincularNfDialog({ open, onClose, orcamento, onLinked }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<NfRow[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !orcamento) return;
    setSelectedId(null);
    setSearch("");
    setLoading(true);
    (async () => {
      try {
        const data = await listNotasFiscaisVinculaveis(orcamento.cliente_id);
        setRows(data);
      } catch (err) {
        notifyError(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, orcamento]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.numero, r.serie, r.chave_acesso, r.clientes?.nome_razao_social]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const handleConfirm = async () => {
    if (!orcamento || !selectedId) return;
    setSubmitting(true);
    try {
      const res = await vincularOrcamentoNf({
        orcamentoId: orcamento.id,
        nfId: selectedId,
      });
      toast.success(`Orçamento ${orcamento.numero} vinculado à NF.`);
      onLinked?.({ nfId: selectedId, ovId: res?.ov_id ?? "" });
      onClose();
    } catch (err) {
      notifyError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Vincular a NF emitida
          </DialogTitle>
          <DialogDescription>
            {orcamento
              ? `Selecione uma NF-e de saída já emitida para o cliente do orçamento ${orcamento.numero}. Será criada uma OV-ponte automaticamente quando necessário.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            placeholder="Buscar por número, série, chave ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />

          <div className="max-h-[360px] overflow-auto rounded-md border divide-y">
            {loading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Nenhuma NF emitida disponível
                {orcamento?.cliente_id ? " para este cliente" : ""}.
              </p>
            ) : (
              filtered.map((nf) => {
                const isSelected = selectedId === nf.id;
                return (
                  <button
                    key={nf.id}
                    type="button"
                    onClick={() => setSelectedId(nf.id)}
                    className={`w-full text-left px-3 py-2.5 hover:bg-muted/40 transition-colors ${
                      isSelected ? "bg-primary/10" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium mono">
                          NF {nf.numero || "—"} / série {nf.serie || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {nf.clientes?.nome_razao_social || "Cliente —"}
                        </p>
                        {nf.chave_acesso && (
                          <p className="text-[10px] font-mono text-muted-foreground/80 truncate">
                            {nf.chave_acesso}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold mono">
                          {formatCurrency(Number(nf.valor_total || 0))}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {nf.data_emissao ? formatDate(nf.data_emissao) : "—"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {orcamento && (
            <p className="text-[11px] text-muted-foreground">
              Valor do orçamento: {formatCurrency(Number(orcamento.valor_total || 0))}.
              Diferenças em relação à NF não são bloqueantes — confira antes de confirmar.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedId || submitting}>
            {submitting ? "Vinculando..." : "Vincular"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}