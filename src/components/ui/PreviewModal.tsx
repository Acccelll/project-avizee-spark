import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
  /**
   * Show the built-in "Print" button. When clicked, triggers `window.print()`
   * after applying the `.print-area` CSS isolation defined in `index.css`.
   * Defaults to `true`.
   */
  showPrint?: boolean;
  /** Optional custom print handler. When provided, replaces `window.print()`. */
  onPrint?: () => void;
}

export function PreviewModal({
  open,
  onClose,
  title = "Visualização",
  children,
  actions,
  showPrint = true,
  onPrint,
}: Props) {
  const handlePrint = () => {
    if (onPrint) {
      onPrint();
      return;
    }
    // Defer print so the browser paints the modal first.
    setTimeout(() => window.print(), 50);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-0 print-area">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Janela de visualização de conteúdo.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-card z-10 no-print">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <div className="flex items-center gap-2">
            {actions}
            {showPrint && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="gap-1.5"
                aria-label="Imprimir conteúdo"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="p-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
