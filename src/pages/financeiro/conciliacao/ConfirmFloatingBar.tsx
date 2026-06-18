import { Button } from "@/components/ui/button";
import { CheckCheck, CheckCircle, Loader2 } from "lucide-react";
import type { LancamentoComStatus } from "./types";

interface Props {
  matches: { extratoId: string; lancamentoId: string }[];
  lancamentosComStatus: LancamentoComStatus[];
  semParOFX: number;
  confirming: boolean;
  onDescartar: () => void;
  onConfirmar: () => void;
}

export function ConfirmFloatingBar(p: Props) {
  if (p.matches.length === 0) return null;
  const divergentes = p.lancamentosComStatus.filter((l) => l.statusConciliacao === "divergente").length;

  return (
    <div className="fixed bottom-4 inset-x-4 md:inset-x-auto md:right-6 md:left-[18rem] z-40">
      <div className="rounded-xl border bg-card/95 backdrop-blur shadow-lg p-3 md:p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <CheckCheck className="w-5 h-5 text-success shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {p.matches.length} {p.matches.length === 1 ? "par pronto" : "pares prontos"} para confirmar
            </p>
            {(divergentes > 0 || p.semParOFX > 0) && (
              <p className="text-xs text-muted-foreground">
                {divergentes > 0 && `${divergentes} divergente${divergentes > 1 ? "s" : ""}`}
                {divergentes > 0 && p.semParOFX > 0 && " · "}
                {p.semParOFX > 0 && `${p.semParOFX} do OFX sem correspondência`}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={p.onDescartar} disabled={p.confirming}>
            Descartar
          </Button>
          <Button size="sm" onClick={p.onConfirmar} disabled={p.confirming} className="gap-1.5">
            {p.confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Confirmar {p.matches.length} {p.matches.length === 1 ? "par" : "pares"}
          </Button>
        </div>
      </div>
    </div>
  );
}