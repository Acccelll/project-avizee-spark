import { formatCurrency, formatDate, formatWeightKg } from "@/lib/format";
import type { OrcamentoItem } from "@/components/Orcamento/OrcamentoItemsGrid";

interface MidSummaryBarProps {
  items: OrcamentoItem[];
  pesoTotal: number;
  validade?: string;
  valorTotal: number;
}

/** Resumo fixo (md→lg, sem sidebar) com itens, peso, validade e total. */
export function MidSummaryBar({ items, pesoTotal, validade, valorTotal }: MidSummaryBarProps) {
  const qtd = items.filter((i) => i.produto_id).length;
  return (
    <div
      className="hidden md:flex lg:hidden fixed inset-x-0 z-20 items-center justify-between gap-4 border-t bg-background/95 backdrop-blur px-6 py-3 shadow-[0_-4px_12px_-4px_hsl(var(--border))]"
      style={{ bottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-center gap-6 text-sm">
        <span className="text-muted-foreground">
          {qtd} {qtd === 1 ? "item" : "itens"}
        </span>
        {pesoTotal > 0 && (
          <span className="text-muted-foreground">{formatWeightKg(pesoTotal)}</span>
        )}
        {validade && (
          <span
            className={
              new Date(validade) < new Date(new Date().toDateString())
                ? "text-destructive font-medium"
                : "text-muted-foreground"
            }
          >
            Val. {formatDate(validade)}
          </span>
        )}
      </div>
      <div className="font-bold text-lg font-mono text-primary">
        {formatCurrency(valorTotal)}
      </div>
    </div>
  );
}