import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function PreviewModal({ open, onClose, title = "Visualização", children, actions }: Props) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Janela de visualização de conteúdo.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-card z-10">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <div className="flex items-center gap-2">
            {actions}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="p-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
