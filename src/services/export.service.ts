/**
 * Centralised export service for the Reports module.
 *
 * Provides three export formats:
 *   - CSV  (synchronous, plain text)
 *   - Excel (.xlsx via exceljs)
 *   - PDF   (jsPDF, landscape A4, dynamic column widths)
 *
 * All public functions accept the same `ExportPayload` so callers do not need
 * to know the underlying library.
 *
 * When `columns` is provided in ExportOptions, exports use the config-defined
 * order, labels and format hints — matching exactly what the user sees on screen.
 * When `columns` is omitted, raw object keys are used as a fallback.
 */

import { downloadTextFile } from "@/lib/utils";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import type { RelatorioResultado } from "@/services/relatorios.service";
import type { ColumnFormat } from "@/config/relatoriosConfig";

export interface EmpresaInfo {
  razao_social?: string;
  cnpj?: string;
  nome_fantasia?: string;
}

/** Minimal column descriptor used by the export layer. */
export interface ExportColumnDef {
  key: string;
  label: string;
  format?: ColumnFormat;
}

export interface ExportOptions {
  /** Report title used as the file name */
  titulo: string;
  /** Rows to export. Each object is one row; keys are column names. */
  rows: Record<string, unknown>[];
  /**
   * Optional ordered column definitions.
   * When provided: exports use this ordering, labels and format hints.
   * When absent: raw object keys are used (legacy behaviour).
   */
  columns?: ExportColumnDef[];
  /** Optional empresa info for the PDF header */
  empresa?: EmpresaInfo | null;
  /** Date range label for PDF header */
  dataInicio?: string;
  dataFim?: string;
  /** Full report result (used for PDF subtitle) */
  resultado?: RelatorioResultado;
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

/**
 * Exports `rows` as a semicolon-delimited CSV file and triggers a browser
 * download.
 *
 * When `columns` is provided, uses the config-defined order and labels.
 */
export function exportarParaCsv(options: ExportOptions): void {
  const { titulo, rows, columns } = options;

  if (!rows.length) {
    downloadTextFile(`${titulo}.csv`, "Sem dados para exportação");
    return;
  }

  if (columns?.length) {
    // Config-driven: use label as header, format-aware cell rendering
    const header = columns.map((c) => `"${c.label}"`).join(";");
    const body = rows.map((row) =>
      columns.map((c) => formatCsvCellTyped(row[c.key], c.format)).join(";")
    );
    const csv = [header, ...body].join("\n");
    downloadTextFile(`${titulo}.csv`, csv, "text/csv;charset=utf-8");
  } else {
    // Legacy fallback: raw keys as headers
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(";"),
      ...rows.map((row) =>
        headers.map((h) => formatCsvCell(row[h])).join(";")
      ),
    ].join("\n");
    downloadTextFile(`${titulo}.csv`, csv, "text/csv;charset=utf-8");
  }
}

function formatCsvCell(value: unknown): string {
  if (typeof value === "number") return value.toString().replace(".", ",");
  if (value == null) return "";
  return `"${String(value).split('"').join('""')}"`;
}

/** Format-aware CSV cell formatting using ColumnFormat hints. */
function formatCsvCellTyped(value: unknown, format?: string): string {
  if (value == null) return "";
  if (typeof value === "number") {
    if (format === "currency") return formatCurrency(value).replace(/\./g, "").replace(",", ".");
    if (format === "percent") return `${value.toFixed(1)}%`;
    return value.toString().replace(".", ",");
  }
  if (typeof value === "string" && format === "date" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return formatDate(value);
  }
  return `"${String(value).split('"').join('""')}"`;
}

// ─── Excel ───────────────────────────────────────────────────────────────────

/**
 * Exports `rows` as an .xlsx file using exceljs.
 *
 * When `columns` is provided, uses the config-defined order, labels and format.
 */
export async function exportarParaExcel(options: ExportOptions): Promise<void> {
  const { titulo, rows, columns } = options;
  if (!rows.length) return;

  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(titulo.slice(0, 31));

  if (columns?.length) {
    // Config-driven: use labels as headers and format cells by type
    const headers = columns.map((c) => c.label);
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8E8E8" },
    };

    rows.forEach((row) => {
      const values = columns.map((c) => {
        const v = row[c.key];
        if (v == null) return "";
        if (typeof v === "number") return v; // Excel keeps as number for native formatting
        if (typeof v === "string" && c.format === "date" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
          return formatDate(v);
        }
        return v;
      });
      sheet.addRow(values);
    });
  } else {
    // Legacy fallback
    const headers = Object.keys(rows[0]);
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8E8E8" },
    };
    rows.forEach((row) => {
      sheet.addRow(headers.map((h) => row[h] ?? ""));
    });
  }

  sheet.columns.forEach((col) => {
    let maxLen = 10;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      maxLen = Math.max(maxLen, String(cell.value ?? "").length + 2);
    });
    col.width = Math.min(maxLen, 50);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${titulo}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

/** Maximum rows included in a PDF export (file-size / render time constraint). */
export const PDF_MAX_ROWS = 200;

/**
 * Builds a jsPDF document from the report result and triggers a browser
 * download.
 */
export async function exportarParaPdf(options: ExportOptions): Promise<void> {
  const { titulo, rows, columns, empresa, dataInicio = "", dataFim = "", resultado } = options;

  const doc = await buildPdfDocument({
    titulo: resultado?.title ?? titulo,
    subtitulo: resultado?.subtitle ?? "",
    rows,
    columns,
    empresa: empresa ?? null,
    dataInicio,
    dataFim,
  });

  doc.save(`${resultado?.title ?? titulo}.pdf`);
}

