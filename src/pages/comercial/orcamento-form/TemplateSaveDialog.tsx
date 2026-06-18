import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type TemplateScope = "usuario" | "equipe";

interface TemplateSaveDialogProps {
  open: TemplateScope | null;
  onOpenChange: (open: boolean) => void;
  name: string;
  onNameChange: (v: string) => void;
  onConfirm: (escopo: TemplateScope) => Promise<void> | void;
}

/** Diálogo de salvar template (escopo usuário/equipe) extraído de OrcamentoForm. */
export function TemplateSaveDialog({
  open,
  onOpenChange,
  name,
  onNameChange,
  onConfirm,
}: TemplateSaveDialogProps) {
  return (
    <Dialog open={open !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {open === "equipe" ? "Compartilhar template com a equipe" : "Salvar como meu template"}
          </DialogTitle>
          <DialogDescription>
            Dê um nome para identificar este template ao reutilizá-lo em novos orçamentos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="tpl-name" className="text-xs">Nome do template</Label>
          <Input
            id="tpl-name"
            autoFocus
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Ex.: Orçamento padrão SP"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!name.trim()}
            onClick={async () => {
              if (!open) return;
              await onConfirm(open);
              onOpenChange(false);
            }}
          >Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}