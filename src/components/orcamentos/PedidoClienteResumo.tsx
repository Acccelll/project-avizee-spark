import { Button } from "@/components/ui/button";
import { Paperclip, Pencil } from "lucide-react";
import { calculateDaysBetween, formatDate } from "@/lib/format";
import { notifyError } from "@/utils/errorMessages";
import { normalizeOrcamentoStatus } from "@/lib/comercialWorkflow";
import { getAnexoPedidoUrl } from "@/services/comercial/pedidoOrcamento.service";

interface Props {
  orcamento: {
    numero: string;
    status: string | null;
    pedido_cliente?: string | null;
    data_pedido_cliente?: string | null;
    previsao_despacho?: string | null;
    pedido_anexo_path?: string | null;
    pedido_registrado_em?: string | null;
  };
  onEditar?: () => void;
}

/** Quadro "Pedido do cliente": número, datas, previsão e anexo. */
export function PedidoClienteResumo({ orcamento, onEditar }: Props) {
  const semNumero = orcamento.pedido_cliente === orcamento.numero;
  const hoje = new Date().toISOString().slice(0, 10);
  const atrasoDias =
    orcamento.previsao_despacho &&
    normalizeOrcamentoStatus(orcamento.status) === "aprovado" &&
    orcamento.previsao_despacho < hoje
      ? Math.abs(calculateDaysBetween(new Date(), orcamento.previsao_despacho))
      : 0;

  const abrirAnexo = async () => {
    if (!orcamento.pedido_anexo_path) return;
    try {
      window.open(await getAnexoPedidoUrl(orcamento.pedido_anexo_path), "_blank", "noopener");
    } catch (err) {
      notifyError(err);
    }
  };

  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Nº pedido</dt>
        <dd className="font-mono font-semibold">
          {orcamento.pedido_cliente}
          {semNumero && <span className="ml-1.5 font-sans font-normal text-muted-foreground">(sem número do cliente)</span>}
        </dd>
        {orcamento.data_pedido_cliente && (
          <>
            <dt className="text-muted-foreground">Data do pedido</dt>
            <dd>{formatDate(orcamento.data_pedido_cliente)}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Previsão de despacho</dt>
        <dd className={atrasoDias > 0 ? "font-medium text-destructive" : undefined}>
          {orcamento.previsao_despacho ? formatDate(orcamento.previsao_despacho) : "—"}
          {atrasoDias > 0 && ` · atrasado ${atrasoDias} ${atrasoDias === 1 ? "dia" : "dias"}`}
        </dd>
        {orcamento.pedido_registrado_em && (
          <>
            <dt className="text-muted-foreground">Registrado em</dt>
            <dd>{formatDate(orcamento.pedido_registrado_em)}</dd>
          </>
        )}
      </dl>
      <div className="flex flex-wrap gap-2">
        {orcamento.pedido_anexo_path && (
          <Button size="sm" variant="outline" className="h-7 min-h-11 gap-1.5 text-xs sm:min-h-0" onClick={abrirAnexo}>
            <Paperclip className="h-3 w-3" /> Ver pedido anexado
          </Button>
        )}
        {onEditar && (
          <Button size="sm" variant="ghost" className="h-7 min-h-11 gap-1.5 text-xs sm:min-h-0" onClick={onEditar}>
            <Pencil className="h-3 w-3" /> Editar dados do pedido
          </Button>
        )}
      </div>
    </div>
  );
}
