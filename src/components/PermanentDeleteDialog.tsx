import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Tabela do Supabase (ex: "funcionarios", "transportadoras"). */
  table:
    | "funcionarios"
    | "transportadoras"
    | "formas_pagamento"
    | "grupos_economicos"
    | "notas_fiscais";
  id: string;
  /** Nome legível usado no título e na descrição (ex: "transportadora"). */
  entityLabel: string;
  /** Identificação do registro (nome / descrição) usada na confirmação. */
  recordName: string;
  /** Texto extra opcional (ex: dependências detectadas) acima do campo. */
  warning?: string;
  /** Chamado após exclusão bem-sucedida. */
  onDeleted: () => void;
}

/**
 * Diálogo de exclusão definitiva (hard delete).
 *
 * Por contrato (ver mem://produto/excluir-vs-inativar-vs-cancelar):
 *  - Só deve ser oferecido para admins.
 *  - Só deve aparecer quando o registro já está inativo.
 *  - Exige digitação literal de "EXCLUIR" para confirmar.
 *  - Falhas de FK são traduzidas para mensagem amigável.
 */
export function PermanentDeleteDialog({
  open,
  onClose,
  table,
  id,
  entityLabel,
  recordName,
  warning,
  onDeleted,
}: Props) {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) setConfirmText("");
  }, [open]);

  const canConfirm = confirmText.trim().toUpperCase() === "EXCLUIR";

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      loading={deleting}
      confirmDisabled={!canConfirm}
      confirmLabel="Excluir definitivamente"
      title={`Excluir ${entityLabel} permanentemente`}
      description={`Esta ação é irreversível. O registro "${recordName}" será removido em definitivo do banco de dados e não poderá ser recuperado.`}
      onConfirm={async () => {
        setDeleting(true);
        try {
          const { error } = await supabase.from(table).delete().eq("id", id);
          if (error) {
            // 23503 = foreign_key_violation
            const code = (error as { code?: string }).code;
            if (code === "23503") {
              throw new Error(
                "Não é possível excluir: o registro está referenciado em outras tabelas (histórico, vínculos). Mantenha-o inativo.",
              );
            }
            throw error;
          }
          toast.success(`${entityLabel.charAt(0).toUpperCase()}${entityLabel.slice(1)} excluída(o) permanentemente.`);
          onClose();
          onDeleted();
        } catch (err) {
          toast.error(getUserFriendlyError(err));
        } finally {
          setDeleting(false);
        }
      }}
    >
      <div className="space-y-3 pt-1">
        {warning && (
          <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md p-2">
            {warning}
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="confirm-delete-input" className="text-xs">
            Digite <span className="font-mono font-semibold">EXCLUIR</span> para confirmar:
          </Label>
          <Input
            id="confirm-delete-input"
            autoComplete="off"
            autoFocus
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="EXCLUIR"
            className="font-mono"
            disabled={deleting}
          />
        </div>
      </div>
    </ConfirmDialog>
  );
}