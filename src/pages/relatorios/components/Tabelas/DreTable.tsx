/**
 * DreTable — renders the DRE (Demonstrativo de Resultado) in its structured
 * accounting layout: headers, subtotals, deductions, and final result.
 */

import { formatCurrency } from "@/lib/format";
import type { DreRow } from "@/types/relatorios";

export interface DreTableProps {
  rows: DreRow[];
}

export function DreTable({ rows }: DreTableProps) {
  if (!rows.length) {
    return (
      <div className="p-6 text-sm text-muted-foreground text-center">
        Sem dados para o período selecionado.
      </div>
    );
  }

  return (
    <div className="p-4">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={
                row.tipo === "header"
                  ? "bg-primary/5 font-bold"
                  : row.tipo === "subtotal"
                  ? "bg-muted/50 font-semibold border-t"
                  : row.tipo === "resultado"
                  ? "bg-primary/10 font-bold text-lg border-t-2 border-primary/30"
                  : "text-muted-foreground"
              }
            >
              <td
                className={`px-4 py-3 ${
                  row.tipo === "deducao" ? "pl-8" : ""
                }`}
              >
                {row.linha}
              </td>
              <td
                className={`px-4 py-3 text-right font-mono ${
                  row.valor < 0 ? "text-destructive" : ""
                }`}
              >
                {formatCurrency(row.valor)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
