import { RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deleteOrcamentoDraft, getOrcamentoDraftPayload } from "@/services/orcamentos.service";

interface RestoreDraftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draftKey: string;
  userId: string | null | undefined;
  applyDraft: (payload: Record<string, unknown>) => void;
}

/** Diálogo que pergunta se o usuário quer restaurar um rascunho salvo automaticamente. */
export function RestoreDraftDialog({
  open,
  onOpenChange,
  draftKey,
  userId,
  applyDraft,
}: RestoreDraftDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Restaurar rascunho não finalizado?</DialogTitle>
          <DialogDescription>Encontramos um rascunho salvo automaticamente para este orçamento.</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              localStorage.removeItem(draftKey);
              if (userId) {
                try {
                  await deleteOrcamentoDraft(userId, draftKey);
                } catch {
                  /* ignore */
                }
              }
              onOpenChange(false);
            }}
          >
            Descartar
          </Button>
          <Button
            onClick={async () => {
              let payload: unknown = null;
              if (userId) {
                payload = await getOrcamentoDraftPayload(userId, draftKey).catch(() => null);
              }
              if (!payload) {
                const raw = localStorage.getItem(draftKey);
                if (raw) {
                  try {
                    payload = JSON.parse(raw);
                  } catch {
                    /* ignore */
                  }
                }
              }
              if (payload) applyDraft(payload as Record<string, unknown>);
              onOpenChange(false);
            }}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Restaurar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}