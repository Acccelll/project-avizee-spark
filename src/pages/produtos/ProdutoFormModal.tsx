import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { closeOnly } from "@/lib/overlay";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import ProdutoForm from "./ProdutoForm";

interface ProdutoFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  produtoId?: string;
  copyFromId?: string;
  onClose: () => void;
  onSaved?: (produtoId: string) => void;
  onPersisted?: (produtoId: string) => void;
}

/**
 * Modal XL que embute o ProdutoForm em uma Dialog (full-screen em mobile).
 * Mantém o padrão dos demais cadastros (Clientes/Fornecedores) sem perder
 * abas, composição, fornecedores e dialogs auxiliares do form.
 */
export function ProdutoFormModal({ open, mode, produtoId, copyFromId, onClose, onSaved, onPersisted }: ProdutoFormModalProps) {
  const [dirty, setDirty] = useState(false);
  const [partialWarning, setPartialWarning] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const handleClose = async () => {
    if (dirty) {
      const ok = await confirm({
        title: "Descartar alterações?",
        description: partialWarning
          ? "O produto principal já foi gravado, mas há vínculos pendentes. Ao sair, localize o produto na listagem para concluir os dados. Deseja sair?"
          : "Há alterações não salvas. Deseja sair mesmo assim?",
        confirmLabel: "Descartar",
        confirmVariant: "destructive",
      });
      if (!ok) return;
    }
    setDirty(false);
    setPartialWarning(null);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={closeOnly(handleClose)}>
        <DialogContent
          className={[
            "sm:max-w-5xl sm:max-h-[92dvh] sm:min-h-[80dvh] overflow-hidden p-0 flex flex-col",
            "max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-0 max-sm:m-0 max-sm:max-h-none max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-x-0",
            "[&>[aria-hidden='true']:first-child]:max-sm:hidden",
          ].join(" ")}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{copyFromId ? "Copiar como novo" : mode === "create" ? "Novo Produto" : "Editar Produto"}</DialogTitle>
            <DialogDescription>Formulário de cadastro de produto.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-4 py-3 sm:px-6 sm:py-4">
            {open && (
              <ProdutoForm
                embedded
                embeddedMode={mode}
                embeddedId={produtoId}
                copyFromId={copyFromId}
                onCancel={handleClose}
                onSaved={(id) => {
                  setDirty(false);
                  setPartialWarning(null);
                  onSaved?.(id);
                  onClose();
                }}
                onPersisted={onPersisted}
                onPartialSaveChange={setPartialWarning}
                onDirtyChange={setDirty}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </>
  );
}

export default ProdutoFormModal;