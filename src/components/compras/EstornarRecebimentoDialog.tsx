import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/format";
import { getUserFriendlyError } from "@/utils/errorMessages";
import { Loader2, RotateCcw, AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";

interface Props {
  open: boolean;
  onClose: () => void;
  pedidoId: string;
  pedidoNumero: string;
  onSuccess?: () => void;
}

interface CompraRow {
  id: string;
  numero: string | null;
  data_compra: string | null;
  status: string | null;
  valor_total: number | null;
  ativo: boolean | null;
}

/**
 * Diálogo para estornar um recebimento. Lista as `compras` ativas
 * vinculadas ao pedido (cada chamada a receber_compra cria uma)
 * e permite estornar uma específica via RPC `estornar_recebimento_compra`.
 *
 * Restrito a admins na chamada (UI deve gatear).
 */
export function EstornarRecebimentoDialog({ open, onClose, pedidoId, pedidoNumero, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [compras, setCompras] = useState<CompraRow[]>([]);
  const [selectedCompraId, setSelectedCompraId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("compras")
          .select("id, numero, data_compra, status, valor_total, ativo")
          .eq("pedido_compra_id", pedidoId)
          .eq("ativo", true)
          .order("data_compra", { ascending: false });
        if (error) throw error;
        if (cancelled) return;
        setCompras((data || []) as CompraRow[]);
        setSelectedCompraId(data && data.length > 0 ? String(data[0].id) : null);
        setMotivo("");
      } catch (err) {
        toast.error(getUserFriendlyError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, pedidoId]);

  const handleSubmit = async () => {
    if (!selectedCompraId) {
      toast.error("Selecione um recebimento para estornar.");
      return;
    }
    if (!motivo.trim()) {
      toast.error("Informe o motivo do estorno.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("estornar_recebimento_compra", {
        p_compra_id: selectedCompraId,
        p_motivo: motivo.trim(),
      });
      if (error) throw error;
      toast.success("Recebimento estornado. Estoque devolvido.");
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(getUserFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-warning" /> Estornar recebimento — {pedidoNumero}
          </DialogTitle>
          <DialogDescription>
            Selecione o recebimento a estornar. O estoque será devolvido e os lançamentos financeiros associados serão cancelados.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-warning flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            Esta ação afeta estoque e financeiro. Se houver NF de entrada emitida vinculada,
            cancele-a antes para evitar inconsistências fiscais.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando recebimentos...
          </div>
        ) : compras.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhum recebimento ativo encontrado para este pedido.
          </p>
        ) : (
          <div className="space-y-3">
            <Label>Recebimento a estornar</Label>
            <div className="rounded-lg border divide-y max-h-60 overflow-auto">
              {compras.map((c) => (
                <label
                  key={c.id}
                  className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 ${
                    selectedCompraId === String(c.id) ? "bg-accent/30" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="compra"
                    value={String(c.id)}
                    checked={selectedCompraId === String(c.id)}
                    onChange={() => setSelectedCompraId(String(c.id))}
                    disabled={saving}
                  />
                  <div className="flex-1 min-w-0 grid grid-cols-3 gap-2 items-center text-sm">
                    <div>
                      <div className="font-mono font-medium">{c.numero ?? `#${String(c.id).slice(0, 8)}`}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(c.data_compra)}</div>
                    </div>
                    <StatusBadge status={String(c.status ?? "")} />
                    <div className="text-right font-mono font-semibold">
                      {formatCurrency(Number(c.valor_total ?? 0))}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div>
              <Label htmlFor="motivo-estorno">Motivo do estorno *</Label>
              <Textarea
                id="motivo-estorno"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex: produto avariado, recebimento em duplicidade, divergência fiscal"
                className="min-h-20"
                disabled={saving}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={saving || loading || !selectedCompraId || !motivo.trim()}
            className="gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Estornar recebimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
