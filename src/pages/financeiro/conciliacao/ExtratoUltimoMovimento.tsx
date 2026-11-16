import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarCheck } from "lucide-react";
import { getUltimoMovimentoExtrato } from "@/services/financeiro/conciliacaoLoaders.service";
import { daysSince, formatDate } from "@/lib/format";

/** A partir de quantos dias sem movimento importado o aviso fica em destaque. */
export const DIAS_EXTRATO_DESATUALIZADO = 10;

interface Props {
  contaId: string;
  /** Recarrega a data quando uma importação termina. */
  uploading: boolean;
}

/**
 * Mostra a data do último movimento importado de extrato da conta e avisa
 * quando ela está antiga — sem extrato recente não há o que conciliar.
 */
export function ExtratoUltimoMovimento({ contaId, uploading }: Props) {
  const { data: ultimo, isLoading, refetch } = useQuery({
    queryKey: ["conciliacao", "ultimo-movimento-extrato", contaId],
    queryFn: () => getUltimoMovimentoExtrato(contaId),
    enabled: !!contaId,
  });

  const estavaImportando = useRef(uploading);
  useEffect(() => {
    if (estavaImportando.current && !uploading) void refetch();
    estavaImportando.current = uploading;
  }, [uploading, refetch]);

  if (!contaId || isLoading) return null;

  if (!ultimo) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Nenhum extrato importado para esta conta.
      </p>
    );
  }

  const dias = daysSince(ultimo);
  const atrasado = dias > DIAS_EXTRATO_DESATUALIZADO;
  const quando = dias <= 0 ? "hoje" : dias === 1 ? "há 1 dia" : `há ${dias} dias`;

  return (
    <p
      className={`flex items-center gap-1.5 text-xs ${
        atrasado ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"
      }`}
    >
      {atrasado ? (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : (
        <CalendarCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
      )}
      Último movimento importado: {formatDate(ultimo)} ({quando})
      {atrasado && " — importe o extrato para conciliar o período."}
    </p>
  );
}
