import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, AlertCircle, Info, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ImportLog {
  id: string;
  nivel: "info" | "warning" | "error";
  etapa: string;
  mensagem: string;
  criado_em: string;
}

interface ImportacaoTimelineProps {
  logs: ImportLog[];
}

export function ImportacaoTimeline({ logs }: ImportacaoTimelineProps) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground italic text-sm">
        <Clock className="h-8 w-8 mb-2 opacity-20" />
        Nenhum evento registrado para este lote.
      </div>
    );
  }

  return (
    <div className="relative space-y-4 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
      {logs.map((log) => (
        <div key={log.id} className="relative flex items-start gap-4">
          <div className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full border-4 border-white z-10 shrink-0 shadow-sm",
            log.nivel === "info" ? "bg-blue-500 text-white" :
            log.nivel === "warning" ? "bg-amber-500 text-white" : "bg-rose-500 text-white"
          )}>
            {log.nivel === "info" ? <Info className="h-4 w-4" /> :
             log.nivel === "warning" ? <AlertCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          </div>
          <div className="flex flex-col pt-1.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {log.etapa}
              </span>
              <span className="text-[10px] text-muted-foreground">•</span>
              <span className="text-[10px] text-muted-foreground">
                {format(new Date(log.criado_em), "HH:mm:ss", { locale: ptBR })}
              </span>
            </div>
            <p className="text-xs text-foreground font-medium leading-relaxed">
              {log.mensagem}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
