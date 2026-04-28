import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, AlertTriangle } from "lucide-react";
import { useCorreiosTracking } from "@/hooks/useCorreiosTracking";
import { normalizarEventos } from "@/services/correios.service";
import { persistirEventosNormalizados } from "@/services/logistica/remessas.service";
import { toast } from "sonner";
import { format } from "date-fns";
import type { CorreiosEventoNormalizado } from "@/services/correios.service";

interface TrackingModalProps {
  open: boolean;
  onClose: () => void;
  codigoRastreio: string | null;
  remessaId?: string;
}

export function TrackingModal({ open, onClose, codigoRastreio, remessaId }: TrackingModalProps) {
  const queryClient = useQueryClient();
  const { data: tracking, isLoading, error, isMock, track } = useCorreiosTracking();

  useEffect(() => {
    if (open && codigoRastreio) {
      track(codigoRastreio);
    }
  }, [open, codigoRastreio, track]);

  const eventos: Array<CorreiosEventoNormalizado & { remessa_id: string }> =
    tracking && remessaId ? normalizarEventos(tracking, remessaId) : [];

  const handlePersistirEventos = async () => {
    if (!remessaId || eventos.length === 0) return;

    try {
      const novos = await persistirEventosNormalizados({ remessaId, eventos });
      toast.success(`${novos} novo(s) evento(s) salvo(s)`);
      queryClient.invalidateQueries({ queryKey: ["remessa-eventos", remessaId] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar eventos");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className={
          "max-w-lg " +
          // Mobile: bottom-sheet pattern (mesmo padrão do RegistrarRecebimentoDialog)
          "max-sm:!top-auto max-sm:!bottom-0 max-sm:!left-0 max-sm:!right-0 max-sm:!translate-x-0 max-sm:!translate-y-0 " +
          "max-sm:w-full max-sm:max-w-full max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:border-x-0 max-sm:border-b-0 " +
          "max-sm:max-h-[92vh] max-sm:overflow-y-auto max-sm:pb-[max(1rem,env(safe-area-inset-bottom))] " +
          "max-sm:before:content-[''] max-sm:before:absolute max-sm:before:top-2 max-sm:before:left-1/2 max-sm:before:-translate-x-1/2 max-sm:before:h-1 max-sm:before:w-10 max-sm:before:rounded-full max-sm:before:bg-muted-foreground/30 max-sm:pt-6"
        }
      >
        <DialogHeader>
          <DialogTitle>
            Rastreamento — <span className="font-mono text-sm">{codigoRastreio ?? "—"}</span>
          </DialogTitle>
        </DialogHeader>

        {isMock && (
          <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            Dados simulados — credenciais dos Correios não configuradas. Eventos não persistidos.
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Consultando rastreio…
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive py-4 text-center">{error.message}</div>
        )}

        {!isLoading && !error && eventos.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum evento encontrado para este código.
          </p>
        )}

        {!isLoading && eventos.length > 0 && (
          // Em mobile o sheet inteiro já scrolla; remover scroll aninhado evita "scroll dentro de scroll".
          <div className="space-y-2 max-h-80 sm:max-h-80 max-sm:max-h-none overflow-y-auto sm:overflow-y-auto max-sm:overflow-visible pr-1">
            {eventos.map((ev, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <div className="flex flex-col items-center gap-1 pt-0.5">
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  {i < eventos.length - 1 && <div className="w-px flex-1 bg-border" />}
                </div>
                <div className="pb-3">
                  <p className="font-medium leading-tight">{ev.descricao}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {ev.local && (
                      <Badge variant="outline" className="text-[10px] gap-1 h-4 px-1.5">
                        <MapPin className="h-2.5 w-2.5" />
                        {ev.local}
                      </Badge>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      {ev.data_hora
                        ? format(new Date(ev.data_hora), "dd/MM/yyyy HH:mm")
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isMock && remessaId && eventos.length > 0 && (
          <div className="flex justify-end pt-2">
            <Button size="sm" variant="outline" onClick={handlePersistirEventos}>
              Salvar eventos no histórico
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
