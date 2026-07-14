import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { deriveFiscalAlerts } from "@/lib/fiscal/deriveAlerts";
import type { DashboardFiscalKpis } from "@/services/fiscal/dashboardFiscal.service";

/**
 * Etapa 15 — Notification Center fiscal.
 *
 * Componente puro de UI: recebe os KPIs consolidados do runtime, deriva os
 * alertas via `deriveFiscalAlerts` e apresenta em um popover com badge de
 * contagem. Não persiste estado nem executa side-effects — segue o padrão
 * do Design System (Popover + Badge + ScrollArea).
 */
export function FiscalNotificationCenter({
  kpis,
}: {
  kpis: DashboardFiscalKpis | undefined;
}) {
  const alerts = kpis ? deriveFiscalAlerts(kpis) : [];
  const criticas = alerts.filter((a) => a.severidade === "critica").length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative"
          aria-label={`Notificações fiscais (${alerts.length})`}
        >
          <Bell className="h-4 w-4" />
          {alerts.length > 0 && (
            <Badge
              variant={criticas > 0 ? "destructive" : "secondary"}
              className="absolute -right-2 -top-2 h-5 min-w-5 justify-center px-1 text-[10px]"
            >
              {alerts.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b p-3">
          <p className="text-sm font-medium">Notificações fiscais</p>
          <p className="text-xs text-muted-foreground">
            Derivadas em tempo real do runtime fiscal.
          </p>
        </div>
        <ScrollArea className="max-h-80">
          {alerts.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground">
              Nenhuma notificação no período.
            </p>
          ) : (
            <ul className="divide-y">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-start gap-2 p-3">
                  <Badge
                    variant={a.severidade === "critica" ? "destructive" : "outline"}
                    className="mt-0.5"
                  >
                    {a.severidade}
                  </Badge>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.titulo}</p>
                    <p className="text-xs text-muted-foreground">{a.mensagem}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export default FiscalNotificationCenter;