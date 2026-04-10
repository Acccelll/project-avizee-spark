import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, XCircle, AlertCircle, PackageCheck, ClipboardList } from "lucide-react";
import { formatNumber } from "@/lib/format";

interface ImportacaoResumoCardsProps {
  totalBatches: number;
  totalErrors: number;
  totalProcessed: number;
  totalPending: number;
  totalRegistrosImportados?: number;
  totalRegistrosRejeitados?: number;
  totalPendenciasConferencia?: number;
  totalConcluidosComAlertas?: number;
}

export function ImportacaoResumoCards({
  totalBatches,
  totalErrors,
  totalProcessed,
  totalPending,
  totalRegistrosImportados = 0,
  totalRegistrosRejeitados = 0,
  totalPendenciasConferencia = 0,
  totalConcluidosComAlertas = 0,
}: ImportacaoResumoCardsProps) {
  const cards = [
    {
      title: "Total de Lotes",
      value: totalBatches,
      description: "Lotes registrados no sistema",
      icon: FileText,
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      title: "Registros Importados",
      value: formatNumber(totalRegistrosImportados),
      description: `${totalProcessed} lote(s) concluído(s)`,
      icon: PackageCheck,
      color: "text-emerald-500",
      bg: "bg-emerald-50",
    },
    {
      title: "Inconsistências",
      value: formatNumber(totalRegistrosRejeitados !== undefined ? totalRegistrosRejeitados : totalErrors),
      description: "Registros com falhas detectadas",
      icon: XCircle,
      color: "text-rose-500",
      bg: "bg-rose-50",
    },
    {
      title: "Pendentes de Conferência",
      value: totalPendenciasConferencia !== undefined ? totalPendenciasConferencia : totalPending,
      description: "Lotes aguardando revisão",
      icon: totalConcluidosComAlertas > 0 ? AlertCircle : ClipboardList,
      color: (totalPendenciasConferencia ?? totalPending) > 0 || totalConcluidosComAlertas > 0 ? "text-amber-500" : "text-slate-400",
      bg: (totalPendenciasConferencia ?? totalPending) > 0 || totalConcluidosComAlertas > 0 ? "bg-amber-50" : "bg-slate-50",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, i) => (
        <Card key={i} className="hover:shadow-sm transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={`p-1.5 rounded-md ${card.bg}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
