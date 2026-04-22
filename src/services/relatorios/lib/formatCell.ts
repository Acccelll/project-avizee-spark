/**
 * Cell formatter used by report tables and CSV/Excel exporters.
 *
 * Heuristic: numbers in monetary-looking columns get currency formatting,
 * ISO-date strings get locale date formatting. For "quantity" reports
 * (movimentos de estoque, estoque mínimo) numbers always render as plain
 * numbers regardless of column key.
 */

import { formatCurrency, formatDate, formatNumber } from "@/lib/format";

export function formatCellValue(value: unknown, key: string, isQuantityReport = false) {
  if (typeof value === "number") {
    if (isQuantityReport) {
      return formatNumber(value);
    }
    if (["valor", "custo", "venda", "entrada", "saida"].some((field) => key.toLowerCase().includes(field))) {
      return formatCurrency(value);
    }
    return formatNumber(value);
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return formatDate(value);
  }

  return value ?? "-";
}