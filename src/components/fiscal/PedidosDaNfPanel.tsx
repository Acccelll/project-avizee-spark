import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RelationalLink } from "@/components/ui/RelationalLink";
import { notifyError } from "@/utils/errorMessages";
import { VincularPedidoNfDialog } from "@/components/fiscal/VincularPedidoNfDialog";
import {
  FATURAMENTO_LABEL,
  ORIGEM_VINCULO_LABEL,
  desvincularNfOrcamento,
  listarVinculosDaNf,
  type FaturamentoStatus,
} from "@/services/comercial/vinculoNfPedido.service";

interface Props {
  nf: { id: string; numero: string | null; tipo: string | null; status: string | null };
}

/** Pedidos (orçamentos) atendidos por uma NF de saída, com vincular/desvincular. */
export function PedidosDaNfPanel({ nf }: Props) {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const { data: vinculos = [], isLoading } = useQuery({
    queryKey: ["nf-pedidos", nf.id],
    queryFn: () => listarVinculosDaNf(nf.id),
  });

  if (nf.tipo !== "saida") return null;
  const cancelada = nf.status === "cancelada";

  const atualizar = () => {
    void qc.invalidateQueries({ queryKey: ["nf-pedidos", nf.id] });
    void qc.invalidateQueries({ queryKey: ["orcamentos"] });
  };

  const desvincular = async (orcamentoId: string, numero: string) => {
    setRemovendo(orcamentoId);
    try {
      await desvincularNfOrcamento(nf.id, orcamentoId);
      toast.success(`NF ${nf.numero ?? ""} desligada de ${numero}.`);
      atualizar();
    } catch (err) {
      notifyError(err);
    } finally {
      setRemovendo(null);
    }
  };

  return (
    <div className="space-y-2">
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando…</p>
      ) : vinculos.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum pedido ligado a esta nota.</p>
      ) : (
        <ul className="space-y-1.5">
          {vinculos.map((v) => v.orcamento && (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-semibold">{v.orcamento.pedido_cliente ?? "—"}</span>
                <RelationalLink type="orcamento" id={v.orcamento.id}>
                  <span className="font-mono">{v.orcamento.numero}</span>
                </RelationalLink>
                {v.orcamento.faturamento_status && (
                  <Badge variant="outline" className="text-[10px]">
                    {FATURAMENTO_LABEL[v.orcamento.faturamento_status as FaturamentoStatus] ?? v.orcamento.faturamento_status}
                  </Badge>
                )}
                <span className="text-muted-foreground">{ORIGEM_VINCULO_LABEL[v.origem] ?? v.origem}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 min-h-11 gap-1 text-xs text-muted-foreground sm:min-h-0"
                disabled={removendo === v.orcamento.id}
                onClick={() => void desvincular(v.orcamento!.id, v.orcamento!.numero)}
              >
                <Unlink className="h-3 w-3" /> Desvincular
              </Button>
            </li>
          ))}
        </ul>
      )}
      {!cancelada && (
        <Button size="sm" variant="outline" className="h-8 min-h-11 gap-1.5 text-xs sm:min-h-0" onClick={() => setDialog(true)}>
          <Link2 className="h-3.5 w-3.5" /> Vincular a pedido
        </Button>
      )}
      <VincularPedidoNfDialog
        open={dialog}
        onClose={() => setDialog(false)}
        nf={nf}
        onLinked={atualizar}
      />
    </div>
  );
}
