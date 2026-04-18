import { ReactNode, type ComponentType } from "react";
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
import { ArrowRight, Loader2, type LucideIcon } from "lucide-react";
import { closeOnly } from "@/lib/overlay";
import { cn } from "@/lib/utils";

export interface ImpactItem {
  /** Ícone Lucide (componente). Defaults to ArrowRight. */
  icon?: LucideIcon | ComponentType<{ className?: string }>;
  /** Texto principal do impacto (ex.: "Cria 1 Pedido em /pedidos"). */
  label: ReactNode;
  /** Detalhe secundário opcional (ex.: "5 itens · R$ 12.340,00"). */
  detail?: ReactNode;
  /** Tom visual do item. */
  tone?: "default" | "info" | "success" | "warning";
}

interface CrossModuleActionDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  /** Lista de impactos cross-módulo previstos. */
  impacts: ImpactItem[];
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  confirmDisabled?: boolean;
  /** Conteúdo extra (campos de input antes/depois da lista). */
  children?: ReactNode;
}

const toneClasses: Record<NonNullable<ImpactItem["tone"]>, string> = {
  default: "text-muted-foreground bg-muted/30",
  info: "text-info bg-info/10",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
};

/**
 * Dialog de confirmação que mostra **prévia de impacto cross-módulo** antes
 * de executar uma operação que afeta múltiplas áreas (ex.: gerar Pedido,
 * gerar NF, receber compra).
 *
 * Resolve o problema "ConfirmDialog burro" — o usuário entende exatamente
 * o que vai mudar e onde.
 */
export function CrossModuleActionDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  impacts,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  loading,
  confirmDisabled,
  children,
}: CrossModuleActionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={closeOnly(onClose, () => !loading)}>
      <AlertDialogContent
        onEscapeKeyDown={(e) => {
          if (loading) e.preventDefault();
        }}
        className="max-w-lg"
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>

        {children}

        {impacts.length > 0 && (
          <div className="space-y-1.5 rounded-lg border bg-muted/20 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              O que vai acontecer
            </p>
            <ul className="space-y-1.5">
              {impacts.map((impact, idx) => {
                const Icon = impact.icon ?? ArrowRight;
                const tone = impact.tone ?? "default";
                return (
                  <li key={idx} className="flex items-start gap-2 text-xs">
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                        toneClasses[tone],
                      )}
                    >
                      <Icon className="h-3 w-3" />
                    </span>
                    <span className="flex-1 leading-tight">
                      <span className="font-medium text-foreground">{impact.label}</span>
                      {impact.detail && (
                        <span className="ml-1 text-muted-foreground">· {impact.detail}</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={loading || confirmDisabled}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {loading ? "Processando..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
