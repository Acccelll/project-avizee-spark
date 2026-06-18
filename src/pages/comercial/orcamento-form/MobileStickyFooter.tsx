import { Save, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type { OrcamentoItem } from "@/components/Orcamento/OrcamentoItemsGrid";

interface MobileStickyFooterProps {
  items: OrcamentoItem[];
  valorTotal: number;
  saving: boolean;
  onSave: () => void;
  onPreview: () => void;
  onGeneratePdf: () => void;
}

/** Rodapé fixo mobile com total, salvar e ações de PDF — posicionado acima do MobileBottomNav. */
export function MobileStickyFooter({
  items,
  valorTotal,
  saving,
  onSave,
  onPreview,
  onGeneratePdf,
}: MobileStickyFooterProps) {
  const qtd = items.filter((i) => i.produto_id).length;
  return (
    <div
      className={cn(
        "md:hidden fixed inset-x-0 z-30",
        "bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85",
        "border-t shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.10)]",
        "px-3 py-2",
      )}
      style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-base font-bold text-primary font-mono truncate">{formatCurrency(valorTotal)}</p>
          <p className="text-[10px] text-muted-foreground">
            {qtd} {qtd === 1 ? "item" : "itens"}
          </p>
        </div>
        <Button onClick={onSave} disabled={saving} className="h-10 gap-2 flex-1 max-w-[160px]">
          <Save className="w-4 h-4" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={onPreview}
          className="h-11 w-11"
          aria-label="Visualizar proposta"
          title="Visualizar proposta em PDF"
        >
          <Eye className="w-4 h-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={onGeneratePdf}
          className="h-11 w-11"
          aria-label="Gerar PDF"
          title="Baixar PDF"
        >
          <FileText className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}