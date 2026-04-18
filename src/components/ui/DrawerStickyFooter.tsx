import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * DrawerStickyFooter — footer padronizado para drawers operacionais.
 *
 * Estrutura em 2 zonas:
 *  - LEFT  → ações destrutivas/cancelar (visualmente separadas)
 *  - RIGHT → fluxo principal (próxima etapa, confirmar, aprovar)
 *
 * Aplica sombra superior sutil para indicar separação do conteúdo scrollável.
 *
 * Uso:
 * ```tsx
 * <DrawerStickyFooter
 *   left={<Button variant="outline" className="text-destructive">Cancelar</Button>}
 *   right={<><Button variant="outline">Rejeitar</Button><Button>Aprovar</Button></>}
 * />
 * ```
 */
export interface DrawerStickyFooterProps {
  /** Ações secundárias / destrutivas — alinhadas à esquerda. */
  left?: ReactNode;
  /** Ações de fluxo principal — alinhadas à direita. */
  right?: ReactNode;
  /** Hint opcional (texto auxiliar) acima dos botões. */
  hint?: ReactNode;
  className?: string;
}

export function DrawerStickyFooter({ left, right, hint, className }: DrawerStickyFooterProps) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 bg-card border-t shadow-[0_-4px_8px_-4px_rgba(0,0,0,0.06)]",
        "px-4 sm:px-6 py-3",
        className,
      )}
    >
      {hint && (
        <div className="mb-2 text-xs text-muted-foreground">{hint}</div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {left && <div className="flex items-center gap-2 flex-wrap">{left}</div>}
        {right && (
          <div className="flex items-center gap-2 flex-wrap ml-auto justify-end">{right}</div>
        )}
      </div>
    </div>
  );
}
