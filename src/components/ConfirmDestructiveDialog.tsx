import { useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { closeOnly } from "@/lib/overlay";
import { AlertTriangle, Loader2 } from "lucide-react";

/**
 * Dialog padronizado para ações destrutivas/terminais.
 *
 * Implementa a árvore de decisão de `mem://produto/excluir-vs-inativar-vs-cancelar`:
 *  - lista efeitos colaterais (estoque revertido, NF cancelada na SEFAZ etc.);
 *  - exige `motivo` quando `requireReason` (default para verbo "Cancelar");
 *  - badge "Ação terminal" quando o status final é irrecuperável.
 *
 * Para confirmações simples (descarte de form, deletes triviais), continue usando
 * `ConfirmDialog`/`useConfirmDialog`.
 */

export type DestructiveVerb = "Cancelar" | "Excluir" | "Estornar" | "Rejeitar" | "Inativar";

export interface ConfirmDestructiveDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => void | Promise<void>;
  /** Verbo padrão da ação. Define label do botão e tom do diálogo. */
  verb?: DestructiveVerb;
  /** Título customizado. Default: "<Verb> <entity>?" se `entity` informado. */
  title?: string;
  /** Nome da entidade (ex.: "pedido #1234"). Usado no título default. */
  entity?: string;
  /** Descrição principal. Aceita string ou ReactNode. */
  description?: React.ReactNode;
  /** Lista de efeitos colaterais que serão executados. Renderizada como bullets. */
  sideEffects?: React.ReactNode[];
  /** Exige motivo não-vazio antes de habilitar confirm. Default: true para "Cancelar". */
  requireReason?: boolean;
  /** Placeholder do textarea de motivo. */
  reasonPlaceholder?: string;
  /** Marca como ação terminal (status irrecuperável). Mostra badge. Default: true. */
  terminal?: boolean;
  loading?: boolean;
  /** Override do label do botão. Default: verbo. */
  confirmLabel?: string;
}

export function ConfirmDestructiveDialog({
  open,
  onClose,
  onConfirm,
  verb = "Cancelar",
  title,
  entity,
  description,
  sideEffects,
  requireReason,
  reasonPlaceholder = "Descreva o motivo (obrigatório para auditoria)...",
  terminal = true,
  loading = false,
  confirmLabel,
}: ConfirmDestructiveDialogProps) {
  const reasonRequired = requireReason ?? verb === "Cancelar";
  const [motivo, setMotivo] = useState("");

  // Reset do motivo quando o dialog reabre — evita leak entre chamadas.
  useEffect(() => {
    if (open) setMotivo("");
  }, [open]);

  const motivoTrim = motivo.trim();
  const motivoInvalido = reasonRequired && motivoTrim.length === 0;
  const computedTitle = title ?? (entity ? `${verb} ${entity}?` : `${verb} este registro?`);

  return (
    <AlertDialog open={open} onOpenChange={closeOnly(onClose, () => !loading)}>
      <AlertDialogContent
        onEscapeKeyDown={(e) => {
          if (loading) e.preventDefault();
        }}
        className={cn(
          "max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:left-0 max-sm:translate-x-0 max-sm:translate-y-0",
          "max-sm:max-w-none max-sm:w-full max-sm:rounded-t-2xl max-sm:rounded-b-none",
          "max-sm:max-h-[92svh] max-sm:overflow-y-auto max-sm:pb-[max(env(safe-area-inset-bottom),1rem)]",
        )}
      >
        <AlertDialogHeader>
          <div className="flex items-start gap-3.5">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"
              aria-hidden="true"
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <AlertDialogTitle>{computedTitle}</AlertDialogTitle>
                {terminal && (
                  <Badge variant="destructive" className="text-[10px] uppercase tracking-wide">
                    Ação terminal
                  </Badge>
                )}
              </div>
              {description && (
                <AlertDialogDescription asChild>
                  <div className="text-sm text-muted-foreground">{description}</div>
                </AlertDialogDescription>
              )}
            </div>
          </div>
        </AlertDialogHeader>

        {sideEffects && sideEffects.length > 0 && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <p className="font-medium text-destructive mb-1.5">O que vai acontecer:</p>
            <ul className="list-disc pl-5 space-y-1 text-foreground/90">
              {sideEffects.map((se, i) => (
                <li key={i}>{se}</li>
              ))}
            </ul>
          </div>
        )}

        {reasonRequired && (
          <div className="space-y-1.5">
            <Label htmlFor="confirm-destructive-motivo" className="text-sm">
              Motivo <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="confirm-destructive-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={reasonPlaceholder}
              rows={3}
              disabled={loading}
              aria-invalid={motivoInvalido}
            />
          </div>
        )}

        <AlertDialogFooter className="max-sm:sticky max-sm:bottom-0 max-sm:bg-background max-sm:pt-3 max-sm:-mx-6 max-sm:px-6 max-sm:border-t max-sm:flex-col-reverse max-sm:gap-2">
          <AlertDialogCancel disabled={loading} className="max-sm:w-full max-sm:min-h-11 max-sm:mt-0">
            Voltar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              if (motivoInvalido) return;
              void onConfirm(motivoTrim);
            }}
            disabled={loading || motivoInvalido}
            className={cn(
              "max-sm:w-full max-sm:min-h-11",
              "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            )}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {loading ? "Aguarde..." : (confirmLabel ?? verb)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}