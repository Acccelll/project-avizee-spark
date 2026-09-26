import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { notifyError } from "@/utils/errorMessages";
import { getOrcamentoStatusLabel } from "@/lib/comercialWorkflow";
import {
  sugerirPedidosNf,
  vincularNfOrcamento,
  type OrigemVinculo,
  type PedidoSugerido,
} from "@/services/comercial/vinculoNfPedido.service";

interface Props {
  open: boolean;
  onClose: () => void;
  nf: { id: string; numero: string | null };
  onLinked?: () => void;
}

interface Opcao {
  orcamento_id: string;
  numero: string;
  pedido_cliente: string | null;
  status: string;
  valor_total: number | null;
  motivo: PedidoSugerido["motivo"] | "busca";
  referencia: string | null;
  registrado: boolean;
  vinculado: boolean;
}

const MOTIVO_LABEL: Record<Opcao["motivo"], string> = {
  xml_pedido: "pedido citado no XML",
  xml_orcamento: "orçamento citado no XML",
  valor: "mesmo valor",
  busca: "busca",
};

/** Escolher o pedido (orçamento) atendido por uma NF de saída. */
export function VincularPedidoNfDialog({ open, onClose, nf, onLinked }: Props) {
  const [sugestoes, setSugestoes] = useState<Opcao[]>([]);
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<Opcao[]>([]);
  const [salvando, setSalvando] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setBusca("");
    setResultados([]);
    sugerirPedidosNf(nf.id)
      .then((rows) => setSugestoes(rows.map((r) => ({ ...r }))))
      .catch((err) => {
        notifyError(err);
        setSugestoes([]);
      });
  }, [open, nf.id]);

  useEffect(() => {
    const termo = busca.trim();
    if (!open || termo.length < 2) {
      setResultados([]);
      return;
    }
    let ativo = true;
    const t = setTimeout(async () => {
      const like = `%${termo.replace(/[%_,()]/g, "")}%`;
      const { data, error } = await supabase
        .from("orcamentos")
        .select("id, numero, pedido_cliente, status, valor_total")
        .in("status", ["aprovado", "convertido"])
        .or(`numero.ilike.${like},pedido_cliente.ilike.${like}`)
        .order("data_orcamento", { ascending: false })
        .limit(15);
      if (!ativo) return;
      if (error) {
        notifyError(error);
        return;
      }
      setResultados(
        (data ?? []).map((o) => ({
          orcamento_id: o.id,
          numero: o.numero,
          pedido_cliente: o.pedido_cliente,
          status: o.status ?? "",
          valor_total: o.valor_total,
          motivo: "busca",
          referencia: null,
          registrado: true,
          vinculado: false,
        })),
      );
    }, 300);
    return () => {
      ativo = false;
      clearTimeout(t);
    };
  }, [busca, open]);

  const vincular = async (o: Opcao) => {
    setSalvando(o.orcamento_id);
    try {
      const origem: OrigemVinculo = o.motivo === "busca" ? "manual" : o.motivo;
      const res = await vincularNfOrcamento({ nfId: nf.id, orcamentoId: o.orcamento_id, origem, referencia: o.referencia });
      toast.success(
        res.ja_vinculado
          ? `A NF ${nf.numero ?? ""} já estava ligada a ${o.numero}.`
          : `NF ${nf.numero ?? ""} ligada ao pedido ${o.pedido_cliente ?? o.numero}.`,
      );
      onLinked?.();
      onClose();
    } catch (err) {
      notifyError(err);
    } finally {
      setSalvando(null);
    }
  };

  const idsSugeridos = new Set(sugestoes.map((s) => s.orcamento_id));
  const lista = [...sugestoes, ...resultados.filter((r) => !idsSugeridos.has(r.orcamento_id))];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Vincular NF {nf.numero} a um pedido
          </DialogTitle>
          <DialogDescription>
            Pedidos do mesmo cliente citados no XML ou com o mesmo valor aparecem primeiro. Busque por nº do orçamento ou do pedido do cliente.
          </DialogDescription>
        </DialogHeader>
        <Input
          id="busca-pedido-nf"
          placeholder="Buscar orçamento ou pedido do cliente…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="h-9"
        />
        <div className="max-h-[360px] divide-y overflow-auto rounded-md border">
          {lista.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhum pedido sugerido. Busque pelo número do orçamento ou do pedido.
            </p>
          ) : (
            lista.map((o) => (
              <div key={o.orcamento_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm">
                    <span className="font-mono font-semibold">{o.pedido_cliente ?? "sem pedido"}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{o.numero}</span>
                  </p>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">{MOTIVO_LABEL[o.motivo]}</Badge>
                    {getOrcamentoStatusLabel(o.status)} · {formatCurrency(Number(o.valor_total || 0))}
                  </p>
                </div>
                {o.vinculado ? (
                  <span className="text-xs text-muted-foreground">Já ligado</span>
                ) : o.registrado ? (
                  <Button size="sm" className="h-8 min-h-11 sm:min-h-0" disabled={!!salvando} onClick={() => void vincular(o)}>
                    {salvando === o.orcamento_id ? "Ligando…" : "Vincular"}
                  </Button>
                ) : (
                  <span className="max-w-[12rem] text-right text-xs text-muted-foreground">
                    Registre o pedido neste orçamento antes de ligar a nota.
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
