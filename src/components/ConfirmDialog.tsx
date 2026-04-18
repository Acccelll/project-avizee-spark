import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { closeOnly } from "@/lib/overlay";
import { AlertTriangle, HelpCircle, Loader2 } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  confirmVariant?: "destructive" | "default";
  loading?: boolean;
  confirmDisabled?: boolean;
  children?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Confirmar exclusão",
  description = "Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.",
  confirmLabel = "Excluir",
  confirmVariant = "destructive",
  loading,
  confirmDisabled,
  children,
}: ConfirmDialogProps) {
  const isDestructive = confirmVariant === "destructive";
  const Icon = isDestructive ? AlertTriangle : HelpCircle;
  const iconWrapClass = isDestructive
    ? "bg-destructive/10 text-destructive"
    : "bg-primary/10 text-primary";

  return (
    <AlertDialog open={open} onOpenChange={closeOnly(onClose, () => !loading)}>
      <AlertDialogContent
        onEscapeKeyDown={(e) => {
          if (loading) e.preventDefault();
        }}
      >
        <AlertDialogHeader>
          <div className="flex items-start gap-3.5">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                iconWrapClass,
              )}
              aria-hidden="true"
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription>{description}</AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // Não fechar automaticamente: deixa o caller decidir (suporta async).
              e.preventDefault();
              onConfirm();
            }}
            disabled={loading || confirmDisabled}
            className={cn(
              isDestructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {loading ? "Aguarde..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
