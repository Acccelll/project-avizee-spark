/**
 * Unified cell formatter used by every report surface (table, preview,
 * CSV / Excel / PDF exporters). Centralising the logic here keeps the on-
 * screen value, the printed value and the exported value in sync.
 *
 * Resolution order for numeric values:
 *   1. explicit `format` hint coming from `ReportColumnDef.format`
 *      (currency / percent / quantity / number / date)
 *   2. `isQuantityReport` flag — forces plain number formatting
 *   3. legacy substring heuristic on the column key
 *      (valor / custo / venda / entrada / saida → currency)
 *
 * The `mode` argument selects the output flavour:
 *   - `display`  → string ready for UI / PDF (currency symbol, locale date)
 *   - `csv`      → string ready for a semicolon-delimited CSV cell, with
 *                  numeric values kept as machine-readable strings (dot
 *                  decimal) and text values quoted.
 *   - `excel`    → preserves native types (number, string) so exceljs can
 *                  apply its own formatting; dates are still pre-rendered
 *                  as locale strings.
 */

import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import type { ColumnFormat } from "@/config/relatoriosConfig";

export type FormatMode = "display" | "csv" | "excel";

export interface FormatReportCellOptions {
  format?: ColumnFormat | string;
  isQuantityReport?: boolean;
  mode?: FormatMode;
}

const CURRENCY_KEY_HINTS = ["valor", "custo", "venda", "entrada", "saida"];
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

function looksLikeCurrencyKey(key: string): boolean {
  const lower = key.toLowerCase();
  return CURRENCY_KEY_HINTS.some((hint) => lower.includes(hint));
}

function csvQuote(value: string): string {
  return `"${value.split('"').join('""')}"`;
}

/**
 * Single source of truth for cell formatting across UI and exporters.
 */
export function formatReportCell(
  value: unknown,
  key: string,
  options: FormatReportCellOptions = {},
): string | number {
  const { format, isQuantityReport = false, mode = "display" } = options;

  if (value == null) {
    return mode === "display" ? "-" : "";
  }

  if (typeof value === "number") {
    // Resolve effective format
    const effective: string | undefined =
      format ??
      (isQuantityReport ? "quantity" : looksLikeCurrencyKey(key) ? "currency" : "number");

    if (mode === "excel") {
      // Keep raw number so Excel handles formatting, except for percent which
      // we render as a string because we don't store a 0-1 ratio.
      if (effective === "percent") return `${value.toFixed(1)}%`;
      return value;
    }

    if (mode === "csv") {
      if (effective === "currency") {
        // Use dot decimal for spreadsheet import friendliness
        return value.toFixed(2);
      }
      if (effective === "percent") return `${value.toFixed(1)}%`;
      // Use comma decimal for pt-BR Excel desktop opening the CSV
      return value.toString().replace(".", ",");
    }

    // mode === "display"
    if (effective === "currency") return formatCurrency(value);
    if (effective === "percent") return `${value.toFixed(1)}%`;
    return formatNumber(value);
  }

  if (typeof value === "string") {
    if (format === "date" || ISO_DATE_RE.test(value)) {
      const formatted = formatDate(value);
      if (mode === "csv") return csvQuote(formatted);
      return formatted;
    }
    if (mode === "csv") return csvQuote(value);
    return value;
  }

  // Booleans / objects fall through to string coercion
  const coerced = String(value);
  if (mode === "csv") return csvQuote(coerced);
  return coerced;
}

/**
 * Backwards-compatible wrapper preserved so existing callers (UI tables,
 * preview document, tests) keep working without churn.
 *
 * @deprecated prefer `formatReportCell(value, key, { isQuantityReport, format, mode: "display" })`
 */
export function formatCellValue(value: unknown, key: string, isQuantityReport = false) {
  return formatReportCell(value, key, { isQuantityReport, mode: "display" });
}