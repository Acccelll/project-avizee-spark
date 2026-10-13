import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Textarea } from "@/components/ui/textarea";

export type CompraGridAction<T> = { kind: "cancelar" | "excluir"; record: T };

/** Confirmação única para ações individuais de compra. */
export function CompraGridConfirmDialog<T>({
  action, numero, onClose, onConfirm,
}: {
  action: CompraGridAction<T> | null;
  numero: string;
  onClose: () => void;
  onConfirm: (action: CompraGridAction<T>, motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const cancelar = action?.kind === "cancelar";
  const close = () => { if (!busy) { setMotivo(""); onClose(); } };
  return (
    <ConfirmDialog
      open={!!action}
      onClose={close}
      onConfirm={() => {
        if (!action || busy) return;
        setBusy(true);
        void onConfirm(action, motivo.trim())
          .then(() => { setMotivo(""); onClose(); })
          .catch(() => {}) // o caller exibe o erro, preservando o diálogo
          .finally(() => setBusy(false));
      }}
      title={cancelar ? `Cancelar ${numero}` : `Excluir ${numero}`}
      description={cancelar
        ? "O documento será cancelado, mantendo seu histórico. Informe o motivo."
        : "A exclusão só é permitida para rascunhos sem dependências. Confirme a operação."}
      confirmLabel={cancelar ? "Confirmar cancelamento" : "Confirmar exclusão"}
      confirmDisabled={cancelar && !motivo.trim()}
      loading={busy}
    >
      {cancelar && (
        <Textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo do cancelamento"
          aria-label="Motivo do cancelamento"
          rows={3}
        />
      )}
    </ConfirmDialog>
  );
}
