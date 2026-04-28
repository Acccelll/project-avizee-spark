import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Diálogo com a lista de atalhos globais. */
export function GlobalShortcutsDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Ajuda · Atalhos Globais</DialogTitle></DialogHeader>
        <ul className="space-y-2 text-sm">
          <li><strong>Ctrl/Cmd + K</strong> — Busca global</li>
          <li><strong>Ctrl/Cmd + N</strong> — Novo orçamento</li>
          <li><strong>Ctrl/Cmd + Shift + N</strong> — Nova nota fiscal</li>
          <li><strong>Ctrl/Cmd + Shift + C</strong> — Novo cliente</li>
          <li><strong>Ctrl/Cmd + Shift + P</strong> — Novo produto</li>
          <li><strong>Ctrl/Cmd + Shift + F</strong> — Dashboard Fiscal</li>
          <li><strong>Esc</strong> — Fechar modal/drawer atual</li>
          <li><strong>Ctrl/Cmd + [1-9]</strong> — Navegação rápida pelos módulos</li>
        </ul>
      </DialogContent>
    </Dialog>
  );
}