interface PdfBuildParams {
  titulo: string;
  subtitulo: string;
  rows: Record<string, unknown>[];
  columns?: ExportColumnDef[];
  empresa: EmpresaInfo | null;
  dataInicio: string;
  dataFim: string;
}

/** Returns a configured jsPDF document (landscape A4). */
export async function buildPdfDocument(params: PdfBuildParams) {
  const { titulo, subtitulo, rows, columns, empresa, dataInicio, dataFim } = params;
  const { default: jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 20;

  // Company header
  if (empresa?.razao_social) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(empresa.razao_social, margin, y);
    y += 4;
    if (empresa.cnpj) {
      doc.setFont("helvetica", "normal");
      doc.text(`CNPJ: ${empresa.cnpj}`, margin, y);
      y += 4;
    }
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  }

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(titulo || "Relatório", margin, y);
  y += 7;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(subtitulo || "", margin, y);
  y += 4;
  const periodoText =
    dataInicio || dataFim
      ? `Período: ${dataInicio || "—"} a ${dataFim || "—"}`
      : `Gerado em: ${new Date().toLocaleDateString("pt-BR")}`;
  doc.text(periodoText, margin, y);
  y += 8;

  if (rows.length > 0) {
    // Determine columns to render: prefer config columns, fallback to raw keys
    const colDefs: Array<{ key: string; label: string; format?: string }> = columns?.length
      ? columns
      : Object.keys(rows[0]).map((k) => ({
          key: k,
          label: k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
        }));

    const contentWidth = pageWidth - margin * 2;

    // Dynamic column widths based on label + sample data
    const maxCharsPerCol = colDefs.map((col) => {
      let maxLen = col.label.length;
      const sample = rows.slice(0, 50);
      for (const row of sample) {
        const val = String(formatCellValuePdf(row[col.key], col.key, col.format) ?? "");
        if (val.length > maxLen) maxLen = val.length;
      }
      return Math.min(maxLen, 35);
    });
    const totalChars = maxCharsPerCol.reduce((s, c) => s + c, 0) || 1;
    const colWidths = maxCharsPerCol.map((c) =>
      Math.max((c / totalChars) * contentWidth, 12)
    );

    // Header row
    doc.setFillColor(105, 5, 0);
    doc.rect(margin, y, contentWidth, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    let xPos = margin;
    colDefs.forEach((col, i) => {
      doc.text(col.label.substring(0, 25), xPos + 1.5, y + 5, {
        maxWidth: colWidths[i] - 2,
      });
      xPos += colWidths[i];
    });
    y += 7;

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);

    const maxRows = Math.min(rows.length, PDF_MAX_ROWS);
    if (rows.length > PDF_MAX_ROWS) {
      y += 10;
      if (y > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(8);
      doc.setFont("helvetica", "bolditalic");
      doc.setTextColor(180, 0, 0);
      doc.text(
        `⚠ PDF limitado a ${PDF_MAX_ROWS} de ${rows.length} registros. Use "Exportar Excel" para o relatório completo.`,
        margin,
        y
      );
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
    }

    for (let r = 0; r < maxRows; r++) {
      if (y > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = 15;
      }
      if (r % 2 === 0) {
        doc.setFillColor(245, 245, 240);
        doc.rect(margin, y, contentWidth, 6, "F");
      }
      xPos = margin;
      colDefs.forEach((col, i) => {
        const val = String(formatCellValuePdf(rows[r][col.key], col.key, col.format) ?? "");
        doc.text(val.substring(0, 35), xPos + 1.5, y + 4, {
          maxWidth: colWidths[i] - 2,
        });
        xPos += colWidths[i];
      });
      y += 6;
    }

    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(`Total de registros: ${rows.length}`, margin, y);
  }

  return doc;
}

/** Formats a cell value for PDF rendering using config format hint when available. */
function formatCellValuePdf(value: unknown, key: string, format?: string): string | number {
  if (typeof value === "number") {
    if (format === "currency") return formatCurrency(value);
    if (format === "percent") return `${value.toFixed(1)}%`;
    if (format === "quantity" || format === "number") return formatNumber(value);
    // Legacy heuristic fallback when no format hint provided
    if (
      ["valor", "custo", "venda", "entrada", "saida"].some((f) =>
        key.toLowerCase().includes(f)
      )
    ) {
      return formatCurrency(value);
    }
    return formatNumber(value);
  }
  if (typeof value === "string" && (format === "date" || /^\d{4}-\d{2}-\d{2}/.test(value))) {
    return formatDate(value);
  }
  return (value ?? "-") as string;
}

// ─── Web Worker CSV ──────────────────────────────────────────────────────────

/**
 * Generates a CSV string off the main thread using a Web Worker.
 * Useful for large datasets (>10k rows) to avoid blocking the UI.
 *
 * @param rows    Array of objects mapping column label → value
 * @param columns Column definitions with key and label
 * @returns Resolves with the CSV string
 */
export function generateCSVViaWorker(
  rows: Record<string, unknown>[],
  columns: ExportColumnDef[],
): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./exportWorker.ts', import.meta.url),
      { type: 'module' },
    );

    const id = crypto.randomUUID();

    worker.onmessage = (e: MessageEvent) => {
      const { type, id: responseId, csv, message } = e.data as {
        type: string;
        id: string;
        csv?: string;
        message?: string;
      };
      if (responseId !== id) return;

      worker.terminate();

      if (type === 'csv-done' && csv !== undefined) {
        resolve(csv);
      } else {
        reject(new Error(message ?? 'CSV generation failed'));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };

    worker.postMessage({ type: 'generate-csv', id, payload: { rows, columns } });
  });
}
