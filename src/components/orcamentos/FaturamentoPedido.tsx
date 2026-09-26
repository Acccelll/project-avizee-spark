import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CircleSlash, Link2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RelationalLink } from "@/components/ui/RelationalLink";
import { formatDate, formatCurrency } from "@/lib/format";
import { notifyError } from "@/utils/errorMessages";
import { supabase } from "@/integrations/supabase/client";
import { VincularNfDialog } from "@/components/orcamentos/VincularNfDialog";
import {
  FATURAMENTO_LABEL,
  ORIGEM_VINCULO_LABEL,
  desvincularNfOrcamento,
  encerrarSaldoOrcamento,
  listarSaldoItensPedido,
  listarVinculosDoOrcamento,
  type FaturamentoStatus,
} from "@/services/comercial/vinculoNfPedido.service";

interface Props {
  orcamento: {
    id: string;
    numero: string;
    cliente_id: string | null;
    valor_total: number | null;
    status: string | null;
    faturamento_status?: string | null;
  };
  onChanged?: () => void;
}

const TONS: Record<FaturamentoStatus, string> = {
  aberto: "border-primary/30 bg-primary/10 text-primary",
  parcial: "border-warning/40 bg-warning/10 text-warning",
  faturado: "border-success/40 bg-success/10 text-success",
  encerrado: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

export function FaturamentoBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  const s = status as FaturamentoStatus;
  return (
    <Badge variant="outline" className={`text-[10px] ${TONS[s] ?? ""}`}>
      {FATURAMENTO_LABEL[s] ?? status}
    </Badge>
  );
}

