import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormModalFooterProps {
  saving?: boolean;
  isDirty?: boolean;
  onCancel: () => void;
  onSubmit?: () => void;
  /** Se o formulário usa <form onSubmit>, deixe true para o botão primário ser type=submit. */
  submitAsForm?: boolean;
  /** Form id, se o botão precisar acionar submit de um form que está fora do footer. */
  formId?: string;
  primaryLabel?: string;
  cancelLabel?: string;
  /** "create" => "Salvar" / "edit" => "Salvar Alterações". Sobrescrito por primaryLabel. */
  mode?: "create" | "edit";
  /** Desabilita o botão primário (além de saving). */
  disabled?: boolean;
  /** Tooltip / título nativo quando primário desabilitado. */
  disabledReason?: string;
  secondaryActions?: ReactNode;
  className?: string;
}

export function FormModalFooter({
  saving = false,
  isDirty = false,
  onCancel,
  onSubmit,
  submitAsForm = false,
  formId,
  primaryLabel,
  cancelLabel = "Cancelar",
  mode = "edit",
  disabled = false,
  disabledReason,
  secondaryActions,
  className,
}: FormModalFooterProps) {
  const label = primaryLabel ?? (mode === "create" ? "Salvar" : "Salvar Alterações");
  const primaryDisabled = saving || disabled;

  const hasStatus = (isDirty && !saving) || saving;

  return (
    <div
      className={cn(
        "flex items-center gap-3",
        hasStatus ? "justify-between" : "justify-end",
        className,
      )}
    >
      {hasStatus && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
          {isDirty && !saving && (
            <span className="inline-flex items-center gap-1.5">
              <Circle className="h-2 w-2 fill-warning text-warning" />
              <span className="font-medium">Alterações não salvas</span>
            </span>
          )}
          {saving && (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Salvando...</span>
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        {secondaryActions}
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {cancelLabel}
        </Button>
        <Button
          type={submitAsForm ? "submit" : "button"}
          form={formId}
          onClick={submitAsForm ? undefined : onSubmit}
          disabled={primaryDisabled}
          title={primaryDisabled && disabledReason ? disabledReason : undefined}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {label}
        </Button>
      </div>
    </div>
  );
}
