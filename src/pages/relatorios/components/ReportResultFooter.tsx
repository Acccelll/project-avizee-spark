/**
 * ReportResultFooter — footer do DataTable com totais destacados.
 *
 * Substitui o `<div bg-muted/30 text-xs text-muted-foreground>` antigo por um
 * bloco com tipografia destacada (uppercase label + bold tabular-nums valor),
 * facilitando a leitura dos totalizadores em relatórios financeiros.
 */

import { formatCurrency, formatNumber } from "@/lib/format";

export interface FooterTotalCol {
  key: string;
  label: string;
  format?: string;
  emphasize?: boolean;
}

export interface ReportResultFooterProps {
  rows: Record<string, unknown>[];
  cols: FooterTotalCol[];
}

export function ReportResultFooter({ rows, cols }: ReportResultFooterProps) {
  if (!rows.length || !cols.length) return null;

  return (
    <div className="border-t bg-muted/40 px-4 py-3">
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        {cols.map((col) => {
          const total = rows.reduce((s, r) => s + Number(r[col.key] || 0), 0);
          const formatted =
            col.format === "currency" ? formatCurrency(total) : formatNumber(total);
          return (
            <div key={col.key} className={`flex flex-col ${col.emphasize ? 'rounded-md bg-background px-2 py-1 ring-1 ring-primary/20' : ''}`}>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                {col.label}
              </span>
              <span className="text-base font-bold tabular-nums text-foreground leading-tight">
                {formatted}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