/** Saldo do pedido por item e as notas que o faturaram. */
export function FaturamentoPedido({ orcamento, onChanged }: Props) {
  const qc = useQueryClient();
  const [vincularOpen, setVincularOpen] = useState(false);
  const [encerrarOpen, setEncerrarOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const { data } = useQuery({
    queryKey: ["pedido-faturamento", orcamento.id],
    queryFn: async () => {
      const [saldos, vinculos, itens] = await Promise.all([
        listarSaldoItensPedido(orcamento.id),
        listarVinculosDoOrcamento(orcamento.id),
        supabase
          .from("orcamentos_itens")
          .select("id, descricao_snapshot, variacao, unidade, valor_unitario")
          .eq("orcamento_id", orcamento.id)
          .then(({ data: rows, error }) => {
            if (error) throw error;
            return rows ?? [];
          }),
      ]);
      const porItem = new Map(itens.map((i) => [i.id, i]));
      return {
        vinculos,
        linhas: saldos.map((s) => ({ ...s, item: porItem.get(s.orcamento_item_id) })),
      };
    },
  });

  const atualizar = () => {
    void qc.invalidateQueries({ queryKey: ["pedido-faturamento", orcamento.id] });
    void qc.invalidateQueries({ queryKey: ["orcamentos"] });
    onChanged?.();
  };

  const desvincular = async (nfId: string, numero: string | null) => {
    setOcupado(true);
    try {
      await desvincularNfOrcamento(nfId, orcamento.id);
      toast.success(`NF ${numero ?? ""} desligada do pedido.`);
      atualizar();
    } catch (err) {
      notifyError(err);
    } finally {
      setOcupado(false);
    }
  };

  const encerrar = async () => {
    setOcupado(true);
    try {
      await encerrarSaldoOrcamento(orcamento.id, motivo);
      toast.success(`Saldo do pedido ${orcamento.numero} encerrado.`);
      setEncerrarOpen(false);
      setMotivo("");
      atualizar();
    } catch (err) {
      notifyError(err);
    } finally {
      setOcupado(false);
    }
  };

  const linhas = data?.linhas ?? [];
  const vinculos = data?.vinculos ?? [];
  const comSaldo = ["aberto", "parcial"].includes(orcamento.faturamento_status ?? "aberto");
  const aMais = linhas.some((l) => l.faturado_a_mais);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FaturamentoBadge status={orcamento.faturamento_status ?? "aberto"} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="h-8 min-h-11 gap-1.5 text-xs sm:min-h-0" onClick={() => setVincularOpen(true)}>
            <Link2 className="h-3.5 w-3.5" /> Vincular NF
          </Button>
          {comSaldo && vinculos.length > 0 && (
            <Button size="sm" variant="ghost" className="h-8 min-h-11 gap-1.5 text-xs sm:min-h-0" onClick={() => setEncerrarOpen(true)}>
              <CircleSlash className="h-3.5 w-3.5" /> Encerrar saldo
            </Button>
          )}
        </div>
      </div>

      {linhas.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-left">Produto</th>
                <th className="px-2 py-1.5 text-left">UN</th>
                <th className="px-2 py-1.5 text-right">Pedido</th>
                <th className="px-2 py-1.5 text-right">Faturado</th>
                <th className="px-2 py-1.5 text-right">Saldo</th>
                <th className="px-2 py-1.5 text-left">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {linhas.map((l) => (
                <tr key={l.orcamento_item_id}>
                  <td className="px-2 py-1.5">
                    {l.item?.descricao_snapshot ?? "—"}
                    {l.item?.variacao ? ` — ${l.item.variacao}` : ""}
                  </td>
                  <td className="px-2 py-1.5">{l.item?.unidade ?? ""}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{l.quantidade}</td>
                  <td className={`px-2 py-1.5 text-right tabular-nums ${l.faturado_a_mais ? "text-warning font-medium" : ""}`}>{l.quantidade_faturada}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{l.saldo}</td>
                  <td className="px-2 py-1.5 font-mono">{l.notas.join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {aMais && (
        <p className="flex items-center gap-1.5 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5" /> Algum item foi faturado a mais do que o pedido.
        </p>
      )}

      {vinculos.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhuma nota ligada. A NF importada pelo XML se liga sozinha quando cita o pedido ou este orçamento.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {vinculos.map((v) => v.nota && (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <RelationalLink type="nota_fiscal" id={v.nota.id}>
                  <span className="font-mono font-semibold">NF {v.nota.numero}</span>
                </RelationalLink>
                <span>{formatDate(v.nota.data_emissao)}</span>
                <span className="tabular-nums">{formatCurrency(Number(v.nota.valor_total || 0))}</span>
                {v.nota.status === "cancelada" && <Badge variant="outline" className="text-[10px] text-destructive">cancelada</Badge>}
                <span className="text-muted-foreground">{ORIGEM_VINCULO_LABEL[v.origem] ?? v.origem}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 min-h-11 gap-1 text-xs text-muted-foreground sm:min-h-0"
                disabled={ocupado}
                onClick={() => void desvincular(v.nota!.id, v.nota!.numero)}
              >
                <Unlink className="h-3 w-3" /> Desvincular
              </Button>
            </li>
          ))}
        </ul>
      )}

      <VincularNfDialog
        open={vincularOpen}
        onClose={() => setVincularOpen(false)}
        orcamento={{ id: orcamento.id, numero: orcamento.numero, cliente_id: orcamento.cliente_id, valor_total: orcamento.valor_total }}
        onLinked={atualizar}
      />

      <Dialog open={encerrarOpen} onOpenChange={(v) => !v && !ocupado && setEncerrarOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Encerrar saldo do pedido</DialogTitle>
            <DialogDescription>
              O saldo restante sai da carteira a faturar e o pedido fica como "Saldo encerrado".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="motivo-encerrar" className="text-xs">Motivo</Label>
            <Input
              id="motivo-encerrar"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: cliente cancelou o restante"
              className="h-9"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEncerrarOpen(false)} disabled={ocupado}>Voltar</Button>
            <Button onClick={() => void encerrar()} disabled={ocupado || motivo.trim().length < 5}>Encerrar saldo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
