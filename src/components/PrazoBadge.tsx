import { StatusBadge } from "@/components/StatusBadge";
import { calculateDaysBetween, formatDate } from "@/lib/format";

/**
 * Badge canônico de prazo de despacho.
 *
 * Replica a lógica usada em Pedidos para reaproveitar em outras telas
 * (ex: Backlog de Faturamento). Calcula status (atrasado / próximo / ok)
 * com base em `dataPrazo`, `status` da operação e dias de alerta.
 */

export type PrazoStatus = "atrasado" | "proximo" | "ok" | "sem_prazo";

const STATUS_FINALIZADOS = new Set(["concluido", "cancelado", "finalizado", "entregue"]);

export function getPrazoStatus(
  dataPrazo: string | null,
  statusOp: string,
  alertaDias: number,
): PrazoStatus {
  if (!dataPrazo) return "sem_prazo";
  if (STATUS_FINALIZADOS.has(statusOp)) return "ok";
  const daysLeft = calculateDaysBetween(new Date(), dataPrazo);
  if (daysLeft < 0) return "atrasado";
  if (daysLeft <= alertaDias) return "proximo";
  return "ok";
}

interface PrazoBadgeProps {
  dataPrazo: string | null;
  status: string;
  alertaDias?: number;
}

export function PrazoBadge({ dataPrazo, status, alertaDias = 3 }: PrazoBadgeProps) {
  if (!dataPrazo) {
    return (
      <span
        className="text-xs text-muted-foreground italic"
        title="Sem prazo de despacho definido"
      >
        Sem prazo
      </span>
    );
  }
  const ps = getPrazoStatus(dataPrazo, status, alertaDias);
  const daysLeft = calculateDaysBetween(new Date(), dataPrazo);

  if (ps === "atrasado") {
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
        <span className="text-xs text-destructive font-medium">{formatDate(dataPrazo)}</span>
        <StatusBadge status="atrasado" className="text-[10px] px-1.5 py-0 h-4" />
      </span>
    );
  }
  if (ps === "proximo") {
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
        <span className="text-xs text-warning font-medium">{formatDate(dataPrazo)}</span>
        <StatusBadge
          status="proximo_vencimento"
          label={`${daysLeft}d restantes`}
          className="text-[10px] px-1.5 py-0 h-4"
        />
      </span>
    );
  }
  return <span className="text-xs">{formatDate(dataPrazo)}</span>;
}

export default PrazoBadge;